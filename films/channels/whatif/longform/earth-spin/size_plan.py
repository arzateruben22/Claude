"""Size the final script at the planned pace (about 2.5 words a second): which recorded sentences each part keeps, which add-ons each part needs.
Durations: the AI stand-in's sentence times for recorded sentences (vo/words.json, 2.4 words/s), words/2.5 + 0.3 s for new sentences."""
import json, re
from pathlib import Path
HERE = Path(__file__).resolve().parent
W = json.loads((HERE / "vo/words.json").read_text())["lines"]
SENT = {}
for wl in W:
    n = int(wl["id"][2:]); cur, k = [], 0
    for w in wl["words"]:
        cur.append(w)
        if re.search(r"[.?!]$", w["w"]):
            k += 1; SENT[f"L{n}.{k}"] = (cur[-1]["end"] - cur[0]["start"], " ".join(x["w"] for x in cur)); cur = []
    if cur: k += 1; SENT[f"L{n}.{k}"] = (cur[-1]["end"] - cur[0]["start"], " ".join(x["w"] for x in cur))
ADD = {a["id"]: a for a in json.loads((HERE / "addons.json").read_text())}
def dur_add(a):
    return len(re.findall(r"[A-Za-z0-9']+", ADD[a]["text"])) / 2.5 + 0.3
def d(k): return SENT[k][0] if k in SENT else dur_add(k)
G = 0.5
FIX = 3.3 + 3.8 + 3.5 + 6.0 + 4 * G      # opening, cliffhanger, closer, like/follow line, and their pauses
def total(keys): return sum(d(k) for k in keys) + G * (len(keys) - 1) + FIX
if __name__ == "__main__":
    import sys
    PARTS = json.loads((HERE / "size_parts.json").read_text())
    tot_film = 0
    for n, keys in PARTS.items():
        t = total(keys); print(f"part {n}: {len(keys)} sentences, {t:.1f} s {'OK' if 61 <= t <= 74 else '<-- OUT'}")
