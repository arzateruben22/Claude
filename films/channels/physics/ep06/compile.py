"""Compile Rest Frame No. 006, "The ten-metre straw": script + voice timings + this direction → film.json and sheet.json,
as in episodes 1–5. Every moment hangs on a beat or a spoken word.

  python3 -I films/channels/physics/ep06/compile.py

The physics (set/straw.js): hydrostatics, h = Δp / ρg with ρ = 998.2 kg/m³ (20 °C) and g = 9.81 m/s². A sip that lifts
the drink 19.3 cm to the lips lowers the straw's air by 19 hPa; the jar is pumped to 100 hPa, below anything a mouth
can reach inside the straw, so the straw empties and no sip lifts it; a perfect pump on the tall straw leaves only
water's vapour (23.4 hPa at 20 °C), so the column stops 10.11 m above the basin and boils at the top. How fast it
climbs is an illustration (badged).
"""
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
sys.path.insert(0, str(ROOT / "kits/cinema/script"))
sys.path.insert(0, str(HERE.parent / "set"))
from timeline import Film   # noqa: E402
from captions_py import phrase_captions   # noqa: E402

FPS, BPM = 30, 112.5
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}
DUR = f.duration
EC = f.end_card
HALF = 0.5 / FPS


def cut(beat):
    return round(B[beat]["t0"] - HALF, 6)


# ── hydrostatics (set/straw.js) ────────────────────────────────────────────────────────────────
P0, PV20, RHO, GG = 1013.25, 23.39, 998.2, 9.81


def lift_cm(dp_hpa):
    return dp_hpa * 100 / (RHO * GG) * 100


def hpa_for(h_cm):
    return RHO * GG * h_cm / 100 / 100


# ── the set, in cm (the mannequin at the origin, facing +z; the house front to its right, in front of the wall) ──
TABLE = {"x": 0.0, "z": 30.0, "w": 70.0, "d": 36.0, "h": 80.0}
GLASS = {"x": 6.0, "y": 80.0, "z": 27.0, "r": 4.0, "h": 13.0, "depth": 10.0}
BASE = 1.2
SURF = GLASS["y"] + BASE + GLASS["depth"]                # the drink's surface: 91.2
BRIM_D = GLASS["h"] - BASE - 0.05                        # filled completely: 11.75 deep
SURF_B = GLASS["y"] + BASE + BRIM_D                      # 92.95
MOUTH = [0.0, 110.5, 5.5]                                # chair.js: the mannequin's mouth (turned 0)
STRAW = {"a": [GLASS["x"], GLASS["y"] + 2.0, GLASS["z"]], "k": [GLASS["x"], 108.0, GLASS["z"]], "b": MOUTH, "r": 0.55}   # a wide (boba) straw: it reads at phone size
SIP_LIFT = MOUTH[1] - SURF                               # 19.3 cm: "twenty centimeters"
SIP_HPA = hpa_for(SIP_LIFT)                              # 18.9 hPa
HARD_HPA = 98.0                                          # the hardest sip: about 100 cm of water (c8)
LID = {"r": GLASS["r"] + 0.25, "y": GLASS["y"] + GLASS["h"], "lift": 12.0}
BARO = {"x": -88.0, "y": 0.0, "z": 16.0, "s": 1.0}
HOUSE = {"x": 60.0, "z": -30.0, "storeys": 3, "storey": 340.0, "w": 200.0, "roof": "flat"}   # behind the bench: the mannequin sits by its door
BASIN = {"r": 16.0, "h": 18.0, "depth": 14.0}
PIPE = {"x": 145.0, "z": -10.0, "r": 3.2, "y0": 3.0, "top": 1072.0, "basin": BASIN}   # up the front to the pump on the flat roof (1020)   # between the right windows and the corner
PIPE["surf"] = BASE + BASIN["depth"]                     # 15.2: heights on the house's scale count from here
HOUSE["scaleX"] = PIPE["x"] - 9.0 - HOUSE["x"]           # the scale beside the straw (house-local x)
HOUSE["scaleY0"] = PIPE["surf"]
H_STOP = lift_cm(P0 - PV20)                              # 1010.8 cm: a perfect pump leaves only the vapor (c6, c7)
H_103 = lift_cm(P0)                                      # 1035.0 cm (ρ at 20 °C): the column as heavy as the air above (c9)
PIPE["stop"] = round(PIPE["surf"] + H_STOP, 3)
PIPE["line103"] = round(PIPE["surf"] + H_103, 3)
LUNGS = 100.0                                            # about one meter (c8)
PIPE["lungs"] = LUNGS
assert PIPE["line103"] < PIPE["top"] - 8, PIPE
HANDS = [[-16.0, 84.0, 24.0], [13.5, 87.0, GLASS["z"]]]  # the left hand on the table, the right one holding the glass
PRESS = [[GLASS["x"] - 2.2, SURF, GLASS["z"] + 1.0], [GLASS["x"] + 2.4, SURF, GLASS["z"] - 0.5]]

