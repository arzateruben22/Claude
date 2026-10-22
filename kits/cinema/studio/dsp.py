"""Filters, envelopes, reverb and saturation, numpy only (no scipy).

Static filters run as zero-padded FFT magnitude curves (no wrap-around tails). Anything that
changes over time is a gain curve multiplied in, so it stays vectorized.
"""
import numpy as np

from .core import SR, rng, stereo


def _bins(n):
    return np.fft.rfftfreq(n, 1 / SR)


def _apply(x, curve_fn, pad=None):
    """Multiply x's spectrum by curve_fn(freqs); zero-padded so tails never wrap."""
    x = np.asarray(x, np.float32)
    n = len(x)
    pad = int(SR * 0.25) if pad is None else pad
    nfft = 1 << (n + pad - 1).bit_length()
    g = curve_fn(_bins(nfft)).astype(np.float32)
    X = np.fft.rfft(x, nfft, axis=0)
    y = np.fft.irfft(X * (g[:, None] if x.ndim == 2 else g), nfft, axis=0)[:n]
    return y.astype(np.float32)


def filt(x, lo=None, hi=None, order=2):
    """Butterworth-shaped magnitude: high-pass at lo, low-pass at hi (Hz). Zero phase."""
    def g(f):
        out = np.ones_like(f)
        if hi:
            out /= np.sqrt(1 + (f / hi) ** (2 * order))
        if lo:
            out /= np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** (2 * order))
        return out
    return _apply(x, g)


def shelf(x, f0, gain_db, high=True):
    """A gentle shelf: gain_db above f0 (high=True) or below it, with a one-octave transition."""
    def g(f):
        k = 1 / (1 + (f0 / np.maximum(f, 1e-3)) ** 2) if high else 1 / (1 + (np.maximum(f, 1e-3) / f0) ** 2)
        return 10 ** (gain_db * k / 20)
    return _apply(x, g)


def tilt(x, db_per_oct, pivot=1000.0):
    """Tilt the whole spectrum around pivot (negative = darker)."""
    return _apply(x, lambda f: 10 ** (db_per_oct * np.log2(np.clip(f, 20, 20000) / pivot) / 20))


def peak(x, f0, gain_db, q=1.0):
    """A bell boost or cut at f0."""
    return _apply(x, lambda f: 10 ** (gain_db * np.exp(-0.5 * (np.log2(np.maximum(f, 1e-3) / f0) * q * 2.4) ** 2) / 20))


def env(n, a=0.005, d=0.0, s=1.0, r=0.05, curve=2.0):
    """ADSR over n samples (a, d, r in seconds). The release takes the tail; curve shapes it."""
    e = np.full(n, s, np.float32)
    na, nd, nr = int(a * SR), int(d * SR), int(r * SR)
    na, nd = min(na, n), min(nd, max(0, n - na))
    if na:
        e[:na] = np.linspace(0, 1, na, dtype=np.float32)
    if nd:
        e[na:na + nd] = np.linspace(1, s, nd, dtype=np.float32)
    if nr and nr < n:
        e[-nr:] *= np.linspace(1, 0, nr, dtype=np.float32) ** curve
    return e


def decay(n, tau):
    return np.exp(-np.arange(n, dtype=np.float32) / (tau * SR))


def fade(x, a=0.0, b=0.0):
    x = x.copy()
    na, nb = int(a * SR), int(b * SR)
    if na:
        x[:na] *= np.linspace(0, 1, na, dtype=np.float32)[:, None] if x.ndim == 2 else np.linspace(0, 1, na, dtype=np.float32)
    if nb:
        x[-nb:] *= (np.linspace(1, 0, nb, dtype=np.float32) ** 2)[:, None] if x.ndim == 2 else np.linspace(1, 0, nb, dtype=np.float32) ** 2
    return x


def saturate(x, drive=1.0):
    """Soft clip, unity gain for small signals."""
    if drive <= 0:
        return x
    return (np.tanh(x * drive) / drive).astype(np.float32)


def resample(x, sr_in, sr_out):
    """Band-limited resample by FFT (fine for whole voice lines)."""
    x = np.asarray(x, np.float32)
    n_out = int(round(len(x) * sr_out / sr_in))
    X = np.fft.rfft(x, axis=0)
    m = n_out // 2 + 1
    Y = np.zeros((m,) + X.shape[1:], complex)
    k = min(m, len(X))
    Y[:k] = X[:k]
    return (np.fft.irfft(Y, n_out, axis=0) * (n_out / len(x))).astype(np.float32)


def ir(seconds, tag, predelay=0.015, damp_hz=7000.0, width=1.0):
    """A seeded stereo room: noise with an exponential tail (RT60 = seconds), damped highs that
    darken as it decays, and decorrelated sides scaled by width."""
    n = int((seconds + predelay) * SR)
    r = rng(f"ir:{tag}")
    t = np.arange(n, dtype=np.float32) / SR
    tail = np.exp(-6.9 * np.maximum(t - predelay, 0) / seconds) * (t >= predelay)
    noise = r.standard_normal((n, 2)).astype(np.float32)
    mid, side = (noise[:, 0] + noise[:, 1]) / 2, (noise[:, 0] - noise[:, 1]) / 2 * width
    h = np.stack([mid + side, mid - side], 1) * tail[:, None]
    # two bands: the top half of the spectrum decays twice as fast, like air and soft walls
    hi = filt(h, lo=damp_hz * 0.5) * np.exp(-6.9 * t / (seconds * 0.5))[:, None]
    lo = filt(h, hi=damp_hz * 0.5)
    h = filt(lo + hi * 0.6, hi=damp_hz)
    return (h / np.sqrt((h ** 2).sum(0, keepdims=True))).astype(np.float32)


def reverb(x, seconds, wet, tag, predelay=0.015, damp_hz=7000.0, width=1.0):
    """Convolve with ir(); returns dry·(1 − wet) + wet·room, same length as x."""
    x = stereo(x)
    h = ir(seconds, tag, predelay, damp_hz, width)
    n = len(x) + len(h)
    nfft = 1 << (n - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, nfft, axis=0) * np.fft.rfft(h, nfft, axis=0), nfft, axis=0)[: len(x)]
    return (x * (1 - wet) + y.astype(np.float32) * wet * 2.0).astype(np.float32)


def rms_env(x, win=0.01):
    """Mono RMS envelope at sample rate (window in seconds), by cumulative sums."""
    m = (stereo(x) ** 2).mean(1).astype(np.float64)
    w = max(1, int(win * SR))
    c = np.concatenate([[0], np.cumsum(m)])
    idx = np.arange(len(m))
    lo, hi = np.maximum(0, idx - w // 2), np.minimum(len(m), idx + w // 2 + 1)
    return np.sqrt((c[hi] - c[lo]) / (hi - lo)).astype(np.float32)


def onset(sig, thresh_db=-30.0):
    """Index of the first sample within thresh_db of the sound's peak envelope."""
    e = rms_env(sig, 0.002)
    if not e.max():
        return 0
    return int(np.argmax(e >= e.max() * 10 ** (thresh_db / 20)))
