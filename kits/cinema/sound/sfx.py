"""Studio sound effects for every channel: sounds that move with the picture, made here from noise and sine waves
(no samples, nothing licensed), seeded per cue so a rebuild is identical.

  python -I sfx.py FILM.json CUES.json OUT.wav            (the stem, on the delivered timeline, ducked under the voice)

CUES.json = {"palette": "space" | "kitchen" | "earth" | "asmr", "cues": [...]}. Each cue:
  {"at": 12.4 | "word:apple#2+0.1" | "cap:ch8_loop" | "capend:ch8_loop-0.2" | "shot:body2+1.0" | [A, B, f],
   "kind": ..., "dur": s | "until": anchor, "pan": -1..1 or [from, to] (a moving sound), "gain": dB,
   "note": scale index (tile), "repeat": n, "every": s, "step": notes per repeat, "seed": int}
Anchors are times in the delivered film (film.json): a plain number, a caption word (the n-th), the start/end of the first
caption whose "line" id matches, a shot's start, or a point between two anchors. Times are divided by film "pace" if set.

Kinds
  space:   shooting_star, mass (a heavy mass moving), boom (deep impact), whoosh, riser (tension into a cut), surge (the sea
           lifting), wave (a wash), crack (rock splitting), debris (rock and dust falling), shimmer (a ring of light forming),
           hush (the light going dim), tick (a counter step)
  kitchen: drip, clink (ceramic), buzz (a fly), whiz (something fast passing), slowmo (a deep slowed-down pass), splat,
           spray (a burst of droplets), thunder
  earth:   wind (gusts), rumble (ground), whoosh, riser, boom, crack, debris
  asmr:    tile (soft piano-tile note, A major pentatonic, 5 = A4), squeeze, squish, pinch, rip, peel, pop, tap, glide,
           tremble, creak, dust
Any kind works with any palette; the palette sets the low-cut (asmr keeps nothing under 150 Hz) and how far it dips under
the voice. Voice times come from the captions."""
import json, re, sys
import numpy as np, soundfile as sf

SR = 48000
SCALE = [220.0, 246.94, 277.18, 329.63, 369.99, 440.0, 493.88, 554.37, 659.26, 739.99, 880.0, 987.77, 1108.73, 1318.51, 1479.98, 1760.0]
PALETTE = {"asmr": {"lowcut": 150, "duck": -5}, "space": {"lowcut": 32, "duck": -6}, "kitchen": {"lowcut": 40, "duck": -6},
           "earth": {"lowcut": 32, "duck": -6}}
LEVEL = {  # loudness of each sound's loudest 0.4 s, in dBFS RMS, before the dip under the voice ("gain" moves it per cue)
    "tile": -22, "squeeze": -19, "squish": -21, "pinch": -23, "rip": -23, "peel": -22, "pop": -23, "tap": -23, "glide": -25,
    "tremble": -23, "creak": -23, "dust": -29, "shooting_star": -18, "mass": -17, "boom": -14, "whoosh": -19, "riser": -16,
    "surge": -17, "wave": -18, "crack": -16, "debris": -19, "shimmer": -22, "hush": -21, "tick": -25, "drip": -21, "clink": -21,
    "buzz": -23, "whiz": -16, "slowmo": -16, "splat": -15, "spray": -18, "thunder": -15, "wind": -19, "rumble": -17}


# ── helpers ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
def tt(d): return np.arange(max(1, int(d * SR))) / SR


def band(x, lo, hi):
    X = np.fft.rfft(x, axis=0); f = np.fft.rfftfreq(len(x), 1 / SR); m = np.ones_like(f)
    if lo: m *= np.clip((f - lo * 0.7) / (lo * 0.3), 0, 1)
    if hi: m *= np.clip((hi * 1.3 - f) / (hi * 0.3), 0, 1)
    return np.fft.irfft(X * (m[:, None] if x.ndim == 2 else m), len(x), axis=0)


def norm(x):
    p = np.abs(x).max(); return x / p if p > 0 else x


def smooth(rng, n, hz):
    m = band(rng.standard_normal(n), None, hz); return m / (np.abs(m).max() + 1e-9)


