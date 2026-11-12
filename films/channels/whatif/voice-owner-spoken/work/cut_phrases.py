"""Cut named phrases out of the owner's cleaned Part B/C/D recording (V-clean.wav) by word times from the recogniser, writing cutV/<name>.wav and cutV/phrases.json.
A phrase is found by its spoken words; `pick` chooses which take (0 = first, -1 = last). Every sample is the owner's."""
import json, re, sys
from pathlib import Path
import numpy as np, soundfile as sf
HERE = Path(__file__).resolve().parent; OUT = HERE.parent / "cutV"; OUT.mkdir(exist_ok=True)
hw = json.load(open("/tmp/Vheard.json")); x, sr = sf.read(HERE / "V-clean.wav", dtype="float32")
tok = lambda w: re.sub(r"[^a-z0-9']", "", w.lower())
H = [tok(w) for w, a, b in hw]
def find(words, pick=0, after=0):
    W = [tok(w) for w in words.split()]; hits = [i for i in range(after, len(H) - len(W) + 1) if H[i:i + len(W)] == W]
    if not hits: raise SystemExit("not found: " + words)
    return hits[pick], hits[pick] + len(W)
PH = {   # name: (spoken words, text as spoken (the caption text), pick, extra words to include after)
 "p1_open": ("what if earth spun faster and couldn't stop", "What if Earth spun faster, and couldn't stop?", 0),
 "p1_cliff": ("and then the spin has only just begun to speed up", "And then the spin has only just begun to speed up.", 0),
 "p2_open": ("the day is now 12 hours long", "The day is now twelve hours long.", 0),
 "p2_cliff": ("and then the wind starts to blow", "And then the wind starts to blow.", 0),
 "c1": ("part 1 of 8 full video on youtube", "Part one of eight. Full video on YouTube.", 0),
 "c2": ("part 2 of 8 full video on youtube", "Part two of eight. Full video on YouTube.", 0),
 "cta_follow": ("hang on if you're enjoying this tap like and follow okay back to the math", "Hang on. If you're enjoying this, tap like and follow. Okay, back to the math.", 0),
 "cta_sub": ("hang on if you're enjoying this tap like and subscribe okay back to the math", "Hang on. If you're enjoying this, tap like and subscribe. Okay, back to the math.", 0),
}
meta = {}
for name, (words, text, pick) in PH.items():
    i0, i1 = find(words, pick); a, b = hw[i0][1], hw[i1 - 1][2]
    prev_end = hw[i0 - 1][2] if i0 else 0.0; nxt = hw[i1][1] if i1 < len(hw) else len(x) / sr
    s0 = max(prev_end + 0.01, a - 0.08); e0 = min(nxt - 0.02, b + 0.15)
    y = x[int(s0 * sr): int(e0 * sr)]; sf.write(OUT / f"{name}.wav", y, sr)
    meta[name] = dict(text=text, file=f"{name}.wav", dur=round(len(y) / sr, 3), src=[round(s0, 2), round(e0, 2)], take=pick, heard=" ".join(w for w, _, _ in hw[i0:i1])); print(name, round(len(y) / sr, 2), meta[name]["src"])
json.dump(meta, open(OUT / "phrases.json", "w"), indent=1)
