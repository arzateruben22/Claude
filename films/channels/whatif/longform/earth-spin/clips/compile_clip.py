"""Compile one vertical cut-down of the Earth-spin pilot (9:16) to film.json and sheet.json.

  python3 -I films/channels/whatif/longform/earth-spin/clips/compile_clip.py 3

Each clip is its own film: its voice (the long video's lines verbatim plus a new hook and outro), the pilot's scene (../scene.mjs, framed natively for
portrait), a day-length readout that falls from where the clip starts and never resets, a live weight badge, one milestone badge, the end card."""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[5] / "kits/cinema/script"))
sys.path.insert(0, str(HERE.parent))
from timeline import Film   # noqa: E402
from calc import RESULTS as R, T_ORB, R as R_EQ, E_ORB, E_NOW   # noqa: E402

N = sys.argv[1]
D = HERE / f"clip{N}"
FPS, BPM = 30, 50
f = Film(D / "script.md", D / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}
T0_H, T_ORB_H = 23.934, T_ORB / 3600
ids = [b["id"] for b in BEATS]
body = [i for i in ids if i not in ("hook", "outro", "tease")]
t_end = A(f"{B['tease']['line']}:Full", -0.2)
L = lambda k: B[k]["line"]
rows = R["rows"]
SHOT_OF = {"hook": "shoulder", "outro": "shoulder", "twelve": "eye", "wind": "eye", "oceans": "globe", "two": "eye", "float": "lift", "break": "globe", "tease": "end"}

# the day length: starts where the clip's milestone is reached from, falls to it, then creeps on; never resets
if N == "1":
    KEYS = [[0.0, T0_H], [round(A(f"{L('hook')}:twelve", 0.5), 4), 12.0], [B["twelve"]["t1"], 11.6], [round(f.duration, 4), 11.6]]
    DRY = [[0.0, 90.0], [round(f.duration, 4), 90.0]]
elif N == "2":
    KEYS = [[0.0, 12.0], [B["wind"]["t1"], 11.4], [round(f.duration, 4), 11.4]]
    DRY = [[0.0, 90.0], [round(f.duration, 4), 90.0]]
elif N == "3":
    KEYS = [[0.0, 12.0], [B["oceans"]["t1"], 11.2], [round(f.duration, 4), 11.2]]
    DRY = [[0.0, 90.0], [B["oceans"]["t0"] + 12.0, 90.0], [B["oceans"]["t1"] - 3.0, 52.0], [round(f.duration, 4), 52.0]]
elif N == "4":
    KEYS = [[0.0, 3.0], [round(A(f"{L('hook')}:two", 0.3), 4), 2.0], [B["two"]["t1"], 1.9], [round(f.duration, 4), 1.9]]
    DRY = [[0.0, 40.0], [round(f.duration, 4), 40.0]]
else:
    KEYS = [[0.0, 1.5], [round(A(f"{L('hook')}:twenty-four", 0.0), 4), round(T_ORB_H, 4)], [round(f.duration, 4), round(T_ORB_H, 4)]]
    DRY = [[0.0, 28.0], [round(f.duration, 4), 24.0]]
for (a, x), (b, y) in zip(KEYS, KEYS[1:]):
    assert b >= a - 1e-9 and y <= x + 1e-9, (a, x, b, y)

SHOTS = []
for b in BEATS:
    SHOTS.append({"at": 0.0 if b["id"] == "hook" else b["t0"], "name": SHOT_OF[b["id"]], "beat": b["id"]})
SHOTS[-1]["at"] = t_end

def lead(pages, by=0.14):
    for i, pg in enumerate(pages):
        prev = pages[i - 1]["t1"] if i else -1.0
        if pg["t0"] - prev >= by + 0.05:
            pg["t0"] = round(max(0.0, pg["t0"] - by), 4)
    return pages

