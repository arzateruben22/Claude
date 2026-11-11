"""Season 3 v2 covers, per the platform zones. python3 set/s3_cover2.py epNN "text" [size] [scale dx dy]
Out (in <ep>/out, or <ep>v2/out when that folder exists): skin-sense-0NN-cover.jpg (1080x1920 upload), -cover-grid-3x4.jpg (the centre 1080x1440 band TikTok/Instagram grids show),
-cover-480.jpg, -thumb.jpg (YouTube 1280x720, under 2 MB).
Layout: the owner's art reframed (scale >1, dx/dy in px) so the subject sits inside the band (y 240..1680), clear of the bottom 25% (y > 1440) and the right 15% (x > 918);
the ivory serif text sits in the band's upper half (y ~ 330) over the #0B1513 gradient."""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(R)
EPIMG = {"ep13": "ep13-nerve-pulse.png", "ep14": "ep14-cell-layers-final.png", "ep15": "ep15-follicle-tunnel.png", "ep16": "ep16-pore-plug.png", "ep17": "ep17-hair-bulb.png", "ep18": "ep18-collagen-fibres.png"}
ep, text = sys.argv[1], sys.argv[2]; size = int(sys.argv[3]) if len(sys.argv) > 3 else 92
sc, dx, dy = (float(v) for v in sys.argv[4:7]) if len(sys.argv) > 6 else (1.0, 0.0, 0.0); n = ep[2:].zfill(3)
out = f"{ep}v2/out" if os.path.isdir(f"{ep}v2") else f"{ep}/out"; os.makedirs(out, exist_ok=True)
src = Image.open("s3-art/owner/" + EPIMG[ep]).convert("RGB")
W0, H0 = 1080, 1920; w, h = int(W0 * sc), int(H0 * sc); big = src.resize((w, h), Image.LANCZOS)
x0 = int((w - W0) / 2 - dx); y0 = int((h - H0) / 2 - dy); im = big.crop((x0, y0, x0 + W0, y0 + H0)).filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))
g = Image.new("L", (1, 1920))
for y in range(1920): a = max(0, 1 - y / (0.52 * 1920)); g.putpixel((0, y), int(255 * 0.85 * a * a ** 0.3))
im = Image.composite(Image.new("RGB", (W0, H0), (11, 21, 19)), im, g.resize((W0, H0)))
f = ImageFont.truetype("fonts/Newsreader-VF.ttf", size); d = ImageDraw.Draw(im); lines = []; cur = ""
for wd in text.split():
    t = (cur + " " + wd).strip()
    if d.textlength(t, font=f) <= 860: cur = t
    else: lines.append(cur); cur = wd
lines.append(cur); lh = int(size * 1.15); y0t = 360
sh = Image.new("L", im.size, 0); sd = ImageDraw.Draw(sh)
for i, l in enumerate(lines): sd.text(((W0 - sd.textlength(l, font=f)) / 2 - 0, y0t + i * lh), l, font=f, fill=255)
im = Image.composite(Image.new("RGB", im.size, (11, 21, 19)), im, sh.filter(ImageFilter.GaussianBlur(16)).point(lambda v: int(v * 0.9))); d = ImageDraw.Draw(im)
for i, l in enumerate(lines): d.text(((W0 - d.textlength(l, font=f)) / 2, y0t + i * lh), l, font=f, fill=(244, 237, 227))
o = f"{out}/skin-sense-{n}-"
im.save(o + "cover.jpg", quality=92); im.crop((0, 240, 1080, 1680)).save(o + "cover-grid-3x4.jpg", quality=90); im.resize((480, 853), Image.LANCZOS).save(o + "cover-480.jpg", quality=90)
# YouTube thumbnail 1280x720: a landscape crop of the art around the subject (middle of the frame), text left-centre, under 2 MB
ar = src.resize((1280, int(1280 * src.height / src.width)), Image.LANCZOS); cy = int(ar.height * (0.5 + (dy / 1920) * -1)); th = ar.crop((0, max(0, cy - 360), 1280, max(0, cy - 360) + 720)).filter(ImageFilter.UnsharpMask(radius=1.2, percent=50, threshold=2))
gr = Image.new("L", (1280, 1)); [gr.putpixel((x, 0), int(255 * 0.75 * max(0, 1 - x / 760))) for x in range(1280)]; th = Image.composite(Image.new("RGB", (1280, 720), (11, 21, 19)), th, gr.resize((1280, 720)))
tf = ImageFont.truetype("fonts/Newsreader-VF.ttf", 96); td = ImageDraw.Draw(th); tl = []; cur = ""
for wd in text.split():
    t = (cur + " " + wd).strip()
    if td.textlength(t, font=tf) <= 640: cur = t
    else: tl.append(cur); cur = wd
tl.append(cur); ty = 360 - len(tl) * 55
for i, l in enumerate(tl): td.text((70, ty + i * 110), l, font=tf, fill=(244, 237, 227))
th.save(o + "thumb.jpg", quality=88, optimize=True)
for k in ("cover.jpg", "cover-grid-3x4.jpg", "cover-480.jpg", "thumb.jpg"): os.utime(o + k, None)
add = " Cover illustration made with AI."
print(out, lines, os.path.getsize(o + "thumb.jpg") // 1024, "KB thumb")
