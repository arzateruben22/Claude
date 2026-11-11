"""make_part_cover.py <n> <seconds> "<text 0-4 words>" "<accent word>": the part's 9:16 cover from a clean frame of its own video (HUD off): rendered with the engine,
text in the centre safe area (clear of the bottom 25% and the right buttons). Writes long01/out/part<n>-cover.jpg (+ -480)."""
import os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont
n, sec, text, accent = sys.argv[1:5]
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".."))
O = f"{ROOT}/films/channels/space/long01/out"; tmp = f"{O}/.cover{n}.mp4"
env = dict(os.environ, NOHUD="1")
subprocess.run(["node", f"{ROOT}/films/channels/space/season3/render_s3.mjs", f"{O}/part{n}.json", tmp, "1080", "1920", "30", sec, str(float(sec) + 0.04)], env=env, check=True, capture_output=True)
fr = f"{O}/.cover{n}.png"; subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-frames:v", "1", fr], check=True)
im = Image.open(fr).convert("RGB"); d = ImageDraw.Draw(im)
FONT = f"{ROOT}/films/channels/space/fonts/Lexend-VF.ttf"
def font(s, w=800):
    f = ImageFont.truetype(FONT, s)
    try: f.set_variation_by_axes([w])
    except Exception: pass
    return f
f = font(150); words = text.split(); lines, cur = [], ""
for w in words:
    t = (cur + " " + w).strip()
    if d.textlength(t, font=f) <= 820: cur = t
    else: lines.append(cur); cur = w
lines.append(cur); y = int(os.environ.get("TEXT_Y", "300"))
shade = Image.new("RGBA", im.size, (0, 0, 0, 0)); sd = ImageDraw.Draw(shade)
sd.rectangle((0, y - 40, 1080, y + len(lines) * 160 + 30), fill=(8, 10, 28, 120)); im = Image.alpha_composite(im.convert("RGBA"), shade).convert("RGB"); d = ImageDraw.Draw(im)
for ln in lines:
    x = 90
    for w in ln.split():
        col = (79, 227, 198) if w.strip(".,?!").lower() == accent.lower() else (238, 240, 255)
        d.text((x + 3, y + 3), w, font=f, fill=(8, 10, 28)); d.text((x, y), w, font=f, fill=col); x += d.textlength(w + " ", font=f)
    y += 160
im.save(f"{O}/part{n}-cover.jpg", quality=92); im.crop((0, 240, 1080, 1680)).save(f"{O}/part{n}-cover-grid-3x4.jpg", quality=90);   # the 3:4 crop the TikTok / Instagram grids show
im.resize((480, 853), Image.LANCZOS).save(f"{O}/part{n}-cover-480.jpg", quality=88); os.remove(tmp); os.remove(fr); print("cover", f"{O}/part{n}-cover.jpg")