BADGE = {"1": f"12 h day: the Sun crosses in 6 h", "2": f"wind through the air: ≈ {rows['h12']['wind_ms']} m/s at first", "3": f"sea at the equator: +{rows['h12']['dh_km']} km vs today · rough guess",
         "4": "2 h day: half your weight", "5": "orbital speed at the equator: 7.91 km/s"}[N]
b0 = B[body[0]]
BADGES = [{"id": "b-thought", "text": "Thought experiment", "t0": 0.3, "t1": round(f.duration - 0.2, 4), "slot": "bl"},
          {"id": "b-ms", "text": BADGE, "t0": round(b0["t0"] + 1.0, 4), "t1": round(B[body[-1]]["t1"] - 0.3, 4), "slot": "tr"}]
if N == "3":
    BADGES.append({"id": "b-shape", "text": "shape and seas drawn bigger than life", "t0": round(b0["t0"] + 1.0, 4), "t1": round(b0["t0"] + 12.0, 4), "slot": "tr"})
if N == "5":
    BADGES.append({"id": "b-hedge", "text": "where a simple sum stops", "t0": round(B["break"]["t0"] + 1.0, 4), "t1": round(B["break"]["t1"] - 0.3, 4), "slot": "tr"})
TITLE = {"series": f"Possibility Lab · Part {N} of 5", "title": "", "t0": 0.2, "t1": 2.4, "sig": round(A(f"{L('hook')}:Earth's" if N == "1" else f"{L('hook')}:The" if N == "2" else f"{L('hook')}:Speed" if N == "3" else f"{L('hook')}:A" if N == "4" else f"{L('hook')}:At", 0.0), 4)}
END = {"title": "Full video on YouTube: *What If Earth Spun Faster…*", "follow": f"Part {N} of 5 · Possibility Lab", "next": "Narration: synthetic voice (AI)."}
dummy = [999.0, 1000.0]
CUE = {"fps": FPS, "float": [B["float"]["t0"], B["float"]["t1"]] if "float" in B else dummy, "break": [B["break"]["t0"], B["break"]["t1"]] if "break" in B else dummy,
       "cost": dummy, "weather": dummy, "wind": [B["wind"]["t0"], B["wind"]["t1"]] if "wind" in B else dummy, "oceans": [B["oceans"]["t0"], B["oceans"]["t1"]] if "oceans" in B else dummy,
       "poles": dummy, "end": t_end, "seed": 3}
film = {
    "id": f"possibility-lab-earth-spin-clip{N}", "theme": "../../../../theme.json", "scene": "../../scene.mjs", "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": round(b0["t0"] + 8.0, 4),
    "shots": SHOTS, "beats": BEATS, "world": {"cycleS": 16.0, "keys": KEYS, "dry": DRY, "tOrbH": T_ORB_H, "t0H": T0_H, "rEq": R_EQ / 1000, "gm": 3.986004418e14, "eNow": E_NOW, "eOrb": E_ORB,
                                              "weightWin": [round(b0["t0"] + 1.0, 4), round(B[body[-1]]["t1"] - 0.2, 4)]},
    "cue": CUE, "badges": BADGES, "title": TITLE, "endCard": t_end, "end": END, "endAnswer": "", "spineHide": [], "spine": [], "spineOut": 0, "labels": [], "counters": [], "work": None, "cam": {},
    "captions": [p for p in lead(f.captions(max_chars=26, balance=True)) if p["t0"] < t_end - 0.3],
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}
ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS if b["id"] != "tease"]
ev.append({"t": t_end, "kind": "signature", "tag": "end"})
sheet = {"duration": f.duration, "fps": FPS, "preset": "envelope-working", "tail_s": 0.05,
         "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: e["t"]),
         "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}
(D / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False))
(D / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
vg = [round(b["t"] - a["t"] - a["dur"], 2) for a, b in zip(f.lines, f.lines[1:])]
print(f"clip{N}: {f.duration:.1f} s, end card {t_end:.1f} s, gaps max {max(vg)}", [(b['id'], round(b['t0'], 1)) for b in BEATS])
