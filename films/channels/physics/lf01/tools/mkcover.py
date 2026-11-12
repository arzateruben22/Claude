"""Covers for Season 3 Parts 1-5 from the owner's cover heroes (lf01/art/owner/covers).
The whole 9:16 picture is fitted to 1080x1920; the subject and the words sit inside the centre 1080x1440 band (the 3:4 grid crop),
words in the upper half of the band on a soft cream plate. Run: python3 -I lf01/tools/mkcover.py"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
CH = "/home/user/claude/films/channels/physics"; ART = f"{CH}/lf01/art/owner/covers"; FONT = f"{CH}/fonts/Archivo-VF.ttf"
INK = (21, 23, 28); COB = (31, 59, 209)
def font(sz, w=800, wd=100):
    f = ImageFont.truetype(FONT, sz); f.set_variation_by_axes([w, wd]); return f
# part: (art file, big words, small words, x, y of the block, alignment)
COVERS = {
    1: ("p1-hummingbird-9x16.png", "50", "beats a second", 64, 300),
    2: ("p2-crown-9x16.png", "100×", "slower", 64, 300),
    3: ("p3-popcorn-9x16.png", "1,000×", "slower", 64, 300),
    4: ("p4-clap-9x16.png", "343 m/s", "in air", 64, 300),
    5: ("p5-apple-9x16.png", "10,000×", "slower", 64, 300),
}
def plate(im, box, a=0.82, r=46):
    ov = Image.new("RGBA", im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov); d.rounded_rectangle(box, r, fill=(244, 241, 232, int(255 * a)))
    ov = ov.filter(ImageFilter.GaussianBlur(2)); return Image.alpha_composite(im.convert("RGBA"), ov).convert("RGB")
def make(n):
    art, big, small, x, y = COVERS[n]
    im = Image.open(f"{ART}/{art}").convert("RGB").resize((1080, 1919), Image.LANCZOS)
    c = Image.new("RGB", (1080, 1920)); c.paste(im, (0, 0)); c.paste(im.crop((0, 1918, 1080, 1919)), (0, 1919))
    d = ImageDraw.Draw(c); fb, fs = font(150, 850, 92), font(66, 780, 100)
    bw = d.textlength(big, font=fb); sw = d.textlength(small, font=fs); w = max(bw, sw)
    c = plate(c, (x - 30, y - 22, x + w + 38, y + 150 + 66 + 56))
    d = ImageDraw.Draw(c); d.text((x, y - 12), big, font=fb, fill=COB); d.text((x + 4, y + 148), small, font=fs, fill=INK)
    out = f"{CH}/ep{12 + n}/out/reality-rulebook-s3p{n}-cover"
    c.save(out + ".jpg", quality=92); c.resize((480, 853), Image.LANCZOS).save(out + "-480.jpg", quality=90)
    band = c.crop((0, 240, 1080, 1680)); band.resize((540, 720), Image.LANCZOS).save(out + "-grid-3x4.jpg", quality=90)
    p = f"{CH}/ep{12 + n}/out/packaging.json"; d2 = json.load(open(p))
    d2["thumbnailFile"] = f"reality-rulebook-s3p{n}-cover.jpg"; d2["shortsCover"] = dict(d2.get("shortsCover", {}), text=f"{big} {small}", art=f"lf01/art/owner/covers/{art}")
    d2["note"] = "Cover is the owner's AI illustration (whole 9:16 image) with the words added in code, both inside the centre 3:4 band; the words do not repeat the title."
    lines = d2.get("postingCopyLines", []); line = "Cover illustration made with AI."
    if line not in lines: lines.append(line)
    d2["postingCopyLines"] = lines; json.dump(d2, open(p, "w"), indent=2, ensure_ascii=False)
    return c
if __name__ == "__main__":
    ns = [int(a) for a in sys.argv[1:]] or [1, 2, 3, 4, 5]
    cs = [make(n) for n in ns]
    g = Image.new("RGB", (len(cs) * 360, 640 + 480), (255, 255, 255))
    for i, c in enumerate(cs): g.paste(c.resize((360, 640), Image.LANCZOS), (i * 360, 0)); g.paste(c.crop((0, 240, 1080, 1680)).resize((360, 480), Image.LANCZOS), (i * 360, 640))
    g.save(f"{CH}/lf01/art/stills/covers-p1-p5-grid.jpg", quality=90)
