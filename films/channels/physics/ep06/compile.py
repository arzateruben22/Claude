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


# ── the set, in cm (the mannequin at the origin, facing +z; the house on the back wall) ──────────
TABLE = {"x": 0.0, "z": 30.0, "w": 70.0, "d": 36.0, "h": 80.0}
GLASS = {"x": 6.0, "y": 80.0, "z": 27.0, "r": 4.0, "h": 13.0, "depth": 10.0}
SURF = GLASS["y"] + 1.2 + GLASS["depth"]                 # the drink's surface: 91.2
MOUTH = [0.0, 110.5, 5.5]                                # chair.js: the mannequin's mouth (seat-local = world, turned 0)
STRAW = {"a": [GLASS["x"], GLASS["y"] + 2.0, GLASS["z"]], "k": [GLASS["x"], 108.0, GLASS["z"]], "b": MOUTH, "r": 0.35}
SIP_LIFT = MOUTH[1] - SURF                               # 19.3 cm: "twenty centimeters"
SIP_HPA = hpa_for(SIP_LIFT)                              # 18.9 hPa
JAR = {"r": 9.0, "h": 25.0, "lift": 70.0}
PUMP = {"x": 27.0, "y": 80.0, "z": 34.0, "s": 0.6}
JAR_HPA = 100.0
BARO = {"x": -58.0, "y": 0.0, "z": 14.0, "s": 1.0}
HOUSE = {"x": 40.0, "z": -36.0, "storeys": 3, "storey": 340.0, "w": 200.0}
BASIN = {"r": 16.0, "h": 18.0, "depth": 14.0}
PIPE = {"x": 115.0, "z": -12.0, "r": 2.5, "y0": 3.0, "top": 1060.0, "basin": BASIN}
PIPE["surf"] = 1.2 + BASIN["depth"]                      # 15.2
H_STOP = lift_cm(P0 - PV20)                              # 1010.8 cm: a perfect pump leaves only the vapour (c6, c7)
PIPE["stop"] = round(PIPE["surf"] + H_STOP, 3)
LUNGS = 100.0                                            # about one meter (c8)
PIPE["lungs"] = LUNGS
assert PIPE["stop"] < PIPE["top"] - 20, PIPE
HANDS = [[-16.0, 84.0, 24.0], [13.5, 87.0, GLASS["z"]]]  # the left hand on the table, the right one holding the glass
PRESS = [[GLASS["x"] - 2.2, SURF, GLASS["z"] + 1.0], [GLASS["x"] + 2.4, SURF, GLASS["z"] - 0.5]]

# ── the bench straw's column (world y), keyed on words: the sip, the jar empties it, the why's sip, the takeaway's ──
SIP0, SIP1 = A("vo02:sip."), A("vo02:lips.")
JAR_DOWN = (A("vo03:seal"), A("vo03:jar,"))
PUMP_ON = (A("vo03:pump"), A("vo03:air.") + 1.2)
JAR_UP = (cut("why") + 0.2, cut("why") + 1.4)
WHY_SIP = (A("vo04:sip"), A("vo04:up."))
LEVEL = [[0.0, MOUTH[1]], [cut("normal") - 0.2, MOUTH[1]], [cut("normal") + 0.4, SURF],      # the hook's straw is in use; reset
         [SIP0, SURF], [SIP1, MOUTH[1]],
         [JAR_DOWN[0], MOUTH[1]], [JAR_DOWN[1], SURF],                                       # sealed in: the sip lets go
         [PUMP_ON[0] + 0.3, SURF], [PUMP_ON[1], STRAW["a"][1] + 0.2],                        # the jar empties: the straw's air pushes the drink out
         [JAR_UP[0], STRAW["a"][1] + 0.2], [JAR_UP[1], SURF],
         [WHY_SIP[0], SURF], [WHY_SIP[1], MOUTH[1]],
         [cut("whoa"), MOUTH[1]], [cut("takeaway"), MOUTH[1]], [DUR, MOUTH[1]]]
