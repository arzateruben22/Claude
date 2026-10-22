"""Voices: every sound the studio can make, each a pure function of its arguments and a tag.

Tonal voices are small additive or FM models (cheap at 3 minutes, unlike a 60-harmonic saw).
Foley voices are shaped noise and pitched sweeps. All return float32 at 48 kHz; mono unless the
docstring says stereo. Gains are left to the preset.
"""
import numpy as np

from .core import SR, hz, rng, tvec
from .dsp import decay, env, filt

TAU = 2 * np.pi


def _f(note):
    return hz(note) if isinstance(note, (str, int, np.integer)) else float(note)


# ── tonal ─────────────────────────────────────────────────────────────
def pad(notes, dur, bright=1400.0, tag="pad", attack=1.2, release=1.6, motion=0.18):
    """Stereo. Detuned sines with soft upper partials, a slow breathing swell, low-passed."""
    t = tvec(dur)
    L = np.zeros(len(t), np.float32)
    R = np.zeros(len(t), np.float32)
    r = rng(tag)
    for j, note in enumerate(notes):
        f = _f(note)
        for k, (det, side) in enumerate(((-0.0025, 0), (0.0021, 1), (0.0004, 2))):
            ph = r.uniform(0, TAU)
            w = sum(a * np.sin(TAU * f * h * (1 + det) * t + ph * h) for h, a in ((1, 1.0), (2, 0.3), (3, 0.12), (4, 0.05)))
            if side == 0:
                L += w
            elif side == 1:
                R += w
            else:
                L += 0.6 * w
                R += 0.6 * w
    breathe = 1 + motion * np.sin(TAU * t / (dur / max(1, round(dur / 5))) + r.uniform(0, TAU))
    x = np.stack([L, R], 1) * (breathe * env(len(t), attack, 0, 1, release))[:, None] / (3.2 * len(notes))
    return filt(x, lo=60, hi=bright, order=2)


def felt(note, dur=2.4, vel=0.8, tag="felt", bright=3200.0):
    """A felt-hammer piano note: stiff-string partials (slightly sharp overtones), each decaying
    faster than the last, a soft attack and a muted top."""
    f = _f(note)
    t = tvec(dur)
    B = 0.00035
    x = np.zeros(len(t), np.float32)
    tau0 = 1.1 * (220 / f) ** 0.35
    for k in range(1, 11):
        fk = k * f * np.sqrt(1 + B * k * k)
        if fk > 12000:
            break
        a = (vel ** (0.5 + 0.12 * k)) / k ** 1.25
        x += (a * np.sin(TAU * fk * t + 0.3 * k) * decay(len(t), tau0 / (1 + 0.55 * (k - 1)))).astype(np.float32)
    thump = filt(rng(f"{tag}:thump").standard_normal(int(0.012 * SR)).astype(np.float32), lo=150, hi=900) * decay(int(0.012 * SR), 0.003) * 0.15 * vel
    x[: len(thump)] += thump
    x *= env(len(t), 0.006, 0, 1, min(0.4, dur / 3))
    return filt(x * 0.5, hi=bright * (0.6 + 0.5 * vel))


def bell(note, dur=1.6, ratio=2.76, index=1.2, tau=0.45, tag="bell"):
    """A small glass bell: two-operator FM whose brightness fades faster than its body."""
    f = _f(note)
    t = tvec(dur)
    x = np.sin(TAU * f * t + index * np.exp(-t / (tau * 0.5)) * np.sin(TAU * f * ratio * t))
    return (x * decay(len(t), tau) * env(len(t), 0.002, 0, 1, 0.05) * 0.5).astype(np.float32)


def sub(note, dur, tag="sub"):
    """A round sine an octave under the bass, with a soft attack (felt more than heard)."""
    f = _f(note)
    t = tvec(dur)
    return (np.sin(TAU * f * t) * env(len(t), 0.03, 0.2, 0.7, min(0.3, dur / 2)) * 0.6).astype(np.float32)


def chime(notes, dur=2.4, spread=0.06, tag="chime"):
    """A rolled chord of bells (an ending)."""
    t = tvec(dur + spread * len(notes))
    x = np.zeros(len(t), np.float32)
    for i, n in enumerate(notes):
        b = bell(n, dur, tau=0.9, index=0.8, tag=f"{tag}{i}")
        a = int(i * spread * SR)
        x[a:a + len(b)] += b
    return x / np.sqrt(len(notes))


