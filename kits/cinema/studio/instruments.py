"""Voices: every sound the studio can make, each a pure function of its arguments and a tag.

Tonal voices are small additive or FM models (cheap at 3 minutes, unlike a 60-harmonic saw).
Foley voices are shaped noise and pitched sweeps. All return float32 at 48 kHz; mono unless the
docstring says stereo. Gains are left to the preset.
"""
import numpy as np

from .core import SR, hz, rng, tvec
from .dsp import decay, env, filt, peak

TAU = 2 * np.pi

# Where a sound's designed loudest moment sits, as a fraction of its length. A foley entry with
# "anchor": "peak" lands that moment on its frame; a voice not listed here is measured instead.
PEAK = {"whoosh": 0.7, "glide": 0.5, "swell": 0.5}


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


def sparkle(dur, notes, tag="sparkle", n=16, grain="bell"):
    """A soft shower of tiny tones over dur (something dissolving). The grains are small bells by
    default; a channel that keeps clear of bells showers mallets, pings or blips instead."""
    total = np.zeros(int((dur + 0.5) * SR), np.float32)
    r = rng(f"sparkle:{tag}")
    for k in range(n):
        note = notes[k % len(notes)]
        if grain == "bell":
            b = bell(note, 0.4, tau=0.12, index=0.6, tag=f"{tag}{k}")
        elif grain == "mallet":
            b = mallet(note, 0.4, 0.6, f"{tag}{k}", harmonic=True)
        elif grain == "ping":
            b = ping(note, f"{tag}{k}", repeats=0, blip=0.04)
        elif grain == "blip":
            b = blip(note, 0.07, 0.7, f"{tag}{k}")
        else:
            raise ValueError(f"unknown sparkle grain {grain}")
        b = b * (0.5 + 0.5 * r.random())
        a = int((dur * k / n + r.uniform(0, dur / n * 0.6)) * SR)
        total[a:a + len(b)] += b[: len(total) - a]
    return total * 0.5


def air(dur, tag="air", hi=2400.0):
    """A barely-there room tone, so silence never sounds like a dropout. Stereo."""
    r = rng(f"air:{tag}")
    n = int(dur * SR)
    return filt(r.standard_normal((n, 2)).astype(np.float32), lo=120, hi=hi) * 0.05


# ── tonal voices for the science channels (none of them is a glass bell) ───────────────
def mallet(note, dur=0.9, vel=0.8, tag="mallet", bright=5000.0, harmonic=False):
    """A soft wooden mallet (marimba-like): a sine, a quiet 3.9x partial and a felt click; harmonic=True rings pure, no wood."""
    f = _f(note)
    t = tvec(dur)
    tau = 0.35 * (440 / f) ** 0.25                       # low bars ring a little longer
    if harmonic:
        x = np.sin(TAU * f * t) * decay(len(t), tau * 1.4) + 0.18 * np.sin(TAU * 2 * f * t + 0.3) * decay(len(t), tau * 0.5)
    else:
        x = np.sin(TAU * f * t) * decay(len(t), tau) + 0.22 * vel * np.sin(TAU * 3.9 * f * t + 0.4) * decay(len(t), tau * 0.18)
    n = int(0.002 * SR)
    click = filt(rng(f"mallet:{tag}").standard_normal(n).astype(np.float32), lo=800, hi=4000) * decay(n, 0.0006)
    x[:n] += click * (0.1 if harmonic else 0.25) * vel
    x *= env(len(t), 0.0015, 0, 1, min(0.15, dur / 3))
    return filt((x * 0.5 * (0.4 + 0.6 * vel)).astype(np.float32), hi=bright)


def thump(note="Eb2", dur=0.4, vel=1.0, tag="thump"):
    """A heartbeat: a sine dropping 2.2x onto its note in 40 ms, a 140 Hz body and a click, saturated for phone speakers."""
    f = _f(note)
    t = tvec(dur)
    fr = f * (1 + 1.2 * np.exp(-t / 0.013))
    x = np.sin(TAU * np.cumsum(fr, dtype=np.float64) / SR) * decay(len(t), 0.11) + 0.5 * np.sin(TAU * 140 * t) * decay(len(t), 0.045)
    n = int(0.003 * SR)
    x[:n] += filt(rng(f"thump:{tag}").standard_normal(n).astype(np.float32), lo=300, hi=2500) * decay(n, 0.0015) * 0.3
    d, b = 2.2, 0.3                                       # the bias makes the even harmonics
    x = (np.tanh(d * (vel * x + b)) - np.tanh(d * b)) / d
    x *= env(len(t), 0.002, 0, 1, 0.08)
    return filt(x.astype(np.float32), lo=25) * 0.8


