"""voice_edges.py: where a line cut out of a longer recording may start and end (One More Orbit Season 3).

The owner heard "some parts of the audio sound quickly cut off" (12 Nov 2026): two lines had been cut while their last
word ("…the tidal pull") was still sounding, 0.26-0.34 s before the voice had died away. The rule here: a cut never
lands on sound. An end waits for the natural decay (the level back within 6 dB of the quiet that follows, for 60 ms)
and stops before the next speech; a start that lands on the voice moves back to the quiet before it. Used by
owner_voice_v4.py (with the recogniser's word bounds) and recut_v4.py (no recogniser: the onset of the next speech is
found in the level itself).
"""
import numpy as np

STEP = 0.005          # envelope frames, s


def envelope(x, sr, step=STEP):
    """level per frame, dBFS"""
    h = int(step * sr); n = len(x) // h
    return 20 * np.log10(np.sqrt((x[: n * h].reshape(n, h) ** 2).mean(1)) + 1e-9)


def settle_end(E, e, floor, limit=None, step=STEP, hold=0.06, margin=6.0, cap=0.8, pad=0.02):
    """The earliest time >= e where the level stays within `margin` dB of the quiet that follows for `hold` s (+ `pad`).
    Never past `limit` (the next speech, when known) or e + cap. A new onset (a rise of 15 dB over the lowest point so
    far, above -40 dBFS) also bounds it. If the voice never settles before that bound, the quietest frame before it."""
    i0 = int(round(e / step)); n = len(E)
    i_lim = n - 1 if limit is None else min(n - 1, int(limit / step))
    i_cap = min(i_lim, i0 + int(cap / step))
    if i0 >= i_cap: return e
    ref = max(floor, float(np.percentile(E[i0:i_cap + 1], 10))) + margin
    S = np.convolve(E, np.ones(4) / 4, "same")                              # 20 ms smoothing: a voice's own ripple is not an onset
    k = max(1, int(round(hold / step))); mn = i0
    for j in range(i0, i_cap - k + 1):
        if S[j] < S[mn]: mn = j
        if j > mn and (S[j:j + 6] > S[mn] + 15).all() and S[j] > -40:      # the next speech starts (30 ms sustained): stop in the dip before it
            return round(mn * step, 3)
        if (E[j:j + k] <= ref).all():
            return round(min(j * step + pad, i_cap * step), 3)
    return round(mn * step, 3)


def settle_start(E, s, floor, limit=None, step=STEP, hold=0.06, margin=6.0, cap=0.4, pad=0.02, voice=-45.0):
    """s itself when the start is quiet (below `voice` dBFS around it); otherwise the latest time <= s where the level
    has been within `margin` dB of the quiet before it for `hold` s (- `pad`), never before `limit` or s - cap."""
    i0 = int(round(s / step))
    if i0 <= 0 or float(np.max(E[max(0, i0 - 4):i0 + 4])) < voice: return s
    i_lim = 0 if limit is None else max(0, int(limit / step) + 1)
    i_cap = max(i_lim, i0 - int(cap / step))
    if i_cap >= i0: return s                                                 # the previous speech ends right here: nothing to move into
    ref = max(floor, float(np.percentile(E[i_cap:i0 + 1], 10))) + margin
    k = max(1, int(round(hold / step)))
    for j in range(i0, i_cap + k - 1, -1):
        if (E[j - k:j] <= ref).all():
            return round(max(j * step - pad, i_cap * step), 3)
    return round(i_cap * step + int(np.argmin(E[i_cap:i0 + 1])) * step, 3)
