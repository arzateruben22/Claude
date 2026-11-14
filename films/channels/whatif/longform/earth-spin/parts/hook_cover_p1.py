"""Possibility Lab S3 Part 1 cover: the owner's ChatGPT picture (robot on Earth, the sunrise line), the house title
(art_cover.py: Bricolage ExtraBold, centred, shadow + thin stroke), and the hook (hook.py, Caveat 700, marker #E862FF).
  python3 -I make.py <src.png> <tools dir> <out dir> <box y0> <note x,y> <note size> <arrow x0,y0:x1,y1:bend>"""
import sys, numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
src, T, OUT, Y0, NOTE, NS, ARR = sys.argv[1:8]
sys.path.insert(0, T); from hook import marks
FONT = f"{T}/Bricolage.ttf"
def extend(im, box):   # art_cover.extend: outside the image = the nearest edge, heavily blurred
    x0, y0, x1, y1 = box; a = np.asarray(im).astype(np.float32); h, w = a.shape[:2]
    pt, pb, pl, pr = max(0, -y0), max(0, y1 - h), max(0, -x0), max(0, x1 - w)
    a = np.pad(a, ((pt, pb), (pl, pr), (0, 0)), mode="edge"); out = Image.fromarray(a.astype(np.uint8))
    bl = out.filter(ImageFilter.GaussianBlur(40)); m = np.zeros(out.size[::-1], np.float32)
    if pt: m[:pt] = 1
    if pb: m[-pb:] = 1
    m = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(30))).astype(np.float32)[..., None] / 255
    out = Image.fromarray((np.asarray(out) * (1 - m) + np.asarray(bl) * m).astype(np.uint8))
    return out.crop((x0 + pl, y0 + pt, x1 + pl, y1 + pt))
def words(im, lines, y, fs):   # art_cover.words, centred
    f = ImageFont.truetype(FONT, fs)
    try: f.set_variation_by_name("ExtraBold")
    except Exception: pass
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(sh); pos = []
    for i, ln in enumerate(lines):
        px = (im.width - d.textlength(ln, font=f)) / 2; pos.append((px, y + i * fs * 1.04, ln)); d.text(pos[-1][:2], ln, font=f, fill=(0, 0, 0, 235))
    im = Image.alpha_composite(im.convert("RGBA"), sh.filter(ImageFilter.GaussianBlur(fs * 0.08))); d = ImageDraw.Draw(im)
    for px, py, ln in pos: d.text((px, py), ln, font=f, fill=(255, 255, 255, 255), stroke_width=max(3, fs // 40), stroke_fill=(12, 14, 18, 255))
    return im.convert("RGB")
im = Image.open(src).convert("RGB"); y0 = int(Y0)
out = extend(im, (0, y0, 941, y0 + 1672)).resize((1080, 1920), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=1.4, percent=55, threshold=2))
lines = ["17 SUNRISES", "A DAY"]; fs = 140
while max(ImageFont.truetype(FONT, fs).getlength(l) for l in lines) > 0.86 * 1080: fs -= 6
out = words(out, lines, 250, fs)
nx, ny = map(float, NOTE.split(",")); a0, a1, bend = ARR.split(":")
out = marks(out, f"{T}/Caveat.ttf", "#E862FF", note="your town|too?!", note_at=(nx, ny), note_size=float(NS), note_weight=700,
            arrows=[(tuple(map(float, a0.split(","))), tuple(map(float, a1.split(","))), float(bend))], stroke=11,
            circle=(172, 1337, 52, 44))
out.save(f"{OUT}/possibility-lab-s3p1-cover.jpg", quality=92, subsampling=0)
out.resize((480, 853), Image.LANCZOS).save(f"{OUT}/possibility-lab-s3p1-cover-480.jpg", quality=90)
out.crop((0, 240, 1080, 1680)).save(f"{OUT}/possibility-lab-s3p1-cover-grid-3x4.jpg", quality=90)
s = 1080 / 941; print("scale", round(s, 4), "robot box ~", (round(366 * s), round((418 - y0) * s), round(575 * s), round((654 - y0) * s)), "target (150,915) ->", (round(150 * s), round((915 - y0) * s)))