# ── the bench: the drink's depth, the lid, the straw's column (world y), each keyed on its words ──
SIP0, SIP1 = A("vo02:sip."), A("vo02:lips.")
FILL = (A("vo03:fill"), A("vo03:completely."))
LID_ON = (A("vo03:Seal"), A("vo03:lid."))
HARD = (A("vo03:sip,"), A("vo03:possible."))
LID_OFF = (cut("why") + 0.15, cut("why") + 1.1)
WHY_SIP = (A("vo04:sip"), A("vo04:up."))
TAKE_SIP = (cut("takeaway") + 0.2, cut("takeaway") + 1.2)
DEPTH = [[0.0, GLASS["depth"]], [FILL[0], GLASS["depth"]], [FILL[1], BRIM_D], [DUR, BRIM_D]]
surf_at = lambda t: SURF if t < FILL[0] else SURF_B
LEVEL = [[0.0, MOUTH[1]], [cut("normal") - 0.2, MOUTH[1]], [cut("normal") + 0.4, SURF],      # the hook's straw is in use; reset
         [SIP0, SURF], [SIP1, MOUTH[1]],
         [FILL[0], MOUTH[1]], [FILL[0] + 0.6, SURF], [FILL[1], SURF_B],                    # the sip ends; the glass fills to the brim
         [cut("why"), SURF_B], [WHY_SIP[0], SURF_B], [WHY_SIP[1], MOUTH[1]],               # lid off, then the sip works
         [cut("whoa"), MOUTH[1]], [DUR, MOUTH[1]]]
LID_K = [[0.0, 0.0], [LID_ON[0], 0.0], [LID_ON[1], 1.0], [LID_OFF[0], 1.0], [LID_OFF[1], 0.0], [DUR, 0.0]]

# ── the tall straw: the lungs' meter, then the perfect pump's climb (its pace an illustration), the stop, the boil ──
LUNG = (A("vo05:About"), A("vo05:meter."))
CLIMB = {"t0": A("vo05:With"), "T": A("vo05:meters.") - A("vo05:With"), "p": 2.6}     # it reaches the stop on "meters."
TALL = [[0.0, PIPE["stop"]], [cut("normal") - 0.01, PIPE["stop"]], [cut("normal"), PIPE["surf"]],
        [LUNG[0], PIPE["surf"]], [LUNG[1], PIPE["surf"] + LUNGS], [CLIMB["t0"], PIPE["surf"] + LUNGS]]
BOIL_T = A("vo05:boils.")
BOIL = [[0.0, 1.0], [cut("normal") - 0.01, 1.0], [cut("normal"), 0.0], [BOIL_T - 0.6, 0.0], [BOIL_T, 1.0],
        [cut("measure"), 1.0], [cut("measure") + 0.5, 0.33], [cut("takeaway"), 0.33], [cut("takeaway") + 0.01, 0.0],
        [cut("tease"), 0.0], [EC, 1.0], [DUR, 1.0]]
LOOP_T = cut("tease")
DTG = 0.2
LADDER = {"tau0": 0.0, "dt": DTG, "n": int(CLIMB["T"] / DTG), "t0": CLIMB["t0"], "t1": cut("takeaway")}
LUNGS_W = [LUNG[0], cut("measure")]
BARO_W = [A("vo04:Torricelli"), cut("whoa")]
PRESS_W = [A("vo04:presses"), cut("whoa") - 0.3]
UP_W = [A("vo04:pushes"), cut("whoa") - 0.3]
AIR_W = [A("vo06:air"), cut("takeaway")]                 # the measure: the dashed column of air above 1 cm², then the 10.3 m line
LINE_W = [A("vo06:So"), cut("takeaway")]

