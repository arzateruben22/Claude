"""One More Orbit S3 Part 4 cover: the tiny person facing the huge thing (rotation device 8). The eclipse from the film
(the Moon at 100,000 km, nearly 4x wider than today, covering the Sun) above the sea, the figure from the beach shot in
front of the glint. Text: "Where's the Sun?" (the eclipse; the episode asks "What happens when the Moon outgrows the
Sun?"). usage: p4_cover.py <eclipse still> <beach still> <Lexend-VF.ttf> <out dir>"""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
ECL, BEACH, FONT, OUT = sys.argv[1:5]
TEAL, WHITE, SHADOW = (79, 227, 198), (238, 240, 255), (8, 10, 28)
e = Image.open(ECL).convert("RGB"); W0, H0 = e.size                     # 2160 x 2200; sea from y~2000
SEA = 2000
# a 9:16 canvas twice the cover size: sky extended above, sea extended below
C = Image.new("RGB", (2160, 3840)); TOP = 980
sky = e.crop((0, 0, W0, 300)).transpose(Image.FLIP_TOP_BOTTOM).resize((W0, TOP), Image.LANCZOS)
fade = Image.linear_gradient("L").resize((W0, TOP)).point(lambda v: int(v * 0.55 + 115))   # darker toward the top
sky = Image.composite(sky, Image.new("RGB", sky.size, (7, 9, 24)), fade)
C.paste(sky, (0, 0)); C.paste(e, (0, TOP))
sea = e.crop((0, SEA + 10, W0, H0)); n = 3840 - (TOP + H0)
ext = sea.transpose(Image.FLIP_TOP_BOTTOM).resize((W0, n), Image.LANCZOS)
ext = Image.composite(ext, Image.new("RGB", ext.size, (6, 9, 22)), Image.linear_gradient("L").resize((W0, n)).point(lambda v: 255 - int(v * 0.6)))
C.paste(ext, (0, TOP + H0))
# the figure: a silhouette from the beach shot (pixels darker than their surroundings), pasted in front of the glint
b = np.asarray(Image.open(BEACH).convert("L")).astype(float)
box = (760, 1435, 842, 1652); patch = b[box[1]:box[3], box[0]:box[2]]
bg = np.median(patch); m = np.clip((bg - patch - 8) / 8, 0, 1)
fig = Image.fromarray((m * 255).astype("uint8")).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
fw, fh = fig.size; s = 1.15; fig = fig.resize((int(fw * s), int(fh * s)), Image.LANCZOS)
fx, fy = 1090, TOP + SEA + 175 - fig.size[1]
C.paste(Image.new("RGB", fig.size, (5, 7, 16)), (fx, fy), fig)
ref = fig.transpose(Image.FLIP_TOP_BOTTOM).point(lambda v: int(v * 0.25))   # a faint reflection on the water
C.paste(Image.new("RGB", ref.size, (5, 7, 16)), (fx, fy + fig.size[1]), ref)
cv = C.resize((1080, 1920), Image.LANCZOS)

def lex(size, w=800):
    f = ImageFont.truetype(FONT, size)
    try: f.set_variation_by_axes([w])
    except Exception: pass
    return f
d = ImageDraw.Draw(cv); f = lex(108); txt = "Where's the Sun?"; x = (1080 - d.textlength(txt, font=f)) // 2; y = 300
for w in txt.split():
    col = TEAL if w.strip("?").lower() == "sun" else WHITE
    d.text((x + 4, y + 4), w, font=f, fill=SHADOW); d.text((x, y), w, font=f, fill=col); x += d.textlength(w + " ", font=f)
cv.save(f"{OUT}/one-more-orbit-s3-part4-cover.jpg", quality=92)
cv.resize((480, 853), Image.LANCZOS).save(f"{OUT}/one-more-orbit-s3-part4-cover-480.jpg", quality=88)
cv.crop((0, 240, 1080, 1680)).save(f"{OUT}/one-more-orbit-s3-part4-cover-grid-3x4.jpg", quality=90)
print("ok")
