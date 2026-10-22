"""Master: a true-peak limiter, gain to a loudness target, stems that sum to the mix, and a
closed loop on the delivered AAC (the encoder adds peak, so the ceiling is lowered until the
decoded file passes).
"""
import json
import re
import subprocess
import tempfile
from pathlib import Path

import numpy as np

from .core import SR, db, write_wav
from .meter import lufs, true_peak_db, upsample4


def limiter_gain(x, ceil_db=-2.0, look=0.005, rel=0.12, cb=32):
    """Gain curve (N,) that keeps the 4×-oversampled peak under ceil_db: 32-sample control blocks,
    5 ms look-ahead, exponential release. Applying it to every stem keeps the stems summing."""
    up = np.abs(upsample4(x)).max(1)
    nb = -(-len(x) // cb)
    up = np.pad(up, (0, nb * cb * 4 - len(up)))
    pk = up.reshape(nb, cb * 4).max(1)
    c = 10 ** (ceil_db / 20)
    req = np.minimum(1, c / np.maximum(pk, 1e-9))
    la = int(np.ceil(look * SR / cb)) + 1
    padr = np.pad(req, (0, la), constant_values=1)
    win = np.min(np.lib.stride_tricks.sliding_window_view(padr, la + 1), 1)[:nb]
    a = np.exp(-cb / (rel * SR))
    g = np.empty(nb)
    cur = 1.0
    for i in range(nb):
        cur = win[i] if win[i] < cur else win[i] + (cur - win[i]) * a
        g[i] = cur
    tg = np.interp(np.arange(len(x)), np.arange(nb) * cb + cb / 2, g)
    return np.minimum(tg, np.repeat(win, cb)[:len(x)]).astype(np.float32)


def master(stems, target=-14.0, ceil_db=-2.0, iters=5):
    """stems: {name: (N, 2)}. Finds one gain k and one limiter curve so that the summed mix hits
    target LUFS under ceil_db true peak. Returns (mix, mastered stems, report)."""
    raw = sum(stems.values())
    k = target - lufs(raw)
    for it in range(iters):
        g = limiter_gain(raw * np.float32(db(k)), ceil_db)
        mix = raw * np.float32(db(k)) * g[:, None]
        err = target - lufs(mix)
        if abs(err) < 0.1:
            break
        k += err
    out = {n: (s * np.float32(db(k)) * g[:, None]).astype(np.float32) for n, s in stems.items()}
    mix = sum(out.values())
    rep = {"gain_db": round(float(k), 2), "iterations": it + 1, "lufs": round(lufs(mix), 2),
           "true_peak_db": round(true_peak_db(mix), 2), "ceiling_db": ceil_db,
           "limiting_max_db": round(float(20 * np.log10(g.min())), 2)}
    return mix.astype(np.float32), out, rep


def measure_file(path):
    """ffmpeg ebur128 on any file (decodes AAC): integrated LUFS, true peak, LRA."""
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-map", "0:a:0", "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True)
    s = r.stderr[r.stderr.rfind("Summary:"):]
    get = lambda pat: float(re.search(pat, s).group(1))
    return {"lufs": get(r"I:\s+(-?[\d.]+) LUFS"), "true_peak_db": get(r"Peak:\s+(-?[\d.]+) dBFS"), "lra": get(r"LRA:\s+(-?[\d.]+) LU")}


def encode_aac(wav, out, kbps=256):
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(wav), "-c:a", "aac", "-b:a", f"{kbps}k", "-ar", str(SR), str(out)], check=True)


def deliver(stems, outdir, target=-14.0, tp_gate=-1.0, start_ceil=-2.0, kbps=256, tag="mix"):
    """Master, write the WAVs, encode the AAC, measure it, and lower the ceiling 0.5 dB at a time
    until the decoded AAC is ≤ tp_gate − 0.5 dBTP (headroom for the platform's own re-encode)."""
    outdir = Path(outdir)
    (outdir / "stems").mkdir(parents=True, exist_ok=True)
    ceil = start_ceil
    for _ in range(6):
        mix, ms, rep = master(stems, target, ceil)
        write_wav(outdir / "mix.wav", mix, tag=tag)
        encode_aac(outdir / "mix.wav", outdir / "mix.m4a", kbps)
        aac = measure_file(outdir / "mix.m4a")
        rep["aac"] = aac
        if aac["true_peak_db"] <= tp_gate - 0.5:
            break
        ceil -= 0.5
    for n, s in ms.items():
        write_wav(outdir / "stems" / f"{n}.wav", s, tag=f"{tag}:{n}")
    rep["stems_sum_error_db"] = round(float(20 * np.log10(np.abs(sum(ms.values()) - mix).max() / np.abs(mix).max() + 1e-12)), 1)
    (outdir / "master.json").write_text(json.dumps(rep, indent=1))
    return mix, ms, rep
