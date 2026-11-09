"""Compile One More Orbit, Season 2 · Episode 5 (folder ep11), "Saturn floats": script + voice timings + this direction → film.json and sheet.json.
Every moment hangs on a beat or a spoken word; every number on screen comes from claims.json. A thought experiment, badged as one.

  python3 -I films/channels/space/ep11/compile.py

One 3-D world (not to scale where badged): a water tank wider than Saturn; Saturn (pale lemon, a thin ring) beside it, then next to Earth at true
scale (c2) and cut away to a cloud of hydrogen and helium (c3); a balance with a small dense ball and a big spread-out one (c4, c21); Saturn
lowered onto the water, floating (c22), then breaking up into gas mixing with the water ("not real"); a ring from the Sun to Saturn for the
80 minutes (c5). The last frame is frame 0's pose (a replay loops).
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[3] / "kits/cinema/script"))
from timeline import Film   # noqa: E402
sys.path.insert(0, str(HERE.parent / "set"))
from capglue import glue, hold, keep_units    # noqa: E402

FPS, BPM = 30, 56.25
ID = "one-more-orbit-s2e05"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}
t_n, t_c, t_why, t_w, t_tk, t_rd = (B[k]["t0"] for k in ("normal", "change", "why", "whoa", "takeaway", "readout"))
t_end = A("vo08:Next", -0.25)
CUE = {
    "n": t_n, "c": t_c, "why": t_why, "w": t_w, "tk": t_tk, "rd": t_rd, "end": t_end,
    "paper": A("vo01:average"), "weighs": A("vo02:weighs"), "water": A("vo02:water"), "tank": A("vo02:tank"), "wider": A("vo02:wider"),
    "nine": A("vo03:nine"), "hydrogen": A("vo03:hydrogen"), "cloud": A("vo03:cloud"),
    "density": A("vo04:Density"), "earth": A("vo04:Earth"), "tight": A("vo04:tight"), "gas": A("vo04:gas"), "thin": A("vo04:thin"),
    "floats": A("vo05:floats"), "mix": A("vo05:mix"), "piece": A("vo05:piece"),
    "size": A("vo06:Size"), "who": A("vo06:who"),
    "light": A("vo07:Light"), "eighty": A("vo07:eighty"), "reach": A("vo07:reach"),
}
assert CUE["weighs"] < CUE["tank"] < t_c < CUE["nine"] < CUE["hydrogen"] < t_why < CUE["density"] < t_w < CUE["floats"] < CUE["mix"] < t_tk, CUE
CUE["dip"] = [round(t_n - 0.15, 4), round(t_why - 0.3, 4), round(t_w - 0.25, 4), round(f.duration - 0.65, 4)]    # dips: into the tank scene, into the balance, out of it, and the loop back
BAL = [0, -60, 0]                                                                 # the balance sits far below the tank
SAT_IN, SAT_OUT = [6, 0.7, 0], [-15, 2.0, 0]
CAMK = [
    (0.0, [14, 4, 20], [6, 0.2, 0], 38),
    (t_n - 0.2, [10, 3, 22], [6, 0.2, 0], 38),
    (t_n + 0.35, [-3, 4, 24], [-4, 1, 0], 44),                                    # Saturn beside the tank
    (CUE["water"], [-1, 4, 25], [-3, 1, 0], 44),
    (CUE["tank"], [2, 6, 29], [0, 0.5, 0], 50),                                   # wider than Saturn: the tank and the planet
    (CUE["wider"] + 1.0, [1, 5, 27], [0, 0.5, 0], 50),
    (t_c - 0.2, [1, 5, 27], [0, 0.5, 0], 50),
    (t_c + 0.35, [-13, 6, 16], [-14, 2, 0], 34),                                  # Saturn and Earth
    (CUE["nine"], [-11, 4, 14], [-13, 1.2, 1], 34),
    (CUE["hydrogen"], [-17, 3, 13], [-15, 2, 0], 30),                             # in on the cutaway
    (CUE["cloud"], [-24, 7, 17], [-15, 2, 0], 34),
    (t_why - 0.3, [-24, 7, 17], [-15, 2, 0], 34),
    (t_why + 0.0, [0, 4, -34], BAL, 36),                                          # the balance (cut under a dip)
    (CUE["earth"], [-4, 2.5, -34], [0, -58.5, 0], 36),
    (CUE["tight"], [-2, 2.0, -36], [0, -58.5, 0], 34),
    (CUE["gas"], [4, 4, -34], [0, -58.5, 0], 38),
    (t_w - 0.25, [4, 4, -34], [0, -58.5, 0], 38),
    (t_w + 0.15, [14, 5, 21], [6, 1, 0], 38),                                     # back at the tank
    (CUE["floats"], [8, 3, 19], [6, 0.5, 0], 34),
    (CUE["mix"], [3, 5, 17], [6, 0, 0], 36),
    (CUE["piece"] + 0.6, [10, 6, 15], [6, 0, 0], 40),
    (t_tk, [8, 2.5, 22], [6, 0.3, 0], 38),                                        # Saturn in the tank, rings level
    (CUE["who"], [3, 1.5, 21], [6, 0.3, 0], 38),
    (t_rd + 0.5, [-70, 170, 400], [-70, 0, 0], 44),                               # out: the Sun and Saturn
    (t_end - 0.15, [-70, 176, 408], [-70, 0, 0], 44),
    (f.duration - 0.7, [-70, 176, 408], [-70, 0, 0], 44),                        # hold the read-out view behind the end card until the loop
    (f.duration, [14, 4, 20], [6, 0.2, 0], 38),
]
def far(t, p, l):                                      # Saturn and its ring are wide: stand back from the tank and Saturn shots (not the balance, not the readout)
    if t < t_rd and l[1] > -30:
        fct = 3.8 if t < t_n + 0.2 else (4.8 if t_c - 0.3 <= t < t_why else 4.2)
        return [round(l[i] + (p[i] - l[i]) * fct, 3) for i in range(3)]
    return p
CAMK = [{"t": round(t, 4), "p": far(t, p, l), "l": l, "fov": fv} for t, p, l, fv in CAMK]
assert all(b["t"] >= a["t"] for a, b in zip(CAMK, CAMK[1:])), [(k["t"]) for k in CAMK]
CAM = {"space": [{"t": 0, "target": [0, 0, 0], "dist": 10}], "end": [{"t": 0, "target": [0, 0, 0], "dist": 10}]}    # unused by the scene (own camera)
SHOTS = [{"at": 0.0, "name": "space"}, {"at": t_end, "name": "end"}]

SPINE = [0.5, 0.555]
LABELS = [
    {"id": "l-sat", "text": "Saturn", "kind": "star", "anchor": "sat", "t0": round(CUE["weighs"] - 0.2, 4), "t1": round(CUE["tank"], 4), "side": -1, "v": "above", "fixed": True},
    {"id": "l-tank", "text": "tank of water", "kind": "light", "anchor": "tank", "t0": round(CUE["tank"], 4), "t1": round(t_c - 0.1, 4), "side": 1, "v": "above", "fixed": True},
    {"id": "l-earth", "text": "Earth, same scale", "kind": "body", "anchor": "earthP", "t0": round(t_c + 0.6, 4), "t1": round(CUE["hydrogen"] - 0.2, 4), "side": 1, "v": "below", "fixed": True},
    {"id": "l-gas", "text": "hydrogen + helium", "kind": "light", "anchor": "sat", "t0": round(CUE["hydrogen"], 4), "t1": round(t_why - 0.4, 4), "side": -1, "v": "above", "fixed": True},
    {"id": "l-rock", "text": "rock and metal: tight", "kind": "body", "anchor": "rock", "t0": round(CUE["earth"], 4), "t1": round(CUE["gas"] - 0.1, 4), "side": -1, "v": "above", "fixed": True},
    {"id": "l-gasb", "text": "gas: spread thin", "kind": "star", "anchor": "gasb", "t0": round(CUE["gas"], 4), "t1": round(t_w - 0.4, 4), "side": 1, "v": "above", "fixed": True},
    {"id": "l-float", "text": "floats: thought experiment", "kind": "star", "anchor": "sat", "t0": round(CUE["floats"], 4), "t1": round(CUE["mix"] - 0.2, 4), "side": 1, "v": "above", "fixed": True},
]
PILLS = [
    {"id": "p-dens", "text": "density = weight ÷ space", "t0": round(CUE["density"], 4), "t1": round(t_w - 0.4, 4), "at": [90 / 1080, 0.175]},
    {"id": "p-real", "text": "real Saturn would not float", "t0": round(CUE["mix"] - 0.1, 4), "t1": round(t_tk - 0.2, 4), "at": [90 / 1080, 0.175]},
]
BADGES = [
    {"id": "b-thought", "text": "thought experiment", "t0": 3.0, "t1": round(t_rd - 0.2, 4), "slot": "tr"},
    {"id": "b-nts", "text": "not to scale", "t0": round(t_rd, 4), "t1": round(t_end - 0.45, 4), "slot": "tr"},
]
COUNTERS = [
    {"id": "c-hook", "label": "Saturn vs water", "text": "lighter?", "t0": 0.0, "t1": t_n},
    {"id": "c-dens", "label": "density: Saturn · water", "text": "0.69 · 1.0", "t0": CUE["weighs"], "t1": CUE["tank"] - 0.3},
    {"id": "c-wide", "label": "Saturn is about", "text": "9 Earths wide", "t0": CUE["nine"] - 0.2, "t1": CUE["hydrogen"] - 0.3},
    {"id": "c-mostly", "label": "mostly", "text": "hydrogen and helium", "t0": CUE["hydrogen"] - 0.1, "t1": t_why - 0.4},
    {"id": "c-weight", "label": "weight ÷ space", "text": "rock tight · gas thin", "t0": CUE["tight"] - 0.2, "t1": t_w - 0.4},
    {"id": "c-float", "label": "in the thought experiment", "text": "Saturn floats", "t0": CUE["floats"] - 0.1, "t1": CUE["mix"] - 0.2},
    {"id": "c-piece", "label": "real Saturn", "text": "wouldn't stay in one piece", "t0": CUE["mix"] - 0.1, "t1": t_tk - 0.2},
    {"id": "c-density", "label": "density tells you", "text": "who floats, who sinks", "t0": CUE["who"] - 0.8, "t1": t_rd},
    {"id": "c-read", "label": "light time · Sun to Saturn", "text": "about 80 minutes", "read": True, "t0": CUE["eighty"] - 0.3, "t1": round(t_end - 0.45, 4)},
]
for c in COUNTERS:
    c.setdefault("at", SPINE)
spine = [c for c in COUNTERS if c["at"] == SPINE]
for a, b in zip(spine, spine[1:]):
    if b["t0"] - a["t1"] < 0.4:
        a["t1"] = round(b["t0"] - 0.4, 4)

TITLE = {"series": "One More Orbit · Season 2 · Episode 5", "title": "Lighter than *water*", "t1": t_n - 0.5, "sig": A("line:vo01:end", 0.05)}
END = {"title": "Next orbit: the *footprints*", "follow": "One More Orbit · S2 · Episode 6",
       "next": "NASA: Saturn, 687 kg/m3."}
POSTER = A("vo05:floats", 0.4)
glue(f, {"vo02": ["a tank of water", "wider than Saturn."], "vo03": ["nine Earths wide.", "hydrogen and helium,"], "vo05": ["in one piece."], "vo06": ["who floats and who sinks."], "vo07": ["eighty minutes"]})
LOOP0 = round(f.duration - 0.6, 4)
film = {
    "loop0": LOOP0, "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": POSTER,
    "shots": SHOTS, "beats": BEATS, "cam": CAM, "camk": CAMK, "cue": CUE, "sat": [SAT_IN, SAT_OUT], "bal": BAL,
    "labels": LABELS, "badges": BADGES, "counters": COUNTERS, "pills": PILLS,
    "title": TITLE, "endCard": t_end, "end": END,
    "captions": hold(f, keep_units(f.captions(max_chars=30, written=False))),
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}
ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS]
ev.append({"t": TITLE["sig"], "kind": "signature", "tag": "title"})
ev.append({"t": t_end, "kind": "signature", "tag": "end"})
ev += [{"t": L["t0"], "kind": "label", "tag": L["id"]} for L in LABELS if L["t0"] > 0]
ev += [{"t": c["t0"], "kind": "counter.show", "tag": c["id"]} for c in COUNTERS if c["t0"] > 0]
ev += [{"t": b["t0"], "kind": "badge", "tag": b["id"]} for b in BADGES if b["t0"] > 0]
ev += [{"t": CUE["eighty"] - 0.3, "kind": "light.front", "tag": "sun-saturn"}]
sheet = {"duration": f.duration, "fps": FPS, "preset": "lightminute-vacuum",
         "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: e["t"]), "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}
(HERE / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
print(f"film.json: {f.duration:.2f} s; tank {CUE['tank']:.2f}, nine {CUE['nine']:.2f}, floats {CUE['floats']:.2f}; end card {t_end:.2f}")
print(f"sheet.json: {len(sheet['events'])} events")