def brown(rng, n):
    x = np.cumsum(rng.standard_normal(n)); x -= np.linspace(x[0], x[-1], n); return x / (np.abs(x).max() + 1e-9)


def sweep(noise, fc, q=0.35, nb=28):
    """Noise through a band-pass whose centre follows fc (per sample): crossfaded fixed bands (smooth, no zipper)."""
    lo, hi = max(40.0, fc.min() * 0.8), min(16000.0, fc.max() * 1.25); cs = np.geomspace(lo, hi, nb); step = np.log(cs[1] / cs[0]) if nb > 1 else 1
    out = np.zeros_like(noise)
    for c in cs:
        w = np.exp(-(np.log(fc / c) / (step * 0.9)) ** 2)
        if w.max() > 1e-3: out += band(noise, c * (1 - q), c * (1 + q)) * w
    return out


def clicks(rng, d, rate_env, lo, hi, width=(0.0004, 0.0015)):
    n = len(tt(d)); out = np.zeros(n); hits = np.nonzero(rng.random(n) < rate_env / SR)[0]
    for h in hits:
        w = int(rng.uniform(*width) * SR) + 8; s = rng.standard_normal(w) * np.exp(-np.arange(w) / (w / 3)) * rng.uniform(0.25, 1.0)
        out[h:h + w] += s[: n - h]
    return band(out, lo, hi)


def chirp(f, t): return np.sin(2 * np.pi * np.cumsum(f) / SR) if np.ndim(f) else np.sin(2 * np.pi * f * t)


def stereo(rng, make):
    """Two decorrelated takes of the same recipe (wide ambiences)."""
    return np.stack([make(np.random.default_rng(rng.integers(1 << 30))), make(np.random.default_rng(rng.integers(1 << 30)))], 1)


# ── asmr (the Skin Sense set) ──────────────────────────────────────────────────────────────────────────────────────────────
def tile(rng, note=5, d=2.2):
    f = SCALE[int(np.clip(note, 0, len(SCALE) - 1))]; t = tt(d); tau = 0.55 * (440 / f) ** 0.3; x = np.zeros_like(t)
    for r, a, dm in ((1, 1.0, 1.0), (2.0, 0.32, 0.55), (3.0, 0.11, 0.35), (4.16, 0.045, 0.22), (5.4, 0.02, 0.15)):
        x += a * np.sin(2 * np.pi * f * r * t + rng.uniform(0, 6.28)) * np.exp(-t / (tau * dm))
    x += 0.22 * np.sin(2 * np.pi * f * 1.0016 * t) * np.exp(-t / tau)
    x *= (1 - np.exp(-t / 0.0035)) * np.clip((d - t) / (0.4 * d), 0, 1) ** 1.5
    return band(x + band(rng.standard_normal(len(t)), 300, 1600) * np.exp(-t / 0.006) * 0.06, 150, 7000)


def squeeze(rng, d=1.0, fast=False):
    t = tt(d); u = t / d
    env = np.sin(np.pi * np.clip(u / (0.35 if fast else 0.5), 0, 1) * 0.5) * np.clip((1 - u) / (0.5 if fast else 0.55), 0, 1) ** 1.3
    lo, mid, hi = (norm(band(rng.standard_normal(len(t)), a, b)) for a, b in ((260, 900), (700, 2200), (1900, 5200)))
    w = np.clip(u * 1.4, 0, 1); body = (1 - w) * 0.55 * hi + 0.8 * mid + w * lo
    wet = np.clip(0.45 + 0.75 * smooth(rng, len(t), 28 if fast else 22), 0, None) ** 1.4
    cl = clicks(rng, d, (55 if fast else 38) * env + 4, 2200, 7500)
    thump = chirp(np.linspace(240, 160, len(t)), t) * np.exp(-t / (0.06 if fast else 0.12)) * 0.35
    return (norm(body * wet) * 0.8 + norm(cl) * 0.38 + thump) * env


def pinch(rng, d=0.18):
    t = tt(d); sq = chirp(np.linspace(1850, 2550, len(t)) * (1 + 0.01 * np.sin(2 * np.pi * 38 * t)), t)
    return (norm(band(rng.standard_normal(len(t)), 2800, 8000) * np.exp(-t / 0.0022)) * 0.8 + sq * (1 - np.exp(-t / 0.004)) * np.exp(-t / 0.045) * 0.22
            + norm(band(rng.standard_normal(len(t)), 1000, 4200) * np.exp(-t / 0.014)) * 0.4)


