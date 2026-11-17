"""RR S3 Part 2: the mosquito -> faucet join as a camera pan to the right with motion blur (the mug sits on the right edge of the mosquito shot).
Reads the last 0.9 s of the mosquito shot (19.5-20.4) and the first 0.9 s of the faucet shot (20.4-21.3) of the owner's ChatGPT Episode 2 and
slides them together along one strip with a smootherstep ease, 8 sub-frames per frame for the blur.   whip.py <source.mp4> <out.mp4>"""
import subprocess, sys
import numpy as np
W, H, N = 1080, 1920, 27
SRC, OUT = sys.argv[1:3]

def frames(t0):
    cmd = ["ffmpeg", "-v", "error", "-ss", f"{t0:.3f}", "-i", SRC, "-frames:v", str(N), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    raw = subprocess.run(cmd, capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)

B = frames(19.5); C = frames(20.4)
assert len(B) == N and len(C) == N, (len(B), len(C))

def ease(u):
    u = min(max(u, 0.0), 1.0)
    return u * u * u * (u * (u * 6 - 15) + 10)

def strip(b, c, x):
    """the strip [b | c] seen through a window shifted x pixels to the right"""
    out = np.empty((H, W, 3), np.float32)
    x = int(round(x))
    if x <= 0: out[:] = b
    elif x >= W: out[:] = c
    else:
        out[:, :W - x] = b[:, x:]; out[:, W - x:] = c[:, :x]
    return out

enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", "30", "-i", "-",
                        "-c:v", "libx264", "-crf", "10", "-preset", "fast", "-pix_fmt", "yuv420p", "-r", "30", OUT], stdin=subprocess.PIPE)
K = 8
for i in range(N):
    acc = np.zeros((H, W, 3), np.float32)
    for k in range(K):                                   # sub-frames across a 0.9-frame shutter
        u = (i + 0.5 + (k / (K - 1) - 0.5) * 0.9) / N
        # frames of the two shots advance with time (their own motion), the strip pans on the ease
        acc += strip(B[i].astype(np.float32), C[i].astype(np.float32), ease(u) * W)
    enc.stdin.write(np.clip(acc / K, 0, 255).astype(np.uint8).tobytes())
enc.stdin.close(); enc.wait(); print("whip ok")
