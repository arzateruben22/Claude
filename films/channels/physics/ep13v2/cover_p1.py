"""Reality Rulebook S3 Part 1 cover (the owner's ChatGPT Episode 1): side by side, two speeds (rotation device 3):
the hummingbird at real speed (wings a blur) above the same bird at 20x slower (wings sharp). RR's look: white
rounded label pills, blue numbers, Archivo. Crops avoid the episode's baked counter and captions.
usage: rr_p1_cover.py <1x frame> <20x frame> <Archivo-VF.ttf> <out dir>"""
import sys
from PIL import Image, ImageDraw, ImageFont
A, B, FONT, OUT = sys.argv[1:5]
BLUE, INK = (35, 70, 230), (21, 23, 28)
def arch(size, w=800):
    f = ImageFont.truetype(FONT, size)
    try: f.set_variation_by_axes([w] + [100] * 0)
    except Exception:
        try: f.set_variation_by_name("Bold")
        except Exception: pass
    return f
cv = Image.new("RGB", (1080, 1920), (20, 22, 26))
for i, src in enumerate((A, B)):
    p = Image.open(src).convert("RGB").crop((0, 500, 1080, 1340))
    cv.paste(p, (0, 230 + i * 850))
d = ImageDraw.Draw(cv)
def pill(x, y, parts, pad=26, r=26):
    w = sum(d.textlength(t, font=f) for t, f, c in parts) + 2 * pad; h = max(f.size for _, f, _ in parts) * 1.25 + pad
    ov = Image.new("RGBA", cv.size, (0, 0, 0, 0)); od = ImageDraw.Draw(ov)
    od.rounded_rectangle((x, y, x + w, y + h), r, fill=(255, 253, 247, 235)); cv.paste(Image.alpha_composite(cv.convert("RGBA"), ov).convert("RGB"))
    tx = x + pad
    for t, f, c in parts:
        ImageDraw.Draw(cv).text((tx, y + h / 2), t, font=f, fill=c, anchor="lm"); tx += d.textlength(t, font=f)
big, mid = arch(118), arch(64, 700)
pill(40, 268, [("50", big, BLUE), ("  flaps a second", mid, INK)])
pill(40, 230 + 840 - 120, [("real speed", mid, INK)])
pill(40, 230 + 850 + 840 - 150, [("20×", big, BLUE), ("  slower", mid, INK)])
cv.save(f"{OUT}/reality-rulebook-s3p1-cover.jpg", quality=92)
cv.resize((480, 853), Image.LANCZOS).save(f"{OUT}/reality-rulebook-s3p1-cover-480.jpg", quality=88)
cv.crop((0, 240, 1080, 1680)).save(f"{OUT}/reality-rulebook-s3p1-cover-grid-3x4.jpg", quality=90)
print("ok")
