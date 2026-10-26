"""Measure the sound before anyone listens: sync per event kind, loudness on the delivered AAC,
the music under the voice, and what a phone speaker does to the mix.

Sync is measured in the mastered effects stem, not taken from the placement math: each event's own
waveform is matched against the stem near where it should be, so a placement bug, a reverb that
smears an onset, or a limiter that eats a transient all show up as error.
"""
import numpy as np

from .core import SR, stereo
from .meter import correlation, lufs, mono_loss_db


HOP = 48   # 1 ms


def _env(x):
    """RMS envelope at 1 ms steps (2 ms windows)."""
    n = len(x) // HOP
    if n < 2:
        return np.zeros(1)
    f = x[: n * HOP].reshape(n, HOP) ** 2
    e = f.mean(1)
    return np.sqrt((e + np.concatenate([[e[0]], e[:-1]])) / 2)


# how each voice is located in the stem (see _locate); a seq is found the way its first note is
METHOD = {"bell": "rise", "chime": "rise", "tick": "rise",
          "tap": "wave", "fizz": "wave", "plop": "wave",
          "sparkle": "peak", "whoosh": "peak", "whistle": "peak",
          "swell": "shape", "dim": "shape",
          # the science channels: struck and pinged tones ring, so they rise; clicks, knocks and
          # noise match their own waveform; sweeps by their loudest moment; slow beds by shape
          "mallet": "rise", "ping": "rise", "blip": "rise", "boing": "rise", "thump": "rise",
          "knock": "wave", "shutter": "wave", "zap": "wave", "squish": "wave",
          "glide": "peak",
          "ramp": "shape", "hum": "shape", "drone": "shape"}
SLOW = {"peak", "shape"}


def _xcorr(A, B):
    n = 1 << (len(A) + len(B) - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(A, n) * np.conj(np.fft.rfft(B, n)), n)[: len(A) - len(B) + 1]


def _heard_as(seg, tpl):
    """Both signals without what lies more than an octave below the template's own lowest energy (a zero-phase
    high-pass with a one-octave cosine edge, so nothing moves in time): a loud low swell under a 2.4 kHz tick
    can't steal its attack, and the template's own band, transient and all, passes untouched."""
    n = 1 << (len(seg) + len(tpl)).bit_length()
    P = np.abs(np.fft.rfft(tpl, n)) ** 2
    if not P.any():
        return seg, tpl
    f = np.fft.rfftfreq(n, 1 / SR)
    lo = f[np.searchsorted(np.cumsum(P) / P.sum(), 0.01)] / 2       # an octave under the bottom 1 % of its energy
    if lo < 40:
        return seg, tpl                    # nothing below a low template to remove
    H = np.clip(np.log2(np.maximum(f, 1e-9) / (lo / 2)), 0, 1)       # 0 below lo/2, rising over one octave to 1 at lo
    H = 0.5 - 0.5 * np.cos(np.pi * H)
    g = lambda x: np.fft.irfft(np.fft.rfft(x, n) * H, n)[: len(x)].astype(np.float32)
    return g(seg), g(tpl)