def rip(rng, d=0.6, rate=650, lo=1800, hi=7000):
    t = tt(d); dens = np.sin(np.pi * t / d) ** 0.8
    return norm(clicks(rng, d, rate * dens + 5, lo, hi)) + norm(band(rng.standard_normal(len(t)), lo + 300, hi - 1500) * dens) * 0.14


def pop(rng, d=0.09, f0=620):
    t = tt(d); return chirp(f0 * (1 + np.clip(t / 0.018, 0, 1)), t) * np.exp(-t / 0.024) * (1 - np.exp(-t / 0.0015)) + band(rng.standard_normal(len(t)), 2000, 6000) * np.exp(-t / 0.0012) * 0.25


def peel(rng, d=0.7):
    x = rip(rng, d, rate=260, lo=900, hi=4500) * 0.85; t = tt(0.06)
    x[-len(t):] += chirp(np.linspace(430, 180, len(t)), t) * np.exp(-t / 0.028) * 0.7 + band(rng.standard_normal(len(t)), 600, 3000) * np.exp(-t / 0.004) * 0.2
    return x


def tap(rng, d=0.12, f=250):
    t = tt(d); return band(rng.standard_normal(len(t)), 300, 2600) * np.exp(-t / 0.005) * 0.6 + np.sin(2 * np.pi * f * t) * np.exp(-t / 0.035) + 0.25 * np.sin(2 * np.pi * f * 2.46 * t) * np.exp(-t / 0.02)


def glide(rng, d=0.9, note=8, down=False):
    t = tt(d); u = t / d; ph = 2 * np.pi * np.cumsum(SCALE[note] * 2 ** ((-1 if down else 1) * u ** 1.6)) / SR
    return (np.sin(ph) + 0.3 * np.sin(2 * ph + 1)) * np.sin(np.pi * u) ** 1.5 * (1 + 0.08 * np.sin(2 * np.pi * 6 * t))


def tremble(rng, d=2.0, rate=16):
    out = np.zeros(len(tt(d))); t = 0.0
    while t < d - 0.05:
        s = tap(rng, 0.05) * (0.35 + 0.65 * np.sin(np.pi * t / d) ** 0.7) * rng.uniform(0.5, 1.0); i = int(t * SR); out[i:i + len(s)] += s[: len(out) - i]; t += rng.uniform(0.8, 1.2) / rate
    return band(out, 180, 6000)


def creak(rng, d=1.2, f1=900, f2=1730):
    out = np.zeros(len(tt(d))); t = 0.0
    while t < d - 0.02:
        u = t / d; tk = tt(0.008); s = (np.sin(2 * np.pi * f1 * tk) + 0.5 * np.sin(2 * np.pi * f2 * tk)) * np.exp(-tk / 0.0022) * np.sin(np.pi * u) ** 0.6 * rng.uniform(0.6, 1.0)
        i = int(t * SR); out[i:i + len(s)] += s[: len(out) - i]; t += rng.uniform(0.85, 1.15) / (22 + 55 * u)
    return band(out, min(f1, f2) * 0.45, 5000)


def dust(rng, d=3.0, rate=12):
    t = tt(d); return clicks(rng, d, rate * np.sin(np.pi * t / d) ** 0.5 + 1, 4000, 9500, (0.0002, 0.0005))


# ── space ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
def shooting_star(rng, d=1.4):
    t = tt(d); u = t / d; env = np.clip(u / 0.12, 0, 1) ** 1.5 * np.clip((1 - u) / 0.8, 0, 1) ** 2
    streak = norm(sweep(rng.standard_normal(len(t)), 7500 * (1800 / 7500) ** u, q=0.22)) * env
    tw = 1 + 0.5 * np.sin(2 * np.pi * 23 * t + rng.uniform(0, 6)); sp = sum(a * chirp(f0 * (f1 / f0) ** u, t) for f0, f1, a in ((4200, 2500, 1), (5600, 3400, 0.6), (3100, 1850, 0.5)))
    tail = clicks(rng, d, 70 * np.clip((u - 0.35) / 0.65, 0, 1) * (1 - u) + 0.5, 5000, 10000, (0.0002, 0.0006))
    return streak + norm(sp) * 0.16 * env * tw + norm(tail) * 0.22


