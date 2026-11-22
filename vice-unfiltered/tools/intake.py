#!/usr/bin/env python3
"""Intake an uploaded source video for a streamer.

Usage (from the vice-unfiltered folder):
    python3 -I tools/intake.py <uploaded_file> <Streamer> [--no-copy]

- Copies the file into sources/<Streamer>/ keeping its original name (the
  8-hex upload prefix the chat adds, e.g. "579c122d-", is dropped). Never
  overwrites: an identical file is reused, a different file with the same name
  gets a numbered suffix. --no-copy probes the file where it is (for tests).
- Writes work/intake/<name>/: contact sheets (one frame per second, or wider
  spacing for long files), loudness.csv (per-second max momentary LUFS),
  timestamps.txt, and prints a summary: duration, fps, size, audio, the
  loudest seconds (reaction candidates) and any duplicate/missing frames.
"""
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for c in iter(lambda: f.read(1 << 20), b""):
            h.update(c)
    return h.hexdigest()


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def main():
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    up, streamer = sys.argv[1], sys.argv[2]
    no_copy = "--no-copy" in sys.argv
    if not os.path.isfile(up):
        raise SystemExit(f"not found: {up}")
    name = re.sub(r"^[0-9a-f]{8}-", "", os.path.basename(up))
    if no_copy:
        dest = up
    else:
        ddir = os.path.join(ROOT, "sources", streamer)
        os.makedirs(ddir, exist_ok=True)
        dest = os.path.join(ddir, name)
        stem, ext = os.path.splitext(name)
        k = 2
        while os.path.exists(dest) and sha256(dest) != sha256(up):
            dest = os.path.join(ddir, f"{stem}_{k}{ext}")
            k += 1
        if not os.path.exists(dest):
            shutil.copy2(up, dest)
    stem = os.path.splitext(os.path.basename(dest))[0]
    out = os.path.join(ROOT, "work", "intake", stem)
    os.makedirs(out, exist_ok=True)

    info = json.loads(run(["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams",
                           dest]).stdout or "{}")
    v = next((s for s in info.get("streams", []) if s["codec_type"] == "video"), None)
    a = next((s for s in info.get("streams", []) if s["codec_type"] == "audio"), None)
    if not v:
        raise SystemExit("no video stream")
    dur = float(info["format"]["duration"])
    rf = lambda r: (lambda n, d: int(n) / int(d) if int(d) else 0)(*r.split("/"))  # noqa: E731
    r_fps, avg_fps = rf(v["r_frame_rate"]), rf(v["avg_frame_rate"])
    lines = [f"file      {os.path.relpath(dest, ROOT)}",
             f"sha256    {sha256(dest)}",
             f"duration  {dur:.3f}s   size {os.path.getsize(dest) / 1e6:.1f} MB",
             f"video     {v['codec_name']} {v['width']}x{v['height']} r_fps {r_fps:.3f} avg_fps {avg_fps:.3f}"
             + ("  (VARIABLE frame rate)" if abs(r_fps - avg_fps) > 0.05 else ""),
             f"audio     " + (f"{a['codec_name']} {a.get('sample_rate')} Hz {a.get('channels')} ch" if a else "NONE")]

    # contact sheets: 1 fps up to 10 min, wider spacing beyond; 60 tiles per sheet
    step = max(1, math.ceil(dur / 600))
    tile_w = 256 if v["width"] >= v["height"] else 144
    run(["ffmpeg", "-hide_banner", "-v", "error", "-y", "-i", dest, "-vf",
         f"fps=1/{step},scale={tile_w}:-2,drawtext=fontfile={FONT}:text='%{{pts\\:hms}}':x=4:y=4:fontsize=14:"
         f"fontcolor=yellow:box=1:boxcolor=black@0.6,tile=10x6:padding=3:color=gray",
         "-fps_mode", "passthrough", os.path.join(out, "sheet_%03d.jpg")])
    sheets = sorted(f for f in os.listdir(out) if f.startswith("sheet_"))
    lines.append(f"sheets    {len(sheets)} contact sheet(s), one frame every {step}s -> {os.path.relpath(out, ROOT)}/")

    # loudness timeline (max momentary per second)
    if a:
        txt = run(["ffmpeg", "-hide_banner", "-nostats", "-i", dest, "-map", "0:a:0", "-af", "ebur128",
                   "-f", "null", "-"]).stderr
        per = {}
        for t, m in re.findall(r"t:\s*([\d.]+)\s+TARGET.*?M:\s*(-?[\d.]+|-inf)", txt):
            s = int(float(t))
            val = -120.0 if m == "-inf" else float(m)
            per[s] = max(per.get(s, -120.0), val)
        with open(os.path.join(out, "loudness.csv"), "w") as f:
            f.write("second,max_momentary_lufs\n" + "".join(f"{s},{per[s]:.1f}\n" for s in sorted(per)))
        loud = sorted(per.items(), key=lambda kv: -kv[1])[:10]
        lines.append("loudest   " + ", ".join(f"{s // 60}:{s % 60:02d} ({l:.0f})" for s, l in sorted(loud)))
        quiet = [s for s in sorted(per) if per[s] < -40]
        runs, start = [], None
        for s in quiet + [None]:
            if start is None:
                start = prev = s
            elif s is not None and s == prev + 1:
                prev = s
            else:
                if start is not None and prev - start >= 2:
                    runs.append((start, prev))
                start = prev = s
        if runs:
            lines.append("quiet     " + ", ".join(f"{a_ // 60}:{a_ % 60:02d}-{b // 60}:{b % 60:02d}" for a_, b in runs[:12])
                         + " (below -40 LUFS for 3 s or more)")

    # timestamp irregularities
    pts = sorted(float(x) for x in run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                                         "packet=pts_time", "-of", "csv=p=0", dest]).stdout.split() if x not in ("", "N/A"))
    exp = 1 / avg_fps if avg_fps else 1 / 30
    gaps = [(pts[i], pts[i + 1] - pts[i]) for i in range(len(pts) - 1) if pts[i + 1] - pts[i] > exp * 1.5]
    dups = [pts[i] for i in range(len(pts) - 1) if pts[i + 1] - pts[i] < exp * 0.25]
    missing = sum(round(d / exp) - 1 for _, d in gaps)
    with open(os.path.join(out, "timestamps.txt"), "w") as f:
        f.write(f"packets {len(pts)} expected step {exp:.5f}s\n")
        f.writelines(f"gap at {t:.3f}s: {d:.3f}s (~{round(d / exp) - 1} missing)\n" for t, d in gaps)
        f.writelines(f"duplicate pts near {t:.3f}s\n" for t in dups)
    lines.append(f"frames    {len(pts)} packets; {len(gaps)} gaps (~{missing} missing frames); {len(dups)} duplicate timestamps"
                 + (f"; first gaps at " + ", ".join(f"{t:.2f}s" for t, _ in gaps[:6]) if gaps else ""))
    report = "\n".join(lines)
    with open(os.path.join(out, "INTAKE.txt"), "w") as f:
        f.write(report + "\n")
    print(report)


if __name__ == "__main__":
    main()
