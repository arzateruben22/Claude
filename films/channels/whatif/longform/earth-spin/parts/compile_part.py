"""Compile one vertical part (9:16, 1:01-1:15) of the Earth-spin film to film.json + sheet.json.

  python3 -I films/channels/whatif/longform/earth-spin/parts/compile_part.py N

The part's scene is the long film's own (../scene.mjs, framed natively for portrait). Its day-length keys, ocean-retreat keys and weight windows are the long
film's, carried over by sentence: each chosen sentence keeps its place on the long film's clock, so the counter reads what the voice says (milestones hold through their beat).
"""
import json, math, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
ES = HERE.parent
sys.path.insert(0, str(ES.parents[4] / "kits/cinema/script"))
sys.path.insert(0, str(ES))
from timeline import Film       # noqa: E402
from calc import T_ORB, R as R_EQ, E_ORB, E_NOW   # noqa: E402
N = int(sys.argv[1])
D = HERE / f"part{N}"
FPS, BPM = 30, 50
items = json.loads((D / "items.json").read_text())
f = Film(D / "script.md", D / "vo", fps=FPS, bpm=BPM, grid=0.125)
speech = sum(i["dur"] for i in items)
TARGET = float(sys.argv[2]) if len(sys.argv) > 2 else 68.0
n_gaps = len(items) - 1
GAP = min(0.9, max(0.35, (TARGET - 2.0 - speech) / n_gaps))          # the pause between items, 0.35-0.9 s (the 1.2 s voiceless-gap rule always holds)
plan = {}
for it in items:
    pre, hold = 0.05, GAP - 0.1
    if it["kind"] == "open": pre, hold = 0.2, GAP
    if it["kind"] == "closer": pre, hold = 0.0, 0.0
    if it["kind"] == "cta": pre, hold = 0.15, GAP - 0.05
    plan[it["uid"]] = {"pre": pre, "hold": max(0.05, hold), "energy": 0.6}
BEATS = f.layout(plan, end_hold=2.2)
A = f.at
LINE = {it["vo"]: it for it in items}
# ── the long film, for the keys ──
LF = json.loads((ES / "film.json").read_text())
LV = {v["id"]: v for v in LF["voice"]}
LO = {l["id"]: l for l in json.loads((ES / "vo-owner/lines.json").read_text())["lines"]}
longsent = {}                                          # key -> (start, end) on the long film's clock
for lid, l in LO.items():
    for s in l["sentences"]: longsent[s["key"]] = (LV[lid]["t"] + s["t0"], LV[lid]["t"] + s["t1"])
anch = []                                              # (long time, part time)
for ln in f.lines:
    it = LINE[ln["id"]]
    if it["key"] in longsent:
        a, b = longsent[it["key"]]
        anch += [(a, ln["t"]), (b, ln["t"] + ln["dur"])]
anch.sort()
for (a, x), (b, y) in zip(anch, anch[1:]):
    assert b >= a - 1e-6 and y >= x - 1e-6, (a, x, b, y)
def m(t):                                              # long time -> part time (piecewise linear between sentences)
    if t <= anch[0][0]: return anch[0][1] - (anch[0][0] - t) * 0.0
    for (a, x), (b, y) in zip(anch, anch[1:]):
        if t <= b: return x + (y - x) * ((t - a) / (b - a) if b > a else 0)
    return anch[-1][1]
def inout2(x): return 2 * x * x if x < 0.5 else 1 - (-2 * x + 2) ** 2 / 2
def Th(t):                                             # the scene's own day-length function
    K = LF["world"]["keys"]
    if t <= K[0][0]: return K[0][1]
    for (a, ta), (b, tb) in zip(K, K[1:]):
        if t <= b:
            return tb if b - a < 1e-9 else math.exp(math.log(ta) + (math.log(tb) - math.log(ta)) * inout2(min(1, max(0, (t - a) / (b - a)))))
    return K[-1][1]
t_lo, t_hi = anch[0][0], anch[-1][0]
KEYS = [[0.0, round(Th(t_lo), 4)]]
for t, T in LF["world"]["keys"]:
    if t_lo < t < t_hi:
        KEYS.append([round(m(t), 4), T])
KEYS.append([round(f.duration, 4), round(Th(t_hi), 4)])
KEYS[0][1] = min(KEYS[0][1], KEYS[1][1] if len(KEYS) > 1 else 99) if False else KEYS[0][1]
for (a, x), (b, y) in zip(KEYS, KEYS[1:]):                # monotone
    assert b >= a - 1e-9 and y <= x + 1e-9, (KEYS)
def dry_at(t):
    K = LF["world"]["dry"]
    if t <= K[0][0]: return K[0][1]
    for (a, va), (b, vb) in zip(K, K[1:]):
        if t <= b:
            u = (t - a) / max(1e-6, b - a); return va + (vb - va) * inout2(min(1, max(0, u)))
    return K[-1][1]
