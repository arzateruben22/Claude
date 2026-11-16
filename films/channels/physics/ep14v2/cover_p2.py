"""Reality Rulebook S3 Part 2 cover: extreme close-up of the frozen moment (rotation device 4; P1 was side by side):
the drop's crown in the blue mug with droplets breaking free, at 100x slower. RR look: white pills, blue numbers,
Archivo; the crop avoids the episode's baked counter and captions. usage: rr_p2_cover.py <frame> <Archivo ttf> <out>"""
import sys
from PIL import Image, ImageDraw, ImageFont
SRC, FONT, OUT = sys.argv[1:4]
BLUE, INK = (35, 70, 230), (21, 23, 28)
def arch(size, w=800):
    f = ImageFont.truetype(FONT, size)
    try: f.set_variation_by_axes([w])
    except Exception: pass
    return f
cv = Image.new("RGB", (1080, 1920), (20, 22, 26))
cv.paste(Image.open(SRC).convert("RGB").crop((160, 520, 920, 1280)).resize((1080, 1080), Image.LANCZOS), (0, 420))
def pill(x, y, parts, pad=26, r=26):
    global cv
    d = ImageDraw.Draw(cv); w = sum(d.textlength(t, font=f) for t, f, c in parts) + 2 * pad; h = max(f.size for _, f, _ in parts) * 1.25 + pad
    ov = Image.new("RGBA", cv.size, (0, 0, 0, 0)); ImageDraw.Draw(ov).rounded_rectangle((x, y, x + w, y + h), r, fill=(255, 253, 247, 240))
    cv = Image.alpha_composite(cv.convert("RGBA"), ov).convert("RGB"); d = ImageDraw.Draw(cv); tx = x + pad
    for t, f, c in parts: d.text((tx, y + h / 2), t, font=f, fill=c, anchor="lm"); tx += d.textlength(t, font=f)
big, mid = arch(118), arch(64, 700)
pill(40, 250, [("1", big, BLUE), ("  drop of water", mid, INK)])
pill(40, 1540, [("100×", big, BLUE), ("  slower", mid, INK)])
cv.save(f"{OUT}/reality-rulebook-s3p2-cover.jpg", quality=92)
cv.resize((480, 853), Image.LANCZOS).save(f"{OUT}/reality-rulebook-s3p2-cover-480.jpg", quality=88)
cv.crop((0, 240, 1080, 1680)).save(f"{OUT}/reality-rulebook-s3p2-cover-grid-3x4.jpg", quality=90)
print("ok")
