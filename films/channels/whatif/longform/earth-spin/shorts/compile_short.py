"""Compile one vertical short of the Earth-spin pilot (Part 1 or Part 2, 9:16, 1:05 to 1:15) to film.json and sheet.json.

  python3 -I films/channels/whatif/longform/earth-spin/shorts/compile_short.py 1

Cut from the opening of the long video: its own voice lines verbatim (plus one new cliffhanger line, and a new hook for Part 2), the pilot's scene (../../scene.mjs,
framed natively for portrait), the day-length readout falling and never resetting, the live weight badge, a milestone badge, the end card."""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[5] / "kits/cinema/script"))
sys.path.insert(0, str(HERE.parent))
from timeline import Film   # noqa: E402
from calc import RESULTS as R, T_ORB, R as R_EQ, E_ORB, E_NOW   # noqa: E402

N = sys.argv[1]
D = HERE / f"part{N}"
FPS, BPM = 30, 50
f = Film(D / "script.md", D / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}
T0_H, T_ORB_H = 23.934, T_ORB / 3600
L = lambda k: B[k]["line"]
rows = R["rows"]
t_end = A(f"{B['tease']['line']}:Full", -0.2)
SHOT_OF = {"hook": "shoulder", "outro": "shoulder", "today": "eye", "spinup": "eye", "twelve": "eye", "wind": "eye", "tease": "end"}
t_sp = round(B["spinup"]["t0"] + 0.6, 4) if N == "1" else 0
if N == "1":
    KEYS = [[0.0, T0_H], [t_sp, T0_H], [round(A(f"{L('spinup')}:twenty"), 4), 20.0], [round(A(f"{L('spinup')}:sixteen"), 4), 16.0], [round(f.duration, 4), 15.0]]
    DRY = [[0.0, 90.0], [round(f.duration, 4), 90.0]]
else:
    KEYS = [[0.0, T0_H], [round(A(f"{L('hook')}:twelve", 0.5), 4), 12.0], [B["wind"]["t1"], 11.4], [round(f.duration, 4), 11.4]]
    DRY = [[0.0, 90.0], [round(f.duration, 4), 90.0]]
for (a, x), (b, y) in zip(KEYS, KEYS[1:]):
    assert b >= a - 1e-9 and y <= x + 1e-9, (a, x, b, y)
SHOTS = [{"at": 0.0 if b["id"] == "hook" else b["t0"], "name": SHOT_OF[b["id"]], "beat": b["id"]} for b in BEATS]
SHOTS[-1]["at"] = t_end

def lead(pages, by=0.14):
    for i, pg in enumerate(pages):
        prev = pages[i - 1]["t1"] if i else -1.0
        if pg["t0"] - prev >= by + 0.05:
            pg["t0"] = round(max(0.0, pg["t0"] - by), 4)
    return pages

BADGES = [{"id": "b-thought", "text": "Thought experiment", "t0": 0.3, "t1": round(f.duration - 0.2, 4), "slot": "bl"}]
if N == "1":
    BADGES += [{"id": "b-today", "text": "today: 0.35 % lighter than on a still Earth", "t0": round(B["today"]["t0"] + 14.0, 4), "t1": round(B["spinup"]["t0"] - 0.3, 4), "slot": "tr"}]
    WW = [round(B["today"]["t0"] + 14.0, 4), round(B["spinup"]["t1"] - 0.2, 4)]
else:
    BADGES += [{"id": "b-12", "text": "12 h day: the Sun crosses in 6 h", "t0": round(B["twelve"]["t0"] + 0.3, 4), "t1": round(B["wind"]["t0"] - 0.3, 4), "slot": "tr"},
               {"id": "b-wind", "text": f"wind through the air: ≈ {rows['h12']['wind_ms']} m/s at first", "t0": round(B["wind"]["t0"] + 12.0, 4), "t1": round(B["wind"]["t1"] - 0.3, 4), "slot": "tr"}]
    WW = [round(B["twelve"]["t0"] + 1.0, 4), round(B["wind"]["t1"] - 0.2, 4)]
TITLE = {"series": f"Possibility Lab · Part {N} of 2", "title": "", "t0": 0.2, "t1": 2.4, "sig": round(A(f"{L('hook')}:What" if N == "1" else f"{L('hook')}:Earth's", 0.0), 4)}
END = {"title": "Full video on YouTube: *What If Earth Spun Faster…*", "follow": f"Part {N} of 2 · Possibility Lab", "next": "Narration: synthetic voice (AI)."}
dummy = [999.0, 1000.0]
CUE = {"fps": FPS, "float": dummy, "break": dummy, "cost": dummy, "weather": dummy, "wind": [B["wind"]["t0"], B["wind"]["t1"]] if "wind" in B else dummy, "oceans": dummy, "poles": dummy, "end": t_end, "seed": 3}
film = {
    "id": f"possibility-lab-earth-spin-part{N}", "theme": "../../../../theme.json", "scene": "../../scene.mjs", "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": round(B["today" if N == "1" else "twelve"]["t0"] + 8.0, 4),
    "shots": SHOTS, "beats": BEATS, "world": {"cycleS": 16.0, "keys": KEYS, "dry": DRY, "tOrbH": T_ORB_H, "t0H": T0_H, "rEq": R_EQ / 1000, "gm": 3.986004418e14, "eNow": E_NOW, "eOrb": E_ORB, "weightWin": WW},
    "cue": CUE, "badges": BADGES, "title": TITLE, "endCard": t_end, "end": END, "endAnswer": "", "spineHide": [], "spine": [], "spineOut": 0, "labels": [], "counters": [], "work": None, "cam": {},
    "captions": [p for p in lead(f.captions(max_chars=26, balance=True)) if p["t0"] < t_end - 0.3],
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}
ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS if b["id"] != "tease"]
ev.append({"t": t_end, "kind": "signature", "tag": "end"})
sheet = {"duration": f.duration, "fps": FPS, "preset": "envelope-working", "tail_s": 0.05, "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: e["t"]), "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}
(D / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False))
(D / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
vg = [round(b["t"] - a["t"] - a["dur"], 2) for a, b in zip(f.lines, f.lines[1:])]
print(f"part{N}: {f.duration:.1f} s ({int(f.duration // 60)}:{f.duration % 60:04.1f}), end card {t_end:.1f} s, gaps max {max(vg)}", [(b['id'], round(b['t0'], 1)) for b in BEATS])