JAR_K = [[0.0, 0.0], [JAR_DOWN[0], 0.0], [JAR_DOWN[1], 1.0], [JAR_UP[0], 1.0], [JAR_UP[1], 0.0], [DUR, 0.0]]
PUMP_VIS = [[0.0, 0.0], [JAR_DOWN[1] - 0.01, 0.0], [JAR_DOWN[1], 1.0], [JAR_UP[0], 1.0], [JAR_UP[0] + 0.01, 0.0], [DUR, 0.0]]
OUT_BUB = [[0.0, 0.0], [PUMP_ON[0] + 0.6, 0.0], [PUMP_ON[0] + 1.2, 1.0], [PUMP_ON[1] + 0.8, 1.0], [PUMP_ON[1] + 1.6, 0.0], [DUR, 0.0]]

# ── the tall straw: the climb (an illustration of the pace), the stop, the boil ──
CLIMB = {"t0": cut("whoa") + 0.6, "T": A("vo05:meters.") - cut("whoa") - 0.6, "p": 2.4}   # it reaches the stop on "meters."
BOIL_T = A("vo05:boils.")
BOIL = [[0.0, 1.0], [cut("normal"), 1.0], [cut("normal") + 0.01, 0.0], [A("vo05:top,"), 0.0], [BOIL_T, 1.0],
        [cut("takeaway"), 1.0], [cut("takeaway") + 0.01, 0.0], [cut("tease"), 0.0], [cut("tease") + 0.5, 1.0], [DUR, 1.0]]
LOOP_T = cut("tease")
DTG = 0.2
LADDER = {"tau0": 0.0, "dt": DTG, "n": int(CLIMB["T"] / DTG) - 1, "t0": CLIMB["t0"], "t1": cut("takeaway")}
LUNGS_W = [A("vo05:lungs?"), cut("measure")]
BARO_W = [A("vo04:Torricelli"), A("vo04:sip", -0.2)]
PRESS_W = [A("vo04:presses"), cut("whoa") - 0.3]
UP_W = [A("vo04:pushes"), cut("whoa") - 0.3]

# ── the spine: the air in the straw (hPa), the jar, the drink, the column (m), the weight (kg) ──
SPINE = [
    {"t0": cut("normal") + 0.3, "t1": cut("change"), "label": "air in the straw", "unit": "hPa", "dp": 0, "kind": "ramp",
     "keys": [[SIP0, P0], [SIP1, P0 - SIP_HPA]]},
    {"t0": cut("change"), "t1": cut("why") + 1.4, "label": "air around the glass", "unit": "hPa", "dp": 0, "kind": "ramp",
     "keys": [[PUMP_ON[0], P0], [PUMP_ON[1], JAR_HPA], [JAR_UP[0], JAR_HPA], [JAR_UP[1], P0]], "lit": [PUMP_ON[1], JAR_UP[0]]},
    {"t0": cut("why") + 1.4, "t1": cut("whoa"), "label": "air on the drink", "unit": "hPa", "dp": 0, "kind": "const", "v": P0},
    {"t0": cut("whoa"), "t1": LUNGS_W[0], "label": "water column, perfect pump", "unit": "m", "dp": 2, "kind": "column",
     "lit": [A("vo05:meters."), LUNGS_W[0]]},
    {"t0": LUNGS_W[0], "t1": cut("measure"), "label": "your lungs' best", "unit": "m", "dp": 1, "kind": "const", "v": 1.0},
    {"t0": cut("measure"), "t1": cut("takeaway"), "label": "air on 1 cm² of drink", "unit": "kg", "dp": 2, "kind": "const", "v": 1.03,
     "lit": [A("vo06:So"), cut("takeaway")]},
    {"t0": cut("takeaway"), "t1": cut("tease") - 0.3, "label": "air in the straw", "unit": "hPa", "dp": 0, "kind": "const", "v": P0 - SIP_HPA},
]

CUTS = {b["id"]: (0.0 if b["id"] == "hook" else cut(b["id"])) for b in BEATS}
CUE = {"cuts": CUTS, "pump": list(PUMP_ON), "stroke": 0.9, "climb": CLIMB, "loop": LOOP_T, "lungs": LUNGS_W, "baro": BARO_W,
       "press": PRESS_W, "up": UP_W}
