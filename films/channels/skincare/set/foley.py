"""Skin Sense ASMR foley: close, soft sounds that move with what is on screen (piano-tile notes, squeezes, squishes, pinches,
peels, rips, pops, taps, creaks, dust). Every sound is made here from noise and sine waves (no samples, nothing licensed),
seeded per cue, so a rebuild is identical.

  python -I foley.py EPDIR [--film film.json] [--cues foley.json] [--out foley.wav]

Cues live in EPDIR/foley.json and are timed on the SCENE timeline with the anchors the scenes use:
  "start:vo03+1.2", "end:vo02-0.5", "word:flatter#2+0.05" (the 2nd caption word "flatter"), plain seconds (12.5),
  or [A, B, f] = A + (B - A) * f (a point between two anchors, e.g. the moment a keyed value crosses a step).
Delivered time = scene time / the film's pace (film.json "pace", 1 if absent), so one cue sheet serves v1 and v2.
Each cue: {"at": anchor, "kind": ..., "pan": -1..1, "gain": dB, "dur": s (or "until": anchor), "note": scale index, "repeat": n, "every": s,
           "step": scale steps per repeat, "seed": int}
Kinds: tile (felt-piano / kalimba plink, "note" = index into A major pentatonic, 5 = A4), squeeze (slow wet compression),
squish (short), pinch, rip (soft tear), peel (sticky separation ending in a small suction pop), pop (bubble), tap (soft
wooden tile tap), glide (a quiet glassy rise, or fall with "down": true, for signals), tremble (fast tiny taps), creak (slow stretch), dust (tiny grains).
Under her voice the foley dips 5 dB and comes back up in the gaps. Nothing below 150 Hz (the rumble rule). The stem peaks
at most -9 dBFS; the episode mix's loudnorm sets the final level."""
import argparse, json, re
from pathlib import Path
import numpy as np, soundfile as sf

SR = 48000
SCALE = [220.0, 246.94, 277.18, 329.63, 369.99, 440.0, 493.88, 554.37, 659.26, 739.99, 880.0, 987.77, 1108.73, 1318.51, 1479.98, 1760.0]
LEVEL = {"tile": -14, "squeeze": -9, "squish": -12, "pinch": -15, "rip": -16, "peel": -14, "pop": -15, "tap": -15, "glide": -20,
         "tremble": -17, "creak": -17, "dust": -22}


def band(x, lo, hi):
    """Soft-edged FFT band-pass (lo/hi in Hz; None = open)."""
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); m = np.ones_like(f)
    if lo: m *= np.clip((f - lo * 0.7) / (lo * 0.3), 0, 1)
    if hi: m *= np.clip((hi * 1.3 - f) / (hi * 0.3), 0, 1)
    return np.fft.irfft(X * m, len(x))


def norm(x):
    p = np.abs(x).max(); return x / p if p > 0 else x


def tt(d): return np.arange(int(d * SR)) / SR


def smooth_noise(rng, d, hz):
    """A slowly wandering positive envelope (the wet, uneven feel of a squeeze)."""
    m = band(rng.standard_normal(int(d * SR) + 1), None, hz)[: int(d * SR)]; m = m / (np.abs(m).max() + 1e-9)
    return np.clip(0.45 + 0.75 * m, 0, None) ** 1.4


def clicks(rng, d, rate_env, lo, hi, width=(0.0004, 0.0015)):
    """Poisson micro-clicks: rate_env is a per-sample rate (clicks/s); each click is a tiny band-limited noise burst."""
    n = int(d * SR); out = np.zeros(n); p = rate_env / SR; hits = np.nonzero(rng.random(n) < p)[0]
    for h in hits:
        w = int(rng.uniform(*width) * SR) + 8; seg = rng.standard_normal(w) * np.exp(-np.arange(w) / (w / 3)) * rng.uniform(0.25, 1.0)
        out[h:h + w] += seg[: n - h]
    return band(out, lo, hi)