# rule 8: whatever delivered the previous beat drops to about a third as the new beat begins (k = strength)
THIRD = 0.33
DIM = {
    "baro": [[0.0, 1.0], [A("vo04:presses"), 1.0], [A("vo04:presses") + 0.5, THIRD], [DUR, THIRD]],     # Torricelli's tube, once the air takes over
    "press": [[0.0, 1.0], [A("vo04:sip"), 1.0], [A("vo04:sip") + 0.5, THIRD], [DUR, THIRD]],            # the air's push, once the sip is named
    "lungs": [[0.0, 1.0], [CLIMB["t0"], 1.0], [CLIMB["t0"] + 0.5, THIRD], [DUR, THIRD]],                # the lungs' meter, once the pump takes over
    "ghosts": [[0.0, 1.0], [BOIL_T - 0.6, 1.0], [BOIL_T, THIRD], [cut("measure"), THIRD], [cut("measure") + 0.5, 1.0], [AIR_W[0], 1.0], [AIR_W[0] + 0.5, THIRD], [DUR, THIRD]],
    "air": [[0.0, 1.0], [LINE_W[0], 1.0], [LINE_W[0] + 0.5, THIRD], [DUR, THIRD]],                      # the air column, once the water line is named
}

# ── the spine: the air in the straw (hPa), then the tall column (m), held lit at 10.1 through the takeaway ──
SPINE = [
    {"t0": cut("normal") + 0.3, "t1": cut("change"), "label": "air in the straw", "unit": "hPa", "dp": 0, "kind": "ramp",
     "keys": [[SIP0, P0], [SIP1, P0 - SIP_HPA]]},
    {"t0": cut("change"), "t1": cut("why"), "label": "air in the straw", "unit": "hPa", "dp": 0, "kind": "ramp",
     "keys": [[FILL[0], P0 - SIP_HPA], [FILL[0] + 0.6, P0], [HARD[0], P0], [HARD[1], P0 - HARD_HPA]], "lit": [HARD[1], cut("why")]},
    {"t0": cut("why"), "t1": cut("whoa"), "label": "air pressing on the drink", "unit": "hPa", "dp": 0, "kind": "const", "v": P0},
    {"t0": cut("whoa"), "t1": A("vo05:About"), "label": "water in the tall straw", "unit": "m", "dp": 2, "kind": "column"},
    {"t0": A("vo05:About"), "t1": CLIMB["t0"], "label": "your lungs' best", "unit": "m", "dp": 2, "kind": "column"},
    {"t0": CLIMB["t0"], "t1": cut("measure"), "label": "with a perfect pump", "unit": "m", "dp": 2, "kind": "column",
     "lit": [A("vo05:meters."), cut("measure")]},
    {"t0": cut("measure"), "t1": cut("takeaway"), "label": "as high as the air can push it", "unit": "m", "dp": 2, "kind": "const",
     "v": round(H_STOP / 100, 2), "lit": [cut("measure"), cut("takeaway")]},
    {"t0": cut("takeaway"), "t1": cut("tease") - 0.3, "label": "the air's push, at most", "unit": "m", "dp": 2, "kind": "const",
     "v": round(H_STOP / 100, 2), "lit": [cut("takeaway"), cut("tease")]},
]
SPINE_AT = [[-1e9, [0.5, 0.235]], [cut("whoa"), [0.5, 0.235]], [A("vo05:tall.") - 0.2, [0.24, 0.40]], [A("vo05:top,"), [0.26, 0.30]],
            [cut("measure"), [0.24, 0.40]], [cut("takeaway"), [0.5, 0.235]]]

CUTS = {b["id"]: (0.0 if b["id"] == "hook" else cut(b["id"])) for b in BEATS}
CUE = {"cuts": CUTS, "climb": CLIMB, "loop": LOOP_T, "lungs": LUNGS_W, "baro": BARO_W, "press": PRESS_W, "up": UP_W,
       "air": AIR_W, "line": LINE_W, "hard": list(HARD)}
