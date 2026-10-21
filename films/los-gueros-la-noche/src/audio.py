"""La Noche — sound, synthesized from timeline.json.

Nothing here has its own clock: every cue's time comes from the same
timeline.json the picture is built from (events[].sfx, transitions[].sfx,
audio.pad), so moving a beat in the JSON moves picture and sound together.

python3 -I film/src/audio.py OUT.wav   → stereo 48 kHz mix (pre-loudnorm)
also writes OUT-cues.wav (cue stem, no bed) and OUT-cues.json for QA.
Deterministic: every noise source is seeded.
"""
import json
import sys
import wave
import zlib
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
T = json.loads((HERE / "timeline.json").read_text())
SR = T["audio"]["sampleRate"]
DUR = T["duration"]
N = int(round(DUR * SR))
LATENCY = T["audio"]["revealLatency"]
NOTES = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}


def hz(name):
    midi = 12 * (int(name[-1]) + 1) + NOTES[name[:-1]]
    return 440.0 * 2 ** ((midi - 69) / 12)


def db(g):
    return 10 ** (g / 20)


def rng(tag):
    return np.random.default_rng(zlib.crc32(tag.encode()))


class Bus:
    def __init__(self):
        self.x = np.zeros((2, N), np.float64)

    def add(self, sig, t, gain=1.0, pan=0.0):
        """Place a mono signal at time t (s) with constant-power pan (-1..1)."""
        i = int(round(t * SR))
        if i >= N:
            return
        sig = sig[: N - max(i, 0)]
        if i < 0:
            sig, i = sig[-i:], 0
        a = (pan + 1) * np.pi / 4
        self.x[0, i:i + len(sig)] += sig * gain * np.cos(a)
        self.x[1, i:i + len(sig)] += sig * gain * np.sin(a)


def onepole_lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc = (1 - a) * v + a * acc
        y[i] = acc
    return y


def svf_bandpass(x, fc, q=1.2):
    """State-variable band-pass with per-sample cutoff (array)."""
    y = np.empty_like(x)
    lp = bp = 0.0
    damp = 1.0 / q
    f = 2 * np.sin(np.pi * np.minimum(fc, SR / 6) / SR)
    for i, v in enumerate(x):
        hp = v - lp - damp * bp
        bp += f[i] * hp
        lp += f[i] * bp
        y[i] = bp
    return y


# ─── instruments ───

def marimba(f, length=1.8):
    t = np.arange(int(length * SR)) / SR
    sig = (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.9)
           + 0.32 * np.sin(2 * np.pi * f * 3.93 * t) * np.exp(-t / 0.22)
           + 0.10 * np.sin(2 * np.pi * f * 9.2 * t) * np.exp(-t / 0.05))
    sig *= 1 - np.exp(-t / 0.0012)                       # soft mallet attack
    click = rng(f"click{f:.1f}").standard_normal(len(t)) * np.exp(-t / 0.002) * 0.08
    return (sig + click) / 1.3


def whoosh(length, peak_at, f0, f1, tag):
    n = int(length * SR)
    x = np.linspace(0, 1, n)
    p = peak_at / length
    env = np.where(x < p, (x / p) ** 2.2, np.exp(-(x - p) / max(1 - p, 1e-3) * 4.5))
    fc = f0 * (f1 / f0) ** np.where(x < p, x / p, 1 - 0.5 * (x - p) / max(1 - p, 1e-3))
    noise = rng(tag).standard_normal(n)
    return svf_bandpass(noise, fc, q=1.4) * env * 1.6


def swell(length, tag):
    n = int(length * SR)
    x = np.linspace(0, 1, n)
    env = x ** 3
    env[-int(0.05 * SR):] *= np.linspace(1, 0, int(0.05 * SR))
    fc = 300 * (3000 / 300) ** x
    return svf_bandpass(rng(tag).standard_normal(n), fc, q=0.9) * env * 1.4


def thump():
    t = np.arange(int(1.2 * SR)) / SR
    freq = 45 + 45 * np.exp(-t / 0.08)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    return np.sin(phase) * np.exp(-t / 0.35) * (1 - np.exp(-t / 0.003))


def pad(notes, length):
    t = np.arange(int(length * SR)) / SR
    sig = np.zeros_like(t)
    for k, name in enumerate(notes):
        f = hz(name)
        for det in (-0.12, 0.12):
            sig += np.sin(2 * np.pi * (f + det) * t + k) / (1 + 0.6 * k)
    trem = 0.85 + 0.15 * np.sin(2 * np.pi * 0.21 * t)
    return onepole_lp(sig * trem, 900) / len(notes)


