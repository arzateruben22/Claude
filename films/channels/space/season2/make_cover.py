"""Designed covers for a Season 2 final, built AFTER the mp4 (a cover must be newer than the render).
usage: python3 -I make_cover.py <epdir> <name> <seconds> "<cover title>" "<accent word>" "<thumb text>" "<series line>"
Writes out/<name>-cover.jpg (1080x1920), -cover-480.jpg, -thumb.jpg (1280x720): a frame from the final, graded dark, title set in the channel's fonts."""
import os, subprocess, sys, tempfile
from PIL import Image, ImageDraw, ImageFont, ImageFilter
ep, name, sec, title, accent, thumb, series = sys.argv[1:8]
out = os.path.join(ep, "out"); FONT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "fonts", "Lexend-VF.ttf")
fr = tempfile.mktemp(suffix=".png")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", sec, "-i", os.path.join(out, f"{name}-9x16.mp4"), "-frames:v", "1", fr], check=True)
base = Image.open(fr).convert("RGB")
def font(size, w=800):
    f = ImageFont.truetype(FONT, size)
    try: f.set_variation_by_axes([w])
    except Exception: pass
    return f
TEAL, WHITE = (79, 227, 198), (238, 240, 255)
def grade(im, strength):
    ov = Image.new("RGB", im.size, (8, 10, 28)); w, h = im.size
    mask = Image.linear_gradient("L").resize((w, h)); mask = mask.point(lambda v: int(v * strength))
    return Image.composite(ov, im, mask)
def words(d, text, accent, f, x, y, maxw, line_gap=1.08):
    ws = text.split(); lines, cur = [], ""
    for w in ws:
        t = (cur + " " + w).strip()
        if d.textlength(t, font=f) <= maxw: cur = t
        else: lines.append(cur); cur = w
    lines.append(cur)
    for ln in lines:
        tx = x
        for w in ln.split():
            col = TEAL if w.strip(".,?!").lower() == accent.lower() else WHITE
            d.text((tx + 3, y + 3), w, font=f, fill=(8, 10, 28)); d.text((tx, y), w, font=f, fill=col); tx += d.textlength(w + " ", font=f)
        y += int(f.size * line_gap)
    return y
# 9:16 cover
c = grade(base.resize((1080, 1920)), 1.0); d = ImageDraw.Draw(c)
d.text((70, 150), series.upper(), font=font(38, 600), fill=TEAL)
words(d, title, accent, font(168, 800), 70, 1150, 940)
c.save(os.path.join(out, f"{name}-cover.jpg"), quality=92)
c.resize((480, 853), Image.LANCZOS).save(os.path.join(out, f"{name}-cover-480.jpg"), quality=88)
# 16:9 thumbnail: the frame, cover-fit, a wide crop around its middle
t = base.resize((1280, 2276)); t = t.crop((0, 700, 1280, 1420)); t = grade(t, 0.9); d = ImageDraw.Draw(t)
words(d, thumb, accent, font(120, 800), 60, 340, 1160)
d.text((60, 60), series.upper(), font=font(34, 600), fill=TEAL)
t.save(os.path.join(out, f"{name}-thumb.jpg"), quality=92)
print("covers:", [f for f in os.listdir(out) if f.startswith(name) and f.endswith(".jpg")])