LABELS = [
    {"id": "nm-20", "text": "about 20 cm up", "color": "motion", "t0": SIP1 - 0.2, "t1": cut("change") - 0.3, "anchor": {"point": [STRAW["k"][0] + 1, MOUTH[1] - 6, STRAW["k"][2]]}, "side": 1, "fixed": False},
    {"id": "ch-lid", "text": "airtight lid", "color": "ghost", "t0": LID_ON[1] - 0.2, "t1": cut("why") - 0.3, "anchor": {"point": [GLASS["x"] + LID["r"], LID["y"] + 1, GLASS["z"]]}, "side": 1, "fixed": False},
    {"id": "wy-baro", "text": "Torricelli's tube, 1644", "color": "ghost", "t0": BARO_W[0] + 0.3, "t1": A("vo04:presses"), "anchor": {"point": [BARO["x"], 104.0, BARO["z"]]}, "side": -1, "fixed": False},
    {"id": "wy-push", "text": "the air's push", "color": "pressure", "t0": PRESS_W[0] + 0.3, "t1": A("vo04:sip"), "anchor": {"point": [PRESS[0][0], SURF_B + 8, PRESS[0][2]]}, "side": -1, "fixed": False},
    {"id": "wo-lungs", "text": "your lungs: about 1 m", "color": "energy", "t0": LUNG[1] - 0.3, "t1": CLIMB["t0"] + 0.4, "anchor": {"point": [PIPE["x"] + PIPE["r"], PIPE["surf"] + LUNGS, PIPE["z"]]}, "side": 1, "fixed": False},
    {"id": "wo-stop", "text": "stops: 10.1 m", "color": "motion", "t0": A("vo05:meters."), "t1": A("vo05:top,"), "anchor": {"tall": 1}, "side": 1, "fixed": False},
    {"id": "wo-boil", "text": "boiling, at 20 °C", "color": "energy", "t0": BOIL_T, "t1": cut("measure"), "anchor": {"point": [PIPE["x"] - PIPE["r"], PIPE["stop"] - 1, PIPE["z"]]}, "side": -1, "fixed": False},
    {"id": "ms-air", "text": "the air above 1 cm²: 1.03 kg", "color": "pressure", "t0": AIR_W[0] + 0.2, "t1": LINE_W[0], "anchor": {"point": [PIPE["x"] - PIPE["r"] - 8, PIPE["surf"] + 400, PIPE["z"]]}, "side": -1, "fixed": False},
    {"id": "ms-103", "text": "10.3 m of water: 1.03 kg", "color": "motion", "t0": LINE_W[0] + 0.2, "t1": cut("takeaway") - 0.3, "anchor": {"point": [PIPE["x"] + 12, PIPE["line103"], PIPE["z"]]}, "side": 1, "fixed": False},
]
BADGES = [
    {"id": "lid", "text": "Rigid lid, no air inside", "t0": LID_ON[1], "t1": cut("why"), "slot": "tr"},
    {"id": "ink", "text": "Illustration", "t0": BARO_W[0] + 0.3, "t1": BARO_W[0] + 4.0, "slot": "tr"},
    {"id": "pace", "text": "Climb speed: illustration", "t0": CLIMB["t0"] + 0.3, "t1": CLIMB["t0"] + 4.0, "slot": "tr"},
    {"id": "vapor", "title": "Why it stops at 10.1 m", "text": "Water's own vapor fills the top.", "t0": LINE_W[0] + 0.4, "t1": cut("takeaway") - 0.3, "slot": "tr"},
]


def view(look, dist, pitch, yaw=0.0, fov=32.0):
    return {"look": [round(v, 3) for v in look], "dist": round(dist, 2), "yaw": yaw, "pitch": pitch, "fov": fov}


def key(t, v, ease="p2", **over):
    return {"t": round(t, 4), **v, **over, "ease": ease}


