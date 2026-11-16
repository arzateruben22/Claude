"""Reality Rulebook S3 Part 3 cover: one giant number as the star, no arrow (rotation device 2; P1 side by side,
P2 extreme close-up): the popcorn bursting into the soap bubble at 1,000x slower, "0.01 s" = how long the whole pop
really takes. RR look: white rounded pills, blue numbers, Archivo. The frame is a clean render (no counter, no
captions). usage: cover_p3.py <clean frame> <Archivo ttf> <out dir>"""
import sys
from PIL import Image, ImageDraw, ImageFont
SRC, FONT, OUT = sys.argv[1:4]
BLUE, INK = (35, 70, 230), (21, 23, 28)
def arch(size, w=800):
    f = ImageFont.truetype(FONT, size)
    try: f.set_variation_by_axes([w])
    except Exception: pass
    return f
cv = Image.open(SRC).convert("RGB").resize((1080, 1920), Image.LANCZOS)
def pill(x, y, parts, pad=30, r=30):
    global cv
    d = ImageDraw.Draw(cv); w = sum(d.textlength(t, font=f) for t, f, c in parts) + 2 * pad; h = max(f.size for _, f, _ in parts) * 1.22 + pad
    ov = Image.new("RGBA", cv.size, (0, 0, 0, 0)); ImageDraw.Draw(ov).rounded_rectangle((x, y, x + w, y + h), r, fill=(255, 253, 247, 242))
    cv = Image.alpha_composite(cv.convert("RGBA"), ov).convert("RGB"); d = ImageDraw.Draw(cv); tx = x + pad
    for t, f, c in parts: d.text((tx, y + h / 2), t, font=f, fill=c, anchor="lm"); tx += d.textlength(t, font=f)
    return w, h
huge, mid = arch(318, 850), arch(104, 700)
pill(40, 84, [("0.01", huge, BLUE), (" sec", mid, INK)])
pill(40, 1640, [("1,000×", arch(104), BLUE), ("  slower", arch(62, 700), INK)])
cv.save(f"{OUT}/reality-rulebook-s3p3-cover.jpg", quality=92)
cv.resize((480, 853), Image.LANCZOS).save(f"{OUT}/reality-rulebook-s3p3-cover-480.jpg", quality=88)
cv.crop((0, 240, 1080, 1680)).save(f"{OUT}/reality-rulebook-s3p3-cover-grid-3x4.jpg", quality=90)
print("ok")
