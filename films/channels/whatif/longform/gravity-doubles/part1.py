"""Builds part1/film.json (the PICTURE, no captions, no voice) and part1/windows.json (the per-line windows for the recording sheet) from the scratch read's line lengths.
  python3 films/channels/whatif/longform/gravity-doubles/part1.py
Each line gets its scratch-read length + SLACK (0.5 s for the owner's takes) + a visual hold where the picture needs time to play (the ball, the dial race...)."""
import json
from pathlib import Path
HERE = Path(__file__).resolve().parent
L = json.loads((HERE / "part1/vo-scratch/lines.json").read_text())["lines"]
SLACK = 0.5
LEAD = {"l01": 0.3}                       # where the line's speech starts inside its window
HOLD = {"l01": 0.0, "l02": 0.4, "l03": 2.6, "l04": 1.6, "l05": 1.5, "l06": 3.4, "l07": 1.8, "l08": 0.5, "l09": 3.9, "l10": 0.0, "l11": 1.5}
END_HOLD = 3.6
win, t = {}, 0.0
for ln in L:
    lead = LEAD.get(ln["id"], 0.2)
    w0 = t; w1 = w0 + lead + ln["dur"] + SLACK + HOLD[ln["id"]]
    win[ln["id"]] = {"id": ln["id"], "text": ln["text"], "t0": round(w0, 3), "t1": round(w1, 3), "speech_t0": round(w0 + lead, 3), "speech_dur": ln["dur"], "window": round(w1 - w0, 3), "speak_window": round(ln["dur"] + SLACK, 3)}
    t = w1
endCard = round(t, 3); dur = round(t + END_HOLD, 3)
w = {k: v["t0"] for k, v in win.items()}; S = {k: v["speech_t0"] for k, v in win.items()}
r0, r1 = w["l09"] + 0.25, w["l09"] + 3.05                    # the payoff race: hour 1 → 20 across "Hour ten ... Hour twenty: a million"
pin0, pin1 = r1, r1 + 1.25                                   # the teaser: the globe glows hotter, shrinks to a pinpoint (~1 s), snaps back to hour one
hours = [[0, 0], [w["l04"] + 0.55, 0], [w["l04"] + 1.45, 1], [r0, 1], [r1, 20, "lin"], [pin1 - 0.06, 20, "lin"], [pin1, 1, "lin"], [S["l11"] + 0.05, 1], [S["l11"] + 0.95, 2]]
robot = [{"t": 0, "pose": "toss", "expr": "happy"}, {"t": w["l02"], "pose": "stand", "expr": "happy"}, {"t": w["l03"], "pose": "toss", "expr": "happy"},
         {"t": w["l04"] + 0.5, "pose": "stand", "expr": "wide"}, {"t": w["l04"] + 1.5, "pose": "crouch", "expr": "squint"},
         {"t": w["l05"] + 0.3, "pose": "trudge", "expr": "squint"}, {"t": w["l05"] + 2.0, "pose": "stepUp", "expr": "squint"}, {"t": w["l05"] + 3.4, "pose": "trudge", "expr": "squint"},
         {"t": w["l06"] + 0.2, "pose": "crouch", "expr": "squint"}, {"t": w["l07"], "pose": "crouch", "expr": "neutral"}, {"t": w["l08"], "pose": "crouch", "expr": "worried"},
         {"t": w["l09"], "pose": "stand", "expr": "wide"}, {"t": pin1, "pose": "crouch", "expr": "squint"}, {"t": w["l10"], "pose": "crouch", "expr": "happy"},
         {"t": S["l11"] + 0.8, "pose": "crouch", "expr": "worried"}, {"t": S["l11"] + 2.4, "pose": "buckle", "expr": "wide"}]
rpos = [{"t": 0, "x": 0, "y": 0}, {"t": w["l05"] + 0.2, "x": 0, "y": 0}, {"t": w["l05"] + 2.3, "x": 0.36, "y": 0.1}, {"t": w["l05"] + 3.7, "x": 0.36, "y": 0.1}, {"t": w["l06"] + 0.1, "x": 0, "y": 0}]
cams = [{"t0": 0, "mode": "grav"}, {"t0": w["l02"] - 0.1, "mode": "wide", "dur": 1.0}, {"t0": w["l03"] - 0.1, "mode": "grav", "dur": 1.0}, {"t0": w["l04"], "mode": "grav2"},
        {"t0": w["l05"] - 0.2, "mode": "step"}, {"t0": w["l06"] - 0.2, "mode": "grav"}, {"t0": w["l07"] - 0.2, "mode": "tree"}, {"t0": w["l08"], "mode": "grav2"},
        {"t0": w["l09"] - 0.3, "mode": "wide", "dur": 0.8}, {"t0": pin1, "mode": "grav"}, {"t0": S["l11"] - 0.2, "mode": "hero", "dur": 1.4}]
