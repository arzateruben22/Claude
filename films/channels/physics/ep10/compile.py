"""Compile Reality Rulebook Season 2 · Episode 4, "The ring a coffee drop leaves" (folder ep10): script + voice timings + this direction -> film.json, sheet.json.

  python3 -I films/channels/physics/ep10/compile.py

The model (scene.mjs reproduces it): a thin drop on paper, height h = h0 (1 - r²/R²), its edge pinned at r = R; evaporation flux
J = J0 (1 - r²/R²)^(-1/2) (strongest at the edge, the diffusion-limited form for a thin drop, as in Deegan et al. 1997);
volume conservation then gives h0 falling steadily and an outward depth-averaged speed
    u(r, s) = [2r² - r⁴ - 1 + sqrt(1 - r²)] / [4 t_f r (1 - s)(1 - r²)]          (R = 1, s = t / t_f the share of the drying time)
so a speck obeys dr/dτ = G(r)/4 with τ = -ln(1 - s): it speeds up as the drop thins and reaches the edge in finite τ. Specks that
reach the edge stay there (the pinned edge). The numbers are made up: R = 10 cm on screen, the drop is scaled for the picture.
review/model-check.md lists the share of specks within 5% of the edge as a function of s (about nine in ten at s = 0.95).
"""
import bisect
import json
import math
import random
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
R, H0, NSP = 10.0, 3.2, 1500
RING = 0.95                                       # a speck counts as "in the ring" beyond 95% of the radius


def G(r):
    return (2 * r * r - r ** 4 - 1 + math.sqrt(max(0.0, 1 - r * r))) / (r * (1 - r * r))


# model check (the share of uniformly placed specks beyond 0.95 R as the drop dries)
tr, r, t, dt = [(0.0, 1e-3)], 1e-3, 0.0, 0.002
while r < 0.9995 and t < 60:
    k1 = G(r) / 4; k2 = G(r + dt / 2 * k1) / 4; k3 = G(r + dt / 2 * k2) / 4; k4 = G(r + dt * k3) / 4
    r += dt / 6 * (k1 + 2 * k2 + 2 * k3 + k4); t += dt; tr.append((t, r))
RS, TS = [x[1] for x in tr], [x[0] for x in tr]
random.seed(1)
r0s = [math.sqrt(random.random()) for _ in range(20000)]


def share(s):
    tau = -math.log(1 - s) if s < 1 else 99
    c = 0
    for r0 in r0s:
        if r0 >= RING:
            c += 1; continue
        i = bisect.bisect_left(RS, max(r0, 1e-3)); tt = TS[min(i, len(TS) - 1)] + tau
        j = bisect.bisect_left(TS, tt)
        if j >= len(TS) or RS[j] >= RING:
            c += 1
    return c / len(r0s)


CHECK = [(s, share(s)) for s in (0.0, 0.3, 0.5, 0.8, 0.9, 0.95, 0.97, 0.99)]
S_MEASURE = 0.95
assert 0.88 < share(S_MEASURE) < 0.95, share(S_MEASURE)


def take(*keys):
    return [[round(t, 4), round(v, 5)] for t, v in keys]


