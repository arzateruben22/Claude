"""Studio core: sample rate, units, seeded noise, a stereo bus, WAV in and out.

Everything is float32 at 48 kHz, stereo as shape (N, 2). Randomness is seeded by name, so the
same cue sheet makes the same file every run, and inserting an event doesn't reshuffle the others.
"""
import wave
import zlib

import numpy as np

SR = 48000
NOTES = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6,
         "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}


def db(x):
    return 10 ** (np.asarray(x, dtype=np.float64) / 20)


def to_db(x):
    return 20 * np.log10(np.maximum(np.abs(x), 1e-12))


def midi(note):
    """'F#4' → 66."""
    name, octave = note[:-1], int(note[-1])
    return NOTES[name] + 12 * (octave + 1)


def hz(note):
    return 440.0 * 2 ** ((midi(note) - 69) / 12) if isinstance(note, str) else 440.0 * 2 ** ((note - 69) / 12)


def rng(tag):
    return np.random.default_rng(zlib.crc32(str(tag).encode()))


def tvec(d):
    return (np.arange(int(round(d * SR))) / SR).astype(np.float32)


def stereo(sig):
    sig = np.asarray(sig, dtype=np.float32)
    return np.stack([sig, sig], 1) if sig.ndim == 1 else sig


class Bus:
    """A stereo track of fixed length. add() places a sound at t seconds (t may be negative)."""

    def __init__(self, dur, name=""):
        self.n = int(round(dur * SR))
        self.x = np.zeros((self.n, 2), np.float32)
        self.name = name

    def add(self, sig, t, gain_db=0.0, pan=0.0):
        """pan −1 (left) … +1 (right), equal power. A stereo sound is balanced, not re-panned."""
        is_st = np.asarray(sig).ndim == 2
        s = stereo(sig) * np.float32(db(gain_db))
        a = int(round(t * SR))
        if a < 0:
            s, a = s[-a:], 0
        if a >= self.n or not len(s):
            return self
        s = s[: self.n - a]
        gl, gr = np.sqrt(0.5 * (1 - pan)), np.sqrt(0.5 * (1 + pan))
        if is_st:                              # balance: centre leaves a stereo sound as it is
            gl, gr = gl * np.sqrt(2), gr * np.sqrt(2)
        self.x[a:a + len(s), 0] += s[:, 0] * np.float32(gl)
        self.x[a:a + len(s), 1] += s[:, 1] * np.float32(gr)
        return self


def read_wav(path):
    """→ float32 (N, 2) at SR. 16/24/32-bit PCM; mono becomes stereo; other rates are resampled."""
    with wave.open(str(path), "rb") as w:
        ch, bits, sr, n = w.getnchannels(), w.getsampwidth() * 8, w.getframerate(), w.getnframes()
        raw = w.readframes(n)
    if bits == 16:
        x = np.frombuffer(raw, "<i2").astype(np.float32) / 32768
    elif bits == 24:
        b = np.frombuffer(raw, np.uint8).reshape(-1, 3)
        x = ((b[:, 0].astype(np.int32) | (b[:, 1].astype(np.int32) << 8) | (b[:, 2].astype(np.int32) << 16)) << 8 >> 8).astype(np.float32) / 8388608
    elif bits == 32:
        x = np.frombuffer(raw, "<i4").astype(np.float32) / 2147483648
    else:
        raise ValueError(f"{path}: {bits}-bit WAV not supported")
    x = stereo(x.reshape(-1, ch)[:, 0]) if ch == 1 else x.reshape(-1, ch)[:, :2]
    if sr != SR:
        from .dsp import resample
        x = resample(x, sr, SR)
    return x.astype(np.float32)


def write_wav(path, x, bits=24, tag="dither"):
    """Stereo PCM with seeded TPDF dither (24-bit by default)."""
    x = stereo(x)
    r = rng(tag)
    full = 2 ** (bits - 1)
    q = np.round(x.astype(np.float64) * (full - 1) + r.uniform(-.5, .5, x.shape) + r.uniform(-.5, .5, x.shape))
    q = np.clip(q, -full, full - 1).astype(np.int32)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(bits // 8)
        w.setframerate(SR)
        if bits == 16:
            w.writeframes(q.astype("<i2").tobytes())
        else:
            w.writeframes(q.astype("<i4").view(np.uint8).reshape(-1, 4)[:, :3].tobytes())
