"""splice.py: re-render only a film's opening title and its end card, and splice them into the delivered master.

For changes that touch nothing but the title card's series line and the end card (a channel rename): the
frames in between are kept bit for bit (stream-copied from the delivered file, never re-encoded), and the sound
is the delivered file's own track, copied, so its loudness is unchanged.

  python3 -I kits/cinema/film/splice.py <episode> --name <new master name> [--title-out S] [--end-in S]
         [--overlap S] [--build DIR] [--keep]

  <episode>       an episode folder whose film.json already carries the new text, with one delivered
                  out/*-9x16.mp4 (the old master)
  --name          the new master's name, without -9x16.mp4 (e.g. reality-rulebook-001)
  --title-out     the last moment the title can be on screen (default: title.t1 + the 0.45 s exit + one frame)
  --end-in        the first moment the end card can be on screen (default: endCard - 0.35 s; physics starts its card 0.3 s early).
                  The overlap check below is the real guard: a name still on screen past a splice point fails it
  --overlap       extra seconds rendered past each splice point and compared with the delivered frames there,
                  which must match (default 0.5)

What it does:
 1. finds the delivered master's keyframes: the opening is replaced up to the first keyframe at or after
    --title-out (A), the ending from the last keyframe at or before --end-in (C);
 2. renders frames 0..A+overlap and C-overlap..end at the final tier with render.mjs (--keep-png, its own
    build folder), from this checkout;
 3. checks continuity: the overlap frames (where nothing changed) must match the delivered ones (PSNR 38 dB at
    full size, or 40 dB at quarter size for very fine textures that the delivery encode alone blurs);
 4. encodes 0..A and C..end from the PNGs with the delivery settings render.mjs uses; cuts A..C out of the
    delivered file at its keyframes without re-encoding; joins the three and muxes the delivered sound (copied);
 5. verifies: the frame count, a clean decode, the middle bit-identical to the delivered file's (framemd5),
    both new ends identical to their own encodes, sound and picture within one frame;
 6. writes out/<name>-9x16.mp4, its poster (<name>-9x16.jpg) and contact sheet (<name>-9x16-contact.jpg),
    and moves every old out/<old>-* file into the build folder (so qa.py and youtube1440.py see one master).
Then run qa.py and youtube1440.py as usual. Exit 0 done; 1 a check failed (nothing in out/ changed); 2 usage.
"""
import hashlib
import json
import math
import os
import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
RENDER = REPO / "kits" / "cinema" / "film" / "render.mjs"
COLOR = ["-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv"]
TO_YUV = "scale=in_range=full:out_range=tv:out_color_matrix=bt709"
# the delivery encode, as render.mjs --assemble runs it (CRF 15, preset slow)
DELIVERY = ["-c:v", "libx264", "-preset", "slow", "-crf", "15", "-maxrate", "20M", "-bufsize", "40M",
            "-x264-params", "aq-mode=3:deblock=-1,-1", "-pix_fmt", "yuv420p", "-profile:v", "high"]
PSNR_MIN = 38.0
PSNR_QUARTER_MIN = 40.0


def log(*a):
    print("[splice]", *a, flush=True)


def fail(msg, code=1):
    print(f"[splice] FAIL: {msg}", flush=True)
    sys.exit(code)


def run(cmd, **kw):
    r = subprocess.run([str(c) for c in cmd], capture_output=True, text=True, **kw)
    if r.returncode != 0:
        fail(f"{Path(str(cmd[0])).name} exited {r.returncode}: {' '.join(map(str, cmd))[:300]}\n{r.stderr[-2000:]}")
    return r


def ffmpeg(args):
    return run(["ffmpeg", "-hide_banner", "-nostdin", "-y", "-v", "error", *args])


def probe_json(f, *args):
    return json.loads(run(["ffprobe", "-v", "error", "-of", "json", *args, f]).stdout)


def count_frames(f):
    j = probe_json(f, "-select_streams", "v:0", "-count_frames", "-show_entries", "stream=nb_read_frames")
    return int(j["streams"][0]["nb_read_frames"])


def keyframes(f, fps):
    j = probe_json(f, "-select_streams", "v:0", "-skip_frame", "nokey", "-show_entries", "frame=pts_time")
    return sorted(round(float(x["pts_time"]) * fps) for x in j["frames"] if "pts_time" in x)