T_DRY = A("vo02:dry.") + 0.3
TAKES = [
    {"name": "hook", "t0": 0.0, "t1": cut("normal"), "view": "top", "keys": take((0.0, 0.0), (cut("normal"), 0.3))},
    {"name": "normal", "t0": cut("normal"), "t1": cut("change"), "view": "top",
     "keys": take((cut("normal"), 0.0), (A("vo02:Spill") + 0.3, 0.0), (T_DRY, 0.985), (A("vo02:ring,") + 0.4, 0.999), (cut("change"), 0.999))},
    {"name": "change", "t0": cut("change"), "t1": cut("why"), "view": "top", "keys": take((cut("change"), 0.02), (cut("why"), 0.6))},
    {"name": "why", "t0": cut("why"), "t1": cut("whoa"), "view": "side", "keys": take((cut("why"), 0.3), (cut("whoa"), 0.56))},
    {"name": "whoa", "t0": cut("whoa"), "t1": cut("measure"), "view": "top",
     "keys": take((cut("whoa"), 0.5), (A("vo05:speeds") + 0.2, 0.86), (A("vo05:edge.") + 0.2, 0.995), (cut("measure"), 0.999))},
    {"name": "measure", "t0": cut("measure"), "t1": cut("takeaway"), "view": "top",
     "keys": take((cut("measure"), 0.0), (A("vo06:nine"), 0.9), (A("vo06:reach"), S_MEASURE), (cut("takeaway"), 0.999))},
    {"name": "takeaway", "t0": cut("takeaway"), "t1": cut("tease"), "view": "top", "keys": take((cut("takeaway"), 0.999), (cut("tease"), 0.999))},
    {"name": "tease", "t0": cut("tease"), "t1": DUR + 1, "view": "top", "keys": take((cut("tease"), 0.999), (DUR + 1, 0.999))},
]
ENDSHOW = round(A("vo08:You") - 0.15, 4)                  # the end card comes up as the last sentence starts and holds to the end
TRAIL_W = [cut("change") + 0.4, cut("why") - 0.2]
CUT_W = [cut("why") + 0.3, cut("whoa") - 0.2]               # the side view's arrows
LABELS = [
    {"id": "no-drop", "text": "coffee drop", "color": "ghost", "t0": cut("normal") + 0.2, "t1": A("vo02:dry."), "at": "edge", "side": 1},
    {"id": "no-ring", "text": "dark ring", "color": "energy", "t0": A("vo02:dark"), "t1": cut("change") - 0.3, "at": "edge", "side": 1},
    {"id": "ch-speck", "text": "a speck", "color": "motion", "t0": cut("change") + 0.3, "t1": A("vo03:outward,") - 0.2, "at": "speck", "side": -1},
    {"id": "ch-edge", "text": "the edge", "color": "ghost", "t0": A("vo03:toward"), "t1": cut("why") - 0.3, "at": "edge", "side": 1},
    {"id": "wy-stuck", "text": "edge stuck to the paper", "color": "ghost", "t0": cut("why") + 0.2, "t1": A("vo04:Water") - 0.1, "at": "edge", "side": 1},
    {"id": "wy-evap", "text": "water evaporates here", "color": "energy", "t0": A("vo04:Water"), "t1": A("vo04:so") - 0.1, "at": "evap", "side": 1},
    {"id": "wy-flow", "text": "flow replaces it", "color": "force", "t0": A("vo04:so"), "t1": A("vo04:The") - 0.1, "at": "flow", "side": -1},
    {"id": "wo-pile", "text": "specks pile up", "color": "energy", "t0": A("vo05:pile"), "t1": cut("measure") - 0.3, "at": "edge", "side": 1},
]
BADGES = [
    {"id": "tl", "kind": "tag", "text": "Time-lapse model", "t0": cut("normal") + 0.3, "t1": round(A("vo05:Make") - 0.3, 4), "slot": "tr"},
    {"id": "oval", "kind": "tag", "text": "Oval specks can spread evenly", "t0": A("vo05:Make"), "t1": round(cut("measure") - 0.5, 4), "slot": "tr"},
    {"id": "model", "kind": "tag", "text": "A model: made-up numbers", "t0": cut("measure"), "t1": round(ENDSHOW - 0.3, 4), "slot": "tr"},
]
SPINE = [{"t0": cut("change"), "t1": round(ENDSHOW - 0.3, 4), "label": "specks in the ring", "unit": "%", "dp": 0, "lit": [A("vo06:reach"), cut("takeaway")]}]
SPINE_AT = [[-1e9, [0.5, 0.262]]]


def view(look, dist, pitch, yaw=0.0, fov=32.0):
    return {"look": [round(v, 3) for v in look], "dist": round(dist, 2), "yaw": yaw, "pitch": pitch, "fov": fov}


def key(t, v, ease="p2"):
    return {"t": round(t, 4), **v, "ease": ease}


