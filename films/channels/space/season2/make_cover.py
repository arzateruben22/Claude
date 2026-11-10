"""Designed covers for a Season 2 final, built AFTER the mp4 (a cover must be newer than the render).
usage: python3 -I make_cover.py <epdir> <name> <seconds> "<cover text, 0-4 words, NOT the title>" "<accent word>" "<thumb text, 0-4 words>" "<unused>"
PACKAGING.md rule: no series line, no badges; the text adds a layer the title does not repeat.
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
def series_line(d, x, y, series, size):
    # 'One More Orbit · Season 2 · Episode N': text-2 colour, teal on the numbers, Lexend
    import re
    f = font(size, 600); parts = re.split(r"(?<=Season )(\d)|(?<=Episode )(\d+)", series.upper()); txt = series.upper()
    cur = x
    for tok in re.findall(r"\d+|[^\d]+", txt):
        col = TEAL if tok.isdigit() else (169, 176, 217)
        d.text((cur, y), tok, font=f, fill=col); cur += d.textlength(tok, font=f)
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
# 9:16 cover: the hero (a crop of the frame without captions and counters) on the channel's night, the title below
y0, y1 = (int(v) for v in (os.environ.get("HERO_Y", "335,1005").split(",")))
hero = base.crop((0, y0, 1080, y1)); hh = y1 - y0
night = Image.linear_gradient("L").resize((1080, 1920)); c = Image.composite(Image.new("RGB", (1080, 1920), (16, 20, 52)), Image.new("RGB", (1080, 1920), (7, 9, 24)), night)
big = hero.resize((1350, int(hh * 1.25)), Image.LANCZOS).crop((135, 0, 1215, int(hh * 1.25)))
vf = Image.linear_gradient("L").rotate(180).resize(big.size).point(lambda v: 255 if v > 90 else int(v * 255 / 90)).filter(ImageFilter.GaussianBlur(4))
c.paste(big, (0, 190), vf)
d = ImageDraw.Draw(c)
words(d, title, accent, font(176, 800), 70, 1130, 940)
c.save(os.path.join(out, f"{name}-cover.jpg"), quality=92)
c.resize((480, 853), Image.LANCZOS).save(os.path.join(out, f"{name}-cover-480.jpg"), quality=88)
# 16:9 thumbnail: the hero at left, the title at right
t = Image.new("RGB", (1280, 720), (10, 12, 32)); hs = hero.resize((int(1080 * 700 / hh), 700), Image.LANCZOS).crop((190, 0, 880, 700))
hm = Image.linear_gradient("L").rotate(90).resize(hs.size).point(lambda v: 255 if v > 150 else int(v * 255 / 150)); hm = hm.transpose(Image.FLIP_LEFT_RIGHT)
t.paste(hs, (0, 10), hm); d = ImageDraw.Draw(t)
words(d, thumb, accent, font(104, 800), 690, 270, 560)
t.resize((1920, 1080), Image.LANCZOS).save(os.path.join(out, f"{name}-thumb.jpg"), quality=90, optimize=True)   # 16:9 export, 1920x1080, under 2 MB
print("covers:", [f for f in os.listdir(out) if f.startswith(name) and f.endswith(".jpg")])
