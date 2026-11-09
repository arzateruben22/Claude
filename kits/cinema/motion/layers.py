#!/usr/bin/env python3
"""Split a still into depth layers for 2.5-D parallax (kits/cinema/motion).

  python3 -I kits/cinema/motion/layers.py <image> [<image> ...] [--out DIR] [--cuts 0.38,0.70] [--feather 6] [--model PATH] [--depth-only]

Per image <name>.<ext> it writes, next to it (or in --out):
  <name>-depth.png   the depth map, 0 = far, 1 = near (Depth Anything V2 small, ONNX, run on the CPU)
  <name>-L0.webp     background: the whole picture with the near areas filled in from their surroundings (no holes when layers move)
  <name>-L1.webp     middle layer, RGBA (soft alpha from the depth band between the two cuts)
  <name>-L2.webp     foreground layer, RGBA (the nearest band)
Then list them in the episode's art/index.json (set/art_index.py) and name them in episode.json: "layers": ["art/x-L0.webp", ...].

The model (27 MB quantised, 99 MB full) is fetched once to ~/.cache/cinema-depth (onnx-community/depth-anything-v2-small).
No model or no network: --mask FILE uses a hand-drawn grey mask (white = near) instead of the model."""
import argparse, os, sys, urllib.request
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

CACHE = Path(os.environ.get("CINEMA_DEPTH", Path.home() / ".cache/cinema-depth"))
URL = "https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/main/onnx/"

def model_path(quant=True):
    f = CACHE / ("model_quantized.onnx" if quant else "model.onnx")
    if not f.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(URL + f.name, f)
    return f

def depth_map(img, model):
    import onnxruntime as ort
    s = ort.InferenceSession(str(model), providers=["CPUExecutionProvider"])
    x = np.asarray(img.convert("RGB").resize((518, 518), Image.BICUBIC), np.float32) / 255
    x = ((x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]).transpose(2, 0, 1)[None].astype(np.float32)
    d = s.run(None, {s.get_inputs()[0].name: x})[0].squeeze().astype(np.float32)
    d = np.asarray(Image.fromarray(d).resize(img.size, Image.BICUBIC))
    lo, hi = np.percentile(d, 3), np.percentile(d, 97)
    return np.clip((d - lo) / max(hi - lo, 1e-6), 0, 1)

def smooth(x): return x * x * (3 - 2 * x)

def fill(rgb, hole):
    """Push-pull fill: hole pixels (weight 0) take the colour of their surroundings, so the background has nothing missing under a layer."""
    w = (1 - hole)[..., None].astype(np.float32); c = rgb.astype(np.float32) * w; lv = [(c, w)]
    while min(lv[-1][0].shape[:2]) > 1:
        cc, ww = lv[-1]; h, wd = cc.shape[0] // 2 * 2, cc.shape[1] // 2 * 2
        cc, ww = cc[:h, :wd], ww[:h, :wd]
        lv.append(((cc[0::2, 0::2] + cc[1::2, 0::2] + cc[0::2, 1::2] + cc[1::2, 1::2]), (ww[0::2, 0::2] + ww[1::2, 0::2] + ww[0::2, 1::2] + ww[1::2, 1::2])))
    cc, ww = lv[-1]; gm = cc.sum((0, 1)) / max(float(ww.sum()), 1e-6); cur = np.where(ww > 1e-3, cc / np.maximum(ww, 1e-6), gm)
    for cc, ww in reversed(lv[:-1]):
        up = np.asarray(Image.fromarray(np.clip(cur, 0, 255).astype(np.uint8)).resize((cc.shape[1], cc.shape[0]), Image.BILINEAR), np.float32) if cur.shape[-1] == 3 else cur
        have = ww / np.maximum(ww, 1e-6) * (ww > 1e-3)
        cur = np.where(ww > 1e-3, cc / np.maximum(ww, 1e-6), up)
    return cur

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("images", nargs="+"); ap.add_argument("--out"); ap.add_argument("--cuts", default="auto", help="two depth cuts 0-1, or auto (Otsu split, then the nearest 30%% of what is left)")
    ap.add_argument("--feather", type=float, default=6); ap.add_argument("--model"); ap.add_argument("--mask"); ap.add_argument("--depth-only", action="store_true")
    a = ap.parse_args()
    model = Path(a.model) if a.model else (None if a.mask else model_path())
    for p in map(Path, a.images):
        img = Image.open(p).convert("RGB"); out = Path(a.out) if a.out else p.parent; out.mkdir(parents=True, exist_ok=True); n = p.stem
        d = np.asarray(Image.open(a.mask).convert("L").resize(img.size), np.float32) / 255 if a.mask else depth_map(img, model)
        d = np.asarray(Image.fromarray((d * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(a.feather / 2)), np.float32) / 255
        Image.fromarray((d * 255).astype(np.uint8)).save(out / f"{n}-depth.png")
        if a.depth_only: continue
        if a.cuts == "auto":
            hist, edges = np.histogram(d, 64, (0, 1)); pr = hist / hist.sum(); w0 = np.cumsum(pr); mu = np.cumsum(pr * edges[:-1]); mt = mu[-1]
            c1 = float(edges[np.argmax((mt * w0 - mu) ** 2 / np.maximum(w0 * (1 - w0), 1e-9))]); c2 = float(np.percentile(d[d > c1], 70)) if (d > c1).any() else 0.8
        else: c1, c2 = (float(v) for v in a.cuts.split(","))
        f = a.feather / 100
        near = smooth(np.clip((d - c2 + f) / (2 * f), 0, 1)); upto_mid = smooth(np.clip((d - c1 + f) / (2 * f), 0, 1))
        mid = np.clip(upto_mid - near, 0, 1); rgb = np.asarray(img, np.float32)
        hole = np.clip(upto_mid * 1.0, 0, 1) ; hole = np.asarray(Image.fromarray((hole * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(4)), np.float32) / 255
        bg = fill(rgb, (hole > 0.25).astype(np.float32)); bg = rgb * (1 - hole[..., None]) + bg * hole[..., None]
        Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8)).save(out / f"{n}-L0.webp", quality=92)
        for i, m in ((1, upto_mid - near), (2, near)):   # L1 keeps the middle band, L2 the nearest band; each carries its own colour
            m = np.clip(m, 0, 1); rgba = np.dstack([rgb, m * 255]).astype(np.uint8)
            Image.fromarray(rgba, "RGBA").save(out / f"{n}-L{i}.webp", quality=92, lossless=False)
        print(n, "cuts %.2f/%.2f;" % (c1, c2), "layers written; coverage mid %.0f%% near %.0f%%" % (100 * (upto_mid - near).mean(), 100 * near.mean()))

if __name__ == "__main__": main()
