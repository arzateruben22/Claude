"""Covers and thumbnails from the owner's AI illustrations (art/owner/*.png, 1672x941): extend the dark sky (no stretching), upscale, sharpen, add the words in code.
  python3 -I .../parts/art_cover.py            writes the 16:9 thumbnail options, the long-film thumbnail and the Part 2/4/8 9:16 covers"""
import json, shutil
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
HERE = Path(__file__).resolve().parent; ES = HERE.parent; W = ES.parents[1]          # W = films/channels/whatif
ART = ES / "art/owner"; FONT = W / "fonts/BricolageGrotesque-VF.ttf"
def load(n): return Image.open(ART / n).convert("RGB")
def extend(im, box):
    """crop box (x0, y0, x1, y1) may reach outside the image: the outside is the nearest edge row/column, heavily blurred (a smooth continuation of the sky)"""
    x0, y0, x1, y1 = box; a = np.asarray(im).astype(np.float32); h, w = a.shape[:2]
    pt, pb, pl, pr = max(0, -y0), max(0, y1 - h), max(0, -x0), max(0, x1 - w)
    a = np.pad(a, ((pt, pb), (pl, pr), (0, 0)), mode="edge"); out = Image.fromarray(a.astype(np.uint8))
    bl = out.filter(ImageFilter.GaussianBlur(40)); m = np.zeros(out.size[::-1], np.float32)
    if pt: m[:pt] = 1
    if pb: m[-pb:] = 1
    if pl: m[:, :pl] = 1
    if pr: m[:, -pr:] = 1
    m = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(30))).astype(np.float32)[..., None] / 255
    out = Image.fromarray((np.asarray(out) * (1 - m) + np.asarray(bl) * m).astype(np.uint8))
    return out.crop((x0 + pl, y0 + pt, x1 + pl, y1 + pt))
def finish(im, size):
    return im.resize(size, Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=1.4, percent=55, threshold=2))
def words(im, text, x, y, fs, align="left", lines=None):
    f = ImageFont.truetype(str(FONT), fs)
    try: f.set_variation_by_name("ExtraBold")
    except Exception: pass
    ls = lines or [text]
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(sh)
    pos = []
    for i, ln in enumerate(ls):
        wd = d.textlength(ln, font=f); px = x if align == "left" else (im.width - wd) / 2; pos.append((px, y + i * fs * 1.04, ln))
        d.text((px, y + i * fs * 1.04), ln, font=f, fill=(0, 0, 0, 235))
    im = Image.alpha_composite(im.convert("RGBA"), sh.filter(ImageFilter.GaussianBlur(fs * 0.08))); d = ImageDraw.Draw(im)
    for px, py, ln in pos: d.text((px, py), ln, font=f, fill=(255, 255, 255, 255), stroke_width=max(3, fs // 40), stroke_fill=(12, 14, 18, 255))
    return im.convert("RGB")
def save(im, *paths, q=92):
    for p in paths: Path(p).parent.mkdir(parents=True, exist_ok=True); im.save(p, quality=q, subsampling=0)
S3 = W / "compilations/s3"
# 16:9: the long-film thumbnail and the two other options
sun, sea, flt = load("sun-streak-90-minute-day.png"), load("oceans-bulge-equator.png"), load("float-8x-lighter.png")
A = words(finish(sun, (1920, 1080)), "", 70, 60, 190, lines=["90-MINUTE", "DAY"])
B = words(finish(sea, (1920, 1080)), "", 70, 50, 170, lines=["OCEANS", "PILE UP"])
C = words(finish(flt, (1920, 1080)), "", 70, 60, 190, lines=["8x", "LIGHTER"])
save(A, S3 / "thumb-options/A-90-minute-day-art.jpg", S3 / "thumbnail.jpg"); save(B, S3 / "thumb-options/B-oceans-pile-up-art.jpg"); save(C, S3 / "thumb-options/C-8x-lighter-art.jpg")
# 9:16 covers (1080x1920): sky extended, words in the top third
def cover(n, im, box, text, size=(1080, 1920), fs=150, lines=None):
    out = words(finish(extend(im, box), size), text, 0, int(size[1] * 0.06), fs, align="center", lines=lines)
    d = W / f"ep{12 + n}/out"; p = ES / f"parts/part{n}/out"
    for base in (d, p): save(out, base / f"possibility-lab-s3p{n}-cover.jpg"); out.resize((480, 853), Image.LANCZOS).save(base / f"possibility-lab-s3p{n}-cover-480.jpg", quality=90)
cover(2, sun, (350, -70, 910, 926), "Sunset in 6 hours", lines=["Sunset in", "6 hours"])
cover(4, sea, (236, -639, 1436, 1494), "Seas pile up here", lines=["Seas pile", "up here"])
cover(8, flt, (630, -410, 1390, 941), "Jump 4 meters high", lines=["Jump 4", "meters high"])
print("ok")
