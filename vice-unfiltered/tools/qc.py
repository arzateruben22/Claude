#!/usr/bin/env python3
"""Vice Unfiltered export QC (master prompt section 7.8).

Usage: python3 -I qc.py <video.mp4> <out_dir> [--at 7.0,8.5,12.2]

Writes <out_dir>/QC_REPORT.txt and <out_dir>/QC_FRAMES.jpg (frames at 0 s,
every --at time, 1 s before the end and the final frame). Exit code 0 only if
every hard check passes. Times passed with --at are the hook, each meme
insert, each transition and each freeze from the job's EDL.
"""
import json
import os
import re
import struct
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def fps_of(rate):
    n, d = (rate or "0/1").split("/")
    return int(n) / int(d) if int(d) else 0.0


def faststart(path):
    """True if the moov atom comes before mdat at the top level."""
    with open(path, "rb") as f:
        while True:
            head = f.read(8)
            if len(head) < 8:
                return False
            size, kind = struct.unpack(">I4s", head)
            if size == 1:
                size = struct.unpack(">Q", f.read(8))[0] - 8
            if kind == b"moov":
                return True
            if kind == b"mdat":
                return False
            f.seek(size - 8, 1)


def main():
    src, out = sys.argv[1], sys.argv[2]
    extra = []
    if "--at" in sys.argv:
        extra = [float(t) for t in sys.argv[sys.argv.index("--at") + 1].split(",") if t]
    os.makedirs(out, exist_ok=True)
    checks, notes = [], []

    def check(name, ok, detail):
        checks.append(("PASS" if ok else "FAIL", name, detail))

    if not os.path.isfile(src) or os.path.getsize(src) == 0:
        print(f"FAIL file missing or empty: {src}")
        sys.exit(1)

    info = json.loads(run(["ffprobe", "-v", "error", "-print_format", "json",
                           "-show_format", "-show_streams", src]).stdout or "{}")
    v = next((s for s in info.get("streams", []) if s["codec_type"] == "video"), None)
    a = next((s for s in info.get("streams", []) if s["codec_type"] == "audio"), None)
    dur = float(info.get("format", {}).get("duration", 0))

    check("video stream", v is not None, v and v["codec_name"])
    if v:
        check("1080x1920", (v["width"], v["height"]) == (1080, 1920), f'{v["width"]}x{v["height"]}')
        check("H.264", v["codec_name"] == "h264", v["codec_name"])
        check("yuv420p", v.get("pix_fmt") == "yuv420p", v.get("pix_fmt"))
        r, avg = fps_of(v.get("r_frame_rate")), fps_of(v.get("avg_frame_rate"))
        check("constant frame rate", abs(r - avg) < 0.01 and round(r) in (30, 60), f"r={r:.3f} avg={avg:.3f}")
    check("audio stream", a is not None, a and a["codec_name"])
    if a:
        check("AAC 48 kHz stereo", a["codec_name"] == "aac" and a.get("sample_rate") == "48000"
              and a.get("channels") == 2, f'{a["codec_name"]} {a.get("sample_rate")} Hz {a.get("channels")} ch')
        vd, ad = float(v.get("duration", dur)) if v else dur, float(a.get("duration", dur))
        check("audio covers video", ad >= vd - 0.1, f"video {vd:.3f}s audio {ad:.3f}s")
    check("faststart", faststart(src), "moov before mdat")

    dec = run(["ffmpeg", "-hide_banner", "-v", "error", "-i", src, "-f", "null", "-"])
    errs = [l for l in dec.stderr.splitlines() if l.strip()]
    check("full decode clean", dec.returncode == 0 and not errs, f"{len(errs)} errors" + (f": {errs[0]}" if errs else ""))

    if a:
        loud = run(["ffmpeg", "-hide_banner", "-nostats", "-i", src, "-map", "0:a:0",
                    "-af", "ebur128=peak=true", "-f", "null", "-"]).stderr
        i = re.findall(r"I:\s+(-?[\d.]+) LUFS", loud)
        tp = re.findall(r"Peak:\s+(-?[\d.]+|-inf) dBFS", loud)
        lufs = float(i[-1]) if i else None
        tpk = float(tp[-1]) if tp and tp[-1] != "-inf" else None
        check("loudness -16..-13 LUFS", lufs is not None and -16.5 <= lufs <= -13.0, f"{lufs} LUFS")
        check("true peak <= -1 dBTP", tpk is not None and tpk <= -1.0, f"{tpk} dBTP")
        sil = run(["ffmpeg", "-hide_banner", "-nostats", "-i", src, "-map", "0:a:0",
                   "-af", "silencedetect=n=-50dB:d=0.5", "-f", "null", "-"]).stderr
        gaps = re.findall(r"silence_start: ([\d.]+)", sil)
        check("no silent gaps >= 0.5 s", not gaps, ", ".join(f"{float(g):.2f}s" for g in gaps) or "none")

    blk = run(["ffmpeg", "-hide_banner", "-nostats", "-i", src, "-map", "0:v:0",
               "-vf", "blackdetect=d=0.05:pix_th=0.06", "-an", "-f", "null", "-"]).stderr
    blacks = re.findall(r"black_start:([\d.]+) black_end:([\d.]+)", blk)
    check("no black frames", not blacks, ", ".join(f"{float(s):.2f}-{float(e):.2f}s" for s, e in blacks) or "none")

    frz = run(["ffmpeg", "-hide_banner", "-nostats", "-i", src, "-map", "0:v:0",
               "-vf", "freezedetect=n=0.001:d=0.5", "-an", "-f", "null", "-"]).stderr
    freezes = re.findall(r"freeze_start: ([\d.]+)", frz)
    notes.append("freezes >= 0.5 s (confirm each is an intended freeze/still): "
                 + (", ".join(f"{float(t):.2f}s" for t in freezes) or "none"))

    # frame grabs
    times = sorted({0.0, *[t for t in extra if 0 <= t < dur], max(0.0, dur - 1.0)})
    frames = []
    for t in times:
        p = os.path.join(out, f"frame_{t:07.3f}.png")
        run(["ffmpeg", "-hide_banner", "-v", "error", "-y", "-ss", f"{t:.3f}", "-i", src, "-frames:v", "1", p])
        frames.append((f"{t:.2f}s", p))
    last = os.path.join(out, "frame_last.png")
    run(["ffmpeg", "-hide_banner", "-v", "error", "-y", "-sseof", "-0.05", "-i", src, "-update", "1", "-frames:v", "1", last])
    frames.append(("last", last))
    ims = [(lbl, Image.open(p).convert("RGB")) for lbl, p in frames if os.path.exists(p)]
    check("frame grabs", len(ims) == len(frames), f"{len(ims)}/{len(frames)}")
    if ims:
        h = 640
        ims = [(l, im.resize((int(im.width * h / im.height), h))) for l, im in ims]
        sheet = Image.new("RGB", (sum(i.width + 8 for _, i in ims) + 8, h + 44), (30, 30, 30))
        d = ImageDraw.Draw(sheet)
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
        except OSError:
            font = ImageFont.load_default()
        x = 8
        for lbl, im in ims:
            sheet.paste(im, (x, 8))
            d.text((x + 4, h + 14), lbl, fill=(255, 255, 255), font=font)
            x += im.width + 8
        sheet.save(os.path.join(out, "QC_FRAMES.jpg"), quality=88)

    failed = [c for c in checks if c[0] == "FAIL"]
    lines = [f"QC  {os.path.basename(src)}", f"size {os.path.getsize(src)/1e6:.2f} MB  duration {dur:.3f}s", ""]
    lines += [f"{s}  {n:26} {d}" for s, n, d in checks] + [""] + [f"NOTE {n}" for n in notes]
    lines += ["", f"RESULT: {'PASS' if not failed else f'FAIL ({len(failed)} checks)'}",
              "Visual review of QC_FRAMES.jpg is still required before delivery."]
    report = "\n".join(lines)
    with open(os.path.join(out, "QC_REPORT.txt"), "w") as f:
        f.write(report + "\n")
    print(report)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
