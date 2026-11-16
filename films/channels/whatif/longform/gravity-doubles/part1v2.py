"""Part 1 v2 (visual upgrade): writes part1v2/film.json from the FROZEN windows (part1/windows.json: the owner records to these) and the v1 film.json.
Only line 11's text/length changes (windows.json l11 updated in place; its window t0/t1 stay).   python3 part1v2.py"""
import json
from pathlib import Path
HERE = Path(__file__).resolve().parent
Wn = json.loads((HERE / "part1/windows.json").read_text()); V1 = json.loads((HERE / "part1/film.json").read_text())
vs = {l["id"]: l for l in json.loads((HERE / "part1/vo-scratch/lines.json").read_text())["lines"]}
for l in Wn["lines"]:
    if l["id"] == "l11": l["text"] = vs["l11"]["text"]; l["speech_dur"] = vs["l11"]["dur"]; l["speak_window"] = round(vs["l11"]["dur"] + Wn["slack_s"], 3); assert l["speak_window"] <= l["window"]
(HERE / "part1/windows.json").write_text(json.dumps(Wn, indent=1, ensure_ascii=False))
rows = ["| # | Line | Starts at | Speak within | Window (to next line) |", "|---|---|---|---|---|"] + [f"| {i} | {l['text']} | {l['speech_t0']:.1f} s | **{l['speak_window']:.1f} s** | {l['window']:.1f} s |" for i, l in enumerate(Wn["lines"], 1)]
(HERE / "part1/windows.md").write_text(f"""# Part 1 recording windows (for the owner's recording sheet)

Picture length {Wn['dur']} s (end card from {Wn['endCard']} s). Each line starts at the time shown (the picture holds the same beats whatever the take's exact length).
**Speak within** = the scratch read's length + {Wn['slack_s']} s of slack. A take shorter than the scratch read is fine: leave a little air; the picture does not move.
v2: only line 11 changed (new ending sentence); every window is unchanged from v1.

""" + "\n".join(rows) + "\n")
w = {l["id"]: l["t0"] for l in Wn["lines"]}; S = {l["id"]: l["speech_t0"] for l in Wn["lines"]}; endCard, dur = Wn["endCard"], Wn["dur"]
hours = [[0, 0], [18.166, 0], [19.066, 1], [43.45, 1], [43.8, 2, "lin"], [44.0, 2, "lin"], [44.15, 3, "lin"], [44.75, 3, "lin"], [44.9, 4, "lin"], [45.4, 4, "lin"], [45.55, 5, "lin"], [46.1, 5, "lin"],
         [46.9, 20, "lin"], [48.09, 20, "lin"], [48.15, 1, "lin"], [S["l11"] + 0.05, 1], [S["l11"] + 0.95, 2]]
pins = [[46.9, 48.15], [57.9, 59.35]]
robot = [dict(r) for r in V1["robot"]]
for r in robot:
    if abs(r["t"] - V1["grav"]["pin"]["t1"]) < 0.01: r["t"] = pins[0][1]
robot = [r for r in robot if not (r["t"] >= w["l09"] and r["t"] < pins[0][1] and r["pose"] == "crouch")] if False else robot
glims = [{"t0": 6.4, "t1": 7.5, "kind": "skel", "load": [1, 3]}, {"t0": 7.5, "t1": 8.55, "kind": "tower", "load": [1, 3]}, {"t0": 8.55, "t1": 9.55, "kind": "ocean", "load": [1, 8]}, {"t0": 9.55, "t1": w["l03"], "kind": "mount"},
         {"t0": 41.6, "t1": w["l09"], "kind": "tower", "load": [2, 2.6]},
         {"t0": 44.0, "t1": 44.75, "kind": "tower", "load": [3, 8], "bow": [0.1, 1.0]}, {"t0": 44.75, "t1": 45.45, "kind": "ocean", "load": [8, 16]}, {"t0": 45.45, "t1": 46.1, "kind": "mount"}]
