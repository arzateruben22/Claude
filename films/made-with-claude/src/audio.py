"""Made with Claude — Breakout · score + foley, synthesized from timeline.json.

Nothing here keeps its own clock. The music grid is timeline.bpm, chords are
timeline.music.chords, and every foley cue is read from the same events the
picture uses (mascot moves, search keys, toolbar presses, streak, keyframes,
shards, viewer beats). Moving a beat in the JSON moves picture and sound.

python3 -I films/made-with-claude/src/audio.py OUT.wav
  → OUT.wav (stereo 48 kHz mix), OUT-sfx.wav (foley stem), OUT-cues.json
Deterministic: all noise is seeded.
"""
import json
import sys
import wave
import zlib
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
J = json.loads((HERE / "timeline.json").read_text())
SR = 48000
DUR = J["duration"]
N = int(round(DUR * SR))
BEAT = 60.0 / J["bpm"]
NOTE = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}


def hz(name):
    return 440.0 * 2 ** ((12 * (int(name[-1]) + 1) + NOTE[name[:-1]] - 69) / 12)


def db(g):
    return 10 ** (g / 20)


def rng(tag):
    return np.random.default_rng(zlib.crc32(tag.encode()))


def tvec(dur):
    return np.arange(int(dur * SR)) / SR


# ─── spectral helpers (no scipy) ───

def fft_filter(x, lo=None, hi=None, slope=2.0):
    """Static band-limit in the frequency domain (smooth Butterworth-like magnitude)."""
    n = len(x)
    X = np.fft.rfft(x, 2 * n)
    f = np.fft.rfftfreq(2 * n, 1 / SR)
    g = np.ones_like(f)
    if lo:
        g *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** (2 * slope))
    if hi:
        g *= 1 / np.sqrt(1 + (f / hi) ** (2 * slope))
    return np.fft.irfft(X * g, 2 * n)[:n]


def stft_shape(x, gain_fn, hop=256, win=1024):
    """Time-varying spectral shaping: gain_fn(t_seconds, freqs) -> gain per bin."""
    w = np.hanning(win)
    pad = np.concatenate([np.zeros(win), x, np.zeros(win)])
    out = np.zeros_like(pad)
    norm = np.zeros_like(pad)
    f = np.fft.rfftfreq(win, 1 / SR)
    for start in range(0, len(pad) - win, hop):
        seg = pad[start:start + win] * w
        t = (start + win / 2 - win) / SR
        Y = np.fft.rfft(seg) * gain_fn(t, f)
        out[start:start + win] += np.fft.irfft(Y, win) * w
        norm[start:start + win] += w * w
    out /= np.maximum(norm, 1e-6)
    return out[win:win + len(x)]


def band(f, fc, width_oct=0.6):
    return np.exp(-0.5 * (np.log2(np.maximum(f, 1) / fc) / width_oct) ** 2)


# ─── instruments ───

def saw_additive(f, dur, cutoff, det=0.0, decay_k=None):
    """Band-limited saw by additive synthesis; cutoff may be a function of t (lowpass on harmonics)."""
    t = tvec(dur)
    out = np.zeros_like(t)
    kmax = int(min(16000 / f, 60))
    cut = cutoff(t) if callable(cutoff) else np.full_like(t, cutoff)
    ph = rng(f"saw{f:.2f}{det}").uniform(0, 2 * np.pi)
    for k in range(1, kmax + 1):
        fk = f * k * (1 + det)
        g = 1 / np.sqrt(1 + (fk / cut) ** 4)
        a = g / k
        if decay_k is not None:
            a = a * np.exp(-t * decay_k * (1 + 0.5 * k))
        out += a * np.sin(2 * np.pi * fk * t + ph * k)
    return out


def adsr(n, a, d, s, r, sustain_end=None):
    t = np.arange(n) / SR
    env = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    if sustain_end is not None:
        env = np.where(t > sustain_end, env * np.exp(-(t - sustain_end) / max(r, 1e-4)), env)
    return env