def tile(rng, note=5, d=2.2):
    f = SCALE[int(np.clip(note, 0, len(SCALE) - 1))]; t = tt(d); tau = 0.55 * (440 / f) ** 0.3; x = np.zeros_like(t)
    for r, a, dm in ((1, 1.0, 1.0), (2.0, 0.32, 0.55), (3.0, 0.11, 0.35), (4.16, 0.045, 0.22), (5.4, 0.02, 0.15)):
        x += a * np.sin(2 * np.pi * f * r * t + rng.uniform(0, 6.28)) * np.exp(-t / (tau * dm))
    x += 0.22 * np.sin(2 * np.pi * f * 1.0016 * t) * np.exp(-t / tau)                      # a gentle beat, like a real string pair
    x *= (1 - np.exp(-t / 0.0035)) * np.clip((d - t) / (0.4 * d), 0, 1) ** 1.5
    felt = band(rng.standard_normal(len(t)), 300, 1600) * np.exp(-t / 0.006) * 0.06
    return band(x + felt, 150, 7000)


def squeeze(rng, d=1.0, fast=False):
    t = tt(d); u = t / d
    env = np.sin(np.pi * np.clip(u / (0.35 if fast else 0.5), 0, 1) * 0.5) * np.clip((1 - u) / (0.5 if fast else 0.55), 0, 1) ** 1.3
    lo, mid, hi = (band(rng.standard_normal(len(t)), a, b) for a, b in ((260, 900), (700, 2200), (1900, 5200)))
    lo, mid, hi = norm(lo), norm(mid), norm(hi)
    w = np.clip(u * 1.4, 0, 1)                                                                # air squeezed out: bright to dark
    body = (1 - w) * 0.55 * hi + 0.8 * mid + w * 1.0 * lo
    wet = smooth_noise(rng, d, 28 if fast else 22)
    cl = clicks(rng, d, (55 if fast else 38) * env + 4, 2200, 7500)
    thump = np.sin(2 * np.pi * np.cumsum(np.linspace(240, 160, len(t))) / SR) * np.exp(-t / (0.06 if fast else 0.12)) * 0.35
    return (norm(body * wet) * 0.8 + norm(cl) * 0.38 + thump) * env


def pinch(rng, d=0.18):
    t = tt(d)
    click = band(rng.standard_normal(len(t)), 2800, 8000) * np.exp(-t / 0.0022)
    sq_f = np.linspace(1850, 2550, len(t)) * (1 + 0.01 * np.sin(2 * np.pi * 38 * t))
    squeak = np.sin(2 * np.pi * np.cumsum(sq_f) / SR) * (1 - np.exp(-t / 0.004)) * np.exp(-t / 0.045) * 0.22
    rub = band(rng.standard_normal(len(t)), 1000, 4200) * np.exp(-t / 0.014) * 0.35
    return norm(click) * 0.8 + squeak + norm(rub) * 0.4


def rip(rng, d=0.6, rate=650, lo=1800, hi=7000):
    t = tt(d); u = t / d; dens = np.sin(np.pi * u) ** 0.8
    cl = clicks(rng, d, rate * dens + 5, lo, hi)
    hiss = band(rng.standard_normal(len(t)), lo + 300, hi - 1500) * dens
    return norm(cl) + norm(hiss) * 0.14


def pop(rng, d=0.09, f0=620):
    t = tt(d); f = f0 * (1 + np.clip(t / 0.018, 0, 1))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.024) * (1 - np.exp(-t / 0.0015))
    return x + band(rng.standard_normal(len(t)), 2000, 6000) * np.exp(-t / 0.0012) * 0.25


def peel(rng, d=0.7):
    x = rip(rng, d, rate=260, lo=900, hi=4500) * 0.85; t = tt(0.06)
    suck = np.sin(2 * np.pi * np.cumsum(np.linspace(430, 180, len(t))) / SR) * np.exp(-t / 0.028) * 0.7
    suck += band(rng.standard_normal(len(t)), 600, 3000) * np.exp(-t / 0.004) * 0.2
    x[-len(t):] += suck
    return x


