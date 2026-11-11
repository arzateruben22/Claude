"""edge_check.py <video.mp4> [W H]: the painting's edge must never show. Samples 4 frames/s; for each, the mean luma of the outer 3 columns on each side (rows 25%-90%) must be a step of more than 8 luma against the columns 10-14 px in (which match the picture 24-32 px in).
Prints the flagged stretches; exit 1 if any."""
import subprocess, sys
import numpy as np
f = sys.argv[1]; W = int(sys.argv[2]) if len(sys.argv) > 2 else 1080; H = int(sys.argv[3]) if len(sys.argv) > 3 else 1920
p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", f, "-vf", "fps=4,format=gray", "-f", "rawvideo", "-"], stdout=subprocess.PIPE)
bad = []; i = 0; r0, r1 = int(H * 0.25), int(H * 0.9)
while True:
    b = p.stdout.read(W * H)
    if len(b) < W * H: break
    a = np.frombuffer(b, np.uint8).reshape(H, W)[r0:r1].astype(float)
    for side, e, nb, ref in (("L", a[:, :3], a[:, 10:14], a[:, 24:33]), ("R", a[:, -3:], a[:, W - 14:W - 10], a[:, W - 33:W - 24])):
        # a strip: the outer columns differ from their neighbours 10 px in, while those neighbours match the picture further in
        if abs(e.mean() - nb.mean()) > 8 and abs(nb.mean() - ref.mean()) < 8: bad.append((i / 4, side, round(e.mean() - nb.mean(), 1)))
    i += 1
print(f"{i} frames checked;", "edge flags:", bad if bad else "none"); sys.exit(1 if bad else 0)