def kick(big=False):
    t = tvec(0.6 if big else 0.42)
    f = 46 + 110 * np.exp(-t / 0.035) + (20 if big else 0) * np.exp(-t / 0.2)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (0.32 if big else 0.2))
    click = fft_filter(rng("kclick").standard_normal(len(t)) * np.exp(-t / 0.004), lo=1500) * 0.25
    return np.tanh(1.6 * (body + click)) * 0.9


def clap():
    t = tvec(0.35)
    n = rng("clap").standard_normal(len(t))
    env = np.zeros_like(t)
    for k, off in enumerate((0.0, 0.011, 0.022)):
        env += np.where(t >= off, np.exp(-(t - off) / (0.008 if k < 2 else 0.11)), 0)
    return fft_filter(n * env, lo=900, hi=5200) * 0.8


def hat(open_=False, seed=0):
    t = tvec(0.28 if open_ else 0.06)
    n = rng(f"hat{seed}{open_}").standard_normal(len(t))
    return fft_filter(n, lo=7000, slope=3) * np.exp(-t / (0.09 if open_ else 0.016)) * 0.5


def snare(v=1.0, seed=0):
    t = tvec(0.22)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05) * 0.4
    nz = fft_filter(rng(f"sn{seed}").standard_normal(len(t)), lo=1200, hi=9000) * np.exp(-t / 0.07)
    return (tone + nz) * 0.6 * v


def bass(f, dur):
    t = tvec(dur)
    sub = np.sin(2 * np.pi * f * t)
    body = saw_additive(f, dur, lambda tt: 300 + 900 * np.exp(-tt / 0.06))
    return (0.8 * sub + 0.45 * body) * adsr(len(t), 0.004, 0.12, 0.7, 0.03, sustain_end=dur - 0.03)


def pluck(f, dur=0.5, bright=1.0):
    t = tvec(dur)
    x = saw_additive(f, dur, lambda tt: 600 + 5200 * bright * np.exp(-tt / 0.07), decay_k=3.2)
    return x * np.exp(-t / 0.22) * (1 - np.exp(-t / 0.002))


def pad(notes, dur, cutoff):
    out = np.zeros(int(dur * SR))
    for k, nm in enumerate(notes):
        for det in (-0.004, 0.004):
            out += saw_additive(hz(nm), dur, cutoff, det=det) * (0.55 if k == 0 else 0.4)
    return out / len(notes)


def bell(f, dur=1.4, index=2.2):
    t = tvec(dur)
    mod = index * np.exp(-t / 0.25) * np.sin(2 * np.pi * f * 3.5 * t)
    return np.sin(2 * np.pi * f * t + mod) * np.exp(-t / 0.55) * (1 - np.exp(-t / 0.001))


def blip(f0, f1, dur=0.11):
    """8-bit square blip (band-limited, odd harmonics) with a pitch step — the sprite's voice."""
    t = tvec(dur)
    f = np.where(t < dur * 0.45, f0, f1)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = sum(np.sin(k * ph) / k for k in range(1, 16, 2))
    return x * np.exp(-t / 0.06) * 0.5


def whoosh(dur, peak, f0, f1, tag, width=0.7):
    n = int(dur * SR)
    x = rng(tag).standard_normal(n)
    p = peak / dur
    def gain(tt, f):
        q = np.clip(tt / dur, 0, 1)
        fc = f0 * (f1 / f0) ** (q / p if q < p else 1 - 0.4 * (q - p) / (1 - p))
        amp = (q / p) ** 2 if q < p else np.exp(-(q - p) / (1 - p) * 4)
        return band(f, fc, width) * amp
    return stft_shape(x, gain) * 2.0


def riser(dur, tag="riser"):
    n = int(dur * SR)
    t = np.arange(n) / SR
    nz = stft_shape(rng(tag).standard_normal(n), lambda tt, f: band(f, 400 * (8000 / 400) ** np.clip(tt / dur, 0, 1), 0.9) * np.clip(tt / dur, 0, 1) ** 2)
    f = 110 * 2 ** (3 * (t / dur) ** 1.6)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * (t / dur) ** 2 * 0.25
    return nz * 1.4 + tone