def ping(note=1100.0, tag="ping", echo=(0.25, -9.0), repeats=2, blip=0.06):
    """A telemetry ping: a 60 ms carrier blip, then `repeats` echoes echo[0] s apart, each echo[1] dB down and darker."""
    f = _f(note)
    t = tvec(blip)
    b = (np.sin(TAU * f * t) + 0.12 * np.sin(TAU * 2 * f * t)) * decay(len(t), blip * 0.9) * env(len(t), 0.003, 0, 1, 0.02, 1.5)
    x = np.zeros(int((blip + repeats * echo[0] + 0.02) * SR), np.float32)
    for j in range(repeats + 1):
        a = int(round(j * echo[0] * SR))
        e = b if j == 0 else filt(b.astype(np.float32), hi=max(1200.0, 6000.0 / j))
        x[a:a + len(e)] += e * np.float32(10 ** (j * echo[1] / 20))
    return x * 0.5


def glide(dur, note="E3", interval=19, tag="glide", slide=1.0, fifth=0.0, bright=3000.0):
    """Two detuned sines slide `interval` semitones from note under a sin² swell (fifth > 0 adds a fifth); ends on its frame."""
    t = tvec(dur)
    u = t / max(dur, 1e-3)
    s = np.clip(u / slide, 0, 1)
    s = s * s * (3 - 2 * s)
    ph = TAU * np.cumsum(_f(note) * 2 ** (interval * s / 12), dtype=np.float64) / SR
    x = np.sin(ph * 1.0029) + np.sin(ph * 0.9971 + 0.7)
    if fifth:
        x = x + fifth * (np.sin(1.5 * ph * 1.0017 + 1.1) + np.sin(1.5 * ph * 0.9983 + 2.3))
    x = x * np.sin(np.pi * u) ** 2 * 0.25 / (1 + fifth)
    return filt(x.astype(np.float32), hi=bright)


def drone(notes, dur, tag="drone", bright=900.0, attack=3.0, release=3.0):
    """Stereo. A slow drone of fifths: sines with soft 2nd and 3rd partials, detuned a hair left and right, low-passed."""
    t = tvec(dur).astype(np.float64)       # it runs the whole film; in float32 the phase is noisy past a minute (−53 dB at 60 s)
    L = np.zeros(len(t), np.float32)
    R = np.zeros(len(t), np.float32)
    r = rng(f"drone:{tag}")
    for note in notes:
        f = _f(note)
        for det, side in ((-0.0012, 0), (0.0012, 1), (0.0, 2)):
            ph = r.uniform(0, TAU)
            w = sum(a * np.sin(TAU * f * h * (1 + det) * t + ph * h) for h, a in ((1, 1.0), (2, 0.25), (3, 0.08)))
            if side == 0:
                L += w
            elif side == 1:
                R += w
            else:
                L += 0.7 * w
                R += 0.7 * w
    x = np.stack([L, R], 1) * env(len(t), attack, 0, 1, release)[:, None] / (3.4 * len(notes))
    return filt(x, lo=35, hi=bright, order=2)


def blip(note, dur=0.09, vel=0.8, tag="blip"):
    """A staccato instrument blip: a sine with a third harmonic (a reading confirmed), gone in about 90 ms."""
    f = _f(note)
    t = tvec(dur)
    x = (np.sin(TAU * f * t) + 0.25 * np.sin(TAU * 3 * f * t + 0.5)) * decay(len(t), 0.028)
    return (x * env(len(t), 0.001, 0, 1, 0.02) * 0.45 * (0.4 + 0.6 * vel)).astype(np.float32)