def fire_bed():
    g = rng("fire")
    # rumble: brown noise, low-passed
    brown = np.cumsum(g.standard_normal(N))
    brown -= onepole_lp(brown, 18)                        # strip drift (DC)
    rumble = onepole_lp(brown, 220)
    rumble /= np.abs(rumble).max()
    left, right = rumble * 0.55, rumble * 0.55
    # crackle: Poisson pops, bright and short
    times = np.cumsum(g.exponential(1 / 16, 600))
    times = times[times < DUR]
    for tt in times:
        n = int(g.uniform(0.001, 0.006) * SR)
        burst = g.standard_normal(n) * np.exp(-np.arange(n) / (n / 4))
        burst = np.diff(burst, prepend=0)                 # brighten
        amp = min(1.0, g.pareto(2.5) * 0.25 + 0.08)
        pan = g.uniform(-0.7, 0.7)
        i = int(tt * SR)
        a = (pan + 1) * np.pi / 4
        seg = slice(i, min(N, i + n))
        left[seg] += burst[: seg.stop - i] * amp * np.cos(a)
        right[seg] += burst[: seg.stop - i] * amp * np.sin(a)
    # intensity follows how much fire is on screen (shot by shot)
    level = {"S1": 1.0, "S2": 0.8, "S3": 0.7, "S4": 0.8, "S5": 0.7, "S6": 0.42}
    env = np.zeros(N)
    for s in T["shots"]:
        env[int(s["start"] * SR):int(s["end"] * SR)] = level[s["id"]]
    env = onepole_lp(env, 2.0)
    env[: int(0.02 * SR)] = level["S1"]                   # full from frame 0 (no fade-in on the hook)
    return np.vstack([left, right]) * env


def reverb(x, seconds=1.6, wet=0.2):
    g = rng("room")
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = g.standard_normal((2, n)) * np.exp(-t / (seconds / 6.9))
    ir[:, : int(0.012 * SR)] = 0                          # pre-delay
    ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
    size = 1 << int(np.ceil(np.log2(N + n)))
    out = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[:, :N]
    return x * (1 - wet) + out * wet * 3


# ─── score ───

def main(path):
    music, sfx, cues = Bus(), Bus(), []

    for ev in T["events"]:
        s = ev.get("sfx")
        if not s:
            continue
        gain = db(s.get("gain", 0))
        if s["kind"] == "marimba":
            stagger = s.get("stagger", 0.022)             # chords are lightly strummed
            for k, name in enumerate(s["notes"]):
                t = ev["t"] + LATENCY + k * stagger
                pan = np.clip((hz(name) - 440) / 900, -0.3, 0.3)
                music.add(marimba(hz(name)), t, 0.5 * gain, pan)
                cues.append({"t": round(t, 4), "kind": "marimba", "note": name, "el": ev["el"], "event_t": ev["t"]})
        elif s["kind"] == "thump":
            t = ev["t"] + 0.04
            sfx.add(thump(), t, 0.9 * gain)
            cues.append({"t": round(t, 4), "kind": "thump", "el": ev["el"], "event_t": ev["t"]})

    for tr in T["transitions"]:
        s = tr["sfx"]
        gain = db(s.get("gain", 0))
        length = tr["end"] - tr["start"]
        peak = {"curtain": (tr.get("cover") or (tr["start"] + tr["end"]) / 2),
                "bloom": tr.get("peak", tr["end"])}.get(tr["type"], (tr["start"] + tr["end"]) / 2) - tr["start"]
        if s["kind"] == "whoosh":
            f0, f1 = (120, 700) if s.get("low") else (500, 4200) if s.get("fast") else (250, 2200)
            w = whoosh(length + 0.4, peak, f0, f1, tr["id"])
            pan = -0.5 if tr["type"] == "whip" else 0.0
            if tr["type"] == "whip":                      # camera travels right→left: sound follows
                half = len(w) // 2
                sfx.add(w[:half], tr["start"], gain, 0.45)
                sfx.add(w[half:], tr["start"] + half / SR, gain, -0.45)
            else:
                sfx.add(w, tr["start"], gain, pan)
        elif s["kind"] == "swell":
            sfx.add(swell(peak, tr["id"]), tr["start"], gain)
        cues.append({"t": round(tr["start"] + peak, 4), "kind": s["kind"], "transition": tr["id"]})

    # pad: crossfade between chord states
    pads = T["audio"]["pad"]
    for k, p in enumerate(pads):
        end = pads[k + 1]["t"] + 0.6 if k + 1 < len(pads) else DUR
        sig = pad(p["notes"], end - p["t"])
        fade_in = int((0.8 if k == 0 else 0.6) * SR)
        sig[:fade_in] *= np.linspace(0, 1, fade_in) ** 2
        if k + 1 < len(pads):
            sig[-int(0.6 * SR):] *= np.linspace(1, 0, int(0.6 * SR))
        music.add(sig, p["t"], db(-20))

    mix_cues = reverb(music.x) + sfx.x
    bed = fire_bed() * db(-17)
    mix = mix_cues + bed
    tail = int(0.4 * SR)                                  # no click at the last frame
    mix[:, -tail:] *= np.linspace(1, 0, tail)
    peak = np.abs(mix).max()
    mix *= db(-3) / peak
    mix_cues *= db(-3) / peak

    write(path, mix)
    stem = Path(path).with_name(Path(path).stem + "-cues.wav")
    write(stem, mix_cues)
    Path(path).with_name(Path(path).stem + "-cues.json").write_text(json.dumps(cues, indent=1))
    print(f"audio: {len(cues)} cues, {DUR:.2f} s → {path}")


def write(path, x):
    pcm = (np.clip(x.T, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


if __name__ == "__main__":
    main(sys.argv[1])
