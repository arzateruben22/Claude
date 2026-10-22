"""Loudness (ITU-R BS.1770 / EBU R128), true peak and phone checks, numpy only.

K-weighting is applied as the filter's magnitude on each block's spectrum (loudness is energy, so
phase doesn't matter). Checked against ffmpeg's ebur128 within 0.1 LU; ffmpeg stays the final
word on the delivered AAC (master.measure_file).
"""
import numpy as np

from .core import SR, stereo


def _kweight_mag2(nfft):
    f = np.fft.rfftfreq(nfft, 1 / SR)
    z = np.exp(-1j * 2 * np.pi * f / SR)

    def H(b, a):
        return (b[0] + b[1] * z + b[2] * z ** 2) / (a[0] + a[1] * z + a[2] * z ** 2)
    # the BS.1770 pre-filter (high shelf) and RLB high-pass, at 48 kHz
    h1 = H([1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585])
    h2 = H([1.0, -2.0, 1.0], [1, -1.99004745483398, 0.99007225036621])
    return np.abs(h1 * h2) ** 2


def _block_energy(x, blk, hop):
    x = stereo(x)
    if len(x) < blk:
        x = np.pad(x, ((0, blk - len(x)), (0, 0)))
    w = _kweight_mag2(blk)
    n = (len(x) - blk) // hop + 1
    idx = np.arange(blk)[None, :] + hop * np.arange(n)[:, None]
    e = np.zeros(n)
    for c in range(2):
        S = np.abs(np.fft.rfft(x[idx, c], axis=1)) ** 2
        S[:, 1:-1] *= 2
        e += (S * w).sum(1) / blk ** 2
    return e


def _L(e):
    return -0.691 + 10 * np.log10(np.maximum(e, 1e-20))


def lufs(x):
    """Integrated loudness: 400 ms blocks, 75% overlap, absolute (−70) and relative (−10) gates."""
    e = _block_energy(x, int(0.4 * SR), int(0.1 * SR))
    g = e[_L(e) > -70]
    if not len(g):
        return -70.0
    rel = _L(g.mean()) - 10
    g2 = g[_L(g) > rel]
    return float(_L(g2.mean()))


def short_term(x, hop=0.1):
    """Short-term loudness (3 s windows) every hop seconds → (times, LUFS)."""
    e = _block_energy(x, int(3 * SR), int(hop * SR))
    return np.arange(len(e)) * hop + 1.5, _L(e)


def lra(x):
    """Loudness range (EBU Tech 3342): 10th–95th percentile of gated short-term loudness."""
    _, s = short_term(x, 0.1)
    s = s[s > -70]
    if not len(s):
        return 0.0
    s = s[s > _L((10 ** ((s + 0.691) / 10)).mean()) - 20]
    return float(np.percentile(s, 95) - np.percentile(s, 10))


def upsample4(x, B=1 << 16, ov=512):
    """4× band-limited upsampling in overlapping FFT blocks (for true peak)."""
    x = stereo(x)
    n = len(x)
    out = np.empty((4 * n, 2), np.float32)
    for s in range(0, n, B):
        a, b = max(0, s - ov), min(n, s + B + ov)
        X = np.fft.rfft(x[a:b], axis=0)
        m = b - a
        Y = np.zeros((2 * m + 1, 2), complex)
        Y[:len(X)] = X
        y = np.fft.irfft(Y, 4 * m, axis=0) * 4
        e = min(n, s + B)
        out[4 * s:4 * e] = y[4 * (s - a):4 * (s - a) + 4 * (e - s)]
    return out


def true_peak_db(x):
    return float(20 * np.log10(max(np.abs(upsample4(x)).max(), 1e-12)))


def correlation(x):
    """Phase correlation of left and right (−1 … +1). Below 0 means the mono fold-down cancels."""
    x = stereo(x).astype(np.float64)
    d = np.sqrt((x[:, 0] ** 2).sum() * (x[:, 1] ** 2).sum())
    return float((x[:, 0] * x[:, 1]).sum() / d) if d else 1.0


def mono_loss_db(x):
    """How much quieter the mono fold-down is than the stereo signal (phone speakers)."""
    x = stereo(x)
    return float(lufs(x) - lufs(np.repeat(x.mean(1, keepdims=True), 2, 1)))
