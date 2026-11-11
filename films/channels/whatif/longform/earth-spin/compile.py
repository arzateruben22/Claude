"""Compile the Earth-spin pilot, "What If Earth Spun Faster and Couldn't Stop?" (16:9 long form): script + voice timings + this direction → film.json
(the scene's clock) and sheet.json (the studio's cue sheet). Every number comes from calc.py, the same module claims.json was written from.

  python3 -I films/channels/whatif/longform/earth-spin/compile.py

The world (scene.mjs): you on the equator under a sky that speeds up. ONE big live number is always on screen, the length of a day (24 h falling to 1 h 24 min,
never resetting), with your speed at the equator under it; a live weight badge; milestone badges. The sky's pace is tied to that number (one sun cycle every 16
film seconds at 24 h, 17 times faster at 1 h 24 min). Beats cut between your eye line, over your shoulder, the globe and a tower of energy.
"""
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[4] / "kits/cinema/script"))
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent.parent))
from timeline import Film   # noqa: E402
from calc import RESULTS as R, T_ORB, R as R_EQ, E_ORB, E_NOW   # noqa: E402

FPS, BPM = 30, 50
ID = "possibility-lab-earth-spin"
import os
VOICE = os.environ.get("VOICE", "ai")               # own: the owner's cloned voice (vo-own/, script.md) · owner: his real recording (vo-owner/, script-owner.md) · ai: the old stand-in (vo/)
OWNER = VOICE != "ai"
SCRIPT, VODIR = {"own": ("script.md", "vo-own"), "owner": ("script-owner.md", "vo-owner"), "ai": ("script.md", "vo")}[VOICE]
f = Film(HERE / SCRIPT, HERE / VODIR, fps=FPS, bpm=BPM, grid=0.25)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}
L = lambda k: B[k]["line"]
W = lambda k, word, dt=0.0: A(f"{L(k)}:{word}", dt)

T0_H = 23.934
T_ORB_H = T_ORB / 3600
# ── the day length, falling and never resetting: (film time, hours) keys, geometric between them ──
t_sp = round(B["spinup"]["t0"] + 0.6, 4)
KEYS = [
    [0.0, T0_H], [t_sp, T0_H],
    [W("spinup", "twenty"), 20.0], [W("spinup", "sixteen"), 16.0],
    [W("twelve", "twelve", -0.2), 12.0], [round(B["weather"]["t0"] + 1.0, 4), 12.0],            # holds at 12 h through twelve, wind, oceans
    [W("weather", "six", -0.1), 6.0], [round(B["three"]["t0"] - 0.1, 4), 6.0],                   # holds at 6 h through six, calendar, poles
    [W("three", "three", -0.3), 3.0], [round(B["two"]["t0"] - 0.05, 4), 3.0],                    # holds at 3 h through three
    [W("two", "two", -0.3), 2.0], [round(B["one-five"]["t0"] - 0.05, 4), 2.0],                   # holds at 2 h through two
    [round(B["one-five"]["t0"] + 0.8, 4), 1.5], [round(B["float"]["t0"] - 0.05, 4), 1.5],        # holds at 1 h 30 through one-five
    [W("float", "twenty-four", 0.0), round(T_ORB_H, 4)], [round(f.duration, 4), round(T_ORB_H, 4)],
]
# monotone check
for (t0, a), (t1, b) in zip(KEYS, KEYS[1:]):
    assert t1 >= t0 - 1e-9 and b <= a + 1e-9, (t0, a, t1, b)
WEIGHT_WINS = [[round(W("today", "weigh", -0.2), 4), B["today"]["t1"]], [round(W("twelve", "weigh", -0.2), 4), B["twelve"]["t1"]],
               [round(W("six", "five", -0.3), 4), B["six"]["t1"]], [round(W("three", "weigh", -0.2), 4), B["three"]["t1"]],
               [B["two"]["t0"], B["float"]["t1"]]]
# the ocean's retreat from the poles (degrees of latitude still under water), a rough picture; first-order only
DRY = [[0.0, 90.0], [B["oceans"]["t0"] + 14.0, 90.0], [B["oceans"]["t1"] - 4.0, 52.0], [B["weather"]["t1"], 50.0], [B["float"]["t1"], 24.0], [round(f.duration, 4), 24.0]]

t_end = A("vo19:Subscribe", -0.25)
t_title_out = B["premise"]["t0"] - 0.3