def framemd5(f, start=None, count=None, extra=()):
    """md5 of each decoded frame (from frame `start`, `count` frames) as a list of hex strings."""
    vf = []
    if start is not None:
        vf = ["-vf", f"select='between(n\\,{start}\\,{start + count - 1})'", "-fps_mode", "passthrough"]
    r = run(["ffmpeg", "-hide_banner", "-nostdin", "-v", "error", *extra, "-i", f, "-map", "0:v:0", *vf, "-f", "framemd5", "-"])
    return [ln.rsplit(",", 1)[1].strip() for ln in r.stdout.splitlines() if ln and not ln.startswith("#")]


def main(argv):
    if not argv or argv[0].startswith("-"):
        print(__doc__)
        return 2
    ep = Path(argv[0]).resolve()
    opt, i = {}, 1
    while i < len(argv):
        k = argv[i]
        if k == "--keep":
            opt["keep"] = True
            i += 1
            continue
        if i + 1 >= len(argv):
            fail(f"{k} needs a value", 2)
        opt[k.lstrip("-")] = argv[i + 1]
        i += 2
    if "name" not in opt:
        fail("--name <new master name> is required", 2)
    name = opt["name"].removesuffix("-9x16.mp4").removesuffix("-9x16")
    film = json.loads((ep / "film.json").read_text())
    fps, dur = int(film["fps"]), float(film["dur"])
    out = ep / "out"
    olds = sorted(p for p in out.glob("*-9x16.mp4") if p.name != f"{name}-9x16.mp4")
    if len(olds) != 1:
        fail(f"expected one delivered out/*-9x16.mp4 besides the new name, found {[p.name for p in olds]}", 2)
    old = olds[0]
    old_prefix = old.name.removesuffix("-9x16.mp4")
    total = count_frames(old)
    if abs(total - round(dur * fps)) > 1:
        fail(f"{old.name} has {total} frames; film.json says {dur} s at {fps} fps ({round(dur * fps)})")
    ov = round(float(opt.get("overlap", 0.5)) * fps)
    title_out = float(opt["title-out"]) if "title-out" in opt else float(film["title"]["t1"]) + 0.45 + 1 / fps
    end_in = float(opt["end-in"]) if "end-in" in opt else float(film["endCard"]) - 0.35
    keys = keyframes(old, fps)
    a = next((k for k in keys if k >= math.ceil(title_out * fps)), None)
    c = max((k for k in keys if k <= math.floor(end_in * fps)), default=None)
    if a is None or c is None or not (0 < a < c < total):
        fail(f"no usable keyframes: title out {title_out:.2f} s, end in {end_in:.2f} s, keyframes {keys}")
    log(f"{ep.relative_to(REPO)}: {old.name} ({total} frames) → {name}-9x16.mp4; new frames 0–{a - 1} and {c}–{total - 1} "
        f"({(a + total - c) / fps:.1f} s), kept {a}–{c - 1} ({(c - a) / fps:.1f} s, stream-copied)")

    build = Path(opt["build"]).resolve() if "build" in opt else ep / "build" / "splice"
    base = build / "final" / "9x16"
    work = build / "work"
    work.mkdir(parents=True, exist_ok=True)

    # 2. render the two ranges (render.mjs rounds --from/--to to frames; --to is exclusive)
    ranges = [(0, min(total, a + ov)), (max(0, c - ov), total)]
    env = dict(os.environ, CHROMIUM=os.environ.get("CHROMIUM", "/opt/pw-browsers/chromium"))
    for f0, f1 in ranges:
        cmd = ["node", RENDER, "--film", ep, "--tier", "final", "--build", build, "--keep-png",
               "--from", f"{f0 / fps:.6f}", "--to", f"{f1 / fps:.6f}", "--resume"]
        log("render", " ".join(str(x) for x in cmd[2:]))
        r = subprocess.run([str(x) for x in cmd], env=env)
        if r.returncode != 0:
            fail(f"render.mjs exited {r.returncode} for frames {f0}–{f1 - 1}")

    def png(f):
        p = base / "frames" / f"{f // (10 * fps):03d}" / f"{f:05d}.png"
        if not p.exists():
            fail(f"missing rendered frame {p.relative_to(REPO)} (render.mjs --chunk must be the default 10 s)")
        return p

    def seq(f0, f1, tag):
        d = work / tag
        shutil.rmtree(d, ignore_errors=True)
        d.mkdir(parents=True)
        for j, f in enumerate(range(f0, f1)):
            os.symlink(png(f), d / f"{j:05d}.png")
        return d / "%05d.png"

    # 3. continuity: where nothing changed, the new render must match the delivered frames
    # Full size first. A frame of very fine texture (a crowd of millions, a star field) loses detail to the
    # delivery encode alone, which can pull full-size PSNR under the bar with nothing changed; so a range that misses
    # at full size is compared again at quarter size (area-averaged), where codec loss fades and a changed word or
    # object does not. Calibrated on Possibility Lab No. 002: codec loss on its crowd, 35.7 dB full / 44.3 quarter;
    # the old series line against the new, 32.0 full / 34.3 quarter.
    def psnr(f0, f1, tag, quarter):
        q = ",scale=270:480:flags=area" if quarter else ""
        log_f = work / f"psnr{f0}{tag}.log"
        run(["ffmpeg", "-hide_banner", "-nostdin", "-v", "error", "-framerate", str(fps), "-i", seq(f0, f1, f"chk{f0}"),
             "-i", old, "-lavfi",
             f"[0:v]{TO_YUV},format=yuv420p{q},setpts=PTS-STARTPTS[x];"
             f"[1:v]select='between(n\\,{f0}\\,{f1 - 1})',setpts=PTS-STARTPTS,format=yuv420p{q}[y];[x][y]psnr=stats_file={log_f}",
             "-frames:v", str(f1 - f0), "-f", "null", "-"])
        vals = []
        for ln in log_f.read_text().splitlines():
            kv = dict(x.split(":", 1) for x in ln.split() if ":" in x)
            vals.append(float(kv["psnr_avg"]) if kv["psnr_avg"] != "inf" else 99.0)
        if len(vals) != f1 - f0:
            fail(f"continuity check compared {len(vals)} frames, expected {f1 - f0}")
        return min(vals), sum(vals) / len(vals)

    checks = [(a, min(total, a + ov)), (max(0, c - ov), c)]
    for f0, f1 in checks:
        if f1 <= f0:
            continue
        lo, mean = psnr(f0, f1, "", False)
        log(f"continuity {f0}–{f1 - 1}: PSNR mean {mean:.1f} dB, min {lo:.1f} dB (needs {PSNR_MIN})")
        if lo < PSNR_MIN:
            qlo, qmean = psnr(f0, f1, "q", True)
            log(f"continuity {f0}–{f1 - 1} at quarter size: PSNR mean {qmean:.1f} dB, min {qlo:.1f} dB (needs {PSNR_QUARTER_MIN})")
            if qlo < PSNR_QUARTER_MIN:
                fail(f"the new render differs from the delivered frames {f0}–{f1 - 1} where nothing should have changed "
                     f"(min PSNR {lo:.1f} dB, {qlo:.1f} dB at quarter size): the code or the film changed since the delivery. "
                     f"Render from the delivered commit.")

    # 4. the new ends, encoded straight from the PNGs with the delivery settings
    seg_a, seg_c, mid = work / "a.mp4", work / "c.mp4", work / "mid.mp4"
    for (f0, f1), seg in (((0, a), seg_a), ((c, total), seg_c)):
        ffmpeg(["-framerate", str(fps), "-i", seq(f0, f1, f"enc{f0}"), "-frames:v", str(f1 - f0), "-vf", TO_YUV,
                *DELIVERY, *COLOR, "-r", str(fps), "-fps_mode", "cfr", "-an", seg])
        if count_frames(seg) != f1 - f0:
            fail(f"{seg.name} decodes to {count_frames(seg)} frames, expected {f1 - f0}")
    # the middle: cut at the delivered keyframes, no re-encode
    for p in work.glob("part*.mp4"):
        p.unlink()
    ffmpeg(["-i", old, "-map", "0:v:0", "-c", "copy", "-f", "segment", "-segment_frames", f"{a},{c}",
            "-reset_timestamps", "1", "-segment_format", "mp4", work / "part%d.mp4"])
    parts = sorted(work.glob("part*.mp4"))
    if len(parts) != 3:
        fail(f"cutting the delivered file at frames {a} and {c} gave {len(parts)} parts")
    shutil.move(parts[1], mid)
    if count_frames(mid) != c - a:
        fail(f"the kept middle has {count_frames(mid)} frames, expected {c - a}")
    (work / "concat.txt").write_text("ffconcat version 1.0\n" + "".join(f"file '{p.name}'\n" for p in (seg_a, mid, seg_c)))
    video, part = work / "video.mp4", out / f"{name}-9x16.part.mp4"
    ffmpeg(["-f", "concat", "-safe", "0", "-i", work / "concat.txt", "-map", "0:v:0", "-c", "copy", video])
    ffmpeg(["-i", video, "-i", old, "-map", "0:v:0", "-map", "1:a:0", "-c", "copy", "-movflags", "+faststart", part])

    # 5. verify
    try:
        n = count_frames(part)
        if n != total:
            raise RuntimeError(f"the spliced file has {n} frames, expected {total}")
        r = subprocess.run(["ffmpeg", "-hide_banner", "-nostdin", "-v", "error", "-i", str(part), "-f", "null", "-"], capture_output=True, text=True)
        if r.returncode != 0 or r.stderr.strip():
            raise RuntimeError(f"the spliced file does not decode cleanly: {r.stderr.strip()[:400]}")
        got = framemd5(part)
        if len(got) != total:
            raise RuntimeError(f"framemd5 read {len(got)} frames, expected {total}")
        if got[a:c] != framemd5(old)[a:c]:
            raise RuntimeError("the kept middle is not bit-identical to the delivered file's frames")
        if got[:a] != framemd5(seg_a) or got[c:] != framemd5(seg_c):
            raise RuntimeError("a new end does not decode the same inside the spliced file as on its own")
        j = probe_json(part, "-show_entries", "stream=codec_type,duration,width,height,r_frame_rate")
        s = {x["codec_type"]: x for x in j["streams"]}
        dv, da = float(s["video"]["duration"]), float(s["audio"]["duration"])
        if abs(dv - da) > 1 / fps + 1e-6:
            raise RuntimeError(f"sound {da:.3f} s and picture {dv:.3f} s are more than one frame apart")
        if (s["video"]["width"], s["video"]["height"], s["video"]["r_frame_rate"]) != (1080, 1920, f"{fps}/1"):
            raise RuntimeError(f"unexpected stream {s['video']['width']}x{s['video']['height']} {s['video']['r_frame_rate']}")
    except RuntimeError as e:
        part.unlink(missing_ok=True)
        fail(str(e))
    log(f"verified: {total} frames, clean decode, frames {a}–{c - 1} bit-identical to {old.name}, sound copied "
        f"({da:.3f} s / {dv:.3f} s)")

    # 6. into out/: the old master's files move to the build folder, the new one takes its place
    keep = build / "old-out"
    keep.mkdir(parents=True, exist_ok=True)
    moved = []
    for p in sorted(out.glob(f"{old_prefix}-*")):
        shutil.move(p, keep / p.name)
        moved.append(p.name)
    final = out / f"{name}-9x16.mp4"
    part.rename(final)
    poster_t = float(film.get("poster") or 0.0)
    ffmpeg(["-ss", f"{poster_t:.6f}", "-i", final, "-frames:v", "1", "-q:v", "2", "-update", "1", out / f"{name}-9x16.jpg"])
    every = 2 * fps
    count = (total - 1) // every + 1
    cols, rows = min(count, 6), math.ceil(count / min(count, 6))
    font = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    label = f",drawtext=fontfile={font}:text='%{{eif\\:trunc(t+0.5)\\:d}}s':x=6:y=h-th-6:fontsize=16:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=4" if Path(font).exists() else ""
    ffmpeg(["-i", final, "-vf", f"select='not(mod(n\\,{every}))',scale=180:320{label},tile={cols}x{rows}:padding=6:margin=6:color=0x202020",
            "-frames:v", "1", "-q:v", "3", "-update", "1", out / f"{name}-9x16-contact.jpg"])
    sha = hashlib.sha256(final.read_bytes()).hexdigest()
    rec = {"film": str(ep.relative_to(REPO)), "from": old.name, "to": final.name, "frames": total, "fps": fps,
           "new": [[0, a], [c, total]], "kept": [a, c], "sha256": sha, "moved_to_build": moved}
    (build / "splice.json").write_text(json.dumps(rec, indent=1) + "\n")
    log(f"{final.relative_to(REPO)} {final.stat().st_size / 1048576:.1f} MB; moved {len(moved)} old file(s) to "
        f"{keep.relative_to(REPO)}: {', '.join(moved)}")
    if not opt.get("keep"):
        shutil.rmtree(base / "frames", ignore_errors=True)
        shutil.rmtree(work, ignore_errors=True)
    log("next: python3 -I kits/cinema/film/qa.py <ep> --json <ep>/build/qa-delivery.json; python3 -I kits/cinema/film/youtube1440.py <ep>")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