DRY = [[0.0, round(dry_at(t_lo), 2)]] + [[round(m(t), 4), v] for t, v in LF["world"]["dry"] if t_lo < t < t_hi] + [[round(f.duration, 4), round(dry_at(t_hi), 2)]]
WW = [[round(m(max(a, t_lo)), 4), round(m(min(b, t_hi)), 4)] for a, b in LF["world"].get("weightWins", []) if b > t_lo and a < t_hi]
# ── shots: the long film's own shot per beat ──
SHOT_OF = {"hook": "shoulder", "premise": "globe", "today": "eye", "spinup": "eye", "twelve": "shoulder", "wind": "eye", "oceans": "globe", "weather": "globe",
           "six": "eye", "calendar": "shoulder", "poles": "globe", "three": "shoulder", "two": "eye", "one-five": "shoulder", "tease": "end"}
SHOTS, last = [], None
for b in BEATS:
    it = next(i for i in items if i["uid"] == b["id"])
    name = SHOT_OF.get(it["beat"], "shoulder") if it["kind"] != "closer" else "end"
    if it["kind"] in ("cta",): name = last or name
    if name != last: SHOTS.append({"at": 0.0 if not SHOTS else b["t0"], "name": name, "beat": it["beat"]})
    last = name
closer = next(l for l in f.lines if LINE[l["id"]]["kind"] == "closer")
t_end = A(f"{closer['id']}:Full", -0.2)
SHOTS[-1]["at"] = min(SHOTS[-1]["at"], t_end) if SHOTS[-1]["name"] == "end" else SHOTS[-1]["at"]
if SHOTS[-1]["name"] != "end": SHOTS.append({"at": t_end, "name": "end", "beat": "tease"})
else: SHOTS[-1]["at"] = t_end
def lead(pages, by=0.14):
    for i, pg in enumerate(pages):
        prev = pages[i - 1]["t1"] if i else -1.0
        if pg["t0"] - prev >= by + 0.05: pg["t0"] = round(max(0.0, pg["t0"] - by), 4)
    return pages
BADGES = [{"id": "b-thought", "text": "Thought experiment", "t0": 0.3, "t1": round(f.duration - 0.2, 4), "slot": "bl"}]
TITLE = {"series": "Possibility Lab", "title": "", "t0": 0.2, "t1": 2.2, "sig": round(A("vo01:", 0.0) if False else 0.2, 4)}
ORD = ["one", "two", "three", "four", "five", "six", "seven", "eight"]
END = {"title": "Full video on YouTube: *What If Earth Spun Faster…*", "follow": f"Possibility Lab · Part {N} of 8", "next": "Every number's source is in the description."}
dummy = [999.0, 1000.0]
CUE = {"fps": FPS, "float": dummy, "break": dummy, "cost": dummy, "weather": dummy, "wind": dummy, "oceans": dummy, "poles": dummy, "end": t_end, "seed": 3}
film = {"id": f"possibility-lab-earth-spin-part{N}", "theme": "../../../../theme.json", "scene": "../../scene.mjs", "fps": FPS, "bpm": BPM, "dur": f.duration,
        "poster": round(min(f.duration - 6, BEATS[len(BEATS) // 2]["t0"]), 4),
        "shots": SHOTS, "beats": BEATS, "world": {"cycleS": 16.0, "keys": KEYS, "dry": DRY, "tOrbH": T_ORB / 3600, "t0H": 23.934, "rEq": R_EQ / 1000, "gm": 3.986004418e14, "eNow": E_NOW, "eOrb": E_ORB, "weightWins": WW},
        "cue": CUE, "badges": BADGES, "title": TITLE, "endCard": t_end, "end": END, "endAnswer": "", "spineHide": [], "spine": [], "spineOut": 0, "labels": [], "counters": [], "work": None, "cam": {},
        "captions": [p for p in lead(f.captions(max_chars=26, balance=True)) if p["t0"] < t_end - 0.3],
        "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines]}
ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS if b["id"] != "tease"]
ev.append({"t": t_end, "kind": "signature", "tag": "end"})
sheet = {"duration": f.duration, "fps": FPS, "preset": "envelope-working", "tail_s": 0.05, "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: e["t"]), "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}
(D / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False))
(D / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
sub = json.loads(json.dumps(sheet))
for v in sub["voice"]:
    it = next(i for i in items if i["vo"] == v["id"])
    if it.get("sub_file"): v["file"] = it["sub_file"]
(D / "sheet-sub.json").write_text(json.dumps(sub, indent=1, ensure_ascii=False))     # the YouTube audio: the same timeline with the "subscribe" line
cta = next(l for l in f.lines if LINE[l["id"]]["kind"] == "cta")
vg = [round(b["t"] - a["t"] - a["dur"], 2) for a, b in zip(f.lines, f.lines[1:])]
print(f"part {N}: {f.duration:.1f} s ({int(f.duration // 60)}:{f.duration % 60:04.1f}), end card {t_end:.1f} s, gap {GAP:.2f}, max voiceless {max(vg)} s, CTA at {cta['t'] / f.duration:.0%}, speech {speech:.1f} s")
print("  keys:", [(round(a, 1), round(b, 2)) for a, b in KEYS])
