"""Compile Reality Rulebook Season 2 · Episode 6, "The slow raindrop" (folder ep12; the season finale): script + voice timings + this direction -> film.json, sheet.json.

  python3 -I films/channels/physics/ep12/compile.py

The model (scene.mjs reproduces it): a round drop of radius r falling in air, m dv/dt = m g - (1/2) C rho_air A v^2 with C = 0.5, rho_air = 1.21 kg/m^3
(OpenStax University Physics Vol. 1, 6.4, and Loftus and Wordsworth, arXiv 2102.09570, Eq. 4). Its closed form: v = vT tanh(g t / vT), s = (vT^2 / g) ln cosh(g t / vT),
vT = sqrt(8 rho_w g r / (3 rho_air C)): r = 0.5 mm gives 4.65 m/s, 1.0 mm 6.58 m/s, 2.0 mm 9.30 m/s (a real 4 mm drop falls near 9 m/s). Real drops flatten and C changes with speed, so real speeds differ:
the film badges it as a model. The fall is drawn slowed down 4x (a badge) over a stage that stands for 24 m of height. The breakup of the big drop is an illustration.
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
DUR = f.duration
EC = f.end_card
HALF = 0.5 / FPS


def cut(beat):
    return round([b for b in BEATS if b["id"] == beat][0]["t0"] - HALF, 6)


CUTS = {b["id"]: (0.0 if b["id"] == "hook" else cut(b["id"])) for b in BEATS}
G, RHO_W, RHO_A, CD = 9.81, 1000.0, 1.21, 0.5
SLOWF = 4.0          # film seconds per real second
HSTAGE = 24.0        # metres the stage stands for
RADII = {"small": 0.5e-3, "medium": 1.0e-3, "big": 2.0e-3}
PAUSE = 0.9          # seconds a landed drop waits before the next one falls (scene.mjs)


def vT(r):
    return math.sqrt(8 * RHO_W * G * r / (3 * RHO_A * CD))


VT = {k: vT(r) for k, r in RADII.items()}
assert abs(VT["small"] - 4.65) < 0.02 and abs(VT["medium"] - 6.58) < 0.02 and abs(VT["big"] - 9.30) < 0.02, VT
FALLT = {k: VT[k] / G * math.acosh(math.exp(G * HSTAGE / VT[k] ** 2)) * SLOWF for k in VT}   # film seconds one fall takes
_v8 = [x for x in f.lines if x["id"] == "vo08"][0]
ENDSHOW = round(max(_v8["t"] + _v8["dur"] + 0.3, DUR - 2.0), 4)
# the falls: lane, start (film time), end; each lane's drop restarts at its start and loops until the end (the scene knows the period)
# the medium drop falls twice through the normal/change/why beats; its first fall starts with the normal beat, the second ends just before the whoa beat
_M0 = round(cut("whoa") - 0.5 - 2 * FALLT["medium"] - PAUSE, 4)
FALLS = [
    {"lane": "medium", "t0": _M0, "t1": cut("whoa"), "hang": round(_M0 - 1.2, 4)},
    {"lane": "small", "t0": round(cut("whoa") + 0.6, 4), "t1": cut("measure")},
    {"lane": "medium", "t0": round(cut("whoa") + 0.6, 4), "t1": cut("measure")},
    {"lane": "big", "t0": round(cut("whoa") + 0.6, 4), "t1": cut("measure")},
    {"lane": "small", "t0": round(cut("measure") + 0.3, 4), "t1": cut("takeaway")},
    {"lane": "big", "t0": round(cut("measure") + 0.3, 4), "t1": cut("takeaway")},
    {"lane": "small", "t0": round(cut("takeaway") + 0.6, 4), "t1": cut("tease")},
    {"lane": "medium", "t0": round(cut("takeaway") + 0.6, 4), "t1": cut("tease")},
    {"lane": "big", "t0": round(cut("takeaway") + 0.6, 4), "t1": cut("tease")},
]
SPLIT_T = round(A("vo05:break") + 0.1, 4)           # the big drop breaks apart (an illustration), in the whoa beat
_F2 = round(_M0 + FALLT["medium"] + PAUSE, 4)           # when the second medium fall starts: arrows show during it
ARROWS_W = [round(_F2 + 0.3, 4), round(_F2 + FALLT["medium"] - 0.4, 4)]
FOCUS = [                                           # which drop the readout follows
    {"t0": _M0, "t1": cut("whoa"), "lane": "medium"},
    {"t0": cut("measure"), "t1": A("vo06:four-millimeter") - 0.5, "lane": "small"},
    {"t0": A("vo06:four-millimeter") - 0.5, "t1": cut("takeaway") - 0.3, "lane": "big"},
]
LABELS = [
    {"id": "no-speed", "text": "speeding up", "color": "energy", "t0": _M0 + 0.8, "t1": A("vo02:Watch") - 0.3, "at": "lane-medium", "side": 1},
    {"id": "no-steady", "text": "steady speed", "color": "motion", "t0": A("vo02:Watch") + 1.2, "t1": min(cut("change") - 0.3, _M0 + FALLT["medium"] - 0.4), "at": "lane-medium", "side": 1},
    {"id": "ch-weight", "text": "weight", "color": "force", "t0": _F2 + 1.0, "t1": cut("why") - 0.3, "at": "w-arrow", "side": -1},
    {"id": "ch-drag", "text": "air pushing back", "color": "energy", "t0": A("vo03:harder") - 0.4, "t1": cut("why") - 0.3, "at": "d-arrow", "side": 1},
    {"id": "wy-tie", "text": "a tie", "color": "ghost", "t0": A("vo04:matches"), "t1": A("vo04:weight#2") + 0.5, "at": "lane-medium", "side": 1},
    {"id": "wo-small", "text": "round", "color": "ghost", "t0": A("vo05:Small"), "t1": A("vo05:biggest") - 0.1, "at": "lane-small", "side": 1},
    {"id": "wo-big", "text": "a bun", "color": "energy", "t0": A("vo05:flatten") - 0.1, "t1": A("vo05:break") - 0.1, "at": "lane-big", "side": -1},
    {"id": "wo-split", "text": "breaks apart", "color": "force", "t0": SPLIT_T + 0.1, "t1": cut("measure") - 0.3, "at": "split", "side": -1},
]
for _lb in LABELS:
    _lb["t0"] = round((math.floor(_lb["t0"] * FPS) + 0.5) / FPS, 6)
    assert _lb["t1"] > _lb["t0"] + 0.8, ("label never shows", _lb["id"], _lb["t0"], _lb["t1"])
BADGES = [
    {"id": "slow", "kind": "tag", "text": "Fall slowed 4×", "t0": cut("normal") + 0.3, "t1": round(cut("tease") - 0.3, 4), "slot": "tr"},
    {"id": "mod", "kind": "tag", "text": "A model: round drops", "t0": round(cut("normal") + 0.3, 4), "t1": round(cut("tease") - 0.5, 4), "slot": "tr"},
    {"id": "bun", "kind": "tag", "text": "Flattening: illustration", "t0": round(A("vo05:flatten") - 0.2, 4), "t1": round(cut("measure") - 0.3, 4), "slot": "tr"},
    {"id": "ill", "kind": "tag", "text": "Illustration", "t0": cut("tease"), "t1": round(ENDSHOW - 0.3, 4), "slot": "tr"},
]
SPINE = [{"t0": _M0, "t1": round(cut("whoa") - 0.3, 4), "label": "speed of the drop", "unit": "m/s", "dp": 1},
         {"t0": cut("measure"), "t1": round(cut("takeaway") - 0.3, 4), "label": "speed of the drop", "unit": "m/s", "dp": 1}]
SPINE_AT = [[-1e9, [0.5, 0.262]]]


def view(look, dist, pitch_=0.0, yaw=0.0, fov=32.0):
    return {"look": [round(v, 3) for v in look], "dist": round(dist, 2), "yaw": yaw, "pitch": pitch_, "fov": fov}


def key(t, v, ease="p2"):
    return {"t": round(t, 4), **v, "ease": ease}


V0 = view([0.0, 4.1, 0.0], 59.0, 4.0)
CAM = {b["id"]: [key(CUTS[b["id"]], {**V0, "yaw": (-4.0 if i % 2 else 4.0)}), key(round(b["t1"] - 0.02, 4), {**V0, "yaw": (4.0 if i % 2 else -4.0)}, "sine")] for i, b in enumerate(BEATS)}
SHOTS = [{"at": CUTS[b["id"]], "name": b["id"]} for b in BEATS]
TITLE = {"series": "Reality Rulebook · Season 2 · Episode 6", "title": "The slow *raindrop*", "t1": round(cut("normal") - 0.45, 4), "y": 0.183, "sig": -0.7}
film = {
    "id": "reality-rulebook-s2e06", "fps": FPS, "bpm": BPM, "dur": DUR, "poster": 0.0,
    "_doc": "Compiled by compile.py from script.md, vo/ and the direction in compile.py. Do not edit by hand.",
    "shots": SHOTS, "beats": BEATS, "cue": {"cuts": CUTS, "arrows": ARROWS_W}, "spine": SPINE, "spineAt": SPINE_AT,
    "model": {"g": G, "rhoW": RHO_W, "rhoA": RHO_A, "C": CD, "slow": SLOWF, "hstage": HSTAGE, "radii": RADII, "vT": VT}, "falls": FALLS, "pause": PAUSE, "split": SPLIT_T, "focus": FOCUS, "bun": [round(A("vo05:flatten") - 0.1, 4), cut("measure")], "ghostT": [round(A("vo02:Watch") - 0.2, 4), cut("tease")], "tagT": [round(A("vo06:tops"), 4), round(A("vo06:four-millimeter") + 0.3, 4), round(cut("takeaway") - 0.2, 4)],
    "labels": LABELS, "badges": BADGES, "cam": CAM, "captionY": 0.655, "title": TITLE,
    "captions": [pg for pg in phrase_captions(f, max_chars=24, fix=[], until=ENDSHOW - 0.3) if pg["t0"] < ENDSHOW - 0.35], "endShow": ENDSHOW, "endCard": EC,
    "end": {"title": "That's season *two*", "follow": "Follow Reality Rulebook", "foot": "Loftus and Wordsworth, arXiv 2102.09570 (2021)."},
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}
ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS]
ev.append({"t": round(A("vo02:Watch"), 4), "kind": "reveal", "tag": "ghosts"})
ev.append({"t": round(A("vo04:matches"), 4), "kind": "swell", "tag": "tie"})
ev.append({"t": SPLIT_T, "kind": "contact", "tag": "split"})
for lb in LABELS:
    ev.append({"t": lb["t0"], "kind": "label", "tag": lb["id"]})
for bd in BADGES:
    ev.append({"t": round(bd["t0"], 4), "kind": "badge", "tag": bd["id"], "text": bd.get("text", "")})
ev.append({"t": SPINE[0]["t0"], "kind": "counter.show", "tag": "spine"})
ev.append({"t": SPINE[1]["t0"], "kind": "counter.show", "tag": "spine2"})
ev.append({"t": 0.0, "kind": "signature", "tag": "title", "gain": -4.0})
ev.append({"t": ENDSHOW, "kind": "signature", "tag": "end"})
sheet = {"duration": DUR, "fps": FPS, "preset": "restframe-bench", "duck_db": -9.0,
         "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: (e["t"], e["kind"])),
         "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}
(HERE / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False, allow_nan=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
print(f"film.json: {len(SHOTS)} shots, {len(LABELS)} labels, {len(film['captions'])} caption pages, end card {EC} s, {DUR} s; vT {VT['small']:.2f} / {VT['medium']:.2f} / {VT['big']:.2f} m/s")
for b in BEATS:
    print(f"  {b['id']:<9} {b['t0']:6.2f}–{b['t1']:6.2f}")
