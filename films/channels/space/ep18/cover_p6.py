"""One More Orbit S3 Part 6 cover: extreme close-up (rotation device 4), the Moon at 42,000 km cropped tight so it
overflows the frame, the sea glint below; text "Rises in the west." (the episode: inside the 42,000 km orbit the Moon
laps faster than Earth turns, so it rises in the west). usage: p6_cover.py <moon still> <Lexend-VF.ttf> <out dir>"""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
SRC, FONT, OUT = sys.argv[1:4]
TEAL, WHITE, SHADOW = (79, 227, 198), (238, 240, 255), (8, 10, 28)
m = Image.open(SRC).convert("RGB"); a = np.asarray(m.convert("L")).astype(float)
k = a[:1800] > 110; ys, xs = np.nonzero(k); cx = int(xs.mean())
cw = round(2200 * 1080 / 1920); x0 = max(0, min(2160 - cw, cx - cw // 2))
cv = m.crop((x0, 0, x0 + cw, 2200)).resize((1080, 1920), Image.LANCZOS)
band = Image.new("RGBA", (1080, 1920), (0, 0, 0, 0)); bd = ImageDraw.Draw(band)
bd.rectangle((0, 250, 1080, 520), fill=(10, 12, 32, 200))
cv = Image.alpha_composite(cv.convert("RGBA"), band).convert("RGB")
f = ImageFont.truetype(FONT, 108)
try: f.set_variation_by_axes([800])
except Exception: pass
d = ImageDraw.Draw(cv); txt = "Rises in the west."; x = (1080 - d.textlength(txt, font=f)) // 2; y = 318
for w in txt.split():
    col = TEAL if w.strip(".").lower() == "west" else WHITE
    d.text((x + 4, y + 4), w, font=f, fill=SHADOW); d.text((x, y), w, font=f, fill=col); x += d.textlength(w + " ", font=f)
cv.save(f"{OUT}/one-more-orbit-s3-part6-cover.jpg", quality=92)
cv.resize((480, 853), Image.LANCZOS).save(f"{OUT}/one-more-orbit-s3-part6-cover-480.jpg", quality=88)
cv.crop((0, 240, 1080, 1680)).save(f"{OUT}/one-more-orbit-s3-part6-cover-grid-3x4.jpg", quality=90)
print("ok", x0, cx)
