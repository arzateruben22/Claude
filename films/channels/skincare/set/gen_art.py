"""Procedural PLACEHOLDER art for Skin Sense (no text, no faces): macro skin patches, a silicone cast, an ultraviolet view, a skin section
and a tube canopy. They exist only so layout, camera and timing can be reviewed until real text-free art is generated from art-prompts.md.
  python3 -I films/channels/skincare/set/gen_art.py ep05 medium     (writes ep05/art/*.png and a note)
"""
import sys
import numpy as np
from pathlib import Path
from PIL import Image, ImageFilter
W, H = 941, 1065
TONES = {"light": (236, 196, 170), "medium": (200, 146, 110), "deep": (118, 76, 56)}

def field(seed, scale, shape=(H, W)):
    r = np.random.default_rng(seed); small = r.random((max(2, shape[0] // scale), max(2, shape[1] // scale))).astype(np.float32)
    im = Image.fromarray((small * 255).astype("uint8")).resize((shape[1], shape[0]), Image.BICUBIC).filter(ImageFilter.GaussianBlur(scale / 3))
    a = np.asarray(im, dtype=np.float32) / 255; return (a - a.mean()) / (a.std() + 1e-6)

def relief(seed, lam=46):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32); wx, wy = field(seed, 90) * 14, field(seed + 1, 90) * 14
    h = np.zeros((H, W), np.float32)
    for th, amp in ((0.62, 1.0), (-0.62, 1.0), (1.57, 0.45)):
        d = ((xx + wx) * np.cos(th) + (yy + wy) * np.sin(th)) / lam
        h += amp * (1 - np.abs(np.sin(np.pi * d))) ** 3
    h = h / h.max(); return h

def shade(h, k=3.0):
    gy, gx = np.gradient(Image.fromarray((h * 255).astype("uint8")).filter(ImageFilter.GaussianBlur(1.2)).convert("F").__array__() if False else np.asarray(Image.fromarray((h * 255).astype("uint8")).filter(ImageFilter.GaussianBlur(1.2)), dtype=np.float32) / 255)
    return np.clip(-(gx * 0.7 + gy * 0.7) * k * 12, -1, 1)

def skin(tone, seed, lam=46):
    base = np.array(TONES[tone], np.float32); h = relief(seed, lam); s = shade(h)
    img = np.ones((H, W, 3), np.float32) * base
    img *= (1 + 0.07 * field(seed + 2, 140))[..., None]
    img *= (1 + 0.55 * s[..., None] * 0.35 + (h[..., None] - 0.5) * -0.20)
    pores = (field(seed + 3, 9) > 2.35).astype(np.float32); pores = np.asarray(Image.fromarray((pores * 255).astype("uint8")).filter(ImageFilter.GaussianBlur(1.6))) / 255
    img *= (1 - 0.35 * pores[..., None]); img += (np.array([255, 235, 215]) - img) * np.clip(s, 0, 1)[..., None] * 0.10
    img += np.random.default_rng(seed).normal(0, 2.2, (H, W, 1))
    return np.clip(img, 0, 255)

def cast(seed):
    h = relief(seed, 46); s = shade(h, 4.0); g = 205 + 38 * s - 26 * (h - 0.5)
    g = g[..., None] * np.array([1.0, 0.985, 0.955]); g *= (1 + 0.03 * field(seed + 4, 160))[..., None]
    return np.clip(g + np.random.default_rng(seed).normal(0, 1.6, (H, W, 1)), 0, 255)

def uv(tone, seed):
    img = skin(tone, seed) * np.array([0.42, 0.34, 0.62]); img = img * 0.55
    spots = np.clip(field(seed + 5, 34) - 1.3, 0, None); spots = np.asarray(Image.fromarray(np.clip(spots * 160, 0, 255).astype("uint8")).filter(ImageFilter.GaussianBlur(3))) / 255
    img += spots[..., None] * np.array([90, 200, 235]) * 0.9
    return np.clip(img + 16, 0, 255)

def section(tone, seed):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32); wob = field(seed, 120) * 10
    y_epi, y_dermis = 330 + wob * 0.8 + 8 * np.sin(xx / 38.0), 400 + wob + 12 * np.sin(xx / 60.0 + 1.3)
    img = np.zeros((H, W, 3), np.float32)
    ivory = np.array([248, 242, 231], np.float32); top = np.array(TONES[tone], np.float32) * 1.05
    img[:] = ivory
    stratum = (yy > y_epi - 18) & (yy <= y_dermis); img[stratum] = np.array([232, 188, 170], np.float32) * (0.55 + 0.45 * (np.array(TONES[tone]) / 255.0).mean() / 0.6)
    horn = (yy > y_epi - 30) & (yy <= y_epi - 18); img[horn] = top * 1.12
    derm = (yy > y_dermis) & (yy <= y_dermis + 330); img[derm] = np.array([222, 150, 148], np.float32)
    fat = yy > y_dermis + 330; img[fat] = np.array([245, 222, 170], np.float32)
    fib = relief(seed, 30); img[derm] *= (1 - 0.14 * fib[derm])[..., None]; img[fat] *= (1 - 0.10 * field(seed + 7, 40)[fat])[..., None]
    img *= (1 + 0.05 * field(seed + 8, 70))[..., None]
    return np.clip(img + np.random.default_rng(seed).normal(0, 2, (H, W, 1)), 0, 255)

def bed(seed):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32); img = np.ones((H, W, 3), np.float32) * np.array([244, 236, 224], np.float32)
    canopy = (yy < 560) & (yy > 140); shade_ = np.clip((yy - 140) / 420, 0, 1)
    img[canopy] = np.array([26, 36, 70], np.float32) * (1.0 - 0.0 * shade_[canopy][..., None]) + 0
    for i in range(6):
        y = 200 + i * 62; tube = np.exp(-((yy - y) / 11.0) ** 2) * ((xx > 70) & (xx < W - 70)); glow = np.exp(-((yy - y) / 34.0) ** 2) * ((xx > 70) & (xx < W - 70))
        img += tube[..., None] * np.array([210, 170, 255]) * 0.9 + glow[..., None] * np.array([70, 40, 120]) * 0.35
    img *= (1 + 0.03 * field(seed, 100))[..., None]
    bench = (yy >= 640) & (yy < 760); img[bench] = np.array([226, 212, 196], np.float32)
    return np.clip(img + np.random.default_rng(seed).normal(0, 2, (H, W, 1)), 0, 255)

def save(a, p): Image.fromarray(a.astype("uint8")).filter(ImageFilter.GaussianBlur(0.6)).save(p)

if __name__ == "__main__":
    ep, tone = sys.argv[1], sys.argv[2]; d = Path(__file__).resolve().parent.parent / ep / "art"; d.mkdir(exist_ok=True)
    save(skin(tone, 11), d / "skin.png"); save(cast(11), d / "cast.png"); save(uv(tone, 11), d / "uv.png"); save(section(tone, 5), d / "section.png"); save(bed(3), d / "bed.png")
    print("wrote", d)
