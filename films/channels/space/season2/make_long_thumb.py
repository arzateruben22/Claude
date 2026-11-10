"""16:9 winner thumbnail for the Season 2 long video (PACKAGING.md concept A): a lone tree on a hill under a star-dense sky, the Moon rising, 'Look up.'
Rendered at 2560x1440, exported as a 1920x1080 JPG under 2 MB. usage: python3 -I make_long_thumb.py <out.jpg>"""
import math, random, os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
W, H = 2560, 1440; out = sys.argv[1]
FONT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "fonts", "Lexend-VF.ttf")
def font(s, w=800):
    f = ImageFont.truetype(FONT, s)
    try: f.set_variation_by_axes([w])
    except Exception: pass
    return f
im = Image.new("RGB", (W, H)); px = im.load()
for y in range(H):
    t = y / H
    for x in range(W):
        d = math.hypot(x - W * 0.72, y - H * 0.3) / 1500
        r = int(8 + 22 * max(0, 1 - d) + 6 * t); g = int(11 + 28 * max(0, 1 - d) + 10 * t); b = int(34 + 56 * max(0, 1 - d) + 14 * t); px[x, y] = (r, g, b)
rnd = random.Random(4); d = ImageDraw.Draw(im, "RGBA")
for _ in range(900):
    x, y = rnd.random() * W, rnd.random() * H * 0.8; s = rnd.choice([1, 1, 1.5, 2, 3]); a = rnd.randint(110, 255); d.ellipse((x - s, y - s, x + s, y + s), fill=(238, 240, 255, a))
glow = Image.new("RGBA", (W, H), (0, 0, 0, 0)); gd = ImageDraw.Draw(glow); mx, my, mr = 1820, 470, 190
for k in range(24, 0, -1): gd.ellipse((mx - mr - k * 14, my - mr - k * 14, mx + mr + k * 14, my + mr + k * 14), fill=(210, 215, 255, int(3 + 1.5 * (24 - k) / 4)))
im.paste(glow.filter(ImageFilter.GaussianBlur(30)), (0, 0), glow.filter(ImageFilter.GaussianBlur(30)))
d = ImageDraw.Draw(im, "RGBA"); d.ellipse((mx - mr, my - mr, mx + mr, my + mr), fill=(222, 224, 238))
for cx, cy, cr in ((-60, -50, 44), (70, 60, 32), (40, -90, 24), (-70, 70, 28), (10, 10, 18)): d.ellipse((mx + cx - cr, my + cy - cr, mx + cx + cr, my + cy + cr), fill=(150, 152, 176, 150))
hill = [(0, H)] + [(x, 1180 - 150 * math.exp(-((x - 620) / 700) ** 2) + 20 * math.sin(x / 260)) for x in range(0, W + 40, 40)] + [(W, H)]
d.polygon(hill, fill=(5, 7, 18))
tx, ty = 620, 1180 - 150 + 20 * math.sin(620 / 260)
d.rectangle((tx - 11, ty - 140, tx + 11, ty + 20), fill=(5, 7, 18))
for i, (dx, dy, r) in enumerate(((0, -230, 140), (-90, -170, 105), (95, -165, 110), (-45, -290, 95), (55, -285, 92))): d.ellipse((tx + dx - r, ty + dy - r, tx + dx + r, ty + dy + r), fill=(5, 7, 18))
f = font(250); d.text((150, 150), "Look up.", font=f, fill=(238, 240, 255))
im.resize((1920, 1080), Image.LANCZOS).save(out, quality=90, optimize=True); print(os.path.getsize(out) // 1024, "KB")