def boing(note="G3", dur=0.8, tag="boing", depth=3.0, rate=9.0):
    """A released spring settling onto its note: a twangy tone whose ±depth-semitone wobble at `rate` Hz dies away."""
    f = _f(note)
    t = tvec(dur)
    ph = TAU * np.cumsum(f * 2 ** (depth * np.exp(-t / 0.15) * np.sin(TAU * rate * t) / 12), dtype=np.float64) / SR
    x = (np.sin(ph) + 0.45 * np.sin(2 * ph + 0.3) + 0.2 * np.sin(3 * ph + 0.9) * np.exp(-t / 0.08)) * decay(len(t), 0.28)
    return filt((x * env(len(t), 0.002, 0, 1, 0.12) * 0.4).astype(np.float32), hi=4500)


def hum(note="D4", dur=2.0, tag="hum", beat=0.5):
    """A wave's hum: two slightly detuned sines beating `beat` times a second, faded in and out."""
    f = _f(note)
    t = tvec(dur)
    x = np.sin(TAU * f * t) + np.sin(TAU * (f + beat) * t + 0.4) + 0.15 * np.sin(TAU * 2 * f * t)
    return (x * np.sin(np.pi * np.minimum(t / dur, 1)) ** 0.8 * 0.22).astype(np.float32)


# ── foley for the science channels ──────────────────────────────────────────────────────
def squish(dur, tag="squish"):
    """A cell squeezing through: band-passed noise under a resonant low-pass falling 1800 to 500 Hz, a pop at the exit."""
    n = int(dur * SR)
    src = filt(rng(f"squish:{tag}").standard_normal(n).astype(np.float32), lo=300, hi=1400)
    cuts = np.geomspace(1800, 500, 6)
    pos = np.linspace(0, len(cuts) - 1, n)                # the falling cutoff, crossfaded between six fixed filters
    x = np.zeros(n, np.float32)
    for j, fc in enumerate(cuts):
        x += peak(filt(src, hi=fc, order=3), fc, 6.0, q=2.0) * np.clip(1 - np.abs(pos - j), 0, 1).astype(np.float32)
    x *= env(n, min(0.05, dur / 4), 0, 1, min(0.12, dur / 3), 1.5) * 0.9
    pop = plop(640, 0.09, f"{tag}:pop") * 0.35
    out = np.zeros(n + int(0.03 * SR), np.float32)
    out[:n] += x
    a = max(0, n - int(0.06 * SR))
    out[a:a + len(pop)] += pop[: len(out) - a]
    return out


def zap(tag="zap", f0=800.0, f1=3200.0, dur=0.07):
    """A nerve spike: a 4 ms click, then a 60 ms chirp up from f0 to f1 (a run of them reads as a soft ratchet)."""
    t = tvec(dur)
    f = f0 * (f1 / f0) ** np.clip(t / 0.06, 0, 1)
    x = np.sin(TAU * np.cumsum(f, dtype=np.float64) / SR) * (1 - t / dur) ** 1.5 * 0.35
    n = int(0.004 * SR)
    x[:n] += filt(rng(f"zap:{tag}").standard_normal(n).astype(np.float32), lo=1500, hi=8000) * decay(n, 0.001) * 0.6
    return (x * env(len(t), 0.0005, 0, 1, 0.01)).astype(np.float32)


def knock(note=None, f0=200.0, tag="knock", dur=0.25):
    """A ball on a bench: a thump falling onto f0, a click and a woody body ringing at note (2.4x f0 without one)."""
    t = tvec(dur)
    fb = _f(note) if note is not None else 2.4 * f0
    r = rng(f"knock:{tag}")
    low = np.sin(TAU * np.cumsum(f0 * (1 + 0.8 * np.exp(-t / 0.01)), dtype=np.float64) / SR) * decay(len(t), 0.03)
    body = np.sin(TAU * fb * t + r.uniform(0, TAU)) * decay(len(t), 0.045) + 0.3 * np.sin(TAU * 2.7 * fb * t) * decay(len(t), 0.012)
    n = int(0.003 * SR)
    x = 0.7 * low + 0.45 * body
    x[:n] += filt(r.standard_normal(n).astype(np.float32), lo=1200, hi=7000) * decay(n, 0.0008) * 0.5
    return (x * env(len(t), 0.0003, 0, 1, 0.05) * 0.6).astype(np.float32)