# ── foley ─────────────────────────────────────────────────────────────
def tap(tag, pitch=560.0, dur=0.12):
    """A small woody tap: a damped body tone plus a click of band-passed noise."""
    t = tvec(dur)
    r = rng(f"tap:{tag}")
    p = pitch * (1 + 0.12 * (r.random() - 0.5))
    body = np.sin(TAU * p * t) * decay(len(t), 0.018)
    click = filt(r.standard_normal(len(t)).astype(np.float32), lo=500, hi=3500) * decay(len(t), 0.004)
    return ((body * 0.6 + click * 0.3) * env(len(t), 0.0005, 0, 1, 0.02)).astype(np.float32)


def fizz(dur, tag, density=0.02):
    """A faint, bright crackle of sparse grains."""
    r = rng(f"fizz:{tag}")
    n = int(dur * SR)
    grains = r.standard_normal(n) * (r.random(n) < density)
    return (filt(grains.astype(np.float32), lo=2500, hi=9000) * decay(n, dur / 3) * 0.8).astype(np.float32)


def plop(f0=320.0, dur=0.5, tag="plop"):
    """A drop meets a surface: a sine falling fast from above its rest pitch."""
    t = tvec(dur)
    f = f0 * (1 + 1.6 * np.exp(-t / 0.035))
    return (np.sin(TAU * np.cumsum(f) / SR) * decay(len(t), 0.12) * env(len(t), 0.002, 0, 1, 0.08)).astype(np.float32)


def splash(tag, dur=0.9):
    """Spreading liquid: filtered noise with a quick rise and a soft tail. Stereo."""
    r = rng(f"splash:{tag}")
    n = int(dur * SR)
    e = (np.exp(-np.arange(n) / (0.22 * SR)) * (1 - np.exp(-np.arange(n) / (0.01 * SR)))).astype(np.float32)
    x = filt(r.standard_normal((n, 2)).astype(np.float32), lo=600, hi=5200)
    return x * e[:, None] * 0.45


def swell(dur, note="D2", tag="swell"):
    """A slow, warm rise and fall (a fifth stacked on the root)."""
    f = _f(note)
    t = tvec(dur)
    x = np.sin(TAU * f * t) + 0.5 * np.sin(TAU * f * 1.5 * t) + 0.2 * np.sin(TAU * f * 2 * t)
    return (filt(x.astype(np.float32), hi=700) * np.sin(np.pi * t / dur) ** 2 * 0.5).astype(np.float32)


def dim(dur, note="B1", tag="dim"):
    """A low note that darkens as it goes (something oxidizing, fading)."""
    f = _f(note)
    t = tvec(dur)
    x = np.sin(TAU * f * t) + 0.4 * np.sin(TAU * f * 2 * t) * np.exp(-t / (dur * 0.4))
    return (x * np.sin(np.pi * np.minimum(t / dur, 1)) ** 1.5 * 0.5).astype(np.float32)


def tick(f=2400.0, dur=0.05, tag="tick"):
    t = tvec(dur)
    return (np.sin(TAU * f * t) * decay(len(t), 0.008)).astype(np.float32)


def whistle(dur, f0=900.0, f1=2300.0, tag="whistle"):
    """A falling object's rising whistle, swelling to the impact."""
    t = tvec(dur)
    u = t / max(dur, 1e-3)
    f = f0 + (f1 - f0) * u ** 2
    return (np.sin(TAU * np.cumsum(f) / SR) * u ** 3 * 0.12).astype(np.float32)


def whoosh(dur, tag, lo=300.0, hi=4000.0):
    """Air past the lens: noise swept up through a band, peaking at 70% of its length. Stereo."""
    r = rng(f"whoosh:{tag}")
    n = int(dur * SR)
    u = np.arange(n) / max(n - 1, 1)
    shape = np.where(u < 0.7, (u / 0.7) ** 2, ((1 - u) / 0.3) ** 1.5).astype(np.float32)
    x = filt(r.standard_normal((n, 2)).astype(np.float32), lo=lo, hi=hi)
    return x * shape[:, None] * 0.35


def sparkle(dur, notes, tag="sparkle", n=16):
    """A soft shower of tiny bells over dur (something dissolving)."""
    total = np.zeros(int((dur + 0.5) * SR), np.float32)
    r = rng(f"sparkle:{tag}")
    for k in range(n):
        b = bell(notes[k % len(notes)], 0.4, tau=0.12, index=0.6, tag=f"{tag}{k}") * (0.5 + 0.5 * r.random())
        a = int((dur * k / n + r.uniform(0, dur / n * 0.6)) * SR)
        total[a:a + len(b)] += b[: len(total) - a]
    return total * 0.5


def air(dur, tag="air", hi=2400.0):
    """A barely-there room tone, so silence never sounds like a dropout. Stereo."""
    r = rng(f"air:{tag}")
    n = int(dur * SR)
    return filt(r.standard_normal((n, 2)).astype(np.float32), lo=120, hi=hi) * 0.05