LK = [0.0, 0.0, -2.6]
TOP = view(LK, 76.0, 63.0, 0.0)
TOPC = view([0.0, 0.0, -6.0], 72.0, 60.0, -5.0)
SIDE = view([0.0, 2.0, 0.0], 62.0, 9.0)
CAM = {
    "hook": [key(0.0, TOPC), key(cut("normal"), {**TOPC, "dist": 76.0, "yaw": 3.0}, "sine")],
    "normal": [key(cut("normal"), {**TOP, "yaw": 3.0}), key(cut("change"), {**TOP, "dist": 78.0, "yaw": -5.0}, "sine")],
    "change": [key(cut("change"), {**TOP, "dist": 78.0, "yaw": -5.0}), key(cut("why") - 0.2, {**TOP, "dist": 72.0, "yaw": 4.0}, "sine")],
    "why": [key(cut("why"), {**TOP, "dist": 72.0, "yaw": 4.0}), key(cut("why") + 1.6, SIDE, "p3"), key(cut("whoa") - 0.1, {**SIDE, "dist": 66.0, "yaw": -8.0}, "sine")],
    "whoa": [key(cut("whoa"), view([0.0, 2.0, 0.0], 66.0, 22.0, -8.0)), key(cut("whoa") + 1.6, TOP, "p3"), key(cut("measure"), {**TOP, "dist": 78.0, "yaw": 4.0}, "sine")],
    "measure": [key(cut("measure"), {**TOP, "dist": 78.0, "yaw": 4.0}), key(cut("takeaway"), {**TOP, "dist": 74.0, "yaw": -4.0}, "sine")],
    "takeaway": [key(cut("takeaway"), {**TOP, "dist": 74.0, "yaw": -4.0}), key(cut("tease"), view(LK, 76.0, 52.0, 12.0), "sine")],
    "tease": [key(cut("tease"), view(LK, 76.0, 52.0, 12.0)), key(DUR, view(LK, 74.0, 60.0, 6.0), "sine")],
}
SHOTS = [{"at": CUTS[b["id"]], "name": b["id"]} for b in BEATS]
TITLE = {"series": "Reality Rulebook · Season 2 · Episode 4", "title": "The ring a coffee drop *leaves*", "t1": round(cut("normal") - 0.45, 4), "y": 0.183, "sig": -0.7}
film = {
    "id": "reality-rulebook-s2e04", "fps": FPS, "bpm": BPM, "dur": DUR, "poster": 0.0,
    "_doc": "Compiled by compile.py from script.md, vo/ and the direction in compile.py. Do not edit by hand.",
    "shots": SHOTS, "beats": BEATS, "cue": {"cuts": CUTS, "trail": TRAIL_W, "cut": CUT_W, "ring": RING}, "spine": SPINE, "spineAt": SPINE_AT,
    "model": {"R": R, "H0": H0, "n": NSP, "ring": RING}, "takes": TAKES, "labels": LABELS, "badges": BADGES, "cam": CAM, "captionY": 0.632, "title": TITLE,
    "captions": [pg for pg in phrase_captions(f, max_chars=24, fix=[], until=ENDSHOW - 0.3) if pg["t0"] < ENDSHOW - 0.35], "endShow": ENDSHOW, "endCard": EC,
    "end": {"title": "Next drop: listen to the cup fill", "follow": "Follow Reality Rulebook", "foot": "Deegan et al., Nature 389, 827 (1997)."},
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}
ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS]
ev.append({"t": round(A("vo02:Spill") + 0.3, 4), "kind": "time.slow", "tag": "spill"})
ev.append({"t": round(A("vo02:ring,"), 4), "kind": "reveal", "tag": "ring"})
ev.append({"t": round(A("vo04:Water"), 4), "kind": "heat", "tag": "evap"})
ev.append({"t": round(A("vo05:pile"), 4), "kind": "swell", "tag": "pile"})
ev.append({"t": round(A("vo06:reach"), 4), "kind": "counter.end", "tag": "ninety"})
for lb in LABELS:
    ev.append({"t": lb["t0"], "kind": "label", "tag": lb["id"]})
for bd in BADGES:
    ev.append({"t": round(bd["t0"], 4), "kind": "badge", "tag": bd["id"], "text": bd.get("text", "")})
ev.append({"t": SPINE[0]["t0"], "kind": "counter.show", "tag": "spine"})
ev.append({"t": 0.0, "kind": "signature", "tag": "title", "gain": -4.0})
ev.append({"t": ENDSHOW, "kind": "signature", "tag": "end"})
sheet = {"duration": DUR, "fps": FPS, "preset": "restframe-bench", "duck_db": -9.0,
         "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: (e["t"], e["kind"])),
         "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}
(HERE / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False, allow_nan=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
(HERE / "review").mkdir(exist_ok=True)
(HERE / "review" / "model-check.md").write_text("# S2E04 model check (for claims c6, c8, c10)\n\nShare of 20,000 specks, placed uniformly over the drop, that are beyond 0.95 R of the centre when the drop is a share s of the way through its drying time (compile.py; model in its docstring):\n\n| s | share |\n|---|---|\n" + "\n".join(f"| {s} | {v:.3f} |" for s, v in CHECK) + "\n\nAbout 6.4% of the specks start in that outer band. The film's measure beat reads this number at s = 0.95.\n")
print(f"film.json: {len(SHOTS)} shots, {len(LABELS)} labels, {len(film['captions'])} caption pages, end card {EC} s, {DUR} s; share at 0.95: {share(0.95):.3f}")
for b in BEATS:
    print(f"  {b['id']:<9} {b['t0']:6.2f}–{b['t1']:6.2f}")
