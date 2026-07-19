#!/usr/bin/env python3
"""
build_montage.py — turn an edit list into a finished montage.

Reads an edit list (from detect_highlights.py, or hand-written), trims each
segment frame-accurately, normalizes everything to one canvas/fps, optionally
burns in captions, lays a music bed under ducked original audio, applies a
light color punch, and exports a high-bitrate master.

Usage:
    python3 build_montage.py highlights.txt [options]

Common:
    # Vertical (TikTok/Reels/Shorts) with music:
    python3 build_montage.py highlights.txt --vertical --music track.mp3

    # Horizontal (YouTube) 60fps, custom out name:
    python3 build_montage.py highlights.txt --horizontal --fps 60 -o miami_ep1.mp4

Edit-list format (one clip per line):
    filepath | start | end | caption
      - times: SS  |  MM:SS  |  HH:MM:SS(.ms)
      - caption optional; blank = none
      - '#' starts a comment; blank lines ignored

Requires: ffmpeg + ffprobe on PATH.
"""
import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile

# ---- time parsing ---------------------------------------------------------

def parse_time(s: str) -> float:
    s = s.strip()
    if not s:
        raise ValueError("empty time")
    parts = s.split(":")
    parts = [float(p) for p in parts]
    if len(parts) == 1:
        return parts[0]
    if len(parts) == 2:
        return parts[0] * 60 + parts[1]
    if len(parts) == 3:
        return parts[0] * 3600 + parts[1] * 60 + parts[2]
    raise ValueError(f"bad time: {s}")


# ---- edit list ------------------------------------------------------------

class Seg:
    def __init__(self, path, start, end, caption):
        self.path = path
        self.start = start
        self.end = end
        self.caption = caption

    @property
    def dur(self) -> float:
        return max(0.0, self.end - self.start)


def load_editlist(path: str) -> list[Seg]:
    segs = []
    with open(path) as fh:
        for i, raw in enumerate(fh, 1):
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            fields = [f.strip() for f in line.split("|")]
            if len(fields) < 3:
                sys.exit(f"{path}:{i}: need at least 'file | start | end' — got: {line}")
            fpath, start_s, end_s = fields[0], fields[1], fields[2]
            caption = fields[3] if len(fields) > 3 else ""
            if not os.path.isfile(fpath):
                sys.exit(f"{path}:{i}: file not found: {fpath}")
            try:
                start, end = parse_time(start_s), parse_time(end_s)
            except ValueError as e:
                sys.exit(f"{path}:{i}: {e}")
            if end <= start:
                sys.exit(f"{path}:{i}: end ({end_s}) must be after start ({start_s})")
            segs.append(Seg(fpath, start, end, caption))
    if not segs:
        sys.exit(f"{path}: no clips found (all lines blank/comments?)")
    return segs


# ---- ffmpeg helpers -------------------------------------------------------

def which_or_die(name: str) -> None:
    if shutil.which(name) is None:
        sys.exit(f"error: '{name}' not found on PATH. Install ffmpeg "
                 f"(see montage/README.md).")


def run(cmd: list[str]) -> None:
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        sys.stderr.write(proc.stderr[-4000:] + "\n")
        sys.exit(f"ffmpeg failed ({proc.returncode}): {' '.join(cmd[:6])} ...")


def find_font() -> str | None:
    candidates = [
        # macOS
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        # Linux
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        # Windows
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/arial.ttf",
    ]
    for c in candidates:
        if os.path.isfile(c):
            return c
    return None


def esc_drawtext(text: str) -> str:
    # Escape for ffmpeg drawtext text= value.
    text = text.replace("\\", "\\\\").replace(":", r"\:").replace("'", r"\'")
    text = text.replace("%", r"\%")
    return text


# ---- core -----------------------------------------------------------------

def build_segment(seg: Seg, out_path: str, W: int, H: int, fps: int,
                  color: bool, font: str | None) -> None:
    """Trim + normalize one segment to a uniform canvas so concat is seamless."""
    # scale to fit, then pad to exact WxH (letterbox/pillarbox as needed)
    vf = (f"scale={W}:{H}:force_original_aspect_ratio=decrease,"
          f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color=black,"
          f"setsar=1,fps={fps}")
    if color:
        # light, tasteful punch — not a heavy grade
        vf += ",eq=contrast=1.06:saturation=1.12:brightness=0.01"
    if seg.caption and font:
        cap = esc_drawtext(seg.caption)
        vf += (f",drawtext=fontfile='{font}':text='{cap}':"
               f"fontcolor=white:fontsize={int(H*0.045)}:"
               f"borderw={max(2,int(H*0.003))}:bordercolor=black@0.8:"
               f"x=(w-text_w)/2:y=h-(h*0.12)")
    elif seg.caption and not font:
        print(f"  note: no system font found — skipping caption '{seg.caption}'",
              file=sys.stderr)

    cmd = [
        "ffmpeg", "-hide_banner", "-y",
        "-ss", f"{seg.start}", "-to", f"{seg.end}", "-i", seg.path,
        "-vf", vf,
        "-c:v", "libx264", "-preset", "medium", "-crf", "16",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
        # guarantee an audio track exists even if source is silent
        "-af", "aresample=48000",
        out_path,
    ]
    run(cmd)


