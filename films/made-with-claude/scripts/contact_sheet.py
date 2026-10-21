"""Tile rendered frames into a labelled contact sheet.

python3 -I contact_sheet.py FRAMES_DIR OUT.jpg FORMAT FPS frame frame …
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

FILM = Path(__file__).resolve().parent.parent
INK, CREAM, FLAME = (16, 12, 9), (243, 233, 215), (232, 163, 86)


def font(size):
    for name in ("DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default()


def main():
    src, out, fmt, fps = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3], int(sys.argv[4])
    frames = [int(f) for f in sys.argv[5:]]
    tl = json.loads((FILM / "src" / "timeline.json").read_text())
    tw, th, cols = (384, 216, 5) if fmt == "16x9" else (180, 320, 9)
    pad, lab, head = 10, 22, 56
    rows = -(-len(frames) // cols)
    sheet = Image.new("RGB", (cols * (tw + pad) + pad, head + rows * (th + lab + pad) + pad), INK)
    d = ImageDraw.Draw(sheet)
    d.text((pad, 16), f"{tl['title']} · {fmt} · {out.stem.split('-')[-1]} · one frame per 0.5 s · 120 BPM (beat = 0.5 s)", font=font(20), fill=FLAME)
    f14 = font(13)
    for i, f in enumerate(frames):
        t = f / fps
        shot = next(s["id"] for s in reversed(tl["shots"]) if t >= s["start"])
        x = pad + (i % cols) * (tw + pad)
        y = head + (i // cols) * (th + lab + pad)
        im = Image.open(src / f"{f:04d}.png").convert("RGB").resize((tw, th), Image.LANCZOS)
        sheet.paste(im, (x, y))
        d.text((x, y + th + 4), f"{shot}  {t:5.2f}s  f{f}", font=f14, fill=CREAM)
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out, quality=88)
    print(f"contact sheet → {out}")


if __name__ == "__main__":
    main()
