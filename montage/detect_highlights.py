#!/usr/bin/env python3
"""
detect_highlights.py — scan raw POV clips and propose candidate highlight moments.

It does NOT decide the final cut. It surfaces moments worth looking at (scene
changes + loud audio spikes: engine revs, gym clangs, bass drops, crowd noise)
and writes a pre-filled edit list you then trim by hand.

Usage:
    python3 detect_highlights.py <clips_folder_or_files...> [options]

Examples:
    python3 detect_highlights.py ./clips
    python3 detect_highlights.py ./clips/miami1.mp4 ./clips/miami2.mp4 --pad 1.5 --len 5

Output:
    highlights.txt   (edit this, then feed it to build_montage.py)

Requires: ffmpeg + ffprobe on PATH.
"""
import argparse
import os
import re
import subprocess
import sys

VIDEO_EXTS = {".mp4", ".mov", ".m4v", ".mkv", ".avi", ".webm"}


def which_or_die(name: str) -> None:
    from shutil import which
    if which(name) is None:
        sys.exit(f"error: '{name}' not found on PATH. Install ffmpeg first "
                 f"(see montage/README.md).")


def probe_duration(path: str) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", path],
        capture_output=True, text=True,
    )
    try:
        return float(out.stdout.strip())
    except ValueError:
        return 0.0


def scene_change_times(path: str, threshold: float) -> list[float]:
    """Return timestamps (s) where the picture changes a lot — good cut points."""
    proc = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", path,
         "-filter:v", f"select='gt(scene,{threshold})',showinfo",
         "-f", "null", "-"],
        capture_output=True, text=True,
    )
    times = []
    for m in re.finditer(r"pts_time:([0-9.]+)", proc.stderr):
        times.append(float(m.group(1)))
    return times


def loud_regions(path: str, noise_db: int, min_dur: float) -> list[float]:
    """Use silencedetect to find where audio is ACTIVE (revs/clangs/bass/crowd).

    Returns start timestamps (s) of active (non-silent) regions."""
    proc = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", path,
         "-af", f"silencedetect=noise={noise_db}dB:d={min_dur}",
         "-f", "null", "-"],
        capture_output=True, text=True,
    )
    silence_ends = [float(m.group(1))
                    for m in re.finditer(r"silence_end:\s*([0-9.]+)", proc.stderr)]
    # Each silence_end marks the start of an active region.
    return silence_ends


def fmt(t: float) -> str:
    if t < 0:
        t = 0.0
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = t % 60
    if h:
        return f"{h}:{m:02d}:{s:05.2f}"
    return f"{m}:{s:05.2f}"


def merge_close(times: list[float], gap: float) -> list[float]:
    """Collapse candidates that are within `gap` seconds of each other."""
    if not times:
        return []
    times = sorted(times)
    out = [times[0]]
    for t in times[1:]:
        if t - out[-1] >= gap:
            out.append(t)
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("paths", nargs="+", help="clip files and/or folders")
    ap.add_argument("--out", default="highlights.txt", help="output edit list")
    ap.add_argument("--scene", type=float, default=0.30,
                    help="scene-change sensitivity 0-1 (lower = more cuts)")
    ap.add_argument("--noise", type=int, default=-30,
                    help="audio activity threshold in dB (higher = only loudest)")
    ap.add_argument("--silence", type=float, default=0.6,
                    help="min silence length (s) to split on")
    ap.add_argument("--pad", type=float, default=1.2,
                    help="seconds to start the clip BEFORE the detected moment")
    ap.add_argument("--len", type=float, default=4.0,
                    help="default candidate clip length (s)")
    ap.add_argument("--gap", type=float, default=3.0,
                    help="merge candidates closer than this (s)")
    args = ap.parse_args()

    which_or_die("ffmpeg")
    which_or_die("ffprobe")

    # Expand folders into video files.
    files: list[str] = []
    for p in args.paths:
        if os.path.isdir(p):
            for name in sorted(os.listdir(p)):
                if os.path.splitext(name)[1].lower() in VIDEO_EXTS:
                    files.append(os.path.join(p, name))
        elif os.path.isfile(p):
            files.append(p)
        else:
            print(f"warning: skipping missing path {p}", file=sys.stderr)
    if not files:
        sys.exit("error: no video files found.")

    lines = [
        "# Montage edit list — auto-generated CANDIDATES. EDIT THESE.",
        "# Format:  filepath | start | end | caption",
        "#   - times: SS or MM:SS or HH:MM:SS(.ms)",
        "#   - caption is optional (leave blank for none)",
        "#   - delete any line you don't want; reorder freely",
        "#   - '#' starts a comment",
        "#",
        "# Then render:  python3 build_montage.py highlights.txt --music song.mp3 --vertical",
        "#",
    ]

    for f in files:
        dur = probe_duration(f)
        print(f"scanning {f}  ({fmt(dur)})", file=sys.stderr)
        cand = scene_change_times(f, args.scene) + loud_regions(f, args.noise, args.silence)
        cand = [t for t in cand if 0 <= t < dur]
        cand = merge_close(cand, args.gap)
        lines.append(f"\n# === {os.path.basename(f)} — {len(cand)} candidate(s) ===")
        if not cand:
            lines.append(f"# (no strong moments detected — scrub manually)")
        for t in cand:
            start = t - args.pad
            end = min(t - args.pad + args.len, dur)
            lines.append(f"{f} | {fmt(start)} | {fmt(end)} | ")

    with open(args.out, "w") as fh:
        fh.write("\n".join(lines) + "\n")

    total = sum(1 for ln in lines if "|" in ln and not ln.lstrip().startswith("#"))
    print(f"\nwrote {args.out} with {total} candidate clips.", file=sys.stderr)
    print("Open it, trim the in/out points, add captions, delete the junk,",
          file=sys.stderr)
    print("then run build_montage.py.", file=sys.stderr)


if __name__ == "__main__":
    main()
