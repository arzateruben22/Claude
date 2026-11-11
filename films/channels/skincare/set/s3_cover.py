"""Season 3 covers from the owner's illustrations: python3 set/s3_cover.py epNN "text" [size]   (image from s3-art/owner/ per EPIMG).
Upscale to 1080x1920, #0B1513 gradient at the top, ivory Newsreader text with a soft shadow, cover-480 and thumb; adds the AI-cover disclosure."""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(R)
EPIMG = {"ep13": "ep13-nerve-pulse.png", "ep14": "ep14-cell-layers-final.png", "ep15": "ep15-follicle-tunnel.png", "ep16": "ep16-pore-plug.png", "ep17": "ep17-hair-bulb.png", "ep18": "ep18-collagen-fibres.png"}
ep, text = sys.argv[1], sys.argv[2]; size = int(sys.argv[3]) if len(sys.argv) > 3 else 96; n = ep[2:].zfill(3)
im = Image.open("s3-art/owner/" + EPIMG[ep]).convert("RGB").resize((1080, 1920), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))
g = Image.new("L", (1, 1920))
for y in range(1920): a = max(0, 1 - y / (0.55 * 1920)); g.putpixel((0, y), int(255 * 0.85 * a * a ** 0.3))
im = Image.composite(Image.new("RGB", (1080, 1920), (11, 21, 19)), im, g.resize((1080, 1920)))
f = ImageFont.truetype("fonts/Newsreader-VF.ttf", size); d = ImageDraw.Draw(im); lines = []; cur = ""
for w in text.split():
    t = (cur + " " + w).strip()
    if d.textlength(t, font=f) <= 940: cur = t
    else: lines.append(cur); cur = w
lines.append(cur); lh = int(size * 1.15); y0 = 300
sh = Image.new("L", im.size, 0); sd = ImageDraw.Draw(sh)
for i, l in enumerate(lines): sd.text(((1080 - sd.textlength(l, font=f)) / 2, y0 + i * lh), l, font=f, fill=255)
im = Image.composite(Image.new("RGB", im.size, (11, 21, 19)), im, sh.filter(ImageFilter.GaussianBlur(16)).point(lambda v: int(v * 0.9))); d = ImageDraw.Draw(im)
for i, l in enumerate(lines): d.text(((1080 - d.textlength(l, font=f)) / 2, y0 + i * lh), l, font=f, fill=(244, 237, 227))
o = f"{ep}/out/skin-sense-{n}-"
im.save(o + "cover.jpg", quality=92); im.resize((480, 853), Image.LANCZOS).save(o + "cover-480.jpg", quality=90); im.crop((0, 560, 1080, 1168)).resize((1280, 720), Image.LANCZOS).save(o + "thumb.jpg", quality=90)
for k in ("cover.jpg", "cover-480.jpg", "thumb.jpg"): os.utime(o + k, None)
add = " Cover illustration made with AI."
for f_ in (f"{ep}/out/POSTING.md", f"{ep}/out/posting.json"):
    if os.path.exists(f_):
        s = open(f_).read()
        if add not in s: open(f_, "w").write(s.replace("Narration: a real person's voice (recorded, not AI).", "Narration: a real person's voice (recorded, not AI)." + add))
pk = f"{ep}/out/packaging.json"
if os.path.exists(pk):
    p = json.load(open(pk)); p["coverSource"] = f"owner's ChatGPT illustration (films/channels/skincare/s3-art/owner/{EPIMG[ep]}), text added in code; Cover illustration made with AI"; p["shortsCover"] = {"image": EPIMG[ep], "text": text}
    if "winner" in p: p["winner"]["thumbnailText"] = text
    json.dump(p, open(pk, "w"), indent=2, ensure_ascii=False)
print(ep, lines)
