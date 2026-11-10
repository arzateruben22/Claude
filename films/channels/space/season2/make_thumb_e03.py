"""One-off image-only cover + thumb for S2E03 (no re-render): two bright stars, the gold ring from the ~44 s shot, '2 stars.' / '1 ring.'"""
import os, subprocess, tempfile, sys
from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageFilter
ep = sys.argv[1]; out = os.path.join(ep, "out"); name = "one-more-orbit-s2e03"
FONT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "fonts", "Lexend-VF.ttf")
def frame(t):
    f = tempfile.mktemp(suffix=".png"); subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", os.path.join(out, name + "-9x16.mp4"), "-frames:v", "1", f], check=True); return Image.open(f).convert("RGB")
def font(s, w=800):
    f = ImageFont.truetype(FONT, s)
    try: f.set_variation_by_axes([w])
    except Exception: pass
    return f
TEAL, WHITE = (79, 227, 198), (238, 240, 255)
def lift(im):
    # remove the frame's own background (its median colour) so only the bright subject remains and the scene stays continuous
    px = im.resize((8, 8)).getdata(); bg = tuple(sorted(c[i] for c in px)[len(px) // 2] for i in range(3))
    return ImageChops.subtract(im, Image.new("RGB", im.size, tuple(min(255, v + 6) for v in bg)))
stars = lift(frame(15.0).crop((0, 400, 1080, 1100))); ring = lift(frame(44.0).crop((20, 330, 960, 920)))
def night(w, h):
    g = Image.linear_gradient("L").resize((w, h)); return Image.composite(Image.new("RGB", (w, h), (15, 19, 50)), Image.new("RGB", (w, h), (7, 9, 24)), g)
def soft(im, edge=60):
    w, h = im.size; m = Image.new("L", (w, h), 255); d = ImageDraw.Draw(m)
    for i in range(edge): v = int(255 * i / edge); d.rectangle((i, i, w - i - 1, h - i - 1), outline=v)
    return m.filter(ImageFilter.GaussianBlur(8))
def screen(bg, im, xy):
    layer = Image.new("RGB", bg.size, (0, 0, 0)); layer.paste(im, xy, soft(im)); return ImageChops.screen(bg, layer)
# 9:16 cover
c = night(1080, 1920); s = stars.resize((1080, 700), Image.LANCZOS); c = screen(c, s, (0, 260))
r = ring.resize((560, 352), Image.LANCZOS); c = screen(c, r, (40, 880))
d = ImageDraw.Draw(c)
for txt, col, y in (("2 stars.", WHITE, 1230), ("1 ring.", TEAL, 1450)):
    d.text((73, y + 4), txt, font=font(210), fill=(8, 10, 28)); d.text((70, y), txt, font=font(210), fill=col)
c.save(os.path.join(out, name + "-cover.jpg"), quality=92); c.resize((480, 853), Image.LANCZOS).save(os.path.join(out, name + "-cover-480.jpg"), quality=88)
# 16:9 thumbnail: one continuous scene
t = night(1920, 1080); s = stars.resize((1296, 840), Image.LANCZOS); t = screen(t, s, (-40, 90))
r = ring.resize((520, 327), Image.LANCZOS); t = screen(t, r, (90, 690))
d = ImageDraw.Draw(t)
for txt, col, y in (("2 stars.", WHITE, 270), ("1 ring.", TEAL, 470)):
    d.text((1123, y + 4), txt, font=font(190), fill=(8, 10, 28)); d.text((1120, y), txt, font=font(190), fill=col)
t.save(os.path.join(out, name + "-thumb.jpg"), quality=90, optimize=True)
print(os.path.getsize(os.path.join(out, name + "-thumb.jpg")) // 1024, "KB")