LABELS = [
    {"id": "nm-20", "text": "about 20 cm up", "color": "motion", "t0": SIP1 - 0.2, "t1": cut("change") - 0.3, "anchor": {"point": [STRAW["k"][0] + 1, MOUTH[1] - 6, STRAW["k"][2]]}, "side": 1, "fixed": True},
    {"id": "ch-pump", "text": "pumping the air out", "color": "pressure", "t0": PUMP_ON[0] + 0.4, "t1": cut("why") - 0.2, "anchor": {"point": [PUMP["x"], PUMP["y"] + 22, PUMP["z"]]}, "side": 1, "fixed": True},
    {"id": "wy-baro", "text": "Torricelli's tube, 1644", "color": "ghost", "t0": BARO_W[0] + 0.3, "t1": BARO_W[1], "anchor": {"point": [BARO["x"], 104.0, BARO["z"]]}, "side": -1, "fixed": True},
    {"id": "wy-76", "text": "76 cm of mercury", "color": "ghost", "t0": A("vo04:We"), "t1": BARO_W[1], "anchor": {"point": [BARO["x"] + 15, 50.0, BARO["z"]]}, "side": 1, "fixed": True},
    {"id": "wy-push", "text": "the air's push", "color": "pressure", "t0": PRESS_W[0] + 0.3, "t1": cut("whoa") - 0.3, "anchor": {"point": [PRESS[0][0], SURF + 8, PRESS[0][2]]}, "side": -1, "fixed": True},
    {"id": "wo-stop", "text": "stops: 10.1 m", "color": "motion", "t0": A("vo05:meters."), "t1": cut("measure") - 0.3, "anchor": {"tall": 1}, "side": 1, "fixed": True},
    {"id": "wo-boil", "text": "boiling", "color": "energy", "t0": BOIL_T, "t1": cut("measure") - 0.3, "anchor": {"point": [PIPE["x"] - PIPE["r"], PIPE["stop"] + 2, PIPE["z"]]}, "side": -1, "fixed": True},
    {"id": "wo-lungs", "text": "your lungs: about 1 m", "color": "energy", "t0": LUNGS_W[0], "t1": LUNGS_W[1], "anchor": {"point": [PIPE["x"] + 7, PIPE["surf"] + LUNGS, PIPE["z"]]}, "side": 1, "fixed": True},
    {"id": "ms-103", "text": "10.3 m of water: 1.03 kg", "color": "motion", "t0": A("vo06:So"), "t1": cut("takeaway"), "anchor": {"tall": 1}, "side": 1, "fixed": True},
]
BADGES = [
    {"id": "ink", "text": "Illustration", "t0": BARO_W[0] + 0.3, "t1": BARO_W[1], "slot": "tr"},
    {"id": "pace", "text": "Climb speed: illustration", "t0": CLIMB["t0"] + 0.4, "t1": cut("measure") - 0.3, "slot": "tr"},
    {"id": "temp", "text": "Water at 20 °C", "t0": BOIL_T, "t1": cut("measure") - 0.3, "slot": "tr"},
    {"id": "sea", "text": "At sea level", "t0": cut("measure") + 0.4, "t1": cut("takeaway"), "slot": "tr"},
]


def view(look, dist, pitch, yaw=0.0, fov=32.0):
    return {"look": [round(v, 3) for v in look], "dist": round(dist, 2), "yaw": yaw, "pitch": pitch, "fov": fov}


def key(t, v, ease="p2", **over):
    return {"t": round(t, 4), **v, **over, "ease": ease}