def impact():
    t = tvec(1.6)
    sub = np.sin(2 * np.pi * np.cumsum(30 + 60 * np.exp(-t / 0.15)) / SR) * np.exp(-t / 0.55)
    burst = fft_filter(rng("impact").standard_normal(len(t)), hi=2500) * np.exp(-t / 0.09)
    return np.tanh(1.3 * (sub + 0.6 * burst))


def shatter(seed=7):
    g = rng(f"glass{seed}")
    out = np.zeros(int(0.9 * SR))
    for i in range(46):
        st = min(0.5, g.exponential(0.09))
        f = g.uniform(2800, 9500)
        d = g.uniform(0.03, 0.14)
        t = tvec(d * 4)
        ping = np.sin(2 * np.pi * f * t) * np.exp(-t / d) * g.uniform(0.15, 0.6)
        i0 = int(st * SR)
        out[i0:i0 + len(ping)] += ping[: len(out) - i0]
    t = np.arange(len(out)) / SR
    crackle = fft_filter(g.standard_normal(len(out)), lo=3000) * np.exp(-t / 0.08) * 0.6
    return out + crackle


def zap(f0=2600, f1=380, dur=0.13):
    t = tvec(dur)
    f = f1 + (f0 - f1) * np.exp(-t / 0.03)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.2 * np.sin(3 * ph)
    return x * np.exp(-t / 0.05) * (1 - np.exp(-t / 0.001)) * 0.6


def thud(weight=1.0):
    t = tvec(0.3)
    f = 70 + 120 * np.exp(-t / 0.03)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (0.07 + 0.05 * weight))
    tick = fft_filter(rng(f"thud{weight}").standard_normal(len(t)), lo=2000, hi=8000) * np.exp(-t / 0.006) * 0.3
    return (body * (0.6 + 0.4 * weight) + tick)


def boing(f0=320, f1=760, dur=0.16):
    t = tvec(dur)
    f = f0 + (f1 - f0) * (t / dur) ** 0.6
    x = np.sin(2 * np.pi * np.cumsum(f * (1 + 0.03 * np.sin(2 * np.pi * 28 * t))) / SR)
    return x * np.sin(np.pi * t / dur) ** 0.7 * 0.45


def key_click(seed):
    t = tvec(0.05)
    n = fft_filter(rng(f"key{seed}").standard_normal(len(t)), lo=1800, hi=7000) * np.exp(-t / 0.005)
    body = np.sin(2 * np.pi * 1300 * t) * np.exp(-t / 0.012) * 0.25
    return (n + body) * 0.7


def shimmer(dur=1.2, tag="shim"):
    g = rng(tag)
    out = np.zeros(int(dur * SR))
    for i in range(14):
        f = hz(g.choice(["D6", "F#6", "A6", "B6", "D7", "E6"]))
        st = g.uniform(0, 0.25)
        b = bell(f, 0.9, 1.2) * g.uniform(0.15, 0.4)
        i0 = int(st * SR)
        out[i0:i0 + len(b)] += b[: len(out) - i0]
    return out


def coo():
    """Content little 'mm-hm' — two soft rounded tones with vibrato."""
    out = np.zeros(int(0.5 * SR))
    for st, f0, f1, d in ((0.0, 620, 700, 0.14), (0.17, 760, 640, 0.22)):
        t = tvec(d)
        f = f0 + (f1 - f0) * (t / d) + 9 * np.sin(2 * np.pi * 7 * t)
        ph = 2 * np.pi * np.cumsum(f) / SR
        x = (np.sin(ph) + 0.25 * np.sin(2 * ph)) * np.sin(np.pi * t / d) ** 1.5
        i0 = int(st * SR)
        out[i0:i0 + len(x)] += x * 0.5
    return out


