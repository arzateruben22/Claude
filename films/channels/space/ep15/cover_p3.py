"""One More Orbit S3 Part 3 cover: side by side (rotation device 3), today's Moon | the Moon at 150,000 km (93,000 mi),
same sky, the closer Moon 2.56x wider (384,400/150,000) with a brighter path on the sea. Text: "Too bright." (the
episode's opening line). Lexend 800, teal accent. usage: p3_cover.py <still 2160x2200 png> <Lexend-VF.ttf> <out dir>"""
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops
SRC, FONT, OUT = sys.argv[1:4]
TEAL, WHITE, SHADOW = (79, 227, 198), (238, 240, 255), (8, 10, 28)
CX, CY, R = 1195, 935, 250                     # the Moon disc in the still
K = 384400 / 150000                             # how much wider the Part 3 Moon is than today's
src = Image.open(SRC).convert("RGB"); W0, H0 = src.size

def lex(size, w=800):
    f = ImageFont.truetype(FONT, size)
    try: f.set_variation_by_axes([w])
    except Exception: pass
    return f

# today: remove the Moon and its glow (fill from the sky beside it, blurred edge), paste it back 1/K the size, dim its sea path
G = int(R * 1.95)
sky = src.crop((20, CY - G, CX - G - 40, CY + G)).resize((2 * G, 2 * G), Image.LANCZOS)   # the clear sky left of the Moon, same rows
import numpy as np
yy, xx = np.mgrid[-G:G, -G:G]; rr = np.hypot(xx, yy) / G
mask = Image.fromarray((255 * np.clip((0.95 - rr) / 0.35, 0, 1)).astype("uint8"))   # soft radial: full inside 0.6G, gone by 0.95G
ring = (rr > 0.6) & (rr < 0.95)                 # match the patch's colour to the sky it replaces, over the fade zone
a_src = np.asarray(src.crop((CX - G, CY - G, CX + G, CY + G))).astype(float); a_sky = np.asarray(sky).astype(float)
gain = np.median(a_src[rr > 0.97], 0) / np.maximum(np.median(a_sky[rr > 0.97], 0), 1)   # match at the outer edge only, so the glow goes away
sky = Image.fromarray(np.clip(a_sky * gain, 0, 255).astype("uint8"))
today = src.copy(); today.paste(sky, (CX - G, CY - G), mask)
moon = src.crop((CX - G, CY - G, CX + G, CY + G)); g2 = int(2 * G / K)
mm = Image.fromarray((255 * np.clip((0.9 - rr) / 0.55, 0, 1) ** 1.6).astype("uint8"))   # the small Moon with its glow fading out smoothly
today.paste(moon.resize((g2, g2), Image.LANCZOS), (CX - g2 // 2, CY - g2 // 2), mm.resize((g2, g2), Image.LANCZOS))
path = Image.new("L", (W0, H0), 0); ImageDraw.Draw(path).rectangle((CX - 170, 1850, CX + 170, H0), fill=255)
path = path.filter(ImageFilter.GaussianBlur(60))
today = Image.composite(ImageChops.multiply(today, Image.new("RGB", today.size, (150, 150, 165))), today, path)

# the cover: night gradient, text band, two tall panels
cv = Image.composite(Image.new("RGB", (1080, 1920), (7, 9, 24)), Image.new("RGB", (1080, 1920), (16, 20, 52)),
                     Image.linear_gradient("L").resize((1080, 1920)))
PT, PW, PH, GAP = 560, 535, 1360, 10
cw = int(H0 * PW / PH)
for i, img in enumerate((today, src)):
    p = img.crop((CX - cw // 2, 0, CX + cw // 2, H0)).resize((PW, PH), Image.LANCZOS)
    cv.paste(p, (i * (PW + GAP), PT))
d = ImageDraw.Draw(cv)

def words(txt, accent, f, x, y):
    for w in txt.split():
        col = TEAL if w.strip(".,?!").lower() == accent else WHITE
        d.text((x + 4, y + 4), w, font=f, fill=SHADOW); d.text((x, y), w, font=f, fill=col); x += d.textlength(w + " ", font=f)

f = lex(160); words("Too bright.", "bright", f, (1080 - d.textlength("Too bright.", font=f)) // 2, 330)
lf = lex(54, 650)
for i, lab in enumerate(("today", "93,000 mi")):
    x = i * (PW + GAP) + 34; y = PT + PH - 110
    d.text((x + 3, y + 3), lab, font=lf, fill=SHADOW); d.text((x, y), lab, font=lf, fill=WHITE)
cv.save(f"{OUT}/one-more-orbit-s3-part3-cover.jpg", quality=92)
cv.resize((480, 853), Image.LANCZOS).save(f"{OUT}/one-more-orbit-s3-part3-cover-480.jpg", quality=88)
cv.crop((0, 240, 1080, 1680)).save(f"{OUT}/one-more-orbit-s3-part3-cover-grid-3x4.jpg", quality=90)
print("ok")
