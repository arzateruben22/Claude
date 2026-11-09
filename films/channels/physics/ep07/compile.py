"""Compile Reality Rulebook No. 007, "The slinky that waits": script + voice timings + this direction → film.json and sheet.json.

  python3 -I films/channels/physics/ep07/compile.py

The physics is the instant-collapse model of a falling tension spring (Cross and Wheatland, Am. J. Phys. 80, 1051, 2012; after
Calkin 1993), in closed form: a slinky of collapsed length l1 (turns touching) hangs from its top; the tension (so the spacing)
falls linearly to zero at the collapsed bottom section (a fraction 1 − xi1 of the mass); on release a collapse front runs
down, the coils above it form one pile, the coils below stay exactly where they were, and the centre of mass falls at g.
With front fraction xi_f the time is t = sqrt(2a(xi1 xi_f²/2 − xi_f³/3)/g), a = mg/k, and the whole collapse takes
tc = sqrt(a xi1³ / 3g). The hung length (1.5 m, a = 350.6 cm) is chosen so tc ≈ 0.295 s, the paper's "typically ~0.3 s".
The scene is an illustration, not a measurement (badged).
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


# ── the slinky (cm, g = 981 cm/s²) ─────────────────────────────────────────────────────────────
G = 981.0
XB, L1, XI1, N = 150.0, 8.0, 0.9, 60            # hung length, collapsed length, collapsed bottom fraction, coils
AA = 2 * (XB - L1) / XI1 ** 2                    # a = mg/k, 350.6 cm
TC = math.sqrt(AA * XI1 ** 3 / (3 * G))          # the whole collapse, ≈ 0.295 s
TOP_Y = 238.0                                    # world y of the held top coil
RING = 11.0                                      # coil radius
SLINKY = {"xb": XB, "l1": L1, "xi1": XI1, "n": N, "a": round(AA, 4), "tc": round(TC, 5), "g": G, "topY": TOP_Y, "ring": RING}


def X(xi):
    if xi <= XI1:
        return L1 * xi + AA * (XI1 * xi - xi * xi / 2)
    return L1 * XI1 + AA * XI1 * XI1 / 2 + L1 * (xi - XI1)


XCOM = sum(X((i + 0.5) / 4000) for i in range(4000)) / 4000
assert abs(X(1.0) - XB) < 1e-6 and 0.28 < TC < 0.31, (X(1.0), TC)
TAU_END = 0.31                                   # the whole pile is still well above the floor at this τ
assert TOP_Y - XCOM - 0.5 * G * TAU_END ** 2 - L1 / 2 > 8, "pile would reach the floor"

# ── the takes: τ (the slinky's own clock) against film time, piecewise linear; τ ≤ 0 is the hung slinky ──
def take(*keys):
    return [[round(t, 4), round(v, 5)] for t, v in keys]


T_REL1 = A("vo02:go.") + 0.25
T_END1 = A("vo02:all.") + 0.45
R1 = TC / (T_END1 - T_REL1)
T_REL2 = A("vo03:Slowed") + 0.2
T_END2 = A("vo03:second.") + 0.1
R2 = TC / (T_END2 - T_REL2)
T_REL3 = A("vo04:pull") - 0.2
T_END3 = A("vo04:move.") + 0.15
R3 = TC / (T_END3 - T_REL3)
T_REL4 = A("vo05:It") - 0.1
T_END4 = A("vo05:fall.") + 0.3
R4 = TAU_END / (T_END4 - T_REL4)
T_REL5 = A("vo06:Measure") + 0.35
T_END5 = A("vo06:second.") + 0.1
R5 = TC / (T_END5 - T_REL5)
HOOK_TAU = (0.135, 0.135 + 0.0208 * cut("normal"))
RATE_TXT = {}

TAKES = [
    {"name": "hook", "t0": 0.0, "t1": cut("normal"), "keys": take((0.0, HOOK_TAU[0]), (cut("normal"), HOOK_TAU[1]))},
    {"name": "normal", "t0": cut("normal"), "t1": cut("change"),
     "keys": take((cut("normal"), 0.0), (T_REL1, 0.0), (T_END1, TC), (cut("change"), TC + R1 * (cut("change") - T_END1)))},
    {"name": "change", "t0": cut("change"), "t1": cut("why"),
     "keys": take((cut("change"), 0.0), (T_REL2, 0.0), (T_END2, TC), (cut("why"), TC + R2 * (cut("why") - T_END2)))},
    {"name": "why", "t0": cut("why"), "t1": cut("whoa"),
     "keys": take((cut("why"), 0.0), (T_REL3, 0.0), (T_END3, TC), (cut("whoa"), TC + R3 * (cut("whoa") - T_END3)))},
    {"name": "whoa", "t0": cut("whoa"), "t1": cut("measure"),
     "keys": take((cut("whoa"), 0.0), (T_REL4, 0.0), (T_END4, TAU_END), (cut("measure"), TAU_END))},
    {"name": "measure", "t0": cut("measure"), "t1": cut("takeaway"),
     "keys": take((cut("measure"), 0.0), (T_REL5, 0.0), (T_END5, TC), (cut("takeaway"), min(TAU_END, TC + R5 * (cut("takeaway") - T_END5))))},
    {"name": "takeaway", "t0": cut("takeaway"), "t1": cut("tease"),
     "keys": take((cut("takeaway"), TC), (cut("tease"), 0.34))},
    {"name": "tease", "t0": cut("tease"), "t1": DUR + 1, "keys": take((cut("tease"), 0.0), (DUR + 1, 0.0))},
]
# the speed note: seconds-of-film per second of slinky, per take, while the slinky moves
SPEED = [{"t0": T_REL1 - 0.0, "t1": cut("change"), "slow": round(1 / R1)}, {"t0": 0.0, "t1": cut("normal"), "slow": round(1 / 0.0208)},
         {"t0": T_REL2, "t1": cut("why"), "slow": round(1 / R2)}, {"t0": T_REL3, "t1": cut("whoa"), "slow": round(1 / R3)},
         {"t0": T_REL4, "t1": cut("measure"), "slow": round(1 / R4)}, {"t0": T_REL5, "t1": cut("takeaway"), "slow": round(1 / R5)},
         {"t0": cut("takeaway"), "t1": cut("tease"), "slow": round(1 / ((0.34 - TC) / (cut("tease") - cut("takeaway"))))}]

CUTS = {b["id"]: (0.0 if b["id"] == "hook" else cut(b["id"])) for b in BEATS}
BOTTOM_Y = TOP_Y - XB
# ghosts: every 1/30 s of the slinky's own time, for the change and the measure; the ghosts of the top and bottom coils
GH_DT = 1 / 30
GH_N = int(TC / GH_DT) + 1
GHOSTS = {"change": {"t0": T_REL2 + 0.05, "t1": cut("why"), "dt": GH_DT, "n": GH_N},
          "measure": {"t0": T_REL5 + 0.05, "t1": cut("takeaway"), "dt": GH_DT, "n": GH_N}}
FRONT_W = [A("vo04:travels"), A("vo04:Until") - 0.1]
FRONT_W2 = [A("vo04:pull"), A("vo04:move.") + 0.3]
MID_W = [A("vo05:middle?"), cut("measure")]
BALL_W = [A("vo05:dropped"), cut("measure")]
CUE = {"cuts": CUTS, "front": FRONT_W2, "mid": MID_W, "ball": BALL_W, "ghosts": GHOSTS, "tc": round(TC, 5)}

# rule 8: what the caption is not about steps back to a third
THIRD = 0.33
DIM = {
    "front": [[0.0, 1.0], [FRONT_W2[1], 1.0], [FRONT_W2[1] + 0.5, THIRD], [DUR, THIRD]],
    "ball": [[0.0, 1.0], [A("vo05:The"), 1.0], [A("vo05:The") + 0.5, THIRD], [DUR, THIRD]],
}

# ── the spine: how far the bottom coil has fallen (cm) ... the front (% of the way down) ... the middle (cm) ... the wait (s) ──
SPINE = [
    {"t0": cut("normal"), "t1": cut("why"), "label": "bottom coil: fallen so far", "unit": "cm", "dp": 1, "kind": "bottom"},
    {"t0": cut("why"), "t1": cut("whoa"), "label": "news has travelled down", "unit": "%", "dp": 0, "kind": "front"},
    {"t0": cut("whoa"), "t1": cut("measure"), "label": "middle of the slinky: fallen", "unit": "cm", "dp": 0, "kind": "mid"},
    {"t0": cut("measure"), "t1": cut("takeaway"), "label": "bottom waited", "unit": "s", "dp": 1, "kind": "wait", "lit": [T_END5, cut("takeaway")]},
    {"t0": cut("takeaway"), "t1": cut("tease") - 0.3, "label": "bottom waited", "unit": "s", "dp": 1, "kind": "const", "v": round(TC, 1), "lit": [cut("takeaway"), cut("tease")]},
]
SPINE_AT = [[-1e9, [0.76, 0.34]]]

LABELS = [
    {"id": "no-held", "text": "held at the top", "color": "ghost", "t0": cut("normal") + 0.3, "t1": T_REL1, "at": "top0", "side": 1},
    {"id": "no-still", "text": "bottom: still", "color": "motion", "t0": A("vo02:bottom"), "t1": cut("change") - 0.3, "at": "bottom", "side": 1},
    {"id": "ch-top", "text": "top: falling", "color": "energy", "t0": A("vo03:coils"), "t1": A("vo03:there.") + 0.3, "at": "top", "side": 1},
    {"id": "ch-bot", "text": "bottom: still", "color": "motion", "t0": A("vo03:bottom"), "t1": T_END2 - 0.3, "at": "bottom", "side": 1},
    {"id": "ch-gap", "text": "1/30 s apart", "color": "ghost", "t0": A("vo03:three") - 0.2, "t1": cut("why") - 0.3, "at": "ghost-top-change-4", "side": 1},
    {"id": "wy-no", "text": "no news yet", "color": "motion", "t0": A("vo04:Nothing"), "t1": A("vo04:The"), "at": "bottom", "side": 1},
    {"id": "wy-front", "text": "the news travels", "color": "force", "t0": A("vo04:travels"), "t1": A("vo04:Until") - 0.1, "at": "front", "side": 1},
    {"id": "wy-arr", "text": "news arrives", "color": "force", "t0": A("vo04:move.") - 0.5, "t1": cut("whoa") - 0.3, "at": "bottom", "side": 1},
    {"id": "wo-mid", "text": "middle of the slinky", "color": "energy", "t0": MID_W[0] + 0.2, "t1": cut("measure") - 0.3, "at": "mid", "side": 1},
    {"id": "wo-ball", "text": "dropped ball", "color": "force", "t0": A("vo05:dropped"), "t1": cut("measure") - 0.3, "at": "ball", "side": 1},
    {"id": "ms-ghost", "text": "bottom's ghosts: one pile", "color": "motion", "t0": A("vo06:stack"), "t1": T_END5 + 0.5, "at": "ghost-bot-measure-4", "side": 1},
]
BADGES = [
    {"id": "ideal", "title": "Illustrated slinky", "text": "Its fall is modeled, with no air. Sized to the paper's typical 0.3 s.", "t0": cut("takeaway") + 0.6, "t1": cut("tease"), "slot": "tr"},
    {"id": "model", "text": "Model slinky", "t0": cut("normal") + 0.4, "t1": T_REL1 + 0.5, "slot": "tr"},
]


def view(look, dist, pitch=6.0, yaw=0.0, fov=32.0):
    return {"look": [round(look[0] + 38.0, 3), round(look[1], 3), round(look[2], 3)], "dist": round(dist, 2), "yaw": yaw, "pitch": pitch, "fov": fov}


def key(t, v, ease="p2"):
    return {"t": round(t, 4), **v, "ease": ease}


WIDE = view([0.0, 128.0, 0.0], 700.0, 5.0, 12.0)
HOOKV = view([0.0, 128.0, 0.0], 470.0, 5.0, 14.0)
BOT = view([0.0, 104.0, 0.0], 320.0, 5.0, 10.0)
MID = view([0.0, 124.0, 0.0], 560.0, 5.0, 10.0)
CAM = {
    "hook": [key(0.0, HOOKV), key(cut("normal"), {**HOOKV, "dist": 300.0}, "sine")],
    "normal": [key(cut("normal"), WIDE), key(T_REL1, WIDE, "sine"), key(A("vo02:bottom"), MID, "p3"), key(cut("change"), {**MID, "dist": 520.0}, "sine")],
    "change": [key(cut("change"), MID), key(cut("why"), {**MID, "dist": 500.0}, "sine")],
    "why": [key(cut("why"), WIDE), key(A("vo04:Nothing"), BOT, "p3"), key(A("vo04:travels"), MID, "p3"), key(cut("whoa"), {**MID, "dist": 440.0}, "sine")],
    "whoa": [key(cut("whoa"), MID), key(A("vo05:The"), WIDE, "p3"), key(cut("measure"), {**WIDE, "dist": 590.0}, "sine")],
    "measure": [key(cut("measure"), MID), key(cut("takeaway"), {**MID, "dist": 520.0}, "sine")],
    "takeaway": [key(cut("takeaway"), view([0.0, 112.0, 0.0], 640.0, 5.0, 12.0)), key(cut("tease"), view([0.0, 112.0, 0.0], 560.0, 5.0, 12.0), "sine")],
    "tease": [key(cut("tease"), WIDE), key(DUR, {**WIDE, "dist": 540.0}, "sine")],
}
SHOTS = [{"at": CUTS[b["id"]], "name": b["id"]} for b in BEATS]
TITLE = {"series": "Reality Rulebook · No. 007", "title": "The slinky that *waits*", "t1": round(cut("normal") - 0.45, 4), "y": 0.183, "sig": 0.3}
CAP_FIX = []
film = {
    "id": "rest-frame-007", "fps": FPS, "bpm": BPM, "dur": DUR, "poster": 0.0,
    "_doc": "Compiled by compile.py from script.md, vo/ and the direction in compile.py. Do not edit by hand.",
    "shots": SHOTS, "beats": BEATS, "cue": CUE, "spine": SPINE, "spineAt": SPINE_AT, "slinky": SLINKY, "takes": TAKES, "speed": SPEED,
    "dim": DIM, "labels": LABELS, "badges": BADGES, "cam": CAM, "captionY": 0.632, "title": TITLE,
    "noteSlots": {"speed": "tl", "hook": "bl"},
    "captions": phrase_captions(f, max_chars=24, fix=CAP_FIX, until=EC - 0.3), "endCard": EC,
    "end": {"title": "Next drop: spaghetti never breaks in *two*", "follow": "Follow Reality Rulebook",
            "foot": "A real slinky collapses in about 0.3 s (Cross and Wheatland, 2012)."},
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}
ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS]
ev.append({"t": round(T_REL1, 4), "kind": "contact", "tag": "release1"})
ev.append({"t": round(T_END1, 4), "kind": "bounce", "tag": "arrive1"})
ev.append({"t": round(T_REL2, 4), "kind": "time.slow", "tag": "release2"})
ev.append({"t": round(T_END2, 4), "kind": "bounce", "tag": "arrive2"})
ev.append({"t": round(T_END3, 4), "kind": "reveal", "tag": "arrive3"})
ev.append({"t": round(T_REL4, 4), "kind": "time.slow", "tag": "release4"})
ev.append({"t": round(T_END5, 4), "kind": "counter.end", "tag": "arrive5"})
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
print(f"film.json: {len(SHOTS)} shots, {len(LABELS)} labels, {len(film['captions'])} caption pages, end card {EC} s, {DUR} s; tc {TC:.4f} s, Xcom {XCOM:.1f} cm")
for b in BEATS:
    print(f"  {b['id']:<9} {b['t0']:6.2f}–{b['t1']:6.2f}")
print(f"  rates: take1 1/{1/R1:.0f}, take2 1/{1/R2:.0f}, take3 1/{1/R3:.0f}, take4 1/{1/R4:.0f}, take5 1/{1/R5:.0f}")
