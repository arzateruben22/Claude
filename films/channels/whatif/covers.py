"""Designed covers for a Possibility Lab final: the title set in code (Bricolage Grotesque, graphite and marker), over a hero frame or art.

    python3 -I films/channels/whatif/covers.py <ep dir> --name possibility-lab-s2e02 --hero out/hero.png --series "Possibility Lab · Season 2 · Episode 2" \
        --line1 "Everyone" --line2 "holds hands" --accent "hands" [--thumb-title "Everyone holds hands"]

Writes out/<name>-cover.jpg (1080x1920), -cover-480.jpg (480x854) and -thumb.jpg (1280x720). Run it AFTER the mp4 is final: a cover only counts
if it is newer than the render.
"""
import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
BG, WHITE, MAG, DIM = (23, 26, 30), (244, 244, 246), (232, 98, 255), (168, 172, 182)


def font(file, size, wght=None):
    f = ImageFont.truetype(str(HERE / "fonts" / file), size)
    if wght is not None:
        try:
            axes = f.get_variation_axes()
            f.set_variation_by_axes([a["maximum"] if a["name"] == b"Optical size" and False else (min(max(wght, a["minimum"]), a["maximum"]) if a["name"] == b"Weight" else a["default"]) for a in axes])
        except Exception:
            pass
    return f


def fit_cover(im, w, h, anchor=(0.5, 0.5)):
    r = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
    x = round((im.width - w) * anchor[0]); y = round((im.height - h) * anchor[1])
    return im.crop((x, y, x + w, y + h))


def draw_title(d, x, y, lines, accent, size, gap=1.02):
    f = font("BricolageGrotesque-VF.ttf", size, 800)
    for ln in lines:
        cx = x
        for word in ln.split(" "):
            col = MAG if word.strip(".,") == accent else WHITE
            d.text((cx, y), word, font=f, fill=col)
            cx += d.textlength(word + " ", font=f)
        y += int(size * gap)
    return y


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ep"); ap.add_argument("--name", required=True); ap.add_argument("--hero", required=True)
    ap.add_argument("--series", required=True); ap.add_argument("--line1", required=True); ap.add_argument("--line2", default="")
    ap.add_argument("--accent", default=""); ap.add_argument("--thumb-title", default=""); ap.add_argument("--anchor", default="0.5,0.4")
    a = ap.parse_args()
    ep = Path(a.ep); out = ep / "out"; out.mkdir(exist_ok=True)
    hero = Image.open(ep / a.hero if not Path(a.hero).is_absolute() else a.hero).convert("RGB")
    ax = tuple(float(v) for v in a.anchor.split(","))
    lines = [l for l in (a.line1, a.line2) if l]
    # 9:16 cover: the hero on top (62%), a graphite plate below with the title
    W, H = 1080, 1920; top = 1190
    cv = Image.new("RGB", (W, H), BG)
    cv.paste(fit_cover(hero, W, top, ax), (0, 0))
    g = Image.new("L", (1, 220)); g.putdata([int(255 * (i / 219) ** 1.6) for i in range(220)])
    cv.paste(Image.new("RGB", (W, 220), BG), (0, top - 220), g.resize((W, 220)))
    d = ImageDraw.Draw(cv)
    d.text((72, top + 40), a.series.upper(), font=font("JetBrainsMono-VF.ttf", 34, 600), fill=MAG)
    y = draw_title(d, 72, top + 110, lines, a.accent, 168)
    d.text((72, H - 150), "A worked-out what-if  ·  narration: synthetic voice (AI)", font=font("Figtree-VF.ttf", 34, 500), fill=DIM)
    cv.save(out / f"{a.name}-cover.jpg", quality=92)
    cv.resize((480, 854), Image.LANCZOS).save(out / f"{a.name}-cover-480.jpg", quality=90)
    # 16:9 thumbnail: the title left (about 5 words at most), the hero right
    TW, TH = 1280, 720
    th = Image.new("RGB", (TW, TH), BG)
    hw = 470
    th.paste(fit_cover(hero, hw, TH, ax), (TW - hw, 0))
    g2 = Image.new("L", (160, 1)); g2.putdata([int(255 * (1 - i / 159) ** 1.4) for i in range(160)])
    th.paste(Image.new("RGB", (160, TH), BG), (TW - hw, 0), g2.resize((160, TH)))
    d = ImageDraw.Draw(th)
    d.text((64, 70), a.series.upper().replace("POSSIBILITY LAB · ", "POSSIBILITY LAB\n"), font=font("JetBrainsMono-VF.ttf", 28, 600), fill=MAG, spacing=8)
    tt = (a.thumb_title or " ".join(lines)).split()
    # break the title into lines of at most two words, big
    rows = [" ".join(tt[i:i + 2]) for i in range(0, len(tt), 2)]
    draw_title(d, 64, 210, rows, a.accent, 150, 1.0)
    th.save(out / f"{a.name}-thumb.jpg", quality=92)
    print("wrote", out / f"{a.name}-cover.jpg", out / f"{a.name}-cover-480.jpg", out / f"{a.name}-thumb.jpg")


main()