dips = sorted({g[k] for g in glims for k in ("t0", "t1")} - {w["l03"]} | {w["l03"]})
chips = [{"t0": 6.45, "t1": 7.45, "text": "Simulation ahead: your skeleton"}, {"t0": 7.55, "t1": 8.5, "text": "Simulation ahead: a skyscraper"}, {"t0": 8.6, "t1": 9.5, "text": "Simulation ahead: the deep sea"}, {"t0": 9.6, "t1": 10.4, "text": "Simulation ahead: a mountain"},
         {"t0": 44.05, "t1": 44.7, "text": "×8: the tower bows"}, {"t0": 44.8, "t1": 45.4, "text": "×16: sea dark, sky sinking"}, {"t0": 45.5, "t1": 46.05, "text": "×32: the mountain cracks"}]
cams = [{"t0": 0, "mode": "grav"}, {"t0": w["l02"] - 0.1, "mode": "wide", "dur": 1.0}, {"t0": w["l03"] - 0.1, "mode": "grav", "dur": 1.0}, {"t0": w["l04"], "mode": "grav2"}, {"t0": w["l05"] - 0.2, "mode": "step2"},
        {"t0": w["l06"] - 0.2, "mode": "grav"}, {"t0": w["l07"] - 0.2, "mode": "tree"}, {"t0": w["l08"], "mode": "city", "dur": 1.4}, {"t0": w["l09"] - 0.3, "mode": "wide", "dur": 0.8}, {"t0": pins[0][1], "mode": "grav", "dur": 0.8},
        {"t0": S["l11"] - 0.2, "mode": "hero", "dur": 1.4}, {"t0": pins[1][0] - 0.15, "mode": "wide", "dur": 0.5}]
grav = {"ball": {"x": 0.36, "h0": 0.5, "T0": 1.5, "r": 0.05, "wins": [[0, 21.321], [28.189, 34.282], [pins[0][1] + 0.1, endCard]], "marks": V1["grav"]["ball"]["marks"]},
        "hours": hours, "race": {"t0": 43.45, "t1": 46.9}, "pins": pins, "rings": [4.2, 5.3],
        "rpos": [{"t": 0, "s": 0}, {"t": w["l05"] + 0.2, "s": 0}, {"t": 22.6, "s": 1}, {"t": 23.6, "s": 2}, {"t": 24.6, "s": 3}, {"t": 26.4, "s": 3}, {"t": 27.4, "s": 0}],
        "step": {"x0": 0.12, "tread": 0.12, "rise": 0.055}, "stairVis": {"t0": w["l05"] - 0.2, "t1": w["l06"] - 0.1}, "ghost": {"t0": w["l05"] + 0.3, "t1": w["l06"] - 0.15},
        "skelB": {"t0": 21.9, "t1": 28.0, "x": -0.3, "l0": 1, "l1": 2, "tl0": 22.4, "tl1": 24.0},
        "cup": {"t0": 0.5, "t1": 1.3, "p0": 2.0, "p1": 2.8, "p2": 3.9, "p3": 4.6, "hide": w["l05"] + 0.2},
        "tree": {"t0": V1["grav"]["tree"]["t0"], "t1": 40.0, "x": -0.5, "sag0": V1["grav"]["tree"]["sag0"], "sag1": V1["grav"]["tree"]["sag1"], "k": 0.32},
        "city": {"t0": 40.5, "t1": 43.35}, "glims": glims, "dips": dips, "buckle": V1["grav"]["buckle"]}
film = dict(V1); film.update({"id": "possibility-lab-gravity-doubles-part1-v2-picture", "scene": "../scene2.mjs", "hook": {"text": "Gravity doubles / every hour", "t0": 0.1, "t1": 2.9}, "badges": [], "cams": cams, "robot": robot, "chips": chips, "grav": grav,
                               "poster": 44.5, "beats": [{"id": k, "t0": v["t0"], "t1": v["t1"], "line": k, "energy": 0.6} for k, v in {l["id"]: l for l in Wn["lines"]}.items()]})
D = HERE / "part1v2"; D.mkdir(exist_ok=True); (D / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False)); print("part1v2/film.json written; dips", len(dips))
