"""Reality Rulebook S3 Part 4 cover: a zoom circle (rotation device 6; P1 side by side, P2 close-up, P3 giant number):
the kitchen with the drawn sound ring (the owner's K3) and a magnifier inset on the one detail that matters, the
hummingbird frozen mid-wingbeat (the owner's K4). RR look: white rounded pills, blue numbers, Archivo.
usage: cover_p4.py <K3> <K4> <Archivo ttf> <out dir>"""
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont
K3, K4, FONT, OUT = sys.argv[1:5]
BLUE, INK = (35, 70, 230), (21, 23, 28)
def arch(size, w=800):
    f = ImageFont.truetype(FONT, size)
    try: f.set_variation_by_axes([w])
    except Exception: pass
    return f
cv = Image.open(K3).convert("RGB").resize((1080, 1920), Image.LANCZOS)
# the zoom circle: the bird, big, with a white rim and a soft shadow, joined to the feeder in the kitchen by a thin line
bird = Image.open(K4).convert("RGB"); bird = bird.crop((140, 230, 880, 970)).resize((680, 680), Image.LANCZOS)
cx, cy, R = 540, 1290, 340
mask = Image.new("L", (680, 680), 0); ImageDraw.Draw(mask).ellipse((0, 0, 679, 679), fill=255)
sh = Image.new("RGBA", cv.size, (0, 0, 0, 0)); ImageDraw.Draw(sh).ellipse((cx - R - 6, cy - R + 8, cx + R + 6, cy + R + 22), fill=(0, 0, 0, 120))
cv = Image.alpha_composite(cv.convert("RGBA"), sh.filter(ImageFilter.GaussianBlur(14))).convert("RGB")
d = ImageDraw.Draw(cv)
fx, fy = 640, 452                                       # the feeder in the kitchen view
d.ellipse((fx - 62, fy - 62, fx + 62, fy + 62), outline=(255, 255, 255), width=8)
d.line((fx - 20, fy + 60, cx + 40, cy - R + 14), fill=(255, 255, 255), width=8)
cv.paste(bird, (cx - R, cy - R), mask)
d = ImageDraw.Draw(cv); d.ellipse((cx - R, cy - R, cx + R, cy + R), outline=(255, 255, 255), width=14)
def pill(x, y, parts, pad=30, r=30):
    global cv
    d = ImageDraw.Draw(cv); w = sum(d.textlength(t, font=f) for t, f, c in parts) + 2 * pad; h = max(f.size for _, f, _ in parts) * 1.22 + pad
    ov = Image.new("RGBA", cv.size, (0, 0, 0, 0)); ImageDraw.Draw(ov).rounded_rectangle((x, y, x + w, y + h), r, fill=(255, 253, 247, 242))
    cv = Image.alpha_composite(cv.convert("RGBA"), ov).convert("RGB"); d = ImageDraw.Draw(cv); tx = x + pad
    for t, f, c in parts: d.text((tx, y + h / 2), t, font=f, fill=c, anchor="lm"); tx += d.textlength(t, font=f)
pill(40, 150, [("A clap", arch(118), INK), ("  still crossing", arch(62, 700), INK)])
pill(40, 1700, [("10,000×", arch(104), BLUE), ("  slower", arch(62, 700), INK)])
cv.save(f"{OUT}/reality-rulebook-s3p4-cover.jpg", quality=92)
cv.resize((480, 853), Image.LANCZOS).save(f"{OUT}/reality-rulebook-s3p4-cover-480.jpg", quality=88)
cv.crop((0, 240, 1080, 1680)).save(f"{OUT}/reality-rulebook-s3p4-cover-grid-3x4.jpg", quality=90)
print("ok")