HOOK = view([110.0, 999.7, -12.0], 777.0, 4.0, -8.0)         # the top of the tall straw: the stopped column, boiling; the pump
BENCH = view([4.0, 93.3, 15.0], 423.1, 8.0, 28.0)            # three-quarters: the mannequin, the glass, the straw to the lips
CLOSE = view([5.0, 97.0, 18.0], 300.0, 8.0, 28.0)
WHY = view([-10.0, 54.4, 10.0], 884.9, 10.0, 18.0)           # back: the bench and Torricelli's tube
TOP = view([112.0, 800.8, -12.0], 1977.8, 2.0, -6.0)         # the upper storeys
WIDE = view([50.0, 291.6, -10.0], 4214.5, 6.0, 0.0)          # three storeys and the bench at the foot
CAM = {
    "hook": [key(0.0, HOOK), key(cut("normal"), {**HOOK, "dist": 760.0}, "sine")],
    "normal": [key(cut("normal"), {**HOOK, "dist": 760.0}), key(A("vo02:glass"), BENCH, "p3"), key(SIP1, CLOSE, "p3"), key(cut("change"), {**CLOSE, "dist": 310.0}, "sine")],
    "change": [key(cut("change"), {**CLOSE, "dist": 310.0}), key(JAR_DOWN[1], BENCH, "p3"), key(cut("why"), {**BENCH, "dist": 440.0}, "sine")],
    "why": [key(cut("why"), {**BENCH, "dist": 440.0}), key(A("vo04:Torricelli"), WHY, "p3"), key(A("vo04:sip"), BENCH, "p3"), key(cut("whoa"), {**BENCH, "dist": 450.0}, "sine")],
    "whoa": [key(cut("whoa"), {**BENCH, "dist": 450.0}), key(CLIMB["t0"] + 0.4, WIDE, "p3"), key(A("vo05:top,"), TOP, "p3"), key(A("vo05:lungs?"), WIDE, "p3"), key(cut("measure"), {**WIDE, "dist": 4250.0}, "sine")],
    "measure": [key(cut("measure"), TOP), key(cut("takeaway"), {**TOP, "dist": 1950.0}, "sine")],
    "takeaway": [key(cut("takeaway"), BENCH), key(cut("tease"), CLOSE, "sine")],
    "tease": [key(cut("tease"), CLOSE), key(EC, HOOK, "p3"), key(DUR, HOOK, "sine")],
}
SHOTS = [{"at": CUTS[b["id"]], "name": b["id"]} for b in BEATS]

TITLE = {"series": "Rest Frame · No. 006", "title": "The ten-metre *straw*", "t1": round(cut("normal") - 0.45, 4), "y": 0.183, "sig": 0.3}
# caption pages the phrase pager can't break well on its own (set/captions_py.py: ' / ' row, ' | ' page)
CAP_FIX = []

GEO = {"table": TABLE, "glass": GLASS, "surfY": SURF, "straw": STRAW, "jar": JAR, "pump": PUMP, "baro": BARO, "house": HOUSE,
       "pipe": PIPE, "hands": HANDS, "press": PRESS}
film = {
    "id": "rest-frame-006", "fps": FPS, "bpm": BPM, "dur": DUR, "poster": 0.0,
    "_doc": "Compiled by compile.py from script.md, vo/ and the direction in compile.py. Do not edit by hand.",
    "shots": SHOTS, "beats": BEATS, "cue": CUE, "spine": SPINE, "geo": GEO,
    "level": LEVEL, "jar": JAR_K, "pumpOn": PUMP_VIS, "outBubbles": OUT_BUB, "boil": BOIL, "ladder": LADDER,
    "labels": LABELS, "badges": BADGES, "cam": CAM,
    "captionY": 0.632, "title": TITLE,
    "captions": phrase_captions(f, max_chars=24, fix=CAP_FIX, until=EC - 0.3), "endCard": EC,
    "end": {"title": "Next drop: why ice *floats*", "follow": "Follow Rest Frame",
            "foot": "Torricelli, 1644: the same air held a column of mercury about 76 cm high."},
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}

ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS]
ev.append({"t": round(SIP1, 4), "kind": "reveal", "tag": "sip"})
ev.append({"t": round(JAR_DOWN[1], 4), "kind": "contact", "tag": "jar"})
k = 0
t = PUMP_ON[0]
while t < PUMP_ON[1] - 0.2:
    ev.append({"t": round(t, 4), "kind": "energy.loss", "tag": f"pump{k}"})                 # a soft hiss per stroke
    t += 0.9 * 2
    k += 1
ev.append({"t": round(JAR_UP[0], 4), "kind": "swell", "tag": "jar-up"})
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
ev.append({"t": A("vo06:So"), "kind": "counter.end", "tag": "spine:kg"})
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