def mass(rng, d=4.0, f0=46):
    t = tt(d); u = t / d; env = np.sin(np.pi * np.clip(u, 0, 1)) ** 1.6
    def one(r):
        tone = sum(a * np.sin(2 * np.pi * f0 * k * (1 + r.uniform(-0.004, 0.004)) * t + r.uniform(0, 6)) for k, a in ((1, 1), (1.5, 0.5), (2, 0.45), (3, 0.2)))
        tone *= 0.8 + 0.2 * np.sin(2 * np.pi * 0.35 * t)
        grind = band(brown(r, len(t)), 40, 320) * np.clip(0.4 + 0.8 * smooth(r, len(t), 7), 0, None)
        return np.tanh(1.8 * (norm(tone) * 0.8 + norm(grind) * 0.6))
    return band(stereo(rng, one) * env[:, None], 30, 1400)


def boom(rng, d=3.0):
    t = tt(d); f = 38 + 72 * np.exp(-t / 0.11)
    body = chirp(f, t) * np.exp(-t / 0.9) * (1 - np.exp(-t / 0.002))
    hit = band(rng.standard_normal(len(t)), 40, 900) * np.exp(-t / 0.035) * 0.7
    def tail(r): return band(r.standard_normal(len(t)), 30, 160) * np.exp(-t / 1.3)
    x = np.tanh(1.6 * (body + norm(hit) * 0.6))[:, None] + norm(stereo(rng, tail)) * 0.45
    return x


def whoosh(rng, d=1.0):
    t = tt(d); u = t / d; fc = np.exp(np.log(380) + (np.log(2600) - np.log(380)) * np.sin(np.pi * u) ** 1.3)
    return norm(sweep(rng.standard_normal(len(t)), fc, q=0.45)) * np.sin(np.pi * u) ** 1.6


def riser(rng, d=3.0):
    t = tt(d); u = t / d; a = u ** 2.2
    nz = norm(sweep(rng.standard_normal(len(t)), 300 * (4500 / 300) ** (u ** 1.4), q=0.35))
    tone = chirp(110 * 2 ** (2.2 * u ** 1.3), t) + 0.6 * chirp(165 * 2 ** (2.2 * u ** 1.3), t)
    x = (nz * 0.8 + norm(tone) * 0.35) * a; x[-int(0.012 * SR):] *= np.linspace(1, 0, int(0.012 * SR)); return x


def surge(rng, d=4.0):
    t = tt(d); u = t / d; swell = np.sin(np.pi * u) ** 1.2; crest = np.exp(-((u - 0.62) / 0.18) ** 2)
    def one(r):
        body = band(r.standard_normal(len(t)), 90, 1100) * (0.7 + 0.3 * smooth(r, len(t), 3))
        fizz = band(r.standard_normal(len(t)), 2500, 9000) * crest * 0.35
        bub = clicks(r, d, 40 * crest + 1, 1500, 6000, (0.001, 0.003)) * 0.6
        return norm(body) * swell + norm(fizz) * 0.3 + norm(bub) * 0.25
    return stereo(rng, one)


def wave(rng, d=2.5):
    t = tt(d); env = (1 - np.exp(-t / 0.15)) * np.exp(-t / 0.9); foam = (1 - np.exp(-t / 0.3)) * np.exp(-t / 1.4)
    def one(r): return norm(band(r.standard_normal(len(t)), 200, 6000)) * env + norm(band(r.standard_normal(len(t)), 3000, 9500)) * foam * 0.35
    return stereo(rng, one)


def crack(rng, d=1.6):
    t = tt(d); out = np.zeros(len(t)); u = t / d
    for k in range(int(rng.integers(3, 6))):
        c = rng.uniform(0.0, 0.75) * d; w = rng.uniform(0.04, 0.12); e = np.exp(-((t - c - w / 2) / (w / 2)) ** 4)
        out += norm(clicks(rng, d, 2200 * e + 1, 700, 6500)) * rng.uniform(0.5, 1.0)
        tk = np.clip(t - c, 0, None); out += chirp(70 * np.exp(-tk / 0.4) + 38, t) * np.exp(-tk / 0.15) * (t >= c) * 0.5
    grind = creak(rng, d, 260, 470) * 0.35
    return np.tanh(1.3 * (out + grind))


