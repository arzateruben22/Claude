#!/usr/bin/env python3
"""
blur_faces.py — auto-blur faces and license plates in a video.

For nightlife/public POV footage: obscures bystanders' faces and car plates so
you can post without consent/takedown headaches. Detection is automatic (not
perfect) — always eyeball the output before publishing.

Pipeline: frames are read with OpenCV, detected regions are blurred/pixelated,
then piped to ffmpeg which re-encodes at near-lossless quality AND copies the
original audio back in. No generational audio loss; video stays high quality.

Usage:
    python3 blur_faces.py input.mp4 -o input_blurred.mp4
    python3 blur_faces.py clip.mp4 --plates --mode pixelate --strength 35
    python3 blur_faces.py clip.mp4 --no-faces --plates          # plates only

Where to run it:
    * MAX QUALITY: blur each RAW clip, then build the montage from the blurred
      clips (the montage re-encode is the only lossy pass).
    * FASTEST: blur the finished montage master (only ~1-2 min to process).

Requires:
    pip install opencv-python numpy
    ffmpeg + ffprobe on PATH
"""
import argparse
import os
import subprocess
import sys
from shutil import which

try:
    import cv2
    import numpy as np
except ImportError:
    sys.exit("error: needs OpenCV + numpy.  Run:  pip install opencv-python numpy")


# ---- detection ------------------------------------------------------------

def load_cascades(want_faces: bool, want_plates: bool):
    base = cv2.data.haarcascades
    dets = {"face": [], "plate": []}
    if want_faces:
        for name in ("haarcascade_frontalface_default.xml",
                     "haarcascade_profileface.xml"):
            c = cv2.CascadeClassifier(base + name)
            if not c.empty():
                dets["face"].append(c)
    if want_plates:
        c = cv2.CascadeClassifier(base + "haarcascade_russian_plate_number.xml")
        if not c.empty():
            dets["plate"].append(c)
    if want_faces and not dets["face"]:
        sys.exit("error: could not load face cascades from OpenCV install.")
    if want_plates and not dets["plate"]:
        sys.exit("error: could not load plate cascade from OpenCV install.")
    return dets


def detect(gray, cascades, min_size, neighbors):
    boxes = []
    for c in cascades:
        found = c.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=neighbors,
            minSize=(min_size, min_size))
        for (x, y, w, h) in found:
            boxes.append((int(x), int(y), int(w), int(h)))
    return boxes


# ---- obscuring ------------------------------------------------------------

def expand(box, pad, W, H):
    x, y, w, h = box
    dx, dy = int(w * pad), int(h * pad)
    x0 = max(0, x - dx)
    y0 = max(0, y - dy)
    x1 = min(W, x + w + dx)
    y1 = min(H, y + h + dy)
    return x0, y0, x1, y1


def obscure(frame, boxes, mode, strength, pad):
    H, W = frame.shape[:2]
    for b in boxes:
        x0, y0, x1, y1 = expand(b, pad, W, H)
        if x1 <= x0 or y1 <= y0:
            continue
        roi = frame[y0:y1, x0:x1]
        if mode == "pixelate":
            blocks = max(2, int(strength))
            rh, rw = roi.shape[:2]
            small = cv2.resize(roi, (max(1, rw // blocks), max(1, rh // blocks)),
                               interpolation=cv2.INTER_LINEAR)
            frame[y0:y1, x0:x1] = cv2.resize(small, (rw, rh),
                                             interpolation=cv2.INTER_NEAREST)
        else:  # gaussian blur
            k = int(strength) | 1  # kernel must be odd
            frame[y0:y1, x0:x1] = cv2.GaussianBlur(roi, (k, k), 0)
    return frame


# ---- ffmpeg io ------------------------------------------------------------

def has_audio(path: str) -> bool:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a",
         "-show_entries", "stream=index", "-of", "csv=p=0", path],
        capture_output=True, text=True)
    return bool(out.stdout.strip())


def start_encoder(out_path, W, H, fps, src_for_audio, crf):
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
           "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}",
           "-r", f"{fps}", "-i", "-"]
    audio = has_audio(src_for_audio)
    if audio:
        cmd += ["-i", src_for_audio]
    cmd += ["-map", "0:v"]
    if audio:
        cmd += ["-map", "1:a"]
    cmd += ["-c:v", "libx264", "-preset", "slow", "-crf", str(crf),
            "-pix_fmt", "yuv420p"]
    if audio:
        cmd += ["-c:a", "aac", "-b:a", "256k"]
    cmd += ["-movflags", "+faststart", out_path]
    return subprocess.Popen(cmd, stdin=subprocess.PIPE)