def tap(rng, d=0.12):
    t = tt(d)
    return (band(rng.standard_normal(len(t)), 300, 2600) * np.exp(-t / 0.005) * 0.6 + np.sin(2 * np.pi * 250 * t) * np.exp(-t / 0.035)
            + 0.25 * np.sin(2 * np.pi * 615 * t) * np.exp(-t / 0.02))


def glide(rng, d=0.9, note=8, down=False):
    t = tt(d); u = t / d; f0 = SCALE[note]; f = f0 * 2 ** ((-1 if down else 1) * u ** 1.6)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) + 0.3 * np.sin(2 * ph + 1)) * np.sin(np.pi * u) ** 1.5 * (1 + 0.08 * np.sin(2 * np.pi * 6 * t))


def tremble(rng, d=2.0, rate=16):
    out = np.zeros(int(d * SR)); t = 0.0
    while t < d - 0.05:
        a = np.sin(np.pi * t / d) ** 0.7; s = tap(rng, 0.05) * (0.35 + 0.65 * a) * rng.uniform(0.5, 1.0); i = int(t * SR)
        out[i:i + len(s)] += s[: len(out) - i]; t += (1 / rate) * rng.uniform(0.8, 1.2)
    return band(out, 180, 6000)


def creak(rng, d=1.2):
    out = np.zeros(int(d * SR)); t = 0.0
    while t < d - 0.02:
        u = t / d; r = 22 + 55 * u; tk = tt(0.008); a = np.sin(np.pi * u) ** 0.6 * rng.uniform(0.6, 1.0)
        s = (np.sin(2 * np.pi * 900 * tk) + 0.5 * np.sin(2 * np.pi * 1730 * tk)) * np.exp(-tk / 0.0022) * a; i = int(t * SR)
        out[i:i + len(s)] += s[: len(out) - i]; t += (1 / r) * rng.uniform(0.85, 1.15)
    return band(out, 400, 5000)


def dust(rng, d=3.0, rate=12):
    t = tt(d); x = clicks(rng, d, rate * np.sin(np.pi * t / d) ** 0.5 + 1, 4000, 9500, (0.0002, 0.0005))
    return x


MAKERS = {"tile": lambda r, c: tile(r, c.get("note", 5), c.get("dur", 2.2)), "squeeze": lambda r, c: squeeze(r, c.get("dur", 1.0)),
          "squish": lambda r, c: squeeze(r, c.get("dur", 0.32), fast=True), "pinch": lambda r, c: pinch(r), "rip": lambda r, c: rip(r, c.get("dur", 0.6)),
          "peel": lambda r, c: peel(r, c.get("dur", 0.7)), "pop": lambda r, c: pop(r, f0=c.get("f0", 620)), "tap": lambda r, c: tap(r),
          "glide": lambda r, c: glide(r, c.get("dur", 0.9), c.get("note", 8), c.get("down", False)), "tremble": lambda r, c: tremble(r, c.get("dur", 2.0), c.get("rate", 16)),
          "creak": lambda r, c: creak(r, c.get("dur", 1.2)), "dust": lambda r, c: dust(r, c.get("dur", 3.0), c.get("rate", 12))}