def debris(rng, d=3.0):
    t = tt(d); n = len(t)
    def one(r):
        out = np.zeros(n)
        for _ in range(int(55 * d / 3)):
            c = d * r.random() ** 1.8; s = tap(r, 0.08, r.uniform(150, 650)) * np.exp(-c / d * 1.5) * r.uniform(0.3, 1.0); i = int(c * SR); out[i:i + len(s)] += s[: n - i]
        rum = band(brown(r, n), 30, 140) * np.exp(-t / (d * 0.5))
        return norm(out) * 0.8 + norm(rum) * 0.5
    return stereo(rng, one)


def shimmer(rng, d=4.0):
    t = tt(d); u = t / d; env = np.clip(u / 0.4, 0, 1) ** 1.5 * np.clip((1 - u) / 0.35, 0, 1)
    fs = [1318.5, 1479.98, 1760.0, 1975.5, 2217.5, 2637.0]; L = np.zeros(len(t)); R = np.zeros(len(t))
    for i, f in enumerate(fs):
        s = np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * (0.5 + 0.5 * np.sin(2 * np.pi * rng.uniform(0.2, 0.7) * t + rng.uniform(0, 6)))
        (L if i % 2 == 0 else R)[:] += s
    sp = clicks(rng, d, 7 * env + 0.5, 4000, 9500, (0.0002, 0.0005))
    return np.stack([norm(L) * env + norm(sp) * 0.3, norm(R) * env + norm(sp[::-1]) * 0.3], 1)


def hush(rng, d=3.0):
    t = tt(d); u = t / d; env = np.sin(np.pi * u)
    def one(r): return norm(sweep(band(r.standard_normal(len(t)), 60, 9000), 6000 * (260 / 6000) ** u, q=0.6)) * env
    low = (np.sin(2 * np.pi * 55 * t) + 0.5 * np.sin(2 * np.pi * 82.4 * t)) * env * 0.25
    return stereo(rng, one) + low[:, None]


def tick(rng, d=0.06):
    t = tt(d); return np.sin(2 * np.pi * 2600 * t) * np.exp(-t / 0.004) + band(rng.standard_normal(len(t)), 3000, 9000) * np.exp(-t / 0.0008) * 0.3


# ── kitchen ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
def drip(rng, d=0.25):
    t = tt(d); f = 850 + 950 * (1 - np.exp(-t / 0.008))
    return chirp(f, t) * np.exp(-t / 0.05) * (1 - np.exp(-t / 0.001)) + band(rng.standard_normal(len(t)), 3000, 8000) * np.exp(-t / 0.01) * 0.2


def clink(rng, d=0.9):
    t = tt(d); x = sum(a * np.sin(2 * np.pi * f * rng.uniform(0.99, 1.01) * t + rng.uniform(0, 6)) * np.exp(-t / dc) for f, a, dc in ((2140, 1, 0.45), (3460, 0.6, 0.3), (5590, 0.35, 0.2), (7020, 0.2, 0.12)))
    return x + band(rng.standard_normal(len(t)), 2000, 9000) * np.exp(-t / 0.001) * 0.4


def buzz(rng, d=2.0, f0=205):
    t = tt(d); u = t / d; f = f0 * (1 + 0.07 * smooth(rng, len(t), 3)); ph = 2 * np.pi * np.cumsum(f) / SR
    x = sum(np.sin(k * ph) / k for k in range(1, 14)) * (1 + 0.25 * np.sin(2 * np.pi * 190 * t))
    return band(x, 180, 5000) * np.clip(u / 0.12, 0, 1) * np.clip((1 - u) / 0.12, 0, 1)


def whiz(rng, d=0.45):
    t = tt(d); u = t / d; crk = band(rng.standard_normal(len(t)), 800, 9000) * np.exp(-t / 0.0015)
    return norm(sweep(rng.standard_normal(len(t)), 5200 * (850 / 5200) ** (u ** 0.6), q=0.35)) * np.exp(-u * 3) * (1 - np.exp(-t / 0.004)) + norm(crk) * 0.6