# ---- main -----------------------------------------------------------------

def main() -> None:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input", help="input video")
    ap.add_argument("-o", "--out", help="output (default: <input>_blurred.mp4)")
    ap.add_argument("--faces", dest="faces", action="store_true", default=True,
                    help="blur faces (on by default)")
    ap.add_argument("--no-faces", dest="faces", action="store_false",
                    help="do NOT blur faces")
    ap.add_argument("--plates", action="store_true", help="also blur license plates")
    ap.add_argument("--mode", choices=["blur", "pixelate"], default="blur")
    ap.add_argument("--strength", type=int, default=45,
                    help="blur kernel size / pixelation blockiness (higher = heavier)")
    ap.add_argument("--pad", type=float, default=0.15,
                    help="expand each box by this fraction (covers detection slop)")
    ap.add_argument("--min-face", type=float, default=0.05,
                    help="min face size as fraction of frame height")
    ap.add_argument("--neighbors", type=int, default=5,
                    help="detector strictness (higher = fewer false positives)")
    ap.add_argument("--detect-every", type=int, default=3,
                    help="run detection every N frames; hold boxes in between (speed)")
    ap.add_argument("--hold", type=int, default=6,
                    help="keep a detected box alive for N frames after it vanishes")
    ap.add_argument("--crf", type=int, default=16,
                    help="output quality (lower = better; 16 ≈ near-lossless)")
    args = ap.parse_args()

    for tool in ("ffmpeg", "ffprobe"):
        if which(tool) is None:
            sys.exit(f"error: '{tool}' not found on PATH (see montage/README.md).")
    if not os.path.isfile(args.input):
        sys.exit(f"error: input not found: {args.input}")
    if not args.faces and not args.plates:
        sys.exit("error: nothing to blur — enable --faces and/or --plates.")

    out = args.out or (os.path.splitext(args.input)[0] + "_blurred.mp4")
    cascades = load_cascades(args.faces, args.plates)

    cap = cv2.VideoCapture(args.input)
    if not cap.isOpened():
        sys.exit(f"error: could not open {args.input}")
    W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
    min_size = max(20, int(H * args.min_face))

    print(f"{os.path.basename(args.input)}  {W}x{H} @ {fps:.2f}fps"
          f"{f'  (~{total} frames)' if total else ''}", file=sys.stderr)
    print(f"blurring: {'faces ' if args.faces else ''}"
          f"{'plates' if args.plates else ''}"
          f"  mode={args.mode} strength={args.strength}", file=sys.stderr)

    enc = start_encoder(out, W, H, fps, args.input, args.crf)

    # each live box: [x,y,w,h, ttl, kind]
    live: list[list] = []
    n = 0
    det_count = 0
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if n % args.detect_every == 0:
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                fresh = []
                if args.faces:
                    for b in detect(gray, cascades["face"], min_size, args.neighbors):
                        fresh.append(list(b) + [args.hold, "face"])
                if args.plates:
                    for b in detect(gray, cascades["plate"], min_size,
                                    max(args.neighbors, 6)):
                        fresh.append(list(b) + [args.hold, "plate"])
                if fresh:
                    det_count += 1
                # decay old boxes, then add fresh ones
                for lb in live:
                    lb[4] -= 1
                live = [lb for lb in live if lb[4] > 0] + fresh

            boxes = [(lb[0], lb[1], lb[2], lb[3]) for lb in live]
            frame = obscure(frame, boxes, args.mode, args.strength, args.pad)
            enc.stdin.write(frame.tobytes())

            n += 1
            if total and n % max(1, int(fps) * 2) == 0:
                pct = 100.0 * n / total
                sys.stderr.write(f"\r  {n}/{total} frames ({pct:4.1f}%)")
                sys.stderr.flush()
    finally:
        cap.release()
        if enc.stdin:
            enc.stdin.close()
        enc.wait()

    sys.stderr.write("\n")
    if det_count == 0:
        print("  ⚠  no faces/plates detected — check the footage and detector "
              "settings (try --neighbors 4 or --min-face 0.03).", file=sys.stderr)
    print(f"✅ done: {out}", file=sys.stderr)
    print("   Review the output before publishing — detection can miss angled "
          "faces or produce false positives.", file=sys.stderr)


if __name__ == "__main__":
    main()