HOOK = view([PIPE["x"] - 26.0, 1019.0, PIPE["z"]], 430.0, 4.0, -8.0)        # the top of the tall straw: the stopped column, boiling; the pump
BENCH = view([4.0, 93.3, 15.0], 423.1, 8.0, 28.0)                          # three-quarters: the mannequin, the glass, the straw to the lips
CLOSE = view([5.0, 97.0, 18.0], 300.0, 8.0, 28.0)
WHY = view([-10.0, 54.4, 10.0], 884.9, 10.0, 18.0)                         # back: the bench and Torricelli's tube
WIDE = view([70.0, 268.0, 0.0], 4107.2, 5.0, 0.0)                          # three stories, and the bench at the foot
LOW = view([110.0, 106.8, PIPE["z"]], 1606.4, 4.0, -6.0)                   # the ground floor: the lungs' meter, the mannequin
TOP = view([PIPE["x"] - 8.0, 941.2, PIPE["z"]], 1016.5, 3.0, -6.0)          # the top storey: the stop, the 10.3 m line
BOIL_V = view([PIPE["x"] - 3.0, 1018.2, PIPE["z"]], 365.4, 4.0, -8.0)        # up close: the boiling top
CAM = {
    "hook": [key(0.0, HOOK), key(cut("normal"), {**HOOK, "dist": 445.0}, "sine")],
    "normal": [key(cut("normal"), {**HOOK, "dist": 445.0}), key(A("vo02:glass"), BENCH, "p3"), key(SIP1, CLOSE, "p3"), key(cut("change"), {**CLOSE, "dist": 310.0}, "sine")],
    "change": [key(cut("change"), {**CLOSE, "dist": 310.0}), key(LID_ON[1], {**CLOSE, "dist": 290.0}, "sine"), key(cut("why"), {**CLOSE, "dist": 280.0}, "sine")],
    "why": [key(cut("why"), {**CLOSE, "dist": 280.0}), key(A("vo04:Torricelli"), WHY, "p3"), key(A("vo04:sip"), BENCH, "p3"), key(cut("whoa"), {**BENCH, "dist": 450.0}, "sine")],
    "whoa": [key(cut("whoa"), {**BENCH, "dist": 450.0}), key(A("vo05:tall."), WIDE, "p3"), key(LUNG[0], LOW, "p3"), key(CLIMB["t0"] + 0.3, WIDE, "p3"),
             key(A("vo05:top,"), TOP, "p3"), key(BOIL_T, BOIL_V, "p3"), key(cut("measure"), {**BOIL_V, "dist": 380.0}, "sine")],
    "measure": [key(cut("measure"), WIDE), key(LINE_W[0], WIDE, "sine"), key(LINE_W[0] + 1.2, TOP, "p3"), key(cut("takeaway"), {**TOP, "dist": 1000.0}, "sine")],
    "takeaway": [key(cut("takeaway"), BENCH), key(cut("tease"), CLOSE, "sine")],
    "tease": [key(cut("tease"), CLOSE), key(EC, HOOK, "p3"), key(DUR, HOOK, "sine")],
}
SHOTS = [{"at": CUTS[b["id"]], "name": b["id"]} for b in BEATS]

TITLE = {"series": "Rest Frame · No. 006", "title": "The ten-meter *straw*", "t1": round(cut("normal") - 0.45, 4), "y": 0.183, "sig": 0.3}
# caption pages the phrase pager can't break well on its own (set/captions_py.py: ' / ' row, ' | ' page)
CAP_FIX = []

GEO = {"table": TABLE, "glass": GLASS, "surfY": SURF, "surfB": SURF_B, "straw": STRAW, "lid": LID, "baro": BARO, "house": HOUSE,
       "pipe": PIPE, "hands": HANDS, "press": PRESS}