def slowmo(rng, d=3.0):
    """A pass slowed right down: a deep, dark, stretched whoosh with a low tone that bends."""
    t = tt(d); u = t / d; env = np.sin(np.pi * np.clip(u, 0, 1)) ** 1.2
    nz = norm(sweep(band(brown(rng, len(t)), 40, 3000), 140 * (900 / 140) ** np.sin(np.pi * u * 0.5), q=0.5))
    tone = chirp(55 + 50 * np.sin(np.pi * u * 0.5), t)
    return np.tanh(1.4 * (nz * 0.9 + tone * 0.45)) * env


def splat(rng, d=0.5):
    t = tt(d); thud = chirp(130 * np.exp(-t / 0.08) + 60, t) * np.exp(-t / 0.12)
    return squeeze(rng, d, fast=True) * 0.8 + thud * 0.7 + norm(clicks(rng, d, 300 * np.exp(-t / 0.08) + 1, 1500, 7000)) * 0.35


def spray(rng, d=1.6):
    t = tt(d); u = t / d
    def one(r): return norm(clicks(r, d, 900 * np.exp(-u * 2.5) + 2, 1200, 8000, (0.0006, 0.002))) * (1 - np.exp(-t / 0.01)) + norm(band(r.standard_normal(len(t)), 1500, 7000)) * np.exp(-u * 3) * 0.25
    return stereo(rng, one)


def thunder(rng, d=5.0):
    t = tt(d)
    def one(r):
        crk = band(r.standard_normal(len(t)), 300, 8000) * np.exp(-t / 0.05) * 0.8
        roll = band(r.standard_normal(len(t)), 30, 320) * sum(np.exp(-np.clip(t - c, 0, None) / r.uniform(0.3, 0.9)) * (t >= c) * r.uniform(0.4, 1.0) for c in r.uniform(0, 2.2, 6))
        return np.tanh(1.5 * (norm(crk) * 0.5 + norm(roll * np.exp(-t / 1.8))))
    return stereo(rng, one)


# ── earth ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
def wind(rng, d=4.0):
    t = tt(d); u = t / d; env = np.clip(u / 0.2, 0, 1) * np.clip((1 - u) / 0.25, 0, 1)
    def one(r):
        g = np.clip(0.35 + 0.8 * smooth(r, len(t), 1.2), 0.05, None)
        body = norm(band(r.standard_normal(len(t)), 220, 2600)) * g
        wh = norm(sweep(r.standard_normal(len(t)), 1050 * 2 ** (0.4 * smooth(r, len(t), 0.6)), q=0.06)) * g * 0.35
        return body + wh
    return stereo(rng, one) * env[:, None]


def rumble(rng, d=3.0):
    t = tt(d); u = t / d; env = np.sin(np.pi * u) ** 1.1
    def one(r): return np.tanh(1.6 * norm(band(brown(r, len(t)), 30, 220) * np.clip(0.5 + 0.6 * smooth(r, len(t), 9), 0, None)))
    return stereo(rng, one) * env[:, None]