def tick():
    t = tvec(0.025)
    return fft_filter(rng("tick").standard_normal(len(t)), lo=2500, hi=9000) * np.exp(-t / 0.004) * 0.35


# ─── mixing ───

class Bus:
    def __init__(self):
        self.x = np.zeros((2, N))

    def add(self, sig, t, gain_db=0.0, pan=0.0):
        i = int(round(t * SR))
        if i >= N or len(sig) == 0:
            return
        if i < 0:
            sig, i = sig[-i:], 0
        sig = sig[: N - i]
        a = (np.clip(pan, -1, 1) + 1) * np.pi / 4
        g = db(gain_db)
        self.x[0, i:i + len(sig)] += sig * g * np.cos(a)
        self.x[1, i:i + len(sig)] += sig * g * np.sin(a)


def reverb(x, seconds=1.8, wet=0.22, tag="room", predelay=0.015):
    g = rng(tag)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = g.standard_normal((2, n)) * np.exp(-t / (seconds / 6.9))
    ir[:, : int(predelay * SR)] = 0
    ir[0] = fft_filter(ir[0], hi=7000); ir[1] = fft_filter(ir[1], hi=7000)
    ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
    size = 1 << int(np.ceil(np.log2(x.shape[1] + n)))
    wetsig = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[:, : x.shape[1]]
    return x * (1 - wet) + wetsig * wet * 2.2


def chord_at(t):
    cur = J["music"]["chords"][0]
    for c in J["music"]["chords"]:
        if t >= c["t"] - 1e-9:
            cur = c
    return cur