film = {
    "id": "rest-frame-006", "fps": FPS, "bpm": BPM, "dur": DUR, "poster": 0.0,
    "_doc": "Compiled by compile.py from script.md, vo/ and the direction in compile.py. Do not edit by hand.",
    "shots": SHOTS, "beats": BEATS, "cue": CUE, "spine": SPINE, "spineAt": SPINE_AT, "geo": GEO,
    "depth": DEPTH, "level": LEVEL, "lid": LID_K, "tall": TALL, "boil": BOIL, "ladder": LADDER, "dim": DIM,
    "labels": LABELS, "badges": BADGES, "cam": CAM,
    "captionY": 0.632, "title": TITLE,
    "captions": phrase_captions(f, max_chars=24, fix=CAP_FIX, until=EC - 0.3), "endCard": EC,
    "end": {"title": "Next drop: why ice *floats*", "follow": "Follow Rest Frame",
            "foot": "Torricelli, 1644: the same air held a column of mercury about 76 cm high."},
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}

ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS]
ev.append({"t": round(SIP1, 4), "kind": "reveal", "tag": "sip"})
ev.append({"t": round(FILL[1], 4), "kind": "swell", "tag": "fill"})
ev.append({"t": round(LID_ON[1], 4), "kind": "contact", "tag": "lid"})
ev.append({"t": round(HARD[1], 4), "kind": "energy.loss", "tag": "hard-sip"})
ev.append({"t": round(LID_OFF[0], 4), "kind": "contact", "tag": "lid-off"})
ev.append({"t": round(WHY_SIP[1], 4), "kind": "reveal", "tag": "why-sip"})
ev.append({"t": round(LUNG[1], 4), "kind": "contact", "tag": "lungs"})
ev.append({"t": round(CLIMB["t0"], 4), "kind": "swell", "tag": "climb"})
ev.append({"t": round(A("vo05:meters."), 4), "kind": "reveal", "tag": "stop"})
ev.append({"t": round(BOIL_T, 4), "kind": "spring", "tag": "boil"})
ev.append({"t": round(cut("measure"), 4), "kind": "time.slow", "tag": "measure:freeze"})
for i in range(0, LADDER["n"], 3):
    ev.append({"t": round(CLIMB["t0"] + i * DTG, 4), "kind": "strobe", "tag": f"climb:g{i}"})
for lb in LABELS:
    ev.append({"t": lb["t0"], "kind": "label", "tag": lb["id"]})
for bd in BADGES:
    ev.append({"t": round(bd["t0"], 4), "kind": "badge", "tag": bd["id"], "text": bd["text"]})
ev.append({"t": SPINE[0]["t0"], "kind": "counter.show", "tag": "spine"})
for s in SPINE[1:]:
    ev.append({"t": s["t0"], "kind": "counter.tick", "tag": f"spine:{s['label']}"})
ev.append({"t": A("vo05:meters."), "kind": "counter.end", "tag": "spine:stop"})
ev.append({"t": TITLE["sig"], "kind": "signature", "tag": "title", "gain": -4.0})
ev.append({"t": EC, "kind": "signature", "tag": "end"})

cues_file = HERE / "build" / f"cues-{film['id']}-9x16.json"
shown = {}
if cues_file.exists():
    cues = json.loads(cues_file.read_text())
    by_tag = {c.get("tag"): c for c in cues.get("events", [])}
    for e in ev:
        c = by_tag.get(e.get("tag"))
        if c and e["kind"] in ("label", "counter.show") and c.get("pos"):
            e["pos"] = c["pos"]
        if c and e["kind"] in ("label", "counter.show") and cues.get("shown", {}).get(e["tag"]) is not None:
            shown[e["tag"]] = cues["shown"][e["tag"]]
sheet = {"duration": DUR, "fps": FPS, "preset": "restframe-bench", "duck_db": -9.0,
         "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: (e["t"], e["kind"])),
         "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}
if shown:
    sheet["shown"] = shown


def finite(x):
    if isinstance(x, float) and not math.isfinite(x):
        return None
    if isinstance(x, dict):
        return {k: finite(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [finite(v) for v in x]
    return x


(HERE / "film.json").write_text(json.dumps(finite(film), indent=1, ensure_ascii=False, allow_nan=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
print(f"film.json: {len(SHOTS)} shots, {len(LABELS)} labels, {len(BADGES)} badges, {len(film['captions'])} caption pages, end card {EC} s, {DUR} s")
print(f"sheet.json: {len(sheet['events'])} events ({'with' if shown else 'without'} the page's cue measurements)")
for b in BEATS:
    print(f"  {b['id']:<9} {b['t0']:6.2f}–{b['t1']:6.2f}  cut {CUTS[b['id']]:.4f}")
print(f"  sip {SIP_LIFT:.1f} cm = {SIP_HPA:.1f} hPa; stop {H_STOP:.1f} cm above the basin (y {PIPE['stop']}); climb {CLIMB['t0']:.2f}+{CLIMB['T']:.2f} s, {LADDER['n']} ghosts")