MAKERS = {"tile": lambda r, c: tile(r, c.get("note", 5), c.get("dur", 2.2)), "squeeze": lambda r, c: squeeze(r, c.get("dur", 1.0)),
          "squish": lambda r, c: squeeze(r, c.get("dur", 0.32), fast=True), "pinch": lambda r, c: pinch(r), "rip": lambda r, c: rip(r, c.get("dur", 0.6)),
          "peel": lambda r, c: peel(r, c.get("dur", 0.7)), "pop": lambda r, c: pop(r, f0=c.get("f0", 620)), "tap": lambda r, c: tap(r),
          "glide": lambda r, c: glide(r, c.get("dur", 0.9), c.get("note", 8), c.get("down", False)), "tremble": lambda r, c: tremble(r, c.get("dur", 2.0), c.get("rate", 16)),
          "creak": lambda r, c: creak(r, c.get("dur", 1.2)), "dust": lambda r, c: dust(r, c.get("dur", 3.0), c.get("rate", 12)),
          "shooting_star": lambda r, c: shooting_star(r, c.get("dur", 1.4)), "mass": lambda r, c: mass(r, c.get("dur", 4.0), c.get("f0", 46)),
          "boom": lambda r, c: boom(r, c.get("dur", 3.0)), "whoosh": lambda r, c: whoosh(r, c.get("dur", 1.0)), "riser": lambda r, c: riser(r, c.get("dur", 3.0)),
          "surge": lambda r, c: surge(r, c.get("dur", 4.0)), "wave": lambda r, c: wave(r, c.get("dur", 2.5)), "crack": lambda r, c: crack(r, c.get("dur", 1.6)),
          "debris": lambda r, c: debris(r, c.get("dur", 3.0)), "shimmer": lambda r, c: shimmer(r, c.get("dur", 4.0)), "hush": lambda r, c: hush(r, c.get("dur", 3.0)),
          "tick": lambda r, c: tick(r), "drip": lambda r, c: drip(r), "clink": lambda r, c: clink(r), "buzz": lambda r, c: buzz(r, c.get("dur", 2.0), c.get("f0", 205)),
          "whiz": lambda r, c: whiz(r, c.get("dur", 0.45)), "slowmo": lambda r, c: slowmo(r, c.get("dur", 3.0)), "splat": lambda r, c: splat(r, c.get("dur", 0.5)),
          "spray": lambda r, c: spray(r, c.get("dur", 1.6)), "thunder": lambda r, c: thunder(r, c.get("dur", 5.0)), "wind": lambda r, c: wind(r, c.get("dur", 4.0)),
          "rumble": lambda r, c: rumble(r, c.get("dur", 3.0))}


# ── timing ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
def caption_spans(film):
    """Every caption as (t0, t1, line id, words [(w, t)]) across the studio's caption formats."""
    out = []
    for c in film.get("captions") or film.get("caps") or []:
        if not isinstance(c, dict): continue
        if "w" in c: out.append((c["t0"], c.get("t1", c["t0"] + 0.3), c.get("line"), [(c["w"], c["t0"])])); continue
        ws = []
        if c.get("lines"):
            for ln in c["lines"]: ws += [(str(w[0]), float(w[1])) for w in ln if isinstance(w, list) and len(w) >= 2]
        elif c.get("text"):
            tx = str(c["text"]).split(); sp = max(0.1, c.get("t1", c["t0"] + 1) - c["t0"]); ws = [(w, c["t0"] + sp * j / max(1, len(tx))) for j, w in enumerate(tx)]
        out.append((c["t0"], c.get("t1", c["t0"] + 1), c.get("line"), ws))
    return out


def resolver(film):
    caps = caption_spans(film); words = [(re.sub(r"[^a-z0-9]", "", w.lower()), t) for _, _, _, ws in caps for w, t in ws]
    shots = {s.get("name"): s["at"] for s in film.get("shots") or [] if isinstance(s, dict) and "at" in s}

    def one(a):
        a = str(a).strip()
        if re.fullmatch(r"-?[\d.]+", a): return float(a)
        m = re.fullmatch(r"([a-z]+):([^#+\-]+?)(?:#(\d+))?([+-][\d.]+)?", a)
        if not m: raise SystemExit(f"sfx: can't read anchor {a!r}")
        kind, key, k, off = m[1], m[2], int(m[3] or 1), float(m[4] or 0)
        if kind == "word":
            hits = [t for w, t in words if w == re.sub(r"[^a-z0-9]", "", key.lower())]
            if len(hits) < k: raise SystemExit(f"sfx: caption word {key!r} #{k} not found")
            return hits[k - 1] + off
        if kind in ("cap", "capend"):
            hits = [(t0, t1) for t0, t1, ln, _ in caps if ln == key]
            if len(hits) < k: raise SystemExit(f"sfx: caption line {key!r} #{k} not found")
            return (hits[k - 1][0] if kind == "cap" else hits[-1][1]) + off
        if kind == "shot":
            if key not in shots: raise SystemExit(f"sfx: shot {key!r} not found")
            return shots[key] + off
        raise SystemExit(f"sfx: unknown anchor kind {kind!r}")

    def at(a):
        if isinstance(a, list): A, B = one(a[0]), one(a[1]); return A + (B - A) * float(a[2])
        return one(a)
    return at, caps


