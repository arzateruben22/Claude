"""Compile Reality Rulebook Season 2 · Episode 3, "The nut that rises" (folder ep09): script + voice timings + this direction -> film.json, sheet.json.

  node films/channels/physics/ep09/sim.mjs        # once: the 2D shaken-jar simulation -> sim.json
  python3 -I films/channels/physics/ep09/compile.py

The whole film runs the simulation at one speed, 2x slower (sim time = film time / 2, 36 s of shaking over 72 s), so the badge
has one factor. The big disc starts on the floor and rises through the small ones. The simulation is our model (soft discs, seeded),
not a measurement: the film says so.
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
    return round({b["id"]: b["t0"] for b in BEATS}[beat] - HALF, 6) if False else round([b for b in BEATS if b["id"] == beat][0]["t0"] - HALF, 6)


CUTS = {b["id"]: (0.0 if b["id"] == "hook" else cut(b["id"])) for b in BEATS}
SIMF = json.loads((HERE / "sim.json").read_text())
PR = SIMF["params"]
SLOW = 2.0                                       # sim time = film time / 2
TMAX = SIMF["frames"][-1]["t"]
assert DUR / SLOW <= TMAX + 0.5, (DUR, TMAX)
# the frames, one decimal (discs are 2 and 7.6 cm across)
SIM = {"params": PR, "slow": SLOW, "floor": [fr["floor"] for fr in SIMF["frames"]],
       "xy": [[round(v, 1) for v in fr["xy"]] for fr in SIMF["frames"]], "dt": 1.0 / PR["fps"]}
BIG0 = SIMF["frames"][0]["xy"][1]
BIGEND = SIMF["frames"][int(min(TMAX, 0.5 * DUR) * PR["fps"])]["xy"][1]
HEIGHT_W = [A("vo06:Measure"), cut("takeaway")]
GHOSTS = {"t0": A("vo06:Measure") + 0.3, "t1": cut("takeaway") + 2.0, "every": 3.0}      # a ghost of the big ball every 3 s of sim time
REV = {"t0": round(A("vo05:And") + 0.5, 4), "t1": round(cut("measure") - 0.5, 4), "ox": 24.0, "yEnd": 6.2,
       "snap": 33 * PR["fps"]}
RP = 1.6                                         # the replay (measure beat on): the climb again from the bottom, 1.6x faster than the 2x-slower main run
ENDSHOW = round(A("vo08:Why") - 0.15, 4)           # the end card comes up as the last question is asked and holds to the end                      # the illustration: the snapshot of the bed at 33 s of simulated shaking, the lighter ball sunk by hand
LABELS = [
    {"id": "no-small", "text": "small grains", "color": "ghost", "t0": cut("normal") + 0.3, "t1": A("vo02:rise") - 0.4, "at": "small", "side": 1},
    {"id": "no-big", "text": "one big ball", "color": "force", "t0": cut("normal") + 0.2, "t1": cut("change") - 0.3, "at": "ball", "side": -1},
    {"id": "ch-ball", "text": "big ball", "color": "force", "t0": A("vo03:Yet") - 0.2, "t1": cut("why") - 0.3, "at": "ball", "side": -1},
    {"id": "wy-gap", "text": "small grains drop under it", "color": "motion", "t0": A("vo04:tumble") + 0.12, "t1": cut("whoa") - 0.5, "at": "under", "side": 1},
    {"id": "wo-up", "text": "up the walls", "color": "energy", "t0": A("vo05:up"), "t1": A("vo05:And") - 0.1, "at": "wallL", "side": 1},
    {"id": "wo-down", "text": "down the middle", "color": "force", "t0": A("vo05:down"), "t1": A("vo05:And") - 0.1, "at": "mid", "side": 1},
    {"id": "wo-light", "text": "bigger but lighter", "color": "force", "t0": A("vo05:sink") - 0.6, "t1": cut("measure") - 0.3, "at": "lball", "side": 1},
    {"id": "ms-gh", "text": "start", "color": "ghost", "t0": A("vo06:climbs"), "t1": A("vo06:takes"), "at": "ghost0", "side": 1},
]
for _lb in LABELS:                                   # first visible frame = the next frame boundary (half-frame grid, as the kit's cues expect)
    _lb["t0"] = round((math.floor(_lb["t0"] * FPS) + 0.5) / FPS, 6)
BADGES = [
    {"id": "sim", "kind": "tag", "text": "2D model, drawn in 3-D", "t0": cut("normal") + 0.3, "t1": round(A("vo05:And") - 0.3, 4), "slot": "tr"},
    {"id": "illus", "kind": "tag", "text": "Illustration, not a simulation", "t0": round(A("vo05:And") + 0.2, 4), "t1": round(cut("measure") - 0.5, 4), "slot": "tr"},
    {"id": "sim2", "kind": "tag", "text": "Replay of the model", "t0": cut("measure"), "t1": round(cut("takeaway") - 0.5, 4), "slot": "tr"},
    {"id": "sim3", "kind": "tag", "text": "Simulation, sped up", "t0": cut("takeaway"), "t1": ENDSHOW - 0.3, "slot": "tr"},
]
SPINE = [
    {"t0": cut("normal"), "t1": round(cut("why") - 0.1, 4), "label": "big ball's height", "unit": "cm", "dp": 0},
    {"t0": cut("whoa"), "t1": round(A("vo05:And") - 0.2, 4), "label": "big ball's height", "unit": "cm", "dp": 0},
    {"t0": cut("measure"), "t1": round(ENDSHOW - 0.3, 4), "label": "big ball's height", "unit": "cm", "dp": 0},
]
SPINE_AT = [[-1e9, [0.5, 0.262]]]
ARROWS_W = [A("vo05:Grains"), A("vo05:And") + 0.2]


def view(look, dist, pitch=0.0, yaw=0.0, fov=32.0):
    return {"look": [round(v, 3) for v in look], "dist": round(dist, 2), "yaw": yaw, "pitch": pitch, "fov": fov}


def key(t, v, ease="p2"):
    return {"t": round(t, 4), **v, "ease": ease}


WC = PR["Wc"]
CX = WC / 2
YC = 19.0
D = 70.0
WIDE = view([CX, YC, 0.0], D)
PANX = REV["ox"] + CX
CAM = {
    "hook": [key(0.0, view([CX, 9.0, 0.0], 50.0, 0.0, -7.0)), key(cut("normal"), view([CX, 12.0, 0.0], 56.0, 0.0, 0.0), "sine")],
    "normal": [key(cut("normal"), {**WIDE, "yaw": -5.0}), key(cut("change"), {**WIDE, "yaw": 6.0}, "sine")],
    "change": [key(cut("change"), {**WIDE, "yaw": 6.0}), key(cut("why"), {**WIDE, "yaw": -4.0}, "sine")],
    "why": [key(cut("why"), {**WIDE, "yaw": -4.0}), key(A("vo04:Each"), view([CX, YC, 0.0], D, 0.0, 6.0), "p3"), key(cut("whoa"), view([CX, YC, 0.0], D, 0.0, -6.0), "sine")],
    "whoa": [key(cut("whoa"), {**WIDE, "yaw": 0.0}), key(A("vo05:And") - 0.2, {**WIDE, "yaw": 5.0}, "sine"), key(A("vo05:And") + 0.8, view([PANX, YC, 0.0], D, 0.0, 4.0), "p3"), key(cut("measure"), view([PANX, YC, 0.0], D - 3.0, 0.0, -5.0), "sine")],
    "measure": [key(cut("measure"), {**WIDE, "yaw": -4.0}), key(cut("takeaway"), {**WIDE, "yaw": 5.0}, "sine")],
    "takeaway": [key(cut("takeaway"), view([CX, YC + 1.6, 0.0], D, 0.0, 8.0)), key(cut("tease"), view([CX, YC + 1.6, 0.0], D, 0.0, -8.0), "sine")],
    "tease": [key(cut("tease"), view([CX, YC, 0.0], 80.0)), key(DUR, view([CX, YC, 0.0], 92.0), "sine")],
}
SHOTS = [{"at": CUTS[b["id"]], "name": b["id"]} for b in BEATS]
TITLE = {"series": "Reality Rulebook · Season 2 · Episode 3", "title": "The nut that *rises*", "t1": round(cut("normal") - 0.45, 4), "y": 0.183, "sig": -0.7}
film = {
    "id": "reality-rulebook-s2e03", "fps": FPS, "bpm": BPM, "dur": DUR, "poster": 0.0,
    "_doc": "Compiled by compile.py from script.md, vo/, sim.json and the direction in compile.py. Do not edit by hand.",
    "shots": SHOTS, "beats": BEATS, "cue": {"cuts": CUTS, "height": HEIGHT_W, "arrows": ARROWS_W, "ghosts": GHOSTS}, "spine": SPINE, "spineAt": SPINE_AT,
    "sim": SIM, "rev": REV, "replay": {"t0": cut("measure"), "rate": RP, "note": "1.6× faster"}, "endShow": ENDSHOW, "labels": LABELS, "badges": BADGES, "cam": CAM, "captionY": 0.632, "title": TITLE,
    "noteSlots": {"speed": "tl", "hook": "tr"}, "speedNote": "2× slower",
    "captions": [pg for pg in phrase_captions(f, max_chars=24, fix=[], until=ENDSHOW - 0.3) if pg["t0"] < ENDSHOW - 0.35], "endCard": EC,
    "end": {"title": "Next drop: the coffee *ring*", "follow": "Follow Reality Rulebook", "foot": "Mathijssen et al., arXiv 2201.12128 (2022)."},
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}
ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS]
ev.append({"t": round(A("vo02:rise"), 4), "kind": "reveal", "tag": "rise"})
ev.append({"t": round(A("vo03:heavier,") if False else A("vo03:heavier."), 4), "kind": "contact", "tag": "heavier"})
ev.append({"t": round(A("vo04:tumble"), 4), "kind": "contact", "tag": "tumble"})
ev.append({"t": round(A("vo06:climbs"), 4), "kind": "swell", "tag": "climb"})
ev.append({"t": round(A("vo07:sorts"), 4), "kind": "reveal", "tag": "sorts"})
for lb in LABELS:
    ev.append({"t": lb["t0"], "kind": "label", "tag": lb["id"]})
for bd in BADGES:
    ev.append({"t": round(bd["t0"], 4), "kind": "badge", "tag": bd["id"], "text": bd.get("text", "")})
ev.append({"t": SPINE[0]["t0"], "kind": "counter.show", "tag": "spine"})
ev.append({"t": SPINE[1]["t0"], "kind": "counter.show", "tag": "spine2"})
ev.append({"t": SPINE[2]["t0"], "kind": "counter.show", "tag": "spine3"})
ev.append({"t": 0.0, "kind": "signature", "tag": "title", "gain": -4.0})
ev.append({"t": ENDSHOW, "kind": "signature", "tag": "end"})
sheet = {"duration": DUR, "fps": FPS, "preset": "restframe-bench", "duck_db": -9.0,
         "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: (e["t"], e["kind"])),
         "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}
(HERE / "film.json").write_text(json.dumps(film, separators=(",", ":"), ensure_ascii=False, allow_nan=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
print(f"film.json: {len(SHOTS)} shots, {len(LABELS)} labels, {len(film['captions'])} caption pages, end card {EC} s, {DUR} s; big ball {BIG0:.1f} -> {BIGEND:.1f} cm")
for b in BEATS:
    print(f"  {b['id']:<9} {b['t0']:6.2f}–{b['t1']:6.2f}")
