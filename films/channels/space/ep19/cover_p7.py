"""One More Orbit S3 Part 7 cover: one giant number (rotation device 2; P6 was a close-up, P5 a note): "20× wider" over
the wall of grey Moon at 18,000 km (384,400 / 18,000 = 21.4, "more than twenty times wider"), the tiny figure on the
sea below for scale. usage: p7_cover.py <moon-wall still> <beach still> <Lexend-VF.ttf> <out dir>"""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
SRC, BEACH, FONT, OUT = sys.argv[1:5]
TEAL, WHITE, SHADOW = (79, 227, 198), (238, 240, 255), (8, 10, 28)
m = Image.open(SRC).convert("RGB"); cw = round(2200 * 1080 / 1920); x0 = (2160 - cw) // 2
C = m.crop((x0, 0, x0 + cw, 2200))
b = np.asarray(Image.open(BEACH).convert("L")).astype(float)
bx0, by0, bx1, by1 = 760, 1435, 842, 1652                      # the figure in the opening beach frame
patch = b[by0:by1, bx0:bx1]; bg = np.median(patch)
fig = Image.fromarray((np.clip((bg - patch - 8) / 8, 0, 1) * 255).astype("uint8")).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
fx, fy = cw // 2 - 120, 1880 - fig.size[1]
C.paste(Image.new("RGB", fig.size, (5, 7, 16)), (fx, fy), fig)
C.paste(Image.new("RGB", fig.size, (5, 7, 16)), (fx, fy + fig.size[1]), fig.transpose(Image.FLIP_TOP_BOTTOM).point(lambda v: int(v * 0.25)))
cv = C.resize((1080, 1920), Image.LANCZOS).convert("RGBA")
band = Image.new("RGBA", cv.size, (0, 0, 0, 0)); ImageDraw.Draw(band).rectangle((0, 250, 1080, 640), fill=(10, 12, 32, 205))
cv = Image.alpha_composite(cv, band).convert("RGB"); d = ImageDraw.Draw(cv)
def lex(size, w=800):
    f = ImageFont.truetype(FONT, size)
    try: f.set_variation_by_axes([w])
    except Exception: pass
    return f
big, small = lex(300), lex(150)
w1 = d.textlength("20×", font=big); w2 = d.textlength("wider", font=small); x = (1080 - (w1 + 30 + w2)) // 2
d.text((x + 5, 265 + 5), "20×", font=big, fill=SHADOW); d.text((x, 265), "20×", font=big, fill=TEAL)
d.text((x + w1 + 30 + 4, 400 + 4), "wider", font=small, fill=SHADOW); d.text((x + w1 + 30, 400), "wider", font=small, fill=WHITE)
cv.save(f"{OUT}/one-more-orbit-s3-part7-cover.jpg", quality=92)
cv.resize((480, 853), Image.LANCZOS).save(f"{OUT}/one-more-orbit-s3-part7-cover-480.jpg", quality=88)
cv.crop((0, 240, 1080, 1680)).save(f"{OUT}/one-more-orbit-s3-part7-cover-grid-3x4.jpg", quality=90)
print("ok", (bx0, by0, bx1, by1))
