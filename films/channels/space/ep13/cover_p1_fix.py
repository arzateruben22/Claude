"""One More Orbit S3 Part 1 cover: "3.8 cm a year" -> "1.5 in a year" (3.8 cm = 1.5 in; the video says an inch and a half).
The cover is the owner's ChatGPT art with the words added in code. The old words (and their shadow) are painted out by diffusion
from the band around them (a smooth fill plus matching grain), then the new words are set in Lexend 800 like the other S3 covers.
usage: cover_p1_fix.py <old cover.jpg> <Lexend-VF.ttf> <out dir>"""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
SRC, FONT, OUT = sys.argv[1:4]
TEAL, WHITE, SHADOW = (79, 227, 198), (238, 240, 255), (8, 10, 28)
cv = Image.open(SRC).convert("RGB")
a = np.asarray(cv).astype(np.float32)
X0, X1, Y0, Y1 = 60, 800, 300, 650
lum = a[Y0:Y1, X0:X1].mean(2)
bright = Image.fromarray(((lum > 45) * 255).astype("uint8")).filter(ImageFilter.MaxFilter(27))     # text + shadow, grown 13 px
M = np.asarray(bright) > 0
sub = a[Y0:Y1, X0:X1].copy()
known = ~M
# Jacobi diffusion: masked pixels relax to the mean of their neighbours; known pixels stay
fill = sub.copy()
fill[M] = np.array([sub[known][:, c].mean() for c in range(3)])
for it in range(2500):
    p = np.pad(fill, ((1, 1), (1, 1), (0, 0)), mode="edge")
    avg = (p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]) / 4
    fill[M] = avg[M]
rng = np.random.default_rng(5)
fill[M] += rng.normal(0, 1.1, fill[M].shape)
a[Y0:Y1, X0:X1] = fill
cv = Image.fromarray(np.clip(a, 0, 255).astype("uint8"))
def lex(size, w=800):
    f = ImageFont.truetype(FONT, size)
    try: f.set_variation_by_axes([w])
    except Exception: pass
    return f
d = ImageDraw.Draw(cv)
f = lex(148)
def words(parts, x, y):
    for txt, col in parts:
        d.text((x + 4, y + 4), txt, font=f, fill=SHADOW); d.text((x, y), txt, font=f, fill=col); x += d.textlength(txt, font=f)
words([("1.5 ", WHITE), ("in", TEAL), (" a", WHITE)], 90, 322)
words([("year", WHITE)], 90, 482)
cv.save(f"{OUT}/one-more-orbit-s3-part1-cover.jpg", quality=92)
cv.resize((480, 853), Image.LANCZOS).save(f"{OUT}/one-more-orbit-s3-part1-cover-480.jpg", quality=88)
cv.crop((0, 240, 1080, 1680)).save(f"{OUT}/one-more-orbit-s3-part1-cover-grid-3x4.jpg", quality=90)
print("ok", d.textlength("3.8 cm a", font=f), d.textlength("1.5 in a", font=f))