def concat_segments(paths: list[str], out_path: str) -> None:
    listfile = out_path + ".txt"
    with open(listfile, "w") as fh:
        for p in paths:
            fh.write(f"file '{os.path.abspath(p)}'\n")
    run(["ffmpeg", "-hide_banner", "-y", "-f", "concat", "-safe", "0",
         "-i", listfile, "-c", "copy", out_path])
    os.remove(listfile)


def add_music(video: str, music: str, out_path: str, music_vol: float,
              duck: float, bitrate: str) -> None:
    """Mix a looping music bed over the montage; original audio ducked under it."""
    # music: loop to cover length, trim to video via -shortest
    filt = (f"[1:a]volume={music_vol}[m];"
            f"[0:a]volume={duck}[o];"
            f"[m][o]amix=inputs=2:duration=first:dropout_transition=0[a]")
    cmd = [
        "ffmpeg", "-hide_banner", "-y",
        "-i", video,
        "-stream_loop", "-1", "-i", music,
        "-filter_complex", filt,
        "-map", "0:v", "-map", "[a]",
        "-c:v", "copy",
        "-c:a", "aac", "-b:a", "256k",
        "-shortest", "-movflags", "+faststart",
        out_path,
    ]
    run(cmd)


def finalize(video: str, out_path: str, bitrate: str) -> None:
    """Re-mux/encode to a clean high-bitrate deliverable with faststart."""
    cmd = [
        "ffmpeg", "-hide_banner", "-y", "-i", video,
        "-c:v", "libx264", "-preset", "slow",
        "-b:v", bitrate, "-maxrate", bitrate, "-bufsize", bitrate,
        "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "256k",
        "-movflags", "+faststart",
        out_path,
    ]
    run(cmd)


def default_bitrate(W: int, H: int) -> str:
    long_edge = max(W, H)
    if long_edge >= 3000:
        return "45M"
    if long_edge >= 1900:
        return "18M"   # 1080p
    return "10M"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("editlist", help="path to the edit list (highlights.txt)")
    ap.add_argument("-o", "--out", default="montage.mp4", help="output file")
    orient = ap.add_mutually_exclusive_group()
    orient.add_argument("--vertical", action="store_true",
                        help="1080x1920 (TikTok/Reels/Shorts) [default]")
    orient.add_argument("--horizontal", action="store_true",
                        help="1920x1080 (YouTube)")
    orient.add_argument("--square", action="store_true", help="1080x1080")
    ap.add_argument("--width", type=int, help="override canvas width")
    ap.add_argument("--height", type=int, help="override canvas height")
    ap.add_argument("--fps", type=int, default=30, help="output fps (30 or 60)")
    ap.add_argument("--music", help="music bed audio file (mp3/wav/m4a)")
    ap.add_argument("--music-vol", type=float, default=0.85, help="music volume 0-1")
    ap.add_argument("--duck", type=float, default=0.28,
                    help="original-audio volume under the music 0-1 (0 = mute)")
    ap.add_argument("--no-color", action="store_true", help="skip color punch")
    ap.add_argument("--bitrate", help="output video bitrate (e.g. 18M, 45M)")
    ap.add_argument("--keep-temp", action="store_true", help="keep intermediate files")
    args = ap.parse_args()

    which_or_die("ffmpeg")
    which_or_die("ffprobe")

    if args.width and args.height:
        W, H = args.width, args.height
    elif args.horizontal:
        W, H = 1920, 1080
    elif args.square:
        W, H = 1080, 1080
    else:
        W, H = 1080, 1920  # vertical default

    if args.music and not os.path.isfile(args.music):
        sys.exit(f"error: music file not found: {args.music}")

    segs = load_editlist(args.editlist)
    total = sum(s.dur for s in segs)
    print(f"{len(segs)} clips, ~{total:.1f}s total, canvas {W}x{H} @ {args.fps}fps",
          file=sys.stderr)
    if total > 150:
        print(f"  heads up: {total:.0f}s is over the 1-2 min target — trim a few.",
              file=sys.stderr)

    font = find_font()
    bitrate = args.bitrate or default_bitrate(W, H)
    workdir = tempfile.mkdtemp(prefix="montage_")
    try:
        parts = []
        for i, seg in enumerate(segs):
            part = os.path.join(workdir, f"seg_{i:03d}.mp4")
            print(f"  [{i+1}/{len(segs)}] {os.path.basename(seg.path)} "
                  f"{seg.start:.2f}->{seg.end:.2f}s"
                  + (f'  \"{seg.caption}\"' if seg.caption else ""),
                  file=sys.stderr)
            build_segment(seg, part, W, H, args.fps, not args.no_color, font)
            parts.append(part)

        stitched = os.path.join(workdir, "stitched.mp4")
        print("  concatenating...", file=sys.stderr)
        concat_segments(parts, stitched)

        if args.music:
            mixed = os.path.join(workdir, "mixed.mp4")
            print("  adding music bed + ducking original audio...", file=sys.stderr)
            add_music(stitched, args.music, mixed, args.music_vol, args.duck, bitrate)
            source = mixed
        else:
            source = stitched

        print(f"  encoding final master @ {bitrate}...", file=sys.stderr)
        finalize(source, args.out, bitrate)
        print(f"\n✅ done: {args.out}", file=sys.stderr)
    finally:
        if args.keep_temp:
            print(f"  (intermediates kept in {workdir})", file=sys.stderr)
        else:
            shutil.rmtree(workdir, ignore_errors=True)


if __name__ == "__main__":
    main()
