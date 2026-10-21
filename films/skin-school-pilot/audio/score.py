"""Skin School 8-2, the optional sound: a soft bed and foley on the scene's own events.

Her clips are silent on purpose (the captions carry every line), so this is an alternative cut,
not a replacement. Every event time below comes from the scene (motion/scenes3d.mjs): label
entrances, the plug cells landing, the bacteria appearing, the drops landing, the day counter.
Seeded and deterministic, like the picture.

python3 -I films/skin-school-pilot/audio/score.py OUT.wav
"""
import sys
import wave
import zlib
from pathlib import Path

import numpy as np

SR, DUR = 48000, 26.0
N = int(SR * DUR)
RNG = lambda tag: np.random.default_rng(zlib.crc32(tag.encode()))   # seeded by name: same sound every run


def t_(d):
    return np.arange(int(d * SR)) / SR


def db(x):
    return 10 ** (x / 20)


def hz(n):
    names = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}
    return 440 * 2 ** ((names[n[:-1]] + 12 * (int(n[-1]) + 1) - 69) / 12)


def lp(x, fc, hp=None):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    g = 1 / np.sqrt(1 + (f / fc) ** 4)
    if hp:
        g *= 1 / np.sqrt(1 + (hp / np.maximum(f, 1)) ** 4)
    return np.fft.irfft(X * g, n=len(x))


class Bus:
    def __init__(self):
        self.x = np.zeros((2, N))

    def add(self, sig, t, gain=0.0, pan=0.0):
        a = int(t * SR)
        if a >= N:
            return
        s = sig[: N - a] * db(gain)
        self.x[0, a:a + len(s)] += s * np.sqrt(0.5 * (1 - pan))
        self.x[1, a:a + len(s)] += s * np.sqrt(0.5 * (1 + pan))


def env(n, a, r):
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    if na: e[:na] = np.linspace(0, 1, na)
    if nr: e[-nr:] *= np.linspace(1, 0, nr) ** 2
    return e


# ── voices ─────────────────────────────────────────────────────────
def pad(notes, d, bright=900):
    t = t_(d)
    x = sum(np.sin(2 * np.pi * hz(n) * t * (1 + det)) for n in notes for det in (-0.002, 0.0015))
    x = lp(x / (2 * len(notes)), bright)
    return x * env(len(t), 1.2, 1.6)


def glass(f, d=1.4):                      # a label lands: a soft glass tick with a bell tail
    t = t_(d)
    x = np.sin(2 * np.pi * f * t + 1.2 * np.exp(-t / 0.25) * np.sin(2 * np.pi * f * 2.76 * t))
    return x * np.exp(-t / 0.45) * env(len(t), 0.003, 0.05) * 0.5


def tap(seed, d=0.12):                    # a plug cell settles: a small, woody tap
    t = t_(d)
    n = RNG(f"tap{seed}").standard_normal(len(t))
    body = np.sin(2 * np.pi * (520 + 90 * (seed % 5)) * t) * np.exp(-t / 0.018)
    return (lp(n, 3200, 400) * np.exp(-t / 0.012) * 0.35 + body * 0.6) * env(len(t), 0.001, 0.02)


def fizz(d, seed):                        # bacteria: a tiny, bright crackle
    t = t_(d)
    n = RNG(f"fz{seed}").standard_normal(len(t)) * (RNG(f"fzg{seed}").random(len(t)) < 0.02)
    return lp(n, 9000, 2500) * np.exp(-t / (d / 3)) * 0.8


def plop(f0, d=0.5):                      # a drop meets the skin: a falling sine "bloop"
    t = t_(d)
    f = f0 * (1 + 1.6 * np.exp(-t / 0.035))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.12) * env(len(t), 0.002, 0.08)


def splash(seed, d=0.9):                  # and spreads: a filtered noise wash
    t = t_(d)
    n = RNG(f"sp{seed}").standard_normal(len(t))
    return lp(n, 5200, 600) * (np.exp(-t / 0.22) * (1 - np.exp(-t / 0.01))) * 0.45


def swell(d, f):                          # the wall swelling red: a slow, warm rise
    t = t_(d)
    x = np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 1.5 * t)
    return lp(x, 700) * np.sin(np.pi * t / d) ** 2 * 0.5


def tick(f=2400, d=0.05):
    t = t_(d)
    return np.sin(2 * np.pi * f * t) * np.exp(-t / 0.008)


