"""Spectrogram of the mix with every timeline cue and shot boundary drawn on it (review aid).

python3 -I films/made-with-claude/scripts/cue_spectrogram.py MIX.wav CUES.json OUT.png
"""
import json
import sys
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

FILM = Path(__file__).resolve().parent.parent
J = json.loads((FILM / "src" / "timeline.json").read_text())
COL = {"impact": (255, 80, 80), "land": (255, 210, 90), "takeoff": (160, 160, 160), "zap": (120, 200, 255), "key": (140, 255, 140),
       "select": (200, 140, 255), "glow": (255, 160, 220), "coo": (255, 255, 255), "blip": (255, 140, 60), "shatter": (255, 120, 120)}


def font(n):
    try:
        return ImageFont.truetype("DejaVuSans.ttf", n)
    except OSError:
        return ImageFont.load_default()


def main(wav, cues_path, out):
    with wave.open(wav) as w:
        sr = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), "<i2").astype(np.float32).reshape(-1, w.getnchannels()).mean(axis=1) / 32768
    hop, win = 256, 2048
    frames = np.lib.stride_tricks.sliding_window_view(x, win)[::hop]
    S = np.abs(np.fft.rfft(frames * np.hanning(win), axis=1)) / (np.hanning(win).sum() / 2)
    f = np.fft.rfftfreq(win, 1 / sr)
    # log-frequency rows 30 Hz – 16 kHz
    H, Wd = 360, 1800
    rows = np.geomspace(30, 16000, H)[::-1]
    idx = np.clip(np.searchsorted(f, rows), 0, len(f) - 1)
    db = 20 * np.log10(S[:, idx].T + 1e-6)
    db = np.clip((db + 96) / 84, 0, 1)
    img = Image.fromarray((np.stack([db ** 1.2 * 255, db ** 2.2 * 215, db ** 4 * 150], -1)).astype(np.uint8)).resize((Wd, H))
    canvas = Image.new("RGB", (Wd + 60, H + 120), (12, 10, 9))
    canvas.paste(img, (50, 30))
    d = ImageDraw.Draw(canvas)
    dur = len(x) / sr
    X = lambda t: 50 + t / dur * Wd
    for s in J["shots"]:
        d.line([(X(s["start"]), 22), (X(s["start"]), H + 34)], fill=(90, 90, 90))
        d.text((X(s["start"]) + 3, 8), s["id"] + " " + s["name"], font=font(12), fill=(200, 200, 200))
    beat = 60 / J["bpm"]
    t = 0.0
    while t <= dur:
        d.line([(X(t), H + 30), (X(t), H + 38)], fill=(120, 120, 120))
        if abs(t - round(t)) < 1e-6:
            d.text((X(t) - 6, H + 40), f"{t:.0f}s", font=font(11), fill=(160, 160, 160))
        t += beat
    cues = json.loads(Path(cues_path).read_text())
    for i, c in enumerate(cues):
        col = COL.get(c["kind"], (255, 255, 255))
        d.line([(X(c["t"]), 30), (X(c["t"]), H + 30)], fill=col, width=1)
        d.text((X(c["t"]) + 2, H + 56 + (i % 3) * 14), c["kind"], font=font(10), fill=col)
    canvas.save(out)
    print(f"cue spectrogram → {out}")


if __name__ == "__main__":
    main(*sys.argv[1:4])