def render(film, sheet):
    pal = PALETTE[sheet.get("palette", "space")]; pace = float(film.get("pace") or 1.0); dur = float(film["dur"]) / pace
    at, caps = resolver(film); n = int(dur * SR); mix = np.zeros((n + 10 * SR, 2)); log = []
    for ci, c0 in enumerate(sheet["cues"]):
        for k in range(int(c0.get("repeat", 1))):
            c = dict(c0)
            if "until" in c: c["dur"] = max(0.1, at(c["until"]) - at(c["at"]))
            t0 = (at(c["at"]) + k * float(c.get("every", 0))) / pace
            if t0 < -5 or t0 >= dur: continue
            rng = np.random.default_rng(int(c.get("seed", 1000 + ci)) * 97 + k); c["note"] = c.get("note", 5) + k * c.get("step", 0)
            if c["kind"] != "tile" and "dur" in c: c["dur"] = c["dur"] / pace
            x = MAKERS[c["kind"]](rng, c); x = x if x.ndim == 2 else x[:, None]
            w = int(0.4 * SR); cs = np.concatenate([[0.0], np.cumsum((x ** 2).mean(1))]); e = (cs[w:] - cs[:-w]) / w if len(x) > w else np.array([(x ** 2).mean()])
            x = x / (np.sqrt(e.max()) + 1e-12) * 10 ** ((LEVEL[c["kind"]] + float(c.get("gain", 0))) / 20)
            x = np.tanh(x / 0.7) * 0.7                                                       # gentle peak guard (about -3 dBFS)
            fade = min(576, len(x)); x[-fade:] *= np.linspace(1, 0, fade)[:, None]
            p = c.get("pan", 0); p0, p1 = (p if isinstance(p, list) else (p, p)); pan = np.clip(np.linspace(p0, p1, len(x)), -1, 1); th = (pan + 1) * np.pi / 4
            if x.shape[1] == 1: L, R = np.cos(th) * x[:, 0], np.sin(th) * x[:, 0]
            else: L, R = x[:, 0] * np.cos(th) * 1.414, x[:, 1] * np.sin(th) * 1.414
            dl = 14
            if not isinstance(p, list) and p > 0.05: L = np.concatenate([np.zeros(dl), L])[: len(x)]
            elif not isinstance(p, list) and p < -0.05: R = np.concatenate([np.zeros(dl), R])[: len(x)]
            i = int(t0 * SR); s0 = max(0, -i); i = max(0, i); m = min(len(x) - s0, len(mix) - i)
            if m > 0: mix[i:i + m, 0] += L[s0:s0 + m]; mix[i:i + m, 1] += R[s0:s0 + m]
            log.append((round(t0, 2), c["kind"]))
    mix = mix[:n]
    for dms, g in ((11, 0.10), (17, 0.07)):
        s = int(dms * SR / 1000); mix[s:] += g * mix[:-s][:, ::-1]
    duck = np.ones(n); tl = np.arange(n) / SR; dg = 1 - 10 ** (pal["duck"] / 20)
    for t0, t1, *_ in caps:
        a0, a1, ramp = t0 / pace - 0.05, t1 / pace + 0.1, 0.1
        duck = np.minimum(duck, 1 - dg * np.clip(np.minimum((tl - (a0 - ramp)) / ramp, ((a1 + ramp) - tl) / ramp), 0, 1))
    mix *= duck[:, None]; mix = band(mix, pal["lowcut"], 15000)
    pk = np.abs(mix).max()
    if pk > 10 ** (-3 / 20): mix *= 10 ** (-3 / 20) / pk
    return mix, log, dur


if __name__ == "__main__":
    film = json.load(open(sys.argv[1])); sheet = json.load(open(sys.argv[2])); mix, log, dur = render(film, sheet)
    sf.write(sys.argv[3], mix.astype(np.float32), SR, subtype="FLOAT")
    print(f"sfx: {len(log)} sounds, {dur:.2f} s, peak {20 * np.log10(np.abs(mix).max() + 1e-12):.1f} dBFS -> {sys.argv[3]}")
    for t0, k in sorted(log): print(f"  {t0:7.2f}  {k}")
