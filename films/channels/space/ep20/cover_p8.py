"""One More Orbit S3 Part 8 cover: a circle only (rotation device 7; P7 was a giant number), the Moon stretched into a
band of rock; one teal marker loop around the big crater on the largest fragment (it was the Moon), and the text "No more Moon." (the episode: "It comes
apart ... No Moon. Just a bright band"). usage: p8_cover.py <break-up still> <Lexend-VF.ttf> <hook.py dir> <out dir>"""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
SRC, FONT, HOOKDIR, OUT = sys.argv[1:5]
sys.path.insert(0, HOOKDIR); from hook import marks
TEAL, WHITE, SHADOW = (79, 227, 198), (238, 240, 255), (8, 10, 28)
m = Image.open(SRC).convert("RGB"); a = np.asarray(m.convert("L")).astype(float)
k = a[:1200] > 150; ys, xs = np.nonzero(k); cx = int(np.median(xs))
cw = round(2200 * 1080 / 1920); x0 = max(0, min(2160 - cw, cx - cw // 2))
cv = m.crop((x0, 0, x0 + cw, 2200)).resize((1080, 1920), Image.LANCZOS)
s = 1080 / cw; fy = int(np.median(ys) * s); fx = int((np.median(xs) - x0) * s)
cv = marks(cv, font=FONT, color="#4FE3C6", circle=(732, 470, 150, 100), stroke=11)
f = ImageFont.truetype(FONT, 124)
try: f.set_variation_by_axes([800])
except Exception: pass
d = ImageDraw.Draw(cv); txt = "No more Moon."; x = (1080 - d.textlength(txt, font=f)) // 2; y = 1420
for w in txt.split():
    col = TEAL if w.strip(".").lower() == "moon" else WHITE
    d.text((x + 4, y + 4), w, font=f, fill=SHADOW); d.text((x, y), w, font=f, fill=col); x += d.textlength(w + " ", font=f)
cv.save(f"{OUT}/one-more-orbit-s3-part8-cover.jpg", quality=92)
cv.resize((480, 853), Image.LANCZOS).save(f"{OUT}/one-more-orbit-s3-part8-cover-480.jpg", quality=88)
cv.crop((0, 240, 1080, 1680)).save(f"{OUT}/one-more-orbit-s3-part8-cover-grid-3x4.jpg", quality=90)
print("ok", fx, fy)
