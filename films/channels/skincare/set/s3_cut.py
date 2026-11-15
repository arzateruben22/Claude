"""Season 3: cut an episode's lines out of the polished recording (ep13/work/polish/after.wav) by word alignment.
  ~/.cache/cinema-voice/venv/bin/python -I films/channels/skincare/set/s3_cut.py ep14
Reads <ep>/cut.json: {"lines": [{"id","beat","text","a","b"}], "cta": {"follow": [a,b,text], "subscribe": [a,b,text]}} where a/b are the approximate start of the first word and end of the last word
(from ep13/work/full_words.json, Parakeet on the whole recording). Writes vo/NN.wav (+ 24-bit, 60 ms fades), vo/lines.json, vo/yt/ (the subscribe take)."""
import json, sys, hashlib
from pathlib import Path
import numpy as np, soundfile as sf
sys.path.insert(0, str(Path(__file__).resolve().parent)); import voice_edges as VE      # a cut never lands on sound (One More Orbit's rule): an end waits for the natural decay, a start moves back into the quiet
R = Path(__file__).resolve().parent.parent; ep = sys.argv[1]; d = R / ep
V2 = len(sys.argv) > 2 and sys.argv[2] == "v2"     # v2: cut from the clarity.py-cleaned recording into <ep>v2/vo (cut.json is read from <ep>/)
srcd = R / ep.removesuffix("v2") if V2 else d; d = R / (ep.removesuffix("v2") + "v2") if V2 else d; (d / "vo/yt").mkdir(parents=True, exist_ok=True)
a_, sr = sf.read(R / ("ep13/work/clarity/clean.wav" if V2 else "ep13/work/polish/after.wav"), dtype="float32"); a_ = a_.mean(1) if a_.ndim > 1 else a_
words = json.loads((R / "ep13/work/full_words.json").read_text()); cfg = json.loads((srcd / "cut.json").read_text())
def span(a, b):
    ws = [w for w in words if w[1] >= a - 0.06 and w[2] <= b + 0.06]; assert ws, (a, b); nxt = [w[1] for w in words if w[1] >= ws[-1][2] - 1e-3 and w is not ws[-1] and w[1] > ws[-1][1]]
    prv = [w[2] for w in words if w[2] <= ws[0][1] + 1e-3 and w is not ws[0] and w[2] < ws[0][2]]; return ws[0][1], ws[-1][2], (nxt[0] if nxt else 1e9), (prv[-1] if prv else None)
E = VE.envelope(a_, sr); FLOOR = float(np.percentile(E, 5))
def cut(s, e, path, nxt=1e9, prv=None):
    s2 = VE.settle_start(E, s, FLOOR, limit=prv); e2 = VE.settle_end(E, e, FLOOR, limit=(nxt - 0.02) if nxt < 1e8 else None)
    i0 = max(0, int((s2 - 0.06) * sr)); i1 = min(len(a_), int(max(e2, e + 0.04) * sr)); x = a_[i0:i1].copy(); f = int(0.03 * sr); x[:f] *= np.linspace(0, 1, f); x[-f:] *= np.linspace(1, 0, f)
    sf.write(path, x, sr, subtype="PCM_24"); return len(x) / sr, hashlib.sha256(Path(path).read_bytes()).hexdigest()

lines = []
for n, L in enumerate(cfg["lines"], 1):
    s, e, nx, pv = span(L["a"], L["b"]); dur, h = cut(s, e, d / f"vo/{n:02d}.wav", nx, pv)
    lines.append({"id": f"vo{n:02d}", "beat": L["beat"], "text": L["text"], "stars": [], "phonemes": None, "file": f"{n:02d}.wav", "dur": round(dur, 2), "sha256": h})
HAS_CTA = bool(cfg.get("cta"))     # an episode with no spoken like/follow ask (films/channels/skincare/CTA.md) has no cta in cut.json
if HAS_CTA:
    n = len(lines) + 1; f = cfg["cta"]["follow"]; s, e, nx, pv = span(f[0], f[1]); dur, h = cut(s, e, d / f"vo/{n:02d}.wav", nx, pv)
    lines.append({"id": f"vo{n:02d}", "beat": "cta", "text": f[2], "stars": [], "phonemes": None, "file": f"{n:02d}.wav", "dur": round(dur, 2), "sha256": h})
    y = cfg["cta"]["subscribe"]; s, e, nx, pv = span(y[0], y[1]); dur, h = cut(s, e, d / f"vo/yt/{n:02d}y.wav", nx, pv)
    json.dump({"voice": "recorded", "lines": [{"id": f"vo{n:02d}", "beat": "cta", "text": y[2], "file": f"{n:02d}y.wav", "dur": round(dur, 2), "sha256": h}]}, open(d / "vo/yt/lines.json", "w"), indent=1)
json.dump({"voice": "recorded", "speaker": "a real person (credit pending her confirmation)", "speed": None, "lang": "en-us", "style": "whisper", "source": "voice-evelyn/evelyn-s3-full.m4a", "made_by": "polish.py --style whisper on the whole recording, cut by word alignment (set/s3_cut.py)", "lines": lines}, open(d / "vo/lines.json", "w"), indent=1, ensure_ascii=False)
print([(l["id"], l["dur"]) for l in lines], round(dur, 2))