def resolver(film):
    lines = film["lines"]; caps = film.get("captions", [])
    words = [(re.sub(r"[^a-z]", "", str(c.get("w", "")).lower()), c["t0"]) for c in caps if isinstance(c, dict) and "w" in c]

    def one(a):
        if isinstance(a, (int, float)) or re.fullmatch(r"-?[\d.]+", str(a).strip()): return float(a)
        m = re.fullmatch(r"(start|end):(\w+)([+-][\d.]+)?", a.strip())
        if m: return lines[m[2]][0 if m[1] == "start" else 1] + float(m[3] or 0)
        m = re.fullmatch(r"word:([a-z]+)(?:#(\d+))?([+-][\d.]+)?", a.strip())
        if m:
            hits = [t for w, t in words if w == m[1]]; k = int(m[2] or 1)
            if len(hits) < k: raise SystemExit(f"foley: caption word {m[1]!r} #{k} not found")
            return hits[k - 1] + float(m[3] or 0)
        raise SystemExit(f"foley: can't read anchor {a!r}")

    def at(a):
        if isinstance(a, list): A, B, f = one(a[0]), one(a[1]), float(a[2]); return A + (B - A) * f
        return one(a)
    return at


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("epdir"); ap.add_argument("--film", default="film.json"); ap.add_argument("--cues", default=None)
    ap.add_argument("--out", default=None); a = ap.parse_args(); d = Path(a.epdir)
    film = json.loads((d / a.film).read_text()); pace = float(film.get("pace") or 1.0); dur = float(film["dur"]) / pace
    cues = json.loads(Path(a.cues or d / "foley.json").read_text())["cues"]; at = resolver(film)
    n = int(dur * SR) + SR; mix = np.zeros((n, 2)); log = []
    for ci, c in enumerate(cues):
        for k in range(int(c.get("repeat", 1))):
            t0 = (at(c["at"]) + k * float(c.get("every", 0))) / pace
            if t0 < 0 or t0 >= dur: continue
            rng = np.random.default_rng(int(c.get("seed", 1000 + ci)) * 97 + k)
            if "until" in c: c = {**c, "dur": max(0.1, at(c["until"]) - at(c["at"]))}
            cc = dict(c); cc["note"] = c.get("note", 5) + k * c.get("step", 0); cc["dur"] = c.get("dur", 1.0) / (pace if c["kind"] not in ("tile",) else 1)
            x = norm(MAKERS[c["kind"]](rng, cc)) * 10 ** ((LEVEL[c["kind"]] + float(c.get("gain", 0)) - 3 * k * float(c.get("fade", 0))) / 20)
            x[-576:] *= np.linspace(1, 0, min(576, len(x)))[-len(x[-576:]):]
            pan = float(np.clip(c.get("pan", 0) + (rng.uniform(-0.08, 0.08) if c.get("repeat", 1) > 1 else 0), -1, 1)); th = (pan + 1) * np.pi / 4
            L, R = np.cos(th) * x, np.sin(th) * x; dl = 14                                            # ~0.3 ms inter-ear offset: close, binaural feel
            if pan > 0.05: L = np.concatenate([np.zeros(dl), L])[: len(x)]
            elif pan < -0.05: R = np.concatenate([np.zeros(dl), R])[: len(x)]
            i = int(t0 * SR); m = min(len(x), n - i); mix[i:i + m, 0] += L[:m]; mix[i:i + m, 1] += R[:m]
            log.append((round(t0, 2), c["kind"]))
    mix = mix[: int(dur * SR)]
    # tiny dry room (two early taps) so it sits in the same space as her voice
    for dms, g in ((11, 0.12), (17, 0.08)):
        s = int(dms * SR / 1000); mix[s:] += g * mix[:-s][:, ::-1]
    # dip under her voice
    duck = np.ones(len(mix)); tl = np.arange(len(mix)) / SR
    for t0, t1, *_ in film["lines"].values():
        a0, a1 = t0 / pace - 0.05, t1 / pace + 0.1; ramp = 0.08
        g = np.clip(np.minimum((tl - (a0 - ramp)) / ramp, ((a1 + ramp) - tl) / ramp), 0, 1); duck = np.minimum(duck, 1 - g * (1 - 10 ** (-5 / 20)))
    mix *= duck[:, None]
    for ch in range(2): mix[:, ch] = band(mix[:, ch], 150, 11000)
    pk = np.abs(mix).max()
    if pk > 10 ** (-9 / 20): mix *= 10 ** (-9 / 20) / pk
    out = Path(a.out or d / "foley.wav"); sf.write(out, mix.astype(np.float32), SR, subtype="FLOAT")
    print(f"foley: {len(log)} sounds, {dur:.2f} s, peak {20 * np.log10(np.abs(mix).max() + 1e-12):.1f} dBFS -> {out}")
    for t0, k in log: print(f"  {t0:7.2f}  {k}")


if __name__ == "__main__":
    main()