def main(path):
    drums, bassb, music, sfx = Bus(), Bus(), Bus(), Bus()
    cues = []
    M = J["music"]
    drop, outro = M["drop"], M["outro"]

    # ── intro (bar 0): filtered pad, muted arp, sprite blips, riser, snare roll
    intro_pad = pad(chord_at(0)["notes"], drop + 0.3, lambda t: 250 + 1700 * (t / drop) ** 1.6)
    intro_pad *= np.minimum(1, np.arange(len(intro_pad)) / (0.25 * SR))
    music.add(intro_pad, 0.0, -9)
    arp = ["B3", "D4", "F#4", "A4"]
    for i in range(int(drop / (BEAT / 2))):
        t = i * BEAT / 2
        music.add(pluck(hz(arp[i % 4]), 0.4, bright=0.25 + 0.5 * t / drop), t, -17 + 6 * t / drop, pan=-0.25 if i % 2 else 0.25)
    for w in next(m for m in J["mascot"] if m["type"] == "sprite").get("wiggle", []):
        sfx.add(blip(hz("B5"), hz("E6")), w, -14, 0.1); cues.append({"t": w, "kind": "blip"})
    ex = next(m for m in J["mascot"] if m["type"] == "extrude")
    music.add(riser(drop - ex["t0"]), ex["t0"], -10)
    for i in range(8):
        t = ex["t0"] + i * BEAT / 4
        drums.add(snare(0.25 + 0.11 * i, seed=i), t, -12 + i * 1.2, pan=0.1)
    # voxel extrusion "build" chirps (16ths, rising)
    for i, nm in enumerate(["B4", "D5", "F#5", "A5", "B5", "D6", "F#6", "A6"]):
        sfx.add(blip(hz(nm), hz(nm) * 1.5, 0.07), ex["t0"] + i * BEAT / 4, -22 + i, pan=-0.3 + 0.08 * i)

    # ── drop: impact + glass
    sfx.add(impact(), drop, -3); cues.append({"t": drop, "kind": "impact"})
    sfx.add(shatter(J["shards"]["seed"]), J["shards"]["t"], -7, 0.15); cues.append({"t": J["shards"]["t"], "kind": "shatter"})

    # ── groove: bars 1–4
    bar_end = outro
    t = drop
    k = 0
    kicks = []
    while t < bar_end - 1e-9:
        beat_in_bar = round(((t - drop) / BEAT)) % 4
        drums.add(kick(big=(k == 0)), t, -3 if k else 0); kicks.append(t)
        if beat_in_bar in (1, 3):
            drums.add(clap(), t, -7, 0.05)
        for h in range(4):                                 # 16th hats, offbeat accent
            th = t + h * BEAT / 4
            acc = -12 if h == 2 else -19
            open_ = (h == 2 and beat_in_bar == 3)
            drums.add(hat(open_, seed=k * 4 + h), th, acc + (2 if open_ else 0), pan=0.3 if h % 2 else -0.2)
        t += BEAT; k += 1
    # fill into the outro
    for i in range(4):
        drums.add(snare(0.45 + 0.15 * i, seed=40 + i), bar_end - BEAT / 2 + i * BEAT / 8, -9 + i * 1.5, pan=-0.1)
    # bass: 8ths on the chord root, octave bounce
    t = drop
    i = 0
    while t < bar_end - 1e-9:
        root = chord_at(t)["notes"][0]
        f = hz(root) * (2 if i % 4 == 2 else 1)
        bassb.add(bass(f, BEAT / 2 - 0.02), t, -6)
        t += BEAT / 2; i += 1
    # pad + 16th arp
    for c in M["chords"]:
        if c["t"] < drop or c["t"] >= bar_end:
            continue
        nxt = min([x["t"] for x in M["chords"] if x["t"] > c["t"]] + [bar_end])
        music.add(pad(c["notes"], nxt - c["t"] + 0.2, 1800), c["t"], -12)
    t = drop
    i = 0
    while t < bar_end - 1e-9:
        notes = chord_at(t)["notes"]
        seq = [notes[1], notes[2], notes[3] if len(notes) > 3 else notes[2], notes[2]]
        nm = seq[i % 4]
        octave = 2 if (i // 4) % 2 else 1
        lighter = 6.0 <= t < 9.5                           # make room for the keyframe dings
        music.add(pluck(hz(nm) * octave, 0.35, bright=0.8), t, (-19 if lighter else -15), pan=-0.35 if i % 2 else 0.35)
        t += BEAT / 4; i += 1

    # ── outro: landing hit, breakdown, final chord + bells
    drums.add(kick(big=True), outro, 0); kicks.append(outro)
    drums.add(hat(True, seed=99), outro, -6)
    sfx.add(fft_filter(rng("crash").standard_normal(int(1.8 * SR)), lo=4000) * np.exp(-tvec(1.8) / 0.6) * 0.35, outro, -10)
    for c in M["chords"]:
        if c["t"] >= outro:
            nxt = min([x["t"] for x in M["chords"] if x["t"] > c["t"]] + [DUR])
            p = pad(c["notes"], DUR - c["t"] + 0.5, lambda tt: 1400 + 900 * np.exp(-tt / 0.8))
            fade_in = int(0.08 * SR)
            p[:fade_in] *= np.linspace(0, 1, fade_in)
            if nxt < DUR:
                cut = int((nxt - c["t"]) * SR)
                p[cut:] *= np.exp(-np.arange(len(p) - cut) / (0.15 * SR))
            music.add(p, c["t"], -8)
    for i, nm in enumerate(["D5", "F#5", "A5", "D6", "F#6", "A6"]):
        music.add(bell(hz(nm), 1.6, 1.4), 11.0 + i * BEAT / 4, -16 + i * 0.5, pan=-0.4 + 0.16 * i)
    bassb.add(bass(hz("D2"), 1.0) * np.exp(-tvec(1.0) / 0.5), 11.0, -5)

    # ── foley from the timeline
    for m in J["mascot"]:
        if m["type"] in ("jump", "hop"):
            big = m["type"] == "jump"
            if m["t0"] != drop:
                sfx.add(boing(300 if big else 380, 820 if big else 640, 0.2 if big else 0.13), m["t0"] - 0.02, -11 if big else -14, 0.0)
                cues.append({"t": m["t0"], "kind": "takeoff"})
            sfx.add(thud(1.6 if big else 1.0), m["t1"], -6 if big else -9)
            cues.append({"t": m["t1"], "kind": "land"})
            if big and m["t0"] != drop:
                sfx.add(whoosh(m["t1"] - m["t0"] + 0.2, (m["t1"] - m["t0"]) * 0.5, 250, 2400, f"wj{m['t0']}"), m["t0"], -9, 0)
        if m["type"] == "trot":
            tt = m["t0"] + m["step"]
            i = 0
            while tt < m["t1"] - 1e-9:
                sfx.add(tick(), tt, -20, pan=-0.2 if i % 2 else 0.2)
                tt += m["step"]; i += 1
    for i, kt in enumerate(J["search"]["keys"]):
        sfx.add(key_click(i), kt, -10, 0.3); cues.append({"t": kt, "kind": "key"})
    hl = J["search"]["highlight"]
    for i, nm in enumerate(["A5", "D6"]):
        sfx.add(bell(hz(nm), 0.8, 1.0), hl + i * 0.06, -12, 0.2)
    cues.append({"t": hl, "kind": "select"})
    for p in J["toolbarPress"]:
        sfx.add(tick() * 1.5, p["t"] + 0.005, -14, -0.2)
    ST = J["streak"]
    sfx.add(whoosh(ST["t1"] - ST["t0"] + 0.15, (ST["t1"] - ST["t0"]) * 0.85, 600, 6000, "streak", 0.5), ST["t0"], -9, 0.4)
    sfx.add(shimmer(1.3, "glowshim"), J["viewer"]["glow"], -9, -0.1); cues.append({"t": J["viewer"]["glow"], "kind": "glow"})
    for kf in J["keyframes"]:
        sfx.add(zap(), kf["t"] - 0.03, -10, 0.0)
        music.add(bell(hz(kf["note"]), 1.1, 1.8), kf["t"] + 0.02, -9, 0.15)
        cues.append({"t": kf["t"], "kind": "zap", "note": kf["note"]})
    V = J["viewer"]
    for name in ("spark", "swoosh", "opus"):
        sfx.add(shimmer(0.7, f"v{name}") * 0.6, V[name], -14, -0.3)
    happy = next(m for m in J["mascot"] if m.get("happy"))
    sfx.add(coo(), happy["happy"], -11, 0.25); cues.append({"t": happy["happy"], "kind": "coo"})

    # ── mix: sidechain bass + music from the kicks, reverbs, glue
    duck = np.ones(N)
    tt = np.arange(N) / SR
    for kt in kicks:
        m = tt >= kt
        duck[m] *= 1 - 0.55 * np.exp(-(tt[m] - kt) / 0.11)
    bassb.x *= duck
    music.x *= 0.55 + 0.45 * duck
    music_wet = reverb(music.x, 2.2, 0.28, "hall")
    sfx_wet = reverb(sfx.x, 1.1, 0.16, "room")
    drums_wet = reverb(drums.x, 0.8, 0.08, "kit")
    mix = drums_wet + bassb.x + music_wet + sfx_wet
    # gentle glue: soft knee saturation on the bus
    mix = np.tanh(mix * 1.15) / 1.15
    tail = int(0.12 * SR)
    mix[:, -tail:] *= np.linspace(1, 0, tail) ** 2
    peak = np.abs(mix).max()
    mix *= db(-1.5) / peak
    write(path, mix)
    sfx_stem = sfx_wet * (db(-1.5) / peak)
    write(Path(path).with_name(Path(path).stem + "-sfx.wav"), sfx_stem)
    Path(path).with_name(Path(path).stem + "-cues.json").write_text(json.dumps(sorted(cues, key=lambda c: c["t"]), indent=1))
    print(f"audio: {len(cues)} cues, {DUR:.2f} s @ {J['bpm']} BPM → {path}")


def write(path, x):
    pcm = (np.clip(x.T, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())


if __name__ == "__main__":
    main(sys.argv[1])
