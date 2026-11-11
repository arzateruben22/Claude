"""Season 3 v2: duck the breaths between words on the stems, by word alignment. Run after align.py on <ep>v2/vo (and vo/yt), before s3_v2.py.
  ~/.cache/cinema-voice/venv/bin/python -I films/channels/skincare/set/s3_duck.py ep16
Each gap between aligned words (and the lead-in and tail of a stem) is lowered by DUCK_DB with raised-cosine fades; word onsets and tails are never touched
(a guard of PRE s before the next word and POST s after the last one stays at full level). The originals are kept as NN.raw.wav (written once)."""
import json, sys, shutil
from pathlib import Path
import numpy as np, soundfile as sf
DUCK_DB, PRE, POST, FADE, SPEECH_DB, MIN_REGION = -14.0, 0.12, 0.16, 0.04, 20.0, 0.30   # only the real pauses between phrases (breaths), never the short gaps inside a phrase
R = Path(__file__).resolve().parent.parent; d = R / (sys.argv[1] + "v2")
def duck(wav, words):
    raw = wav.with_suffix(".raw.wav")
    if not raw.exists(): shutil.copy(wav, raw)
    x, sr = sf.read(raw, dtype="float64"); n = len(x); g = np.ones(n); gd = 10 ** (DUCK_DB / 20); spans = []
    ws = sorted(words, key=lambda w: w["start"]); edges = [(0.0, ws[0]["start"])] + [(a["end"], b["start"]) for a, b in zip(ws, ws[1:])] + [(ws[-1]["end"], n / sr)]
    for k, (a, b) in enumerate(edges):
        a2 = a + (POST if k > 0 else 0.0); b2 = b - (PRE if k < len(edges) - 1 else 0.0)
        if b2 - a2 < MIN_REGION: continue
        f = min(FADE, (b2 - a2) / 3); i0, i1, fi = int(a2 * sr), int(b2 * sr), int(f * sr)
        env = np.full(i1 - i0, gd); ramp = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, fi)); env[:fi] = 1 - (1 - gd) * ramp; env[-fi:] = 1 - (1 - gd) * ramp[::-1]
        if k == 0: env[:fi] = gd                          # the lead-in before the first word is already silence-like: no fade needed
        g[i0:i1] = np.minimum(g[i0:i1], env); spans.append((round(a2, 2), round(b2, 2)))
    # protect anything speech-like inside the gaps (alignment is only good to a few tens of ms): frames louder than SPEECH_DB below the words' own 90th-percentile level keep full gain
    h = int(0.01 * sr); fr = np.sqrt(np.convolve(x ** 2, np.ones(h) / h, "same")); lv = 20 * np.log10(fr + 1e-9)
    inw = np.zeros(n, bool)
    for w in ws: inw[int(w["start"] * sr):int(w["end"] * sr)] = True
    ref = np.percentile(lv[inw], 90) if inw.any() else lv.max(); loud = np.convolve((lv > ref - SPEECH_DB).astype(float), np.ones(int(0.04 * sr)), "same") > 0
    g = np.where(loud, 1.0, g)
    # smooth the envelope so a protected stretch never makes a click
    g = np.convolve(g, np.ones(int(0.008 * sr)) / int(0.008 * sr), "same")
    y = x * g if x.ndim == 1 else x * g[:, None]
    sf.write(wav, y, sr, subtype="PCM_24")
    rms = lambda v: 20 * np.log10(np.sqrt(np.mean(v ** 2)) + 1e-12)
    ing = np.concatenate([x[int(a * sr):int(b * sr)] for a, b in spans]) if spans else np.zeros(1)
    return spans, rms(ing), rms(np.concatenate([y[int(a * sr):int(b * sr)] for a, b in spans]) if spans else np.zeros(1))
for sub in ("vo", "vo/yt"):
    wj = d / sub / "words.json"
    if not wj.exists(): continue
    for L in json.loads(wj.read_text())["lines"]:
        f = d / sub / next(x["file"] for x in json.loads((d / sub / "lines.json").read_text())["lines"] if x["id"] == L["id"])
        spans, before, after = duck(f, L["words"]); print(f"{sub}/{f.name}: {len(spans)} gaps ducked, gap level {before:.1f} -> {after:.1f} dB")
