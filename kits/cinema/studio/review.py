"""A picture of the sound for review: the mix's spectrogram with every section and placed cue on it.

  python3 -I kits/cinema/studio/review.py OUTDIR      (reads mix.wav, sheet.json, cues-placed.json)
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from studio.core import SR, read_wav            # noqa: E402

PALETTE = [(255, 214, 120), (140, 220, 255), (255, 140, 170), (170, 255, 170), (210, 170, 255), (255, 170, 110), (230, 230, 230)]


def _font(n):
    try:
        return ImageFont.truetype("DejaVuSans.ttf", n)
    except OSError:
        return ImageFont.load_default()


def spectrogram(outdir, width=1800, height=360):
    out = Path(outdir)
    x = read_wav(out / "mix.wav").mean(1)
    sheet = json.loads((out / "sheet.json").read_text())
    placed = json.loads((out / "cues-placed.json").read_text())
    hop, win = 256, 2048
    frames = np.lib.stride_tricks.sliding_window_view(x, win)[::hop]
    S = np.abs(np.fft.rfft(frames * np.hanning(win), axis=1)) / (np.hanning(win).sum() / 2)
    f = np.fft.rfftfreq(win, 1 / SR)
    rows = np.geomspace(30, 16000, height)[::-1]
    idx = np.clip(np.searchsorted(f, rows), 0, len(f) - 1)
    lvl = np.clip((20 * np.log10(S[:, idx].T + 1e-6) + 96) / 84, 0, 1)
    img = Image.fromarray(np.stack([lvl ** 1.2 * 255, lvl ** 2.2 * 215, lvl ** 4 * 150], -1).astype(np.uint8)).resize((width, height))
    kinds = sorted({p["kind"] for p in placed})
    col = {k: PALETTE[i % len(PALETTE)] for i, k in enumerate(kinds)}
    canvas = Image.new("RGB", (width + 60, height + 80 + 16 * ((len(kinds) + 5) // 6)), (12, 10, 9))
    canvas.paste(img, (50, 30))
    d = ImageDraw.Draw(canvas)
    dur = len(x) / SR
    X = lambda t: 50 + t / dur * width
    for s in sheet["sections"]:
        d.line([(X(s["t0"]), 22), (X(s["t0"]), height + 34)], fill=(110, 110, 110))
        d.text((X(s["t0"]) + 3, 8), s["id"], font=_font(12), fill=(210, 210, 210))
    for t in range(int(dur) + 1):
        d.line([(X(t), height + 30), (X(t), height + 36)], fill=(120, 120, 120))
        if t % 2 == 0:
            d.text((X(t) - 6, height + 38), f"{t}s", font=_font(11), fill=(160, 160, 160))
    for p in placed:
        d.line([(X(p["sound"]), 30), (X(p["sound"]), height + 30)], fill=col[p["kind"]], width=1)
    for i, k in enumerate(kinds):
        d.text((50 + (i % 6) * 280, height + 58 + 16 * (i // 6)), "— " + k, font=_font(12), fill=col[k])
    canvas.save(out / "spectrogram.png")
    return out / "spectrogram.png"


if __name__ == "__main__":
    print(spectrogram(sys.argv[1]))