def reverb(x, sec=2.4, wet=0.3, seed="room"):
    ir_t = t_(sec)
    ir = RNG(seed).standard_normal((2, len(ir_t))) * np.exp(-ir_t / (sec / 5))
    ir[:, : int(0.012 * SR)] = 0
    ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
    L = x.shape[1] + ir.shape[1]
    nfft = 1 << (L - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(ir, nfft), nfft)[:, : x.shape[1]]
    return x * (1 - wet) + y * wet * 3.0


# ── the cue sheet (times from scenes3d.mjs) ────────────────────────
def main(out):
    bed, fx = Bus(), Bus()
    # a slow progression in D major, one chord per shot, the last one held
    chords = [(0, 6, ["D3", "A3", "F#4"]), (6, 12, ["B2", "F#3", "D4"]), (12, 18, ["G2", "D3", "B3"]), (18, 26, ["D3", "A3", "E4", "F#4"])]
    for a, b, notes in chords:
        bed.add(pad(notes, b - a + 1.6, 1100 if a < 18 else 1600), a, -14)
    # labels landing: glass ticks rising through the scale (healthy, clog, inflame, clear)
    labels = [(0.8, "A5"), (1.8, "D6"), (3.0, "F#6"), (7.2, "B5"), (10.4, "F#5"), (13.0, "G5"), (14.6, "B5"), (18.6, "A5"), (22.0, "D6")]
    for i, (t, n) in enumerate(labels):
        fx.add(glass(hz(n)), t, -16, -0.3 + 0.08 * i)
    # the plug fills: each cell lands at 6.3 + (k/20 + 0.25) * 4.5 (k = 0..19), a soft tap and a little bounce tap
    for k in range(20):
        land = 6.0 + 0.3 + (k / 20 + 0.25) * 4.5
        fx.add(tap(k), land, -15 + (k % 3), (-0.2 if k % 2 else 0.2))
        fx.add(tap(k + 50) * 0.5, land + 0.13, -22, (-0.2 if k % 2 else 0.2))
    # oxidizing dark: a low, dimming note under the blackhead (lt 4.2–5.8 → 10.2–11.8)
    bed.add(swell(1.8, hz("B1")), 10.1, -12)
    # bacteria appearing (lt 0.6 + 3.8·k/14 → 12.6–16.4): fizz grains
    for k in range(14):
        fx.add(fizz(0.35, k), 12.6 + 3.8 * k / 14, -14, -0.4 + 0.06 * k)
    # the wall swells red (lt 1.6–5.4 → 13.6–17.4)
    bed.add(swell(3.8, hz("D2")), 13.6, -10)
    # the drops: a stretch whistle as each falls, a plop and a splash as it lands
    for t_fall, t_land, f0, seed in ((18.1, 19.0, 300, 1), (21.6, 22.4, 360, 2)):
        tt = t_(t_land - t_fall)
        whistle = np.sin(2 * np.pi * np.cumsum(900 + 1400 * (tt / tt[-1]) ** 2) / SR) * (tt / tt[-1]) ** 3 * 0.12
        fx.add(whistle, t_fall, -12, 0.1)
        fx.add(plop(f0), t_land, -7, 0.0)
        fx.add(splash(seed), t_land + 0.01, -14, 0.15)
    # the plug dissolving (lt 1.4–4.6 → 19.4–22.6): a soft sparkle
    for k in range(18):
        fx.add(glass(hz(["D7", "F#7", "A7", "E7"][k % 4]), 0.4) * 0.5, 19.4 + 3.2 * k / 18, -26, -0.5 + k / 18)
    # the day counter (lt 6.6–7.9 → 24.6–25.9, eased out): a tick every 10 days, then the chime
    for d in range(10, 91, 10):
        p = d / 90
        tt_ = 24.6 + 1.3 * (1 - (1 - p) ** (1 / 3))      # inverse of the counter's ease-out
        fx.add(tick(2200 + 30 * d), tt_, -20, 0.2)
    for i, n in enumerate(["D5", "F#5", "A5", "D6"]):
        fx.add(glass(hz(n), 2.2), 25.0 + i * 0.06, -12, -0.3 + 0.2 * i)
    mix = reverb(bed.x, 3.2, 0.35, "hall") + reverb(fx.x, 1.6, 0.22, "room")
    mix[:, -int(0.6 * SR):] *= np.linspace(1, 0, int(0.6 * SR)) ** 2
    mix = np.tanh(mix * 1.1) / 1.1
    mix *= db(-3) / np.abs(mix).max()
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    with wave.open(out, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(mix.T, -1, 1) * 32767).astype("<i2").tobytes())
    print(f"8-2 score → {out}")


if __name__ == "__main__":
    main(sys.argv[1])