SHOT_OF = {"hook": "shoulder", "premise": "globe", "today": "eye", "spinup": "eye", "twelve": "shoulder", "wind": "eye", "oceans": "globe", "weather": "globe",
           "six": "eye", "calendar": "shoulder", "poles": "globe", "three": "shoulder", "two": "eye", "one-five": "shoulder", "float": "lift", "break": "globe",
           "cost": "tower", "close": "shoulder", "tease": "end"}
SHOTS = [{"at": 0.0, "name": "shoulder", "beat": "hook"}]
for b in BEATS[1:]:
    SHOTS.append({"at": b["t0"], "name": SHOT_OF[b["id"]], "beat": b["id"]})
SHOTS[-1]["at"] = t_end
SHOTS = [dict(s, name=s["name"] + f"-{i}") if False else s for i, s in enumerate(SHOTS)]

def lead(pages, by=0.14):
    for i, pg in enumerate(pages):
        prev = pages[i - 1]["t1"] if i else -1.0
        if pg["t0"] - prev >= by + 0.05:
            pg["t0"] = round(max(0.0, pg["t0"] - by), 4)
    return pages

rows = R["rows"]
BADGES = [
    {"id": "b-thought", "text": "Thought experiment", "t0": 0.3, "t1": round(f.duration - 0.2, 4), "slot": "bl"},
]
for b in BADGES:
    assert b["t1"] > b["t0"], b
TITLE = {"series": "Possibility Lab · Long form", "title": "What if Earth spun faster and *couldn't stop*?", "t0": 0.3, "t1": round(t_title_out, 4), "sig": A("line:vo01:end", 0.05)}
END = {"title": "Subscribe for the next *what-if*", "follow": "Possibility Lab · What If Earth Spun Faster and Couldn't Stop?",
       "next": ("Narration: a synthetic version of the owner's own voice (AI). Every number's source is in the description." if VOICE == "own" else "Every number's source is in the description." if OWNER else "Narration: synthetic voice (AI). Every number's source is in the description.")}

CUE = {"fps": FPS, "float": [B["float"]["t0"], B["float"]["t1"]], "break": [B["break"]["t0"], B["break"]["t1"]], "cost": [B["cost"]["t0"], B["cost"]["t1"]],
       "weather": [B["weather"]["t0"], B["weather"]["t1"]], "wind": [B["wind"]["t0"], B["wind"]["t1"]], "oceans": [B["oceans"]["t0"], B["oceans"]["t1"]],
       "poles": [B["poles"]["t0"], B["poles"]["t1"]], "end": t_end, "seed": 3}
film = {
    "id": ID, "theme": "../../theme.json", "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": round(W("float", "seven", 0.0), 4),
    "shots": SHOTS, "beats": BEATS, "world": {"weightWins": WEIGHT_WINS, "cycleS": 16.0, "keys": KEYS, "dry": DRY, "tOrbH": T_ORB_H, "t0H": T0_H, "rEq": R_EQ / 1000, "gm": 3.986004418e14,
                                              "eNow": E_NOW, "eOrb": E_ORB},
    "cue": CUE, "badges": BADGES, "title": TITLE, "endCard": t_end, "end": END, "endAnswer": "", "spineHide": [], "spine": [], "spineOut": 0, "labels": [], "counters": [],
    "work": None, "cam": {},
    "captions": lead(f.captions(max_chars=44, balance=True, keep=("twelve hour day", "six hour day", "three hour day", "an hour and twenty-four minutes", "seven point nine kilometers a second",
                                                              "sixteen hundred and seventy kilometers an hour"))),
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}
ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS if b["id"] not in ("tease",)]
ev.append({"t": TITLE["sig"], "kind": "signature", "tag": "title"})
ev.append({"t": t_end, "kind": "signature", "tag": "end"})
for k in ("twelve", "six", "three", "two", "float"):
    ev.append({"t": B[k]["t0"] + 0.3, "kind": "swell", "tag": f"ms-{k}", "t1": B[k]["t0"] + 3.3})
sheet = {"duration": f.duration, "fps": FPS, "preset": "envelope-working", "tail_s": 0.05,
         "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: e["t"]),
         "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}
(HERE / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
vg = [round(b["t"] - a["t"] - a["dur"], 2) for a, b in zip(f.lines, f.lines[1:])]
print(f"film.json: {f.duration:.1f} s ({f.duration / 60:.2f} min), {len(SHOTS)} shots, {len(BADGES)} badges, {len(film['captions'])} caption pages, end card {t_end:.1f} s; voiceless gaps max {max(vg)}")
for b in BEATS:
    print(f"  {b['id']:<9} {b['t0']:7.1f}–{b['t1']:7.1f}")
