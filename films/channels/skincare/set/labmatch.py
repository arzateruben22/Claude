#!/usr/bin/env python3
"""Match the skin colour of one picture to the skin of others (one skin tone per episode), in CIE-LAB: mean and spread of the skin pixels.
  python3 set/labmatch.py <out.webp> <src.webp> <target1.webp> [target2.webp …] [--skip-top 0.3]
Skin = saturated warm pixels (not the ivory ground, not stone/cloth); the edge is feathered so the ground is untouched."""
import sys, numpy as np
from PIL import Image, ImageFilter
def lab(rgb):
    r = rgb / 255.; r = np.where(r > 0.04045, ((r + 0.055) / 1.055) ** 2.4, r / 12.92)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]]); xyz = r @ M.T / np.array([0.95047, 1, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116); return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)
def unlab(L):
    fy = (L[..., 0] + 16) / 116; fx = L[..., 1] / 500 + fy; fz = fy - L[..., 2] / 200
    f = np.stack([fx, fy, fz], -1); xyz = np.where(f ** 3 > 0.008856, f ** 3, (f - 16 / 116) / 7.787) * np.array([0.95047, 1, 1.08883])
    M = np.linalg.inv(np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])); r = xyz @ M.T
    r = np.where(r > 0.0031308, 1.055 * np.clip(r, 0, None) ** (1 / 2.4) - 0.055, 12.92 * r); return np.clip(r, 0, 1) * 255
def skin(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]; mx = rgb.max(2); mn = rgb.min(2); sat = (mx - mn) / (mx + 1e-6)
    return (sat > 0.35) & (r > g) & (g >= b - 10) & (mx > 60)
a = sys.argv[1:]; top = 0.3
if "--skip-top" in a: i = a.index("--skip-top"); top = float(a[i + 1]); del a[i:i + 2]
out, src, tg = a[0], a[1], a[2:]
T = []
for t in tg:
    x = np.asarray(Image.open(t).convert('RGB'), np.float32); m = skin(x); m[:int(top * x.shape[0])] = False; T.append(lab(x)[m])
T = np.concatenate(T); mt, st = T.mean(0), T.std(0)
x = np.asarray(Image.open(src).convert('RGB'), np.float32); m = skin(x); L = lab(x); ms, ss = L[m].mean(0), L[m].std(0)
L2 = L.copy(); L2[m] = (L[m] - ms) / ss * st + mt
mk = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3)), np.float32)[..., None] / 255
o = unlab(L2) * mk + x * (1 - mk); Image.fromarray(o.astype(np.uint8)).save(out, quality=92)
print("target", mt.round(1), "src", ms.round(1), "-> after", lab(o.astype(np.float32))[m].mean(0).round(1))
