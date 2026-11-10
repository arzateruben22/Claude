"""Compile Reality Rulebook Season 3's long film lf01, "Slow Down One Second Until Light Stands Still":
script + voice timings + this direction -> film.json, sheet.json (the 16:9 long film).

  python3 -I films/channels/physics/lf01/compile.py

One kitchen, one counter. The slow-motion factor F (k = log10 F) only goes up until the last beat: the counter is the live number, and
every picture reads its own local real time r = (t - t0) / F from the film clock. Numbers come from calc.py (calc.json).
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
CALC = json.loads((HERE / "calc.json").read_text())


def cut(beat):
    return round([b for b in BEATS if b["id"] == beat][0]["t0"] - HALF, 6)


CUTS = {b["id"]: (0.0 if b["id"] == "hook" else cut(b["id"])) for b in BEATS}
ENDSHOW = round(max(A("vo12:Thanks") - 0.2, DUR - 2.0), 4)
R = lambda x: round(x, 4)   # noqa: E731

# ── the slow-motion factor: k = log10 F, keyed (time, k); eased ramps of RAMP s into each plateau ─────────────────────
RAMP = 1.1
KEYS = [
    (0.0, 0.0),
    (A("vo01:slower,") - 0.2, 0.0), (A("vo01:slower,") + 0.7, 0.301),          # "slower"  -> 2x (the replay)
    (A("vo01:slower#2") - 0.2, 0.301), (A("vo01:slower#2") + 0.7, 0.602),     # "slower again" -> 4x
    (A("vo02:Ten") - 0.1, 0.602), (A("vo02:Ten") + RAMP, 1.0),                 # ten times slower
    (A("vo03:hundred") - 0.1, 1.0), (A("vo03:hundred") + RAMP, 2.0),
    (A("vo04:thousand") - 0.1, 2.0), (A("vo04:thousand") + RAMP, 3.0),
    (A("vo06:thousand") - 0.1, 3.0), (A("vo06:thousand") + RAMP, 4.0),
    (A("vo07:million") - 0.1, 4.0), (A("vo07:million") + 1.6, 6.0),
    (A("vo08:million") - 0.1, 6.0), (A("vo08:million") + 1.4, 7.0),            # ten million
    (A("vo08:hundred#2") - 0.1, 7.0), (A("vo08:hundred#2") + 1.4, 8.0),        # a hundred million
    (A("vo08:billion") - 0.1, 8.0), (A("vo08:billion") + 1.4, 9.0),            # a billion
    (A("vo09:billion#2") - 0.1, 9.0), (A("vo09:billion#2") + 1.3, 10.0),           # ten billion
    (A("vo09:billion#3") - 0.1, 10.0), (A("vo09:billion#3") + 1.3, 11.0),        # a hundred billion
    (A("vo09:trillion") - 0.1, 11.0), (A("vo09:trillion") + 1.5, 12.0),        # a trillion
    (A("vo11:Now") - 0.1, 12.0), (A("vo11:Now") + 1.5, 0.0),                   # back to one second
]
KEYS = [(R(t), R(k)) for t, k in KEYS]
for (t0, _), (t1, _) in zip(KEYS, KEYS[1:]):
    assert t1 >= t0, ("the factor keys go backwards", t0, t1)
LABEL_TXT = {0.0: "1 second", 0.301: "2 seconds", 0.602: "4 seconds"}
for r in CALC["rows"]:
    LABEL_TXT[round(math.log10(r["factor"]), 3)] = r["lasts"]
# the counter label (a step): "1 real second now lasts X", X changing when a ramp ends
LBL = [[-1e9, "1 real second now lasts 1 second"]]
for (t0, k0), (t1, k1) in zip(KEYS, KEYS[1:]):
    if abs(k1 - k0) > 1e-6:
        LBL.append([R(t1), f"1 real second now lasts {LABEL_TXT[round(k1, 3)]}"])

# ── the events (film times; the scene turns each into its own local real time) ────────────────────────────────────────
EV = {
    # hook: a fly crosses the room in one real second, then the same second again, slower (2x, then 4x)
    "fly1": R(A("vo01:crosses") - 0.55), "fly2": R(A("vo01:slower,") + 0.6), "fly3": R(A("vo01:slower#2") + 0.5),
    "wire": [R(A("vo02:No") + 0.2), R(A("vo02:Ten") - 0.6)],                      # the kitchen is drawn on: wireframe -> solid
    # ch1: hummingbird at 10x (50 beats/s), blur demo ("why they blur at full speed"), the fly by the cup (a blur at 10x)
    "bird": [R(A("vo02:hummingbird") - 0.6), R(A("vo02:But") - 0.2)],
    "blur": [R(A("vo02:Here's")), R(A("vo02:So#2") if False else A("vo02:But") - 0.3)],
    "cupfly": [R(A("vo02:But") + 0.2), R(cut("fly") + 22.0)],
    # ch2: housefly at 100x then mosquito; the drop at the tap; the crown
    "fly100": [R(A("vo03:First,") + 0.2), R(A("vo03:mosquito's"))],
    "mosq": [R(A("vo03:mosquito's")), R(A("vo03:tap") - 0.8)],
    "tapdrop": [R(A("vo03:swells") - 0.3), R(A("vo03:falls")), R(A("vo03:hits") + 0.1)],   # swell starts, lets go, impact
    "settle": R(A("vo03:settles,")),
    # ch3: popcorn in the pan, the pop; the bubble
    "kernel": {"jump": R(A("vo04:jumps.") - 0.6), "pop": R(A("vo04:splits,") - 0.1), "foamEnd": R(A("vo04:settles"))},
    "bubble": {"in": R(A("vo04:sink,") - 0.4), "pop": R(A("vo04:pops#2") - 0.1)},
    # ch4: the clap (the ring starts, F = 1,000x, 0.343 m per film second), reaches the wall, bounces back
    "clap": R(A("vo05:far#2") if False else A("vo05:clap#1") - 0.0 if False else cut("sound") + 16.8),
    # ch5: the bullet enters the apple here (F = 10,000x); it approaches from 6.5 s before
    "bullet": {"enter": R(A("vo06:dimples.") + 2.0), "approach": R(A("vo06:small,") - 0.2)},
    # ch6: the storm; the leader's steps (a step every 3 s: 1 s of growth, then a skipped wait); the return stroke
    "storm": R(A("vo07:Beyond")),
    "leader": {"t0": R(A("vo07:jumps.") - 0.3), "stepEvery": 3.0, "steps": 8, "ground": R(A("vo07:touches") + 0.3)},
    # ch7: ramp, a flash crosses the room in 1.7 s (F = 1e8); then the flashlight, the front (F = 1e9)
    "flash8": R(A("vo08:flash") - 0.3), "light9": R(A("vo08:glowing") - 0.9),
    # ch8: the chip ticks (3 per slowed second at 1e9), the front crawling past a ruler (1e10 to 1e12), the hair
    "chip": [R(A("vo09:Here,")), R(A("vo09:Keep"))],
    "ruler": [R(A("vo09:Now,") - 0.3), R(A("vo09:Here's") - 0.2)],
    "hair": [R(A("vo09:human") - 0.2), R(A("vo09:takes") - 0.3)],
    "pulse": R(A("vo09:Keep")),
    # close: the lab bench (a bottle, a pulse crawling through it), then the kitchen again
    "lab": [cut("real"), cut("takeaway")], "back": R(A("vo11:Now")),
    "fly4": R(A("vo11:fly") + 0.1),
}
EV["fly100"][1] = EV["mosq"][0]

# ── cameras: keys (t, look [x,y,z], fitW = metres across the frame at the look plane, yaw deg, ease) ──────────────────
def ck(t, look, fitW, yaw=0.0, ease="p2", pitch=3.0):
    return {"t": R(t), "look": [round(v, 3) for v in look], "fitW": fitW, "yaw": yaw, "pitch": pitch, "ease": ease}


CUP, PAN, BUB, APP = [-0.3, 1.0, -1.0], [1.57, 1.02, -1.0], [-2.05, 1.25, -1.05], [0.8, 0.98, -1.0]
WIN, HUM, CHIP, FLASH = [-1.0, 1.85, -1.8], [-1.45, 1.85, -2.0], [2.4, 0.97, -0.85], [-2.42, 0.96, -0.95]
WIDE = ([0.0, 1.2, -0.8], 5.6)
CAM = [
    ck(0.0, WIDE[0], WIDE[1], -4.0), ck(A("vo01:Coffee") - 0.3, CUP, 1.5, 3.0), ck(A("vo01:fly") - 0.5, WIDE[0], 5.0, -3.0),
    ck(A("vo01:Now") + 0.2, WIDE[0], WIDE[1], 3.0, "sine"),
    ck(A("vo02:No"), WIDE[0], WIDE[1], 0.0), ck(A("vo02:Ten") - 1.5, WIDE[0], 5.2, 3.0, "sine"),
    ck(A("vo02:hummingbird") - 0.9, HUM, 0.55, -8.0), ck(A("vo02:Here's") - 0.5, HUM, 0.5, 8.0, "sine"), ck(A("vo02:But") - 0.5, HUM, 0.5, 6.0, "sine"),
    ck(A("vo02:But") + 0.1, [-0.3, 1.1, -1.0], 0.5, -6.0),
    ck(A("vo03:First,") - 0.3, [-0.3, 1.12, -1.0], 0.4, 6.0, "sine"), ck(A("vo03:tap") - 0.9, [-0.3, 1.1, -1.0], 0.34, -5.0),
    ck(A("vo03:hits") - 0.6, CUP, 0.26, 5.0), ck(A("vo03:settles,"), CUP, 0.3, -4.0, "sine"),
    ck(A("vo03:But") + 0.2, CUP, 0.5, 3.0),
    ck(A("vo04:thousand") - 0.2, PAN, 0.5, 8.0), ck(A("vo04:Then") + 0.3, PAN, 0.22, -4.0),
    ck(A("vo04:splits,") - 1.2, PAN, 0.24, 4.0), ck(A("vo04:sink,") - 1.6, PAN, 0.26, 3.0, "sine"), ck(A("vo04:sink,") - 0.2, BUB, 0.7, -8.0),
    ck(A("vo04:pops#2") - 0.8, BUB, 0.34, 6.0), ck(A("vo04:And#2") + 0.3, BUB, 0.5, -4.0, "sine"),
    ck(cut("sound") - 0.2, WIDE[0], WIDE[1], 0.0), ck(A("vo05:Now,") + 0.6, [1.0, 1.2, -0.8], 2.6, -5.0), ck(A("vo05:five") - 0.6, WIDE[0], 5.4, 5.0, "sine"),
    ck(A("vo05:Something") - 0.6, [0.4, 1.0, -1.0], 1.8, -5.0),
    ck(cut("bullet") - 0.2, APP, 1.1, 6.0), ck(A("vo06:small,") + 0.6, APP, 0.3, -6.0), ck(A("vo06:dimples.") - 0.4, APP, 0.3, 4.0, "sine"), ck(A("vo06:Then") + 0.2, [0.9, 0.98, -1.0], 0.4, 5.0, "sine"),
    ck(A("vo06:And") + 0.2, [1.1, 1.0, -1.0], 1.1, -5.0, "sine"), ck(A("vo06:But") + 0.2, [0.4, 1.0, -1.0], 3.0, 3.0),
    ck(cut("leader") - 0.2, WIN, 2.8, -3.0), ck(A("vo07:First,") - 0.3, [-1.2, 2.3, -1.8], 3.0, 5.0, "sine"), ck(A("vo07:Look") + 0.2, [-1.2, 2.0, -1.8], 2.8, -4.0, "sine"),
    ck(A("vo07:And#3") + 0.4, [-0.6, 1.5, -1.0], 3.8, 3.0),
    ck(cut("light") - 0.2, WIDE[0], WIDE[1], -3.0), ck(A("vo08:Someone") - 0.6, [-0.4, 1.1, -0.8], 4.8, 4.0, "sine"), ck(A("vo08:Behind") - 0.3, [0.0, 1.1, -0.8], 3.4, -5.0, "sine"),
    ck(A("vo08:cup") - 0.1, [-0.3, 1.05, -1.0], 0.7, 5.0), ck(A("vo08:seventeen") - 0.8, WIDE[0], 5.4, -3.0), ck(A("vo08:corner,") - 0.2, CHIP, 0.9, 4.0),
    ck(cut("still") - 0.2, CHIP, 0.8, 4.0), ck(A("vo09:Keep") + 0.3, [-2.3, 0.93, -1.0], 0.5, -4.0, "p2", 30.0), ck(A("vo09:Now,") + 0.5, [-2.43, 0.91, -1.0], 0.1, 4.0, "sine", 45.0),
    ck(A("vo09:Here's") - 0.2, [-2.45, 0.91, -1.0], 0.03, -3.0, "sine", 50.0), ck(A("vo09:human") - 0.3, [0.0, 3.0, 0.0], 0.0006, 0.0), ck(A("vo09:Light#4") - 0.3, [0.0, 3.0, 0.0], 0.0006, 0.0),
    ck(A("vo09:But#2") - 0.2, WIDE[0], 5.4, 0.0),
    ck(cut("real"), [0.0, 2.85, 0.0], 1.0, 0.0), ck(cut("takeaway") - 0.1, [0.0, 2.85, 0.0], 1.0, 0.0),
    ck(cut("takeaway"), WIDE[0], WIDE[1], 0.0), ck(DUR, WIDE[0], WIDE[1], 3.0, "sine"),
]
# (the "close-up" keys that sit in the physics scene, i.e. x=0,y=3 up in the sky, are the macro hair stage and the lab bench)
CAM.sort(key=lambda k: k["t"])
for a, b in zip(CAM, CAM[1:]):
    assert b["t"] > a["t"] - 1e-6, ("camera keys out of order", a["t"], b["t"])

BADGES = [
    {"id": "code", "kind": "tag", "text": "Model · drawn by code", "t0": R(A("vo02:Ten") - 5.0), "t1": R(cut("takeaway")), "slot": "tr"},
    {"id": "skip", "kind": "tag", "text": "Skipping ahead", "t0": R(A("vo07:So")), "t1": R(A("vo07:And#3") - 0.2), "slot": "tr"},
    {"id": "bench", "kind": "tag", "text": "Model of the MIT setup", "t0": R(cut("real") + 3.0), "t1": R(cut("takeaway") - 0.4), "slot": "tr"},
]
SPINE = [{"t0": 0.45, "t1": R(cut("takeaway") + 12.0), "label": "slow-motion"}]
SPINE_AT = [[-1e9, [0.3, 0.19]]]

film = {
    "id": "reality-rulebook-lf01", "fps": FPS, "bpm": BPM, "dur": DUR, "poster": 0.0,
    "_doc": "Compiled by compile.py from script.md, vo/ and the direction in compile.py. Do not edit by hand.",
    "shots": [{"at": CUTS[b["id"]], "name": b["id"]} for b in BEATS], "beats": BEATS, "cue": {"cuts": CUTS},
    "spine": SPINE, "spineAt": SPINE_AT, "factorKeys": KEYS, "ramp": RAMP, "labelKeys": LBL, "ev": EV, "cam": CAM,
    "calc": {"c": CALC["c"], "hz": {"hum": 50.0, "fly": 200.0, "mosq": 500.0}, "bubble_t": CALC["bubble"]["t_s"], "bullet": CALC["bullet"],
             "sound": 343.0, "leader": CALC["leader"], "light": CALC["light"]["m_per_ns"], "hair_m": CALC["hair"]["m"]},
    "badges": BADGES, "captionY": 0.77, "title": None,
    "captions": [pg for pg in phrase_captions(f, max_chars=44, fix=[], until=ENDSHOW - 0.3) if pg["t0"] < ENDSHOW - 0.35], "endShow": ENDSHOW, "endCard": EC,
    "end": {"title": "Next drop: why the sky is *blue*", "follow": "Follow Reality Rulebook", "foot": "Velten et al., femto-photography (2012-2013)."},
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}
ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS]
ev.append({"t": SPINE[0]["t0"], "kind": "counter.show", "tag": "spine"})
for bd in BADGES:
    ev.append({"t": R(bd["t0"]), "kind": "badge", "tag": bd["id"], "text": bd.get("text", "")})
ev.append({"t": EV["kernel"]["pop"], "kind": "contact", "tag": "pop"})
ev.append({"t": EV["clap"], "kind": "contact", "tag": "clap"})
ev.append({"t": EV["bullet"]["enter"], "kind": "contact", "tag": "bullet"})
ev.append({"t": EV["leader"]["ground"], "kind": "contact", "tag": "strike"})
ev.append({"t": 0.0, "kind": "signature", "tag": "title", "gain": -4.0})
ev.append({"t": ENDSHOW, "kind": "signature", "tag": "end"})
sheet = {"duration": DUR, "fps": FPS, "preset": "restframe-bench", "duck_db": -9.0,
         "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: (e["t"], e["kind"])),
         "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}
(HERE / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False, allow_nan=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
print(f"film.json: {len(film['shots'])} shots, {len(CAM)} camera keys, {len(film['captions'])} caption pages, {DUR:.1f} s ({int(DUR//60)}:{DUR%60:04.1f}); end card {EC} s")
for b in BEATS:
    print(f"  {b['id']:<9} {b['t0']:7.2f}–{b['t1']:7.2f}  ({b['t1']-b['t0']:.1f} s)")
