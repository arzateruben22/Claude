"""YouTube versions of delivered episodes: each 1080×1920 final, upscaled to 1440×2560 for YouTube.

  python3 -I kits/cinema/film/youtube1440.py films/channels/<ch>/epNN [...]      # or a channel folder: every episode
  python3 -I kits/cinema/film/youtube1440.py films/channels                       # every channel

Why: YouTube is widely reported to give 1440p-and-up uploads its better encoder (VP9/AV1) and a higher
bitrate, so the same picture plays back sharper; TikTok and Instagram stop at 1080×1920, so they keep the
master. Re-rendering at 1440 would add no detail worth days of rendering; this is a careful upscale of the
near-lossless master: Lanczos with accurate rounding and full-chroma interpolation, x264 slow, CRF 15,
aq-mode 3 (as render.mjs's delivery encode), BT.709 tags, sound copied untouched (so loudness and sync are
the master's). The rate is capped so every file stays under 90 MB (GitHub refuses files over 100 MB).

Writes <episode>/out/<name>-9x16-youtube.mp4 beside <name>-9x16.mp4 (qa.py and the importers look for the
master by its -9x16.mp4 ending, so they never mistake this for it). Skips an episode whose YouTube version
is newer than its master; --force redoes it. Checks the result: 1440×2560, same frame count, same length.
"""
import json
import subprocess
import sys
from pathlib import Path

BUDGET_MB = 90


def probe(f):
    j = json.loads(subprocess.run(["ffprobe", "-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", str(f)],
                                  check=True, capture_output=True, text=True).stdout)
    v = next(s for s in j["streams"] if s["codec_type"] == "video")
    return int(v["width"]), int(v["height"]), int(v["nb_read_frames"]), float(j["format"]["duration"]), int(j["format"]["size"])


def episodes(arg):
    p = Path(arg)
    if (p / "out").is_dir():
        return [p]
    return sorted({m.parent.parent for m in p.glob("**/out/*-9x16.mp4") if "compilations" not in m.parts})


def make(ep, force=False):
    masters = sorted((ep / "out").glob("*-9x16.mp4"))
    if not masters:
        return f"{ep}: no delivered final"
    src = masters[0]
    dst = src.with_name(src.name.replace("-9x16.mp4", "-9x16-youtube.mp4"))
    if dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime and not force:
        return f"{dst.name}: up to date"
    w, h, frames, dur, _ = probe(src)
    if (w, h) != (1080, 1920):
        return f"{src.name}: {w}×{h}, not 1080×1920 (skipped)"
    cap = int((BUDGET_MB * 8e6 / dur - 300e3) / 1000)            # kbps for the picture, leaving room for the copied sound
    part = dst.with_suffix(".part.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-map", "0:v:0", "-map", "0:a:0?",
                    "-vf", "scale=1440:2560:flags=lanczos+accurate_rnd+full_chroma_int",
                    "-c:v", "libx264", "-preset", "slow", "-crf", "15", "-maxrate", f"{cap}k", "-bufsize", f"{cap * 2}k",
                    "-x264-params", "aq-mode=3:deblock=-1,-1", "-pix_fmt", "yuv420p", "-profile:v", "high",
                    "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv",
                    "-c:a", "copy", "-movflags", "+faststart", str(part)], check=True)
    w2, h2, frames2, dur2, size = probe(part)
    bad = [m for m, ok in [("not 1440×2560", (w2, h2) == (1440, 2560)), (f"{frames2} frames, master has {frames}", frames2 == frames),
                           (f"{dur2:.2f} s, master is {dur:.2f} s", abs(dur2 - dur) < 0.05), (f"{size / 1e6:.0f} MB, over 95", size < 95e6)] if not ok]
    if bad:
        part.unlink()
        return f"{src.name}: FAIL {'; '.join(bad)}"
    part.replace(dst)
    return f"{dst.name}: 1440×2560, {frames2} frames, {dur2:.1f} s, {size * 8 / dur2 / 1e6:.1f} Mbps, {size / 1e6:.0f} MB"


def main(argv):
    force = "--force" in argv
    args = [a for a in argv if a != "--force"] or ["films/channels"]
    eps = [e for a in args for e in episodes(a)]
    fails = 0
    for ep in eps:
        line = make(ep, force)
        fails += "FAIL" in line
        print(line, flush=True)
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
