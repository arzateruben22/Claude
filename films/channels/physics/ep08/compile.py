"""Compile Reality Rulebook No. 008, "Spaghetti never breaks in two": script + voice timings + this direction → film.json and sheet.json.

  python3 -I films/channels/physics/ep08/compile.py

An illustration, not a simulation. The stick is a circular arc of length L, ends held; its bend runs from 0 to the breaking
bend; at the first break the stick snaps at its middle and, in the cascade, breaks again where the bending waves from the first
break arrive (the second 0.29 and the third 0.40 time units later: the waves cross 0.2 L and 0.28 L at 0.7 L per unit). A
twisted stick (twist, then bend) breaks once. Facts are from Heisser et al., PNAS 115, 8665 (2018) (twist angles above
about 250 degrees give binary fracture) and Audoly and Neukirch, PRL 95, 095505 (2005). The scene says so on screen.

τ is the take's own phase: τ in [-1, 0] the twist (0 → twist), [0, 1] the bend, above 1 the time after the first break.
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
    return round({b["id"]: b for b in BEATS}[beat]["t0"] - HALF, 6)


STICK = {"L": 25.0, "thetaMax": 1.12, "Y0": 118.0, "rad": 0.9, "g": 70.0, "fall": 9.0,
         "casc": [[0.5, 0.0], [0.30, 0.29], [0.78, 0.40]], "single": [[0.5, 0.0]], "wave": 0.7}


def take(*keys):
    return [[round(t, 4), round(v, 5)] for t, v in keys]


TAKES = [
    {"name": "hook", "t0": 0.0, "t1": cut("normal"), "phimax": 0, "breaks": "casc", "keys": take((0.0, 0.965), (cut("normal"), 0.992))},
    {"name": "normal", "t0": cut("normal"), "t1": cut("change"), "phimax": 0, "breaks": "casc",
     "keys": take((cut("normal"), 0.0), (A("vo02:curves,"), 0.35), (A("vo02:snaps.") - 0.04, 0.995), (A("vo02:snaps.") + 0.04, 1.0), (A("vo02:snaps.") + 1.0, 1.95), (cut("change"), 1.97))},
    {"name": "change", "t0": cut("change"), "t1": cut("why"), "phimax": 0, "breaks": "casc",
     "keys": take((cut("change"), 0.93), (A("vo03:end.") - 0.1, 1.0), (A("vo03:snaps") + 0.05, 1.29), (A("vo03:again.") + 0.05, 1.40), (cut("why"), 1.62))},
    {"name": "why", "t0": cut("why"), "t1": cut("whoa"), "phimax": 0, "breaks": "casc",
     "keys": take((cut("why"), 0.97), (A("vo04:first"), 0.992), (A("vo04:sends"), 1.0), (A("vo04:extra"), 1.29), (A("vo04:again.") + 0.05, 1.40), (cut("whoa"), 1.62))},
    {"name": "whoa", "t0": cut("whoa"), "t1": cut("measure"), "pair": [
        {"xo": 0.0, "yoKeys": take((cut("whoa"), 0.0), (A("vo05:pieces.") + 0.2, 0.0), (A("vo05:pieces.") + 1.4, -11.0)), "breaks": "single", "phimax": 250,
         "keys": take((cut("whoa"), -1.0), (cut("whoa") + 1.0, -1.0), (A("vo05:turn.") + 0.2, 0.0), (A("vo05:Then"), 0.0), (A("vo05:two#2") - 0.05, 0.97), (A("vo05:two#2"), 1.0), (A("vo05:two#2") + 3.5, 1.9), (cut("measure"), 1.92))},
        {"xo": 0.0, "yo": 11.0, "show": [A("vo05:pieces.") + 0.5, 1e9], "breaks": "casc", "phimax": 0, "keys": take((A("vo05:pieces.") + 0.5, 1.97), (cut("measure"), 1.97))}]},
    {"name": "measure", "t0": cut("measure"), "t1": cut("takeaway"), "phimax": 300, "breaks": "single",
     "keys": take((cut("measure"), -1.0), (A("vo06:little"), -1.0), (A("vo06:fifty"), -1.0 / 6), (A("vo06:win."), 0.0), (cut("takeaway"), 0.0))},
    {"name": "takeaway", "t0": cut("takeaway"), "t1": cut("tease"), "pair": [
        {"xo": 0.0, "yo": 11.0, "breaks": "casc", "phimax": 0, "keys": take((cut("takeaway"), 0.55), (A("vo07:chain") - 0.6, 0.985), (A("vo07:chain") - 0.1, 1.0), (A("vo07:chain") + 3.8, 1.95), (cut("tease"), 1.97))},
        {"xo": 0.0, "yo": -11.0, "breaks": "single", "phimax": 250, "keys": take((cut("takeaway"), -1.0), (A("vo07:Twist"), -1.0), (A("vo07:usually"), 0.0), (A("vo07:break#2") - 0.05, 0.97), (A("vo07:break#2"), 1.0), (A("vo07:break#2") + 3.4, 1.9), (cut("tease"), 1.92))}]},
    {"name": "tease", "t0": cut("tease"), "t1": EC - 0.6, "pair": [
        {"xo": 0.0, "yo": 11.0, "breaks": "casc", "phimax": 0, "keys": take((cut("tease"), 1.97), (EC, 1.97))},
        {"xo": 0.0, "yo": -11.0, "breaks": "single", "phimax": 250, "keys": take((cut("tease"), 1.92), (EC, 1.92))}]},
    {"name": "tease", "t0": EC - 0.6, "t1": DUR + 1, "phimax": 0, "breaks": "casc", "keys": take((EC - 0.6, 0.965), (DUR + 1, 0.965))},
]
CUTS = {b["id"]: (0.0 if b["id"] == "hook" else cut(b["id"])) for b in BEATS}
RIPPLE_W = [A("vo04:sends"), A("vo04:again.") + 0.1]
TWIST_W = [A("vo05:Twist"), cut("measure")]

SPINE = [
    {"t0": cut("normal"), "t1": cut("whoa"), "label": "pieces so far", "unit": " ", "dp": 0, "kind": "pieces"},
    {"t0": cut("whoa"), "t1": cut("takeaway") - 0.35, "label": "angle", "unit": "°", "dp": 0, "kind": "twist", "lit": [A("vo06:fifty"), cut("takeaway")]},
]
SPINE_AT = [[-1e9, [0.74, 0.25]]]
LABELS = []          # owner rule (one text element per idea): the caption names things, the readout carries the number; no on-art labels
BADGES = [
    {"id": "fey", "kind": "tag", "text": "Feynman asked why", "t0": A("vo04:Feynman"), "t1": A("vo04:Years"), "slot": "tr"},
    {"id": "illus", "kind": "tag", "text": "Illustration, not a simulation", "t0": A("vo02:snaps."), "t1": EC - 0.2, "slot": "tl"},
]
PIECES_BADGE = {"id": "pc", "t0": A("vo06:little"), "t1": cut("takeaway") - 0.1, "slot": "tl", "thr": 250, "phimax": 300}


def view(look, dist, pitch=0.0, yaw=0.0, fov=32.0):
    return {"look": [round(v, 3) for v in look], "dist": round(dist, 2), "yaw": yaw, "pitch": pitch, "fov": fov}


def key(t, v, ease="p2"):
    return {"t": round(t, 4), **v, "ease": ease}


Y0 = STICK["Y0"]
WIDE = view([0.0, Y0 - 7.0, 0.0], 118.0)
CLOSE = view([0.0, Y0 + 4.0, 0.0], 90.0)
PUSH = view([0.0, Y0 + 1.0, 0.0], 80.0)
PAIR = view([0.0, Y0 - 12.0, 0.0], 176.0)
T1, T2, T3, T4 = A("vo02:snaps."), A("vo03:end.") - 0.1, A("vo04:sends"), A("vo05:two#2")
CAM = {
    "hook": [key(0.0, CLOSE), key(cut("normal"), {**CLOSE, "dist": 84.0}, "sine")],
    "normal": [key(cut("normal"), WIDE), key(T1 - 1.4, WIDE, "sine"), key(T1 - 0.3, PUSH, "p3"), key(T1 + 0.7, PUSH, "sine"), key(T1 + 2.6, {**WIDE, "dist": 124.0, "yaw": 10.0}, "p3"), key(cut("change"), {**WIDE, "dist": 112.0, "yaw": -8.0}, "sine")],
    "change": [key(cut("change"), view([0.0, Y0 - 6.0, 0.0], 100.0)), key(T2 - 1.0, view([0.0, Y0 - 6.0, 0.0], 100.0), "sine"), key(T2 - 0.1, PUSH, "p3"), key(T2 + 0.6, PUSH, "sine"), key(A("vo03:snaps") - 0.4, {**WIDE, "dist": 120.0}, "p3"), key(cut("why"), view([0.0, Y0 - 7.0, 0.0], 112.0), "sine")],
    "why": [key(cut("why"), CLOSE), key(cut("why") + 1.8, view([0.0, Y0 + 4.0, 0.0], 60.0), "p3"), key(A("vo04:Years") + 0.6, view([0.0, Y0 + 4.0, 0.0], 56.0, 0.0, 6.0), "sine"), key(A("vo04:explained"), {**CLOSE, "dist": 84.0, "yaw": 8.0}, "p3"), key(T3 - 0.9, PUSH, "p3"), key(T3 + 0.6, PUSH, "sine"), key(T3 + 2.4, {**WIDE, "dist": 124.0}, "p3"), key(cut("whoa"), {**WIDE, "dist": 108.0}, "sine")],
    "whoa": [key(cut("whoa"), WIDE), key(cut("whoa") + 2.4, {**WIDE, "dist": 100.0, "yaw": -10.0}, "sine"), key(A("vo05:Then") - 0.3, view([0.0, Y0 - 3.0, 0.0], 88.0), "p3"), key(T4 - 0.2, PUSH, "p3"), key(T4 + 0.5, PUSH, "sine"), key(A("vo05:pieces.") + 0.4, {**WIDE, "dist": 112.0, "yaw": 14.0}, "p3"), key(A("vo05:pieces.") + 1.5, PAIR, "p3"), key(cut("measure"), {**PAIR, "dist": 190.0, "yaw": -10.0}, "sine")],
    "measure": [key(cut("measure"), view([0.0, Y0 - 5.0, 0.0], 116.0, 0.0, 12.0)), key(cut("takeaway"), view([0.0, Y0 - 5.0, 0.0], 108.0, 0.0, -12.0), "sine")],
    "takeaway": [key(cut("takeaway"), view([0.0, Y0 - 6.0, 0.0], 128.0, 0.0, -14.0)), key(cut("takeaway") + 1.8, PAIR, "p3"), key(cut("tease"), {**PAIR, "dist": 160.0, "yaw": 10.0}, "sine")],
    "tease": [key(cut("tease"), {**PAIR, "dist": 150.0, "yaw": -26.0, "pitch": 14.0}), key(EC - 0.6, {**PAIR, "dist": 250.0, "yaw": 26.0, "pitch": 2.0}, "sine"), key(EC - 0.59, CLOSE, "lin"), key(DUR, CLOSE, "sine")],
}
_CUTS = sorted([b["t0"] for b in BEATS] + [EC - 0.6])
for _lb in LABELS:
    _next = [x for x in _CUTS if x > _lb["t0"] + 0.1]
    if _next and _lb.get("t1") is not None and _lb["t1"] > _next[0] - 0.75:
        _lb["t1"] = max(_lb["t0"] + 0.6, _next[0] - 0.75)
SHOTS = [{"at": CUTS[b["id"]], "name": b["id"]} for b in BEATS]
TITLE = {"series": "Reality Rulebook · Season 2 · Episode 2", "title": "Spaghetti almost never breaks in *two*", "t1": round(cut("normal") - 0.45, 4), "y": 0.183, "sig": 0.3}
film = {
    "id": "reality-rulebook-s2e02", "fps": FPS, "bpm": BPM, "dur": DUR, "poster": 0.0,
    "_doc": "Compiled by compile.py from script.md, vo/ and the direction in compile.py. Do not edit by hand.",
    "shots": SHOTS, "beats": BEATS, "cue": {"cuts": CUTS, "ripple": RIPPLE_W, "twist": TWIST_W}, "spine": SPINE, "spineAt": SPINE_AT, "stick": STICK,
    "takes": TAKES, "labels": LABELS, "badges": BADGES, "piecesBadge": PIECES_BADGE, "cam": CAM, "captionY": 0.632, "title": TITLE,
    "noteSlots": {"speed": "tl", "hook": "bl"},
    "captions": phrase_captions(f, max_chars=24, fix=[], until=EC - 0.3), "endCard": EC,
    "end": {"title": "Next drop: the nut that *rises*", "follow": "Follow Reality Rulebook", "foot": "Twist first, then bend: usually two pieces. Heisser et al., PNAS 115, 8665 (2018)."},
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}
ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS]
ev.append({"t": round(A("vo02:snaps."), 4), "kind": "impact", "tag": "snap1"})
ev.append({"t": round(A("vo03:end."), 4), "kind": "impact", "tag": "snap2"})
ev.append({"t": round(A("vo03:snaps"), 4), "kind": "impact", "tag": "snap3"})
ev.append({"t": round(A("vo04:sends"), 4), "kind": "impact", "tag": "snap4"})
ev.append({"t": round(A("vo05:two#2"), 4), "kind": "impact", "tag": "snap5"})
ev.append({"t": round(A("vo07:chain") - 0.1, 4), "kind": "impact", "tag": "snap6"})
ev.append({"t": round(A("vo07:break#2"), 4), "kind": "impact", "tag": "snap7"})
ev.append({"t": round(A("vo06:fifty"), 4), "kind": "counter.end", "tag": "threshold"})
for lb in LABELS:
    ev.append({"t": lb["t0"], "kind": "label", "tag": lb["id"]})
for bd in BADGES:
    ev.append({"t": round(bd["t0"], 4), "kind": "badge", "tag": bd["id"], "text": bd.get("text", "")})
ev.append({"t": SPINE[0]["t0"], "kind": "counter.show", "tag": "spine"})
for s in SPINE[1:]:
    ev.append({"t": s["t0"], "kind": "counter.tick", "tag": f"spine:{s['label']}"})
ev.append({"t": TITLE["sig"], "kind": "signature", "tag": "title", "gain": -4.0})
ev.append({"t": EC, "kind": "signature", "tag": "end"})
sheet = {"duration": DUR, "fps": FPS, "preset": "restframe-bench", "duck_db": -9.0,
         "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: (e["t"], e["kind"])),
         "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}
(HERE / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False, allow_nan=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
print(f"film.json: {len(SHOTS)} shots, {len(LABELS)} labels, {len(film['captions'])} caption pages, end card {EC} s, {DUR} s")
for b in BEATS:
    print(f"  {b['id']:<9} {b['t0']:6.2f}–{b['t1']:6.2f}")
