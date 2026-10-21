"""Build the seamless footage loop the composition plays from.

media/hero-loop.mp4 is 96 frames whose wrap point jumps (last→first frame
differs ~3x a normal frame step). We keep frames loopStart..95 and cross-fade
the final `crossfade` frames into frames 0..crossfade-1, giving a seamless
`loopFrames`-frame loop. Frames are upscaled with Lanczos (+ light unsharp)
so the browser's bilinear sampling has detail to work with.

Output: film/build/plate/0000.jpg … (deterministic; skipped if up to date)
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

FILM = Path(__file__).resolve().parent.parent
REPO = FILM.parent.parent


def main():
    tl = json.loads((FILM / "src" / "timeline.json").read_text())
    s = tl["source"]
    video = REPO / s["video"]
    w, h, up = s["width"], s["height"], s["upscale"]
    W, H = w * up, h * up
    start, L, X = s["loopStart"], s["loopFrames"], s["crossfade"]
    out = FILM / "build" / "plate"
    stamp = out / ".stamp"
    key = f"{video.stat().st_size}:{W}x{H}:{start}:{L}:{X}"
    if stamp.exists() and stamp.read_text() == key:
        print(f"plate: up to date ({L} frames)")
        return
    out.mkdir(parents=True, exist_ok=True)

    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(video),
         "-vf", f"scale={W}:{H}:flags=lanczos,unsharp=5:5:0.45:5:5:0",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        check=True, capture_output=True).stdout
    frames = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)
    n = len(frames)
    if start + L != n or X > start:
        sys.exit(f"plate: loop params don't fit {n} source frames")

    for i in range(L):
        a = frames[start + i].astype(np.float32)
        if i >= L - X:
            mix = (i - (L - X) + 1) / (X + 1)
            b = frames[start + i - L].astype(np.float32)
            a = a * (1 - mix) + b * mix
        Image.fromarray(np.clip(a + 0.5, 0, 255).astype(np.uint8)).save(
            out / f"{i:04d}.jpg", quality=95, subsampling=0)
    stamp.write_text(key)
    print(f"plate: wrote {L} frames at {W}x{H} → {out}")


if __name__ == "__main__":
    main()