grav = {"ball": {"x": 0.36, "h0": 0.5, "T0": 1.5, "r": 0.05,
                 "wins": [[0, w["l05"] - 0.1], [w["l06"] - 0.2, w["l07"] - 0.1], [pin1 + 0.1, endCard]],
                 "marks": [{"hour": 0, "t0": w["l03"] + 1.9, "t1": w["l07"] - 0.3}, {"hour": 1, "t0": w["l06"] + 1.5, "t1": w["l07"] - 0.3}]},
        "hours": hours, "race": {"t0": r0, "t1": r1}, "pin": {"t0": pin0, "t1": pin1},
        "rings": [w["l02"] + 2.3, w["l02"] + 4.4], "rpos": rpos,
        "step": {"t0": w["l05"] - 0.2, "t1": w["l06"] - 0.1, "x": 0.36}, "ghost": {"t0": w["l05"] + 0.3, "t1": w["l06"] - 0.15},
        "tree": {"t0": w["l07"] - 0.1, "t1": w["l08"] + 0.5, "x": -0.5, "sag0": w["l07"] + 1.4, "sag1": w["l07"] + 2.6, "k": 0.32},
        "buckle": {"t0": S["l11"] + 2.4, "t1": endCard - 0.2}}
film = {"id": "possibility-lab-gravity-doubles-part1-picture", "theme": "../../../theme.json", "scene": "../scene.mjs", "fps": 30, "bpm": 50, "dur": dur, "v2": True, "poster": round(w["l09"] + 3.3, 2),
        "shots": [{"at": 0.0, "name": "eye", "beat": "l01"}, {"at": endCard, "name": "end", "beat": "tease"}],
        "beats": [{"id": k, "t0": v["t0"], "t1": v["t1"], "line": k, "energy": 0.6} for k, v in win.items()],
        "world": {"cycleS": 16.0, "keys": [[0.0, 23.934], [200.0, 23.934]], "dry": [[0.0, 90.0], [200.0, 90.0]], "tOrbH": 1.408151055244956, "t0H": 23.934, "rEq": 6378.137, "gm": 398600441800000.0, "eNow": 2.1e29, "eOrb": 6.2e29},
        "disclosures": {"aiVoice": False, "realVoice": True, "aiIllustration": True},
        "cue": {"fps": 30, "float": [999.0, 1000.0], "break": [999.0, 1000.0], "cost": [999.0, 1000.0], "weather": [999.0, 1000.0], "wind": [999.0, 1000.0], "oceans": [999.0, 1000.0], "poles": [999.0, 1000.0], "end": endCard, "seed": 3},
        "badges": [{"id": "b-thought", "text": "Thought experiment", "t0": 0.3, "t1": 5.0, "slot": "br"}],
        "title": {"series": "Possibility Lab", "title": "What If Gravity Doubled Every Hour?", "t0": -20.0, "t1": -19.0, "sig": -18.0},
        "endCard": endCard, "end": {"title": "Full video on YouTube: *What If Gravity Doubled Every Hour?*", "follow": "Possibility Lab · Part 1 of 8", "next": "Every number's source is in the description."},
        "endAnswer": "", "spineHide": [], "spine": [], "spineOut": 0, "labels": [], "counters": [], "work": None, "cam": {}, "cams": cams, "fx": {}, "robot": robot,
        "hook": {"text": "Gravity doubles every hour", "t0": 0.1, "t1": 2.9}, "chips": [], "captions": [], "voice": [], "grav": grav}
(HERE / "part1/film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False))
(HERE / "part1/windows.json").write_text(json.dumps({"dur": dur, "endCard": endCard, "slack_s": SLACK, "lines": list(win.values())}, indent=1, ensure_ascii=False))
print("dur", dur, "endCard", endCard)
for v in win.values(): print(v["id"], v["t0"], v["t1"], "window", v["window"], "speak", v["speak_window"])
