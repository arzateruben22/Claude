"""More named phrases from the owner's V recording for Parts 3-8: openings/cliffhangers V05-V16, closers C3-C8, and the NEW one-sentence asks (cut from inside V25/V26, without 'Hang on.' and 'Okay, back to the math.').
Merges into cutV/phrases.json. Every sample is the owner's."""
import json, re
from pathlib import Path
import numpy as np, soundfile as sf
HERE = Path(__file__).resolve().parent; OUT = HERE.parent / "cutV"
hw = json.load(open("/tmp/Vheard.json")); x, sr = sf.read(HERE / "V-clean.wav", dtype="float32")
tok = lambda w: re.sub(r"[^a-z0-9']", "", w.lower()); H = [tok(w) for w, a, b in hw]
def find(words, after=0):
    W = [tok(w) for w in words.split()]; hits = [i for i in range(after, len(H) - len(W) + 1) if H[i:i + len(W)] == W]
    if not hits: raise SystemExit("not found: " + words)
    return hits[0], hits[0] + len(W)
PH = {  # name: (spoken words as heard, caption text, search-after time in s)
 "p3_open": ("the air can't keep up with the ground", "The air can't keep up with the ground.", 0),
 "p3_cliff": ("and then the oceans start to move", "And then the oceans start to move.", 0),
 "p4_open": ("the oceans are sliding toward the equator", "The oceans are sliding toward the equator.", 0),
 "p4_cliff": ("and the weather is about to change completely", "And the weather is about to change completely.", 0),
 "p5_open": ("storms are turning faster and the days are six hours long", "Storms are turning faster, and the days are six hours long.", 0),
 "p5_cliff": ("and the calendar is about to break", "And the calendar is about to break.", 0),
 "p6_open": ("now our year has more than a thousand days in it", "Now a year has more than a thousand days in it.", 0),
 "p6_cliff": ("and the day keeps getting shorter", "And the day keeps getting shorter.", 0),
 "p7_open": ("three hours then two a day is as long as a movie", "Three hours, then two. A day is as long as a movie.", 0),
 "p7_cliff": ("at an hour and a half you're almost weightless", "At an hour and a half, you're almost weightless.", 0),
 "p8_open": ("a day now lasts about an hour and a half", "A day now lasts about an hour and a half.", 0),
 "p8_cliff": ("one more nudge and something changes completely", "One more nudge, and something changes completely.", 0),
 "c3": ("part 3 of 8 full video on youtube", "Part three of eight. Full video on YouTube.", 0), "c4": ("part 4 of 8 full video on youtube", "Part four of eight. Full video on YouTube.", 0),
 "c5": ("part 5 of 8 full video on youtube", "Part five of eight. Full video on YouTube.", 0), "c6": ("part 6 of 8 full video on youtube", "Part six of eight. Full video on YouTube.", 0),
 "c7": ("part 7 of 8 full video on youtube", "Part seven of eight. Full video on YouTube.", 0), "c8": ("part 8 of 8 full video on youtube", "Part eight of eight. Full video on YouTube.", 0),
 "ask_follow": ("if you're enjoying this tap like and follow", "If you're enjoying this, tap like and follow.", 100),
 "ask_sub": ("if you're enjoying this tap like and subscribe", "If you're enjoying this, tap like and subscribe.", 107),
}
meta = json.load(open(OUT / "phrases.json"))
for name, (words, text, after_s) in PH.items():
    a0 = next((i for i, w in enumerate(hw) if w[1] >= after_s), 0)
    try: i0, i1 = find(words, a0)
    except SystemExit as e: print("MISSING", name, "| heard near:", " ".join(w for w, a, b in hw[max(0, a0):a0 + 0]) , e); continue
    a, b = hw[i0][1], hw[i1 - 1][2]; prev_end = hw[i0 - 1][2] if i0 else 0.0; nxt = hw[i1][1] if i1 < len(hw) else len(x) / sr
    s0 = max(prev_end + 0.01, a - 0.08); e0 = min(nxt - 0.02, b + 0.15); y = x[int(s0 * sr): int(e0 * sr)]; sf.write(OUT / f"{name}.wav", y, sr)
    meta[name] = dict(text=text, file=f"{name}.wav", dur=round(len(y) / sr, 3), src=[round(s0, 2), round(e0, 2)], take=0, heard=" ".join(w for w, _, _ in hw[i0:i1])); print(name, round(len(y) / sr, 2), meta[name]["heard"])
json.dump(meta, open(OUT / "phrases.json", "w"), indent=1)