def shutter(tag="shutter", gap=0.035):
    """A camera shutter for a ghost stamp: two soft clicks gap s apart (open, then close), the second quieter."""
    r = rng(f"shutter:{tag}")
    n = int(0.012 * SR)
    t = tvec(0.012)
    x = np.zeros(int((gap + 0.02) * SR), np.float32)
    for j, g in ((0, 1.0), (1, 0.7)):
        c = filt(r.standard_normal(n).astype(np.float32), lo=1800, hi=7500) * decay(n, 0.0012) + 0.25 * np.sin(TAU * 1500 * t) * decay(n, 0.003)
        a = int(j * gap * SR)
        x[a:a + n] += c * g
    return x * 0.6


def ramp(note="G3", dur=0.5, direction="down", tag="ramp"):
    """A tape-stop (down) or tape-start (up) over dur: an open fifth whose speed, pitch and level run to or from nothing."""
    t = tvec(dur)
    u = t / dur
    speed = (1 - u) ** 1.6 if direction == "down" else np.maximum(u, 1e-3) ** 1.6
    f = _f(note)
    ph = TAU * np.cumsum(f * speed, dtype=np.float64) / SR
    x = sum(a * (np.sin(h * ph) + 0.6 * np.sin(1.5 * h * ph)) for h, a in ((1, 1.0), (2, 0.4), (3, 0.2)))
    x = x * np.sqrt(speed) * env(len(t), 0.004, 0, 1, 0.03 if direction == "up" else 0.0)
    return filt((x * 0.18).astype(np.float32), lo=40, hi=3500)


# ── Back of the Envelope (films/channels/whatif): a plucked string and pencil on paper ──
def pluck(note, dur=0.9, vel=0.8, tag="pluck", bright=3200.0):
    """A pizzicato string: Karplus–Strong on a seeded noise burst (one period long, low-passed by
    `bright`), its loop filter a two-point average with a decay set so the note dies in about `dur`.
    Mono. The attack is the burst itself, so the onset is sample-sharp (QA finds it as "rise")."""
    f = _f(note)
    n = int(dur * SR)
    N = max(2, int(round(SR / f)))
    burst = filt(rng(tag).uniform(-1, 1, N + 1).astype(np.float32), hi=bright)
    y = np.zeros(n + N + 1, np.float32)
    y[: N + 1] = burst
    g = np.float32(10 ** (-3.0 / (f * dur)))                 # -60 dB over dur, per round trip of the loop
    i = N + 1
    while i < len(y):                                       # one period at a time: y[k] depends on y[k-N], y[k-N-1]
        j = min(len(y), i + N)
        y[i:j] = 0.5 * (y[i - N:j - N] + y[i - N - 1:j - N - 1]) * g
        i = j
    x = y[N + 1:N + 1 + n] if n > 0 else y[:0]
    x = x * env(len(x), 0.001, 0, 1, 0.04)
    return (x / (np.max(np.abs(x)) + 1e-9) * 0.5 * (0.45 + 0.55 * vel)).astype(np.float32)


def scratch(dur=0.35, tag="scratch", lo=1800.0, hi=7000.0, rise=False):
    """Pencil on paper: band-passed noise with a seeded, grainy amplitude (the lead skipping over the
    tooth of the paper), a quick attack and a soft tail. rise=True swells toward its end instead (a box
    being drawn: anchor "end"). Mono."""
    n = int(dur * SR)
    r = rng(tag)
    x = filt(r.normal(0, 1, n).astype(np.float32), lo=lo, hi=hi)
    grain = np.repeat(r.uniform(0.35, 1.0, n // 240 + 1), 240)[:n].astype(np.float32)
    grain = filt(grain, hi=180.0)
    t = np.linspace(0, 1, n, dtype=np.float32)
    shape = (0.35 + 0.65 * t) if rise else (1.0 - 0.55 * t)
    x = x * grain * shape * env(n, 0.006, 0, 1, 0.06)
    return (x / (np.max(np.abs(x)) + 1e-9) * 0.4).astype(np.float32)
