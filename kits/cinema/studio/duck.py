"""The music steps back while someone speaks.

The curve is built from the voice's line spans (known from the cue sheet), not from a detector,
so it starts *before* the first word (pre-roll) and never pumps on breaths. Gaps shorter than
`hold` stay ducked, so the music doesn't bob between sentences.
"""
import numpy as np

from .core import SR


def duck_curve(spans, n, depth_db=-9.0, attack=0.08, release=0.35, preroll=0.15, hold=0.6, step=0.001):
    """spans: [(t0, t1)] in seconds. Returns a gain curve of n samples (1 = untouched)."""
    m = int(np.ceil(n / (step * SR))) + 1
    target = np.ones(m)
    merged = []
    for a, b in sorted(spans):
        if merged and a - merged[-1][1] < hold:
            merged[-1][1] = max(merged[-1][1], b)
        else:
            merged.append([a, b])
    g = 10 ** (depth_db / 20)
    for a, b in merged:
        target[max(0, int((a - preroll) / step)):min(m, int(b / step) + 1)] = g
    out = np.empty(m)
    ka, kr = 1 - np.exp(-step / (attack / 3)), 1 - np.exp(-step / (release / 3))
    # look ahead by the attack time so the dip is complete when the word starts
    lead = int(attack / step)
    target = np.concatenate([target[lead:], np.ones(lead)])
    cur = 1.0
    for i in range(m):
        cur += (target[i] - cur) * (ka if target[i] < cur else kr)
        out[i] = cur
    return np.interp(np.arange(n) / SR, np.arange(m) * step, out).astype(np.float32)