def _locate(stem, sig, place, anchor, method, search=0.06):
    """Where sig's anchor actually sits in the stem, as an offset (s) from where it was placed.

    rise:  ringing tones match themselves a period later almost as well as at the attack (and the
           reverb build-up makes later periods louder), so they are found by the sharp rise in
           energy: the positive slope of the 1 ms envelope.
    wave:  noise and clicks have no periods, so a plain cross-correlation of the attack is exact.
    peak:  sweeps and showers are found by the waveform around their loudest moment.
    shape: smooth swells by their envelope's shape (they have no sharp moment to hear)."""
    m = stereo(sig).mean(1)
    if method == "rise" or method == "shape":
        t = m[: int(0.6 * SR)]
        a = max(0, int((place - search) * SR))
        b = min(len(stem), int((place + search) * SR) + len(t))
        t = t[: b - a - int(2 * search * SR) + 1] if b - a < len(t) + 2 * search * SR else t
        pad = 5 * HOP                    # silence before the template, so an instant attack is still a rise
        a = max(0, a - pad)
        seg, tp = _heard_as(stem[a:b], np.concatenate([np.zeros(pad, np.float32), t]))
        Es, Et = _env(seg), _env(tp)
        A, B = (np.maximum(np.diff(Es), 0), np.maximum(np.diff(Et), 0)) if method == "rise" else (Es - Es.mean(), Et - Et.mean())
        if len(A) < len(B) or not np.any(B):
            return None
        return (a + pad + int(np.argmax(_xcorr(A, B))) * HOP) / SR - place
    if method == "peak":
        e = np.convolve(m ** 2, np.ones(int(0.02 * SR)), "same")
        c = int(np.argmax(e))
        lo, hi = max(0, c - int(0.15 * SR)), min(len(m), c + int(0.15 * SR))
    else:
        lo, hi = max(0, anchor - int(0.005 * SR)), min(len(m), anchor + int(0.08 * SR))
    tpl = m[lo:hi]
    a = max(0, int((place + lo / SR - search) * SR))
    b = min(len(stem), int((place + lo / SR + search) * SR) + len(tpl))
    if b - a < len(tpl) or not np.any(tpl):
        return None
    return (a + int(np.argmax(_xcorr(stem[a:b], tpl)))) / SR - lo / SR - place


def sync(placed, effects, fps):
    """Per kind: how far each sound sits from the frame that shows its event, measured in the
    mastered effects stem. Gate: transients within one frame (and, for a kind heard three times or
    more, a median ≤ 10 ms); slow swells and sweeps, which have no sharp moment to hear, within three."""
    mono = stereo(effects).mean(1)
    rows, kinds = [], {}
    for p in placed:
        method = METHOD.get(p.get("of", p["voice"]), "wave")
        err = _locate(mono, p["sig"], p["place"], p["anchor"], method)
        if err is None:
            continue
        slow = method in SLOW
        rows.append({"kind": p["kind"], "tag": p["tag"], "show": p["show"], "method": method, "err_ms": round(err * 1000, 1)})
        kinds.setdefault((p["kind"], slow), []).append(abs(err) * 1000)
    frame_ms = 1000 / fps
    per = {k: {"n": len(v), "max_ms": round(max(v), 1), "median_ms": round(float(np.median(v)), 1), "slow": slow,
               "pass": max(v) <= frame_ms * (3 if slow else 1) and (len(v) < 3 or float(np.median(v)) <= (3 * frame_ms if slow else 10))}
           for (k, slow), v in sorted(kinds.items())}
    return {"per_kind": per, "pass": all(v["pass"] for v in per.values()), "events": rows}


def picture_sync(placed, shown):
    """Check the timing rule against the picture: where the sound was put (from the event table
    and events.json) versus the first frame on which the page actually shows the event, measured
    independently by render.mjs --cues. Positive = the sound is late."""
    out = []
    for p in placed:
        s = shown.get(p["tag"])
        if s is not None:
            out.append({"tag": p["tag"], "kind": p["kind"], "picture": s, "sound": p["sound"], "err_ms": round((p["sound"] - s) * 1000, 1)})
    return out


def under_voice(stems, spans):
    """Loudness of the music against the voice while the voice speaks (want ≥ 10 LU apart)."""
    if not spans:
        return None
    idx = np.zeros(len(stems["music"]), bool)
    for a, b in spans:
        idx[int(a * SR):int(b * SR)] = True
    m, d = lufs(stems["music"][idx]), lufs(stems["dialog"][idx])
    return {"music_lufs": round(m, 1), "dialog_lufs": round(d, 1), "gap_lu": round(d - m, 1), "pass": d - m >= 10}


def phone(mix, stems):
    """A phone speaker: mono, and nothing much under ~200 Hz."""
    out = {"correlation": round(correlation(mix), 2), "mono_loss_db": round(mono_loss_db(mix), 2)}
    if np.any(stems["dialog"]):
        out["dialog_mono_loss_db"] = round(mono_loss_db(stems["dialog"]), 2)
    out["pass"] = out["correlation"] > 0 and out.get("dialog_mono_loss_db", 0) < 1.0
    return out
