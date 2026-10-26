"""Compile Rest Frame No. 004, "The hammer and the feather": script + voice timings + this direction → film.json and
sheet.json, as in episodes 1–3. Every moment hangs on a beat or a spoken word; every landing is solved back through
the closed-form fall and the clock.

  python3 -I films/channels/physics/ep04/compile.py

The physics: a hammer and a feather released from rest with their lowest points 160 cm up (Apollo 15's "approximately
1.6 m"). On the Moon (g = 162 cm/s², NASA's fact sheet) both fall the 160 cm in √(2·160/162) = 1.405 s, together.
On Earth (981 cm/s²) the hammer lands in 0.571 s (no air for the hammer: its drag over 1.6 m is far under a frame);
the feather's drift is an illustration (badged): it falls freely to 100 cm/s, then sinks at that speed, swaying.
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
from bench_py import Clock   # noqa: E402
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


G_E, G_M, H0 = 981.0, 162.0, 160.0
T_E = math.sqrt(2 * H0 / G_E)                            # 0.571 s (c1)
T_M = math.sqrt(2 * H0 / G_M)                            # 1.405 s (c11)
VT = 100.0                                               # the feather's illustrated sinking speed on Earth (cm/s; published figures 0.5–1 m/s)
XH, XF = 16.0, -16.0                                     # the hammer right, the feather left
DT, NG = 0.1, 15                                         # Moon ghosts every 1/10 s: k 0 … 14 (τ 1.4)
DT_E, NG_E = 0.05, 12                                    # Earth ghosts every 1/20 s: the hammer's 0.55 s

# ── the clock ──────────────────────────────────────────────────────────────────────────────────
SLOW_H, FREEZE = 0.1, 0.4
F_h = A("vo01:feather?") - FREEZE                        # the hook (Moon, ×1/10) freezes as the question ends
HOOK_END = 0.95                                          # … 0.95 s into the 1.405 s fall: two thirds down, rows level
HOOK_TAU0 = HOOK_END - FREEZE * SLOW_H / 2 - SLOW_H * F_h
SLOW_N = 0.25                                            # Earth at ×1/4: the hammer lands on "second."
R_n = A("vo02:second.") - T_E / SLOW_N
assert A("vo02:From") < R_n < A("vo02:the"), (R_n,)
F_n = A("vo02:second.") + 0.12                           # frozen just after the hammer lands: the feather still drifting
R_c = A("vo03:together.") - T_M                          # the Moon in real time: both land on "together."
assert A("vo03:dropped") - 0.1 < R_c < A("vo03:both."), (R_c,)
SLOW_W = 0.5
R_w = A("vo04:tie.") - T_M / SLOW_W                      # the why: re-dropped at ×1/2, tying on "tie."
assert A("vo04:speed") < R_w < A("vo04:So"), (R_w,)
R_m = A("vo06:seconds.") - T_M                           # the measure: real time, landing on "seconds."
assert A("vo06:drop") - 0.2 < R_m < A("vo06:about"), (R_m,)

KEYS = [
    {"t": 0.0, "rate": SLOW_H, "badge": None},           # the hook's speed note is its own badge (film.json hookNote), bottom-right:
    {"t": F_h, "rate": 0.0, "ramp": FREEZE, "badge": None},   # the title drop owns the top through the hook (frame 0)
    {"t": cut("normal"), "rate": SLOW_N},
    {"t": F_n, "rate": 0.0, "ramp": 0.25},
    {"t": cut("change"), "rate": 1.0},
    {"t": cut("why"), "rate": 0.0, "badge": None},
    {"t": A("vo04:speed", -0.3), "rate": SLOW_W, "ramp": 0.3},
    {"t": cut("whoa"), "rate": 1.0},
    {"t": cut("takeaway"), "rate": 0.0, "badge": None},
    {"t": cut("tease"), "rate": SLOW_H, "ramp": 0.4},
]
clk = Clock(KEYS)
R_t = clk.tOf(clk.tau(DUR) - HOOK_TAU0)                  # the loop: released so the last frame is frame 0's moment
assert cut("tease") + 0.05 < R_t < EC, (R_t,)

TAKES = {
    "hook": {"t0": -1e9, "t1": cut("normal"), "tauR": clk.tau(0.0) - HOOK_TAU0, "world": "moon"},
    "earth": {"t0": cut("normal"), "t1": cut("change"), "tauR": clk.tau(R_n), "R": R_n, "world": "earth"},
    "moon": {"t0": cut("change"), "t1": cut("why"), "tauR": clk.tau(R_c), "R": R_c, "world": "moon"},
    "why": {"t0": cut("why"), "t1": cut("whoa"), "tauR": clk.tau(R_w), "R": R_w, "world": "moon"},
    "space": {"t0": cut("whoa"), "t1": cut("measure"), "tauR": 0.0, "world": "space"},
    "measure": {"t0": cut("measure"), "t1": cut("tease"), "tauR": clk.tau(R_m), "R": R_m, "world": "moon"},
    "loop": {"t0": cut("tease"), "t1": 1e9, "tauR": clk.tau(R_t), "R": R_t, "world": "moon"},
}
for name, tk in TAKES.items():
    if tk["world"] == "moon":
        tk["stamps"] = [round(clk.tOf(tk["tauR"] + k * DT), 6) for k in range(NG)]
    elif tk["world"] == "earth":
        tk["stamps"] = [round(clk.tOf(tk["tauR"] + k * DT_E), 6) for k in range(NG_E)]
assert abs(clk.tau(DUR) - TAKES["loop"]["tauR"] - HOOK_TAU0) < 1e-9
assert TAKES["hook"]["stamps"][5] + 0.2 < 0, TAKES["hook"]["stamps"][:8]
LAND = {k: clk.tOf(TAKES[k]["tauR"] + (T_E if TAKES[k]["world"] == "earth" else T_M)) for k in ("earth", "moon", "why", "measure")}
assert abs(LAND["moon"] - A("vo03:together.")) < 1e-6 and abs(LAND["measure"] - A("vo06:seconds.")) < 1e-6


def feather_drop_earth(tau):
    """cm fallen by the feather on Earth (illustration): free fall to VT, then a steady sink."""
    tc = VT / G_E
    if tau <= 0:
        return 0.0
    if tau < tc:
        return 0.5 * G_E * tau * tau
    return 0.5 * G_E * tc * tc + VT * (tau - tc)


FEATHER_AT_HAMMER_LANDING = feather_drop_earth(T_E)      # 52 cm of 160: "Still drifting down."

# ── the spine (WRITING.md "The picture" 2) ──────────────────────────────────────────────────────
# One number from the normal to the tease; its label names the beat. The whoa's "< 5" lights when it is said ("billion.");
# the measure's stopwatch lights on "seconds." and stays lit from there: the Moon's 1.41 s, the Earth's 0.57 s on "On
# Earth", then held at 0.57 through the takeaway with a label that says what it now means (both of them, on Earth, once
# the air is gone: c12 + c13 + c14). It never leaves at the payoff (it goes 0.3 s before the tease).
# Its width (measured on the animatic's plates: a one-line label is as wide as its text, but a wrapped label's box takes
# the whole wrap width, 34vmin = 367 px by default, so any wrapped label made a 415 px plate). The bench leaves 372 px
# left of the feather (x 90–462), so each step sets its own wrap ("wrap", vmin; the scene sets the label's max-width):
# 26vmin keeps the plates at about 333 px, the why's 28vmin keeps "acceleration (m/s²)" on one line, the whoa's 19vmin
# keeps its plate about 255 px wide, clear of the ink orbit at the top left while the camera pushes in. The why's
# acceleration carries its unit in the label: "1.62 m/s²" in the row alone makes a 412 px plate. "< 5" keeps three
# figures' width (minCh 3).
SPINE = [
    {"t0": cut("normal") + 0.3, "t1": cut("change"), "label": "the hammer's fall, Earth", "unit": "s", "dp": 2, "kind": "watch", "take": "earth", "cap": T_E, "wrap": 26},
    {"t0": cut("change"), "t1": cut("why"), "label": "both, on the Moon", "unit": "s", "dp": 2, "kind": "watch", "take": "moon", "cap": T_M, "wrap": 26},
    {"t0": cut("why"), "t1": cut("whoa"), "label": "each one's acceleration (m/s²)", "unit": "", "dp": 2, "kind": "const", "v": 1.62, "wrap": 28},
    {"t0": cut("whoa"), "t1": cut("measure"), "label": "parts in a million billion", "unit": "", "kind": "text", "text": "< 5", "minCh": 3, "wrap": 19,
     "lit": [A("vo05:billion."), cut("measure")]},
    {"t0": cut("measure"), "t1": A("vo06:On#2"), "label": "the drop, Moon", "unit": "s", "dp": 2, "kind": "watch", "take": "measure", "cap": T_M, "wrap": 26,
     "lit": [A("vo06:seconds."), A("vo06:On#2")]},
    {"t0": A("vo06:On#2"), "t1": cut("takeaway"), "label": "the same drop, Earth", "unit": "s", "dp": 2, "kind": "const", "v": T_E, "wrap": 26,
     "lit": [A("vo06:On#2"), cut("takeaway")]},
    {"t0": cut("takeaway"), "t1": cut("tease") - 0.3, "label": "both, on Earth, without air", "unit": "s", "dp": 2, "kind": "const", "v": T_E, "wrap": 26,
     "lit": [cut("takeaway"), cut("tease") - 0.3], "tick": False},
]
assert all(a["t1"] == b["t0"] for a, b in zip(SPINE, SPINE[1:])), "the readout never leaves between its steps"
assert all(a["lit"][1] == b["lit"][0] for a, b in zip(SPINE[4:], SPINE[5:])), "lit from 'seconds.' through the takeaway, without a gap"
assert SPINE[-1]["t1"] > B["takeaway"]["t1"] - 0.5 and SPINE[-1]["v"] == SPINE[-2]["v"], "it holds its final value through the takeaway"

# Where it sits (set/spine.js placeSpine: [[t, [fx, fy]], ...] plate centres as fractions of the frame, a step at each
# cut, clamped inside the safe box x 90–900, y 250–1420). The corners hold the notes (speed top-left, cheats top-right).
# Projected through each shot's camera keys (placeCam) at every frame, start and end of each shot:
#   bench shots (normal from "From", change, why, measure, takeaway): the hands and the release at x 472–608, y 482–551,
#     the falls and their ghost rows x 469–636 down to the floor at y 1150 (the tipped hammer to x 697); so the centre
#     [0.5, 0.245] (plate y ≈ 362–578) sits on the hands: the plate goes left of the feather, x ≈ 104–436
#   normal, why                        L0 [0.25, 0.245] (y ≈ 362–578): under the speed note (to y ≈ 324). In the normal it
#     clears "still drifting" (an 81 px pill above the feather, y ≈ 686–767, from "down."), which L1 would cover; in the
#     why it sits above "pulled far harder" (a pill left of the hammer's pull arrow, below the feather)
#   change, measure, takeaway          L1 [0.25, 0.31] (y ≈ 487–703): under the change's card (x 403–900, to y ≈ 425),
#     which L0 would touch; no label is above y ≈ 1030 in these shots
#   whoa                               the top-left corner, x ≈ 90–345 (no speed note: real time): the ink orbit is
#     373–707 × 361–696 at the cut and grows to 235–845 × 565–1176 as the camera pushes in; the MICROSCOPE card is x 403–900
# The why's two arrow pills sit LEFT of their arrows: right of the hammer only ~290 px of the safe box remain, so a
# right-side pill (about 390 px at the label size) is clamped back over the arrow. "same speed-up" names the
# feather's arrow (its twin on the hammer is the same length), its pill left of the feather, clear of both arrows.
SPINE_L1, SPINE_L0, SPINE_TL = [0.25, 0.31], [0.25, 0.245], [0.0, 0.0]
SPINE_PLACE = {"hook": SPINE_L1, "normal": SPINE_L0, "change": SPINE_L1, "why": SPINE_L0, "whoa": SPINE_TL,
               "measure": SPINE_L1, "takeaway": SPINE_L1, "tease": SPINE_L1}
SPINE_AT = [[0.0 if b["id"] == "hook" else cut(b["id"]), SPINE_PLACE[b["id"]]] for b in BEATS]

# ── rule 8, one line wins (WRITING.md "The picture" 8) ─────────────────────────────────────────────
# The line or object the caption names is the brightest thing in the picture; whatever delivered the previous beat (or
# line) drops to about a third of its strength, eased over half a second from the cut or the word. Each table is
# [[t, strength], ...] for keyed() (cinema/film/runtime.js), 1 = as built, LOW = a third. "A third" is measured on
# screen: the scene lerps the displayed colour two-thirds of the way to the paper #E6E2D8 (in sRGB, after the ACES
# curve), so a stepped-back thing keeps a third of its contrast against the paper in the draft and in the finish alike:
# the ink and the arrows by their colour (unlit, through the ACES inverse), the lit props and the ghost rows in their
# shaders, the rungs by their colour. Every key is a cut or a spoken word; every table starts and ends at 1, so frame 0
# and the loop's last frame are as built.
LOW, FADE = 1 / 3, 0.5
T_FEATHER = A("vo02:feather")
# the why's arrows (scene.mjs reads them from CUE.why): the pull draws on "Gravity" and retracts on "harder" (arrows.js
# shrinks over 0.2 s); the acceleration draws 0.4 s after "harder" and retracts 0.4 s after the why's release
T_PULL_GONE = A("vo04:harder#2") + 0.2
T_ACC = [A("vo04:harder#2") + 0.4, R_w + 0.4]
# the Earth's rows, held at a third through the change ("Now take the air away ... dropped both"): the Earth's result
# (the hammer down, the feather still drifting) stands behind the Moon's setup until the Moon's release, where the new
# rows start in the same columns. Their own ladders (slots 32–63), copies of the Earth take's; the window ends on the
# half frame before the release's frame, as a take's does
HOLD = {"t0": cut("change"), "t1": (round(R_c * FPS) - 0.5) / FPS}
assert TAKES["moon"]["t0"] == HOLD["t0"] < HOLD["t1"] <= R_c, ("the held rows leave before the Moon's new rows start", HOLD)
DIM = {
    # the hammer and its ghost row (Earth): they delivered "the hammer lands in about half a second"; on "The feather?
    # Still drifting down." the feather and its row are what the caption names. The Moon's takes re-drop it at full (a cut)
    "hammer": [[0.0, 1], [T_FEATHER, 1], [T_FEATHER + FADE, LOW], [cut("change"), LOW], [cut("change"), 1]],
    # the Earth's rows held in the change (HOLD): the hammer's stays at the third it had; the feather's, which delivered
    # the normal's last line, steps back from the cut
    "earthRowH": [[0.0, 1], [HOLD["t0"], 1], [HOLD["t0"], LOW], [HOLD["t1"], LOW], [HOLD["t1"], 1]],
    "earthRowF": [[0.0, 1], [HOLD["t0"], 1], [HOLD["t0"] + FADE, LOW], [HOLD["t1"], LOW], [HOLD["t1"], 1]],
    # the ink hands: they released the Earth drop; from the change they hold and release as context, a third, except
    # where the caption names the drop by a person ("astronaut David Scott dropped both"). Full again in the tease: they
    # release the loop's drop, and the last frame is frame 0's
    "hands": [[0.0, 1], [cut("change"), 1], [cut("change") + FADE, LOW], [A("vo03:astronaut"), LOW], [A("vo03:astronaut") + FADE, 1],
              [A("vo03:They"), 1], [A("vo03:They") + FADE, LOW], [cut("tease"), LOW], [cut("tease") + FADE, 1]],
    # the why's pull arrows (cobalt, and their ink outline): they delivered "Gravity does pull the hammer harder"; "But a
    # heavier thing is harder to speed up" names the hammer and its inertia, so they step back on "But" until they have
    # retracted (the outline is shared by every arrow: back to 1 before the acceleration arrows draw)
    "pull": [[0.0, 1], [A("vo04:But"), 1], [A("vo04:But") + FADE, LOW], [T_PULL_GONE, LOW], [T_PULL_GONE, 1]],
    # the whoa's ink Earth: "a satellite let two metals fall" names the satellite (and its two metals, the accent), so
    # the Earth's heavy ring steps back; "around Earth for months" names it again; "They matched ... a million billion"
    # names the metals and the number (the readout lights on "billion.")
    "earthInk": [[0.0, 1], [A("vo05:satellite"), 1], [A("vo05:satellite") + FADE, LOW], [A("vo05:around"), LOW], [A("vo05:around") + FADE, 1],
                 [A("vo05:They"), 1], [A("vo05:They") + FADE, LOW], [cut("measure"), LOW], [cut("measure"), 1]],
    # the orbit: the satellite's path ("fall around Earth") until the metals and the number take over
    "orbitInk": [[0.0, 1], [A("vo05:They"), 1], [A("vo05:They") + FADE, LOW], [cut("measure"), LOW], [cut("measure"), 1]],
    # the measure's drop (both ghost rows, the rung, the hammer and the feather): it delivered "one point four seconds";
    # "On Earth, under six tenths" names the readout's Earth time. The takeaway holds on both rows, level ("Gravity speeds
    # them up equally"), so they are full again from its cut
    "drop": [[0.0, 1], [A("vo06:On#2"), 1], [A("vo06:On#2") + FADE, LOW], [cut("takeaway"), LOW], [cut("takeaway") + FADE, 1]],
}
for name, keys in DIM.items():
    assert keys[0] == [0.0, 1] and keys[-1][1] == 1 and keys[-1][0] < DUR, (name, "frame 0 and the loop's last frame are as built")
    assert all(a[0] <= b[0] for a, b in zip(keys, keys[1:])) and all(LOW - 1e-9 <= k <= 1 for _, k in keys), (name, keys)
assert TAKES["earth"]["t0"] < T_FEATHER and DIM["hammer"][-1][0] == TAKES["earth"]["t1"], "the hammer steps back only in the Earth take"
assert TAKES["measure"]["t0"] < A("vo06:On#2") and DIM["drop"][-1][0] + 1e-9 < TAKES["measure"]["t1"], "the drop steps back only in the measure take"
assert DIM["hammer"][-2][1] == DIM["earthRowH"][2][1] == LOW, "the held hammer row keeps the third it had at the cut"
assert A("vo04:Gravity") < A("vo04:But") < T_PULL_GONE <= T_ACC[0], "the pull steps back after its line, and is whole again before the acceleration draws"

CUTS = {b["id"]: (0.0 if b["id"] == "hook" else cut(b["id"])) for b in BEATS}
CUE = {
    "hook": {"freeze": [F_h, F_h + FREEZE]},
    "earth": {"R": R_n, "land": LAND["earth"]},
    "moon": {"R": R_c, "land": LAND["moon"], "fade": [A("vo03:Now"), A("vo03:away.", 0.3)]},
    "why": {"pull": A("vo04:Gravity"), "inertia": A("vo04:harder#2"), "acc": T_ACC, "R": R_w, "land": LAND["why"]},
    "whoa": {"orbit": cut("whoa")},
    "measure": {"R": R_m, "land": LAND["measure"]},
    "cuts": CUTS,
}
# Labels name what the caption names and are gone by their beat's cut (rule 8): hud.js fades a label out over 0.4 s
# after its t1, so a label that lasts to the end of its beat ends 0.4 s before the cut (its anchor is stale after it:
# "still drifting" would slide down the change's empty column, "together" and "tie" point at a reset floor). "0.57 s"
# leaves as the hammer steps back on "feather" (the readout keeps the 0.57); "Earth" names the Earth while the caption
# does. The pull's label lands as its arrow finishes drawing (0.3 s): riding the growing tip, it would cross the why's
# readout plate.
LABEL_OUT = 0.4
LABELS = [
    {"id": "hk-hammer", "text": "hammer", "color": "ghost", "t0": A("vo01:hammer,"), "t1": cut("normal") - 0.4, "anchor": {"obj": ["hook", "hammer"]}, "side": 1, "fixed": True},
    {"id": "hk-feather", "text": "feather", "color": "ghost", "t0": A("vo01:feather?"), "t1": cut("normal") - 0.4, "anchor": {"obj": ["hook", "feather"]}, "side": -1, "fixed": True},
    {"id": "nm-land", "text": "0.57 s", "color": "motion", "t0": A("vo02:second."), "t1": T_FEATHER, "anchor": {"obj": ["earth", "hammer"]}, "side": 1, "fixed": True},
    {"id": "nm-half", "text": "still drifting", "color": "ghost", "t0": A("vo02:Still"), "t1": cut("change") - LABEL_OUT, "anchor": {"obj": ["earth", "feather"]}, "side": -1, "fixed": True},
    {"id": "ch-together", "text": "together", "color": "motion", "t0": A("vo03:together."), "t1": cut("why") - LABEL_OUT, "anchor": {"point": [0.0, 4.0, 0.0]}, "side": 1, "fixed": True},
    {"id": "wy-pull", "text": "pulled far harder",   # on the hammer's pull arrow, its pill to the left (see the note above SPINE_L1)
     "color": "force", "t0": A("vo04:Gravity", 0.3), "t1": A("vo04:But", -0.1), "anchor": {"arrow": "pull-h"}, "side": -1, "fixed": True, "v": "middle"},
    {"id": "wy-acc", "text": "same speed-up", "color": "motion", "t0": A("vo04:harder#2", 0.4), "t1": R_w + 0.3, "anchor": {"arrow": "acc-f"}, "side": -1, "fixed": True, "v": "middle"},
    {"id": "wy-tie", "text": "tie", "color": "motion", "t0": A("vo04:tie."), "t1": cut("whoa") - LABEL_OUT, "anchor": {"point": [0.0, 4.0, 0.0]}, "side": 1, "fixed": True},
    {"id": "wo-earth", "text": "Earth", "color": "ghost", "t0": A("vo05:Earth"), "t1": A("vo05:They"), "anchor": {"point": [0.0, 190.0, -20.0]}, "side": 1, "v": "middle", "fixed": True},
]
NEXT_CUT = {a["id"]: cut(b["id"]) for a, b in zip(BEATS, BEATS[1:])}
for lb in LABELS:
    beat = next(b for b in BEATS if b["t0"] - HALF <= lb["t0"] < b["t1"] - HALF)
    assert lb["t0"] < lb["t1"] and lb["t1"] + LABEL_OUT <= NEXT_CUT.get(beat["id"], DUR) + 1e-9, (lb["id"], "a label is gone by its beat's cut")

# ── notes (rule 8's layout for Rest Frame) ─────────────────────────────────────────────────────
# The speed column top-left (the clock's note), the standing cheats top-right (model cards, "Not to scale",
# "Illustration"), at most two notes in a top corner at once; a framing tag (a note that names the picture, "framing")
# visits for 4 s at most; the spine readout sits between and below the corners. The hook's speed note is the one
# exception: bottom-right, because the title drop owns the top through the hook (frame 0's title falls through
# y ≈ 266–433, where a top-left note would sit on it), as in episodes 2, 3 and 5.
# The Moon card leaves before Scott's card arrives: stacked, the two cards would reach y ≈ 666 over the hands and the
# tops of the ghost rows (x 403–900), and the readout under them.
HOOK_NOTE = {"slot": "br", "slow": [0.0, F_h], "paused": [F_h, cut("normal")], "text": ["10× slower", "paused"]}
# The clock's note is drawn in two windows (hud.badge's own t0/t1 for a clock): the why's "2× slower" leaves 0.3 s before
# the whoa (the drop landed at 38.2 s), so the whoa's readout can take the empty top-left corner at the cut; the tease's
# "10× slower" is the second window. "Not to scale" names the arrows, so it stands from "Gravity" until the last of them
# retract; the drift's "Illustration" stands from the hammer's landing through the feather's line
WARP_WINDOWS = [[None, cut("whoa") - 0.3], [cut("tease"), None]]
assert abs(SLOW_H - 0.1) < 1e-12, "the hook note's text"
BADGES = [
    {"id": "drift", "text": "Illustration", "t0": A("vo02:second."), "t1": cut("change") - 0.3, "slot": "tr", "framing": True},   # the feather's drift: from the hammer's landing, through "The feather? Still drifting down."
    {"id": "moon", "title": "The Moon", "text": "Gravity 1.62 m/s², a sixth of Earth's. No air.", "t0": A("vo03:away."), "t1": A("vo03:\"Mister", -0.4), "slot": "tr"},
    {"id": "scott", "title": "David Scott, Apollo 15", "text": "\"Mr Galileo was correct in his findings.\"", "t0": A("vo03:\"Mister"), "t1": cut("why") - 0.3, "slot": "tr"},
    {"id": "notscale", "text": "Not to scale", "t0": A("vo04:Gravity"), "t1": T_ACC[1], "slot": "tr"},   # the arrows: it leaves as the last of them retract
    {"id": "orbit", "text": "Illustration", "t0": cut("whoa") + 0.5, "t1": cut("whoa") + 4.5, "slot": "tr", "framing": True},          # the ink Earth and orbit
    {"id": "microscope", "title": "MICROSCOPE", "text": "Satellite test, 2016–2018.", "t0": A("vo05:satellite"), "t1": cut("measure") - 0.3, "slot": "tr"},
]
CLOCK_WORDS = {"slow": "{n}× slower", "fast": "{n}× faster", "freeze": "paused"}   # scene.mjs's clock words


def rate_text(rate):                                     # kits/cinema/sci/clock.js rateText with CLOCK_WORDS
    if rate == 0:
        return CLOCK_WORDS["freeze"]
    if abs(rate - 1) < 1e-12:
        return None
    n = 1 / rate if rate < 1 else rate
    n = str(round(n)) if abs(n - round(n)) < 1e-9 else str(round(n, 2))
    return CLOCK_WORDS["slow" if rate < 1 else "fast"].replace("{n}", n)


CLOCK_NOTES = []                                         # clock.js C.badges: one per run of keys with the same wording
for i, k in enumerate(KEYS):
    text, t1 = (k["badge"] if "badge" in k else rate_text(k["rate"])), (KEYS[i + 1]["t"] if i + 1 < len(KEYS) else math.inf)
    if text is None:
        continue
    if CLOCK_NOTES and CLOCK_NOTES[-1]["t1"] == k["t"] and CLOCK_NOTES[-1]["text"] == text:
        CLOCK_NOTES[-1]["t1"] = t1
    else:
        CLOCK_NOTES.append({"text": text, "t0": k["t"], "t1": t1})


def in_windows(n):                                       # a clock note as its windows show it (scene.mjs: one badge per window)
    out = []
    for j, (w0, w1) in enumerate(WARP_WINDOWS):
        a, b = max(n["t0"], -math.inf if w0 is None else w0), min(n["t1"], math.inf if w1 is None else w1, EC)
        if a < b:
            out.append({"id": f"warp{j + 1}" if j else "warp", "t0": a, "t1": b})
    return out


NOTES = ([{"slot": "tl", "text": n["text"], "speed": True, **w} for n in CLOCK_NOTES for w in in_windows(n)]
         + [{"id": "hook-speed", "slot": HOOK_NOTE["slot"], "t0": 0.0, "t1": HOOK_NOTE["paused"][1], "text": " / ".join(HOOK_NOTE["text"]), "speed": True}]
         + [{**b, "speed": False} for b in BADGES])
assert [n["text"] for n in CLOCK_NOTES] == ["4× slower", "paused", "2× slower", "10× slower"], CLOCK_NOTES
assert all(n["slot"] == "tl" for n in NOTES if n["speed"] and n["id"] != "hook-speed"), "the speed column is top-left"
assert all(b["slot"] == "tr" for b in BADGES), "the standing cheats are top-right"
for n in NOTES:
    assert not n.get("framing") or n["t1"] - n["t0"] <= 4.0 + 1e-9, (n["id"], "a framing tag visits for 4 s at most")
for slot in ("tl", "tr"):                                # each note fades out over 0.3 s after its t1
    for fr in range(int(DUR * FPS) + 1):
        t = fr / FPS
        on = {n["id"] for n in NOTES if n["slot"] == slot and n["t0"] <= t < n["t1"] + 0.3}   # a clock's run is one note
        assert len(on) <= 2, (slot, t, on)
NB = {b["id"]: b for b in BADGES}
assert NB["notscale"]["t0"] == CUE["why"]["pull"] and NB["notscale"]["t1"] == CUE["why"]["acc"][1], "'Not to scale' stands while the arrows do"
assert LAND["earth"] - 1e-6 <= NB["drift"]["t0"] < T_FEATHER and NB["drift"]["t1"] + 0.3 <= cut("change"), "the drift's tag stands with the feather's line"
cards = [b for b in BADGES if b.get("title")]
assert not any(a["t0"] < b["t1"] + 0.3 and b["t0"] < a["t1"] + 0.3 for i, a in enumerate(cards) for b in cards[i + 1:]), "one card at a time"

# ── camera ─────────────────────────────────────────────────────────────────────────────────────
def view(cx, top_px=330.0, floor_px=1140.0, top=200.0, fov=32.0, pitch=0.0, z=0.0):
    fpx = 960 / math.tan(math.radians(fov / 2))
    ppc = (floor_px - top_px) / top
    return {"look": [round(cx, 3), round(top - (960 - top_px) / ppc, 3), z], "dist": round(fpx / ppc, 2), "yaw": 0.0, "pitch": pitch, "fov": fov}


def key(t, v, ease="p2", **over):
    return {"t": round(t, 4), **v, **over, "ease": ease}


BENCH = {"look": [0.0, 59.0, 0.0], "dist": 1020.0, "yaw": 0.0, "pitch": 9.0, "fov": 32.0}   # looking down a little (the regolith reads as ground); the hand at 0.27 H, under the spine readout, the floor at 0.6 H
HOOK = view(0.0, top_px=650.0, floor_px=1150.0, top=175.0, pitch=9.0)   # under the title
SPACE = {"look": [0.0, 175.0, -20.0], "dist": 560.0, "yaw": 0.0, "pitch": 0.0, "fov": 32.0}
CAM = {
    "hook": [key(0.0, HOOK), key(cut("normal"), {**HOOK, "dist": HOOK["dist"] + 10}, "sine")],
    "normal": [key(cut("normal"), {**HOOK, "dist": HOOK["dist"] + 10}), key(A("vo02:From"), BENCH, "p3"), key(cut("change"), {**BENCH, "dist": BENCH["dist"] - 8}, "sine")],
    "change": [key(cut("change"), {**BENCH, "dist": BENCH["dist"] - 8}), key(A("vo03:away."), {**BENCH, "pitch": 6.0}, "sine"), key(cut("why"), {**BENCH, "pitch": 6.0, "dist": BENCH["dist"] - 14}, "sine")],
    "why": [key(cut("why"), {**BENCH, "pitch": 6.0, "dist": BENCH["dist"] - 14}), key(cut("whoa"), {**BENCH, "pitch": 4.0, "dist": BENCH["dist"] - 4}, "sine")],
    "whoa": [key(cut("whoa"), {**BENCH, "pitch": 4.0, "dist": BENCH["dist"] - 4}), key(A("vo05:Starting"), SPACE, "p3"), key(cut("measure"), {**SPACE, "dist": 590.0}, "sine")],
    "measure": [key(cut("measure"), BENCH), key(cut("takeaway"), {**BENCH, "dist": BENCH["dist"] + 10}, "sine")],
    "takeaway": [key(cut("takeaway"), {**BENCH, "dist": BENCH["dist"] + 10}), key(cut("tease"), {**BENCH, "dist": BENCH["dist"] + 18}, "sine")],
    "tease": [key(cut("tease"), {**BENCH, "dist": BENCH["dist"] + 18}), key(EC, HOOK, "p3"), key(DUR, HOOK, "sine")],
}
SHOTS = [{"at": CUTS[b["id"]], "name": b["id"]} for b in BEATS]

TITLE = {"series": "Rest Frame · No. 004", "title": "The hammer and the *feather*", "t1": round(cut("normal") - 0.45, 4), "y": 0.183, "sig": 0.3}
# caption pages the phrase pager can't break well on its own (set/captions_py.py: ' / ' row, ' | ' page)
CAP_FIX = [
    'On the Moon, / in nineteen seventy-one, | astronaut David Scott / dropped both.',
    'For nearly / two thousand years, | most scholars / followed Aristotle: | heavier things fall faster.',
    'Starting in / twenty sixteen, | a satellite let / two metals fall | around Earth for months.',
    'They matched / to within | a few parts / in a million billion.',
    'Measure it: on the Moon, | that drop takes about / one point four seconds.',
    'Next: / a spinning office chair.',
]

film = {
    "id": "rest-frame-004", "fps": FPS, "bpm": BPM, "dur": DUR, "poster": 0.0,
    "_doc": "Compiled by compile.py from script.md, vo/ and the direction in compile.py. Do not edit by hand.",
    "shots": SHOTS, "beats": BEATS, "clock": KEYS, "takes": TAKES, "cue": CUE, "spine": SPINE, "spineAt": SPINE_AT, "dim": DIM, "hold": HOLD,
    "hookNote": HOOK_NOTE, "warpWindows": WARP_WINDOWS, "drop": {"gE": G_E, "gM": G_M, "h0": H0, "tE": T_E, "tM": T_M, "vt": VT, "xh": XH, "xf": XF, "dt": DT, "n": NG, "dtE": DT_E, "nE": NG_E},
    "labels": LABELS, "badges": BADGES, "cam": CAM,
    "captionY": 0.632, "title": TITLE,
    "captions": phrase_captions(f, max_chars=24, fix=CAP_FIX, until=EC - 0.3), "endCard": EC,
    "end": {"title": "Next drop: the spinning *chair*", "follow": "Follow Rest Frame",
            "foot": "The feather was a falcon's. Apollo 15's lunar module was named Falcon."},
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}

# vo01's "s" in "lands" (0.52 s into the line) is a near-Nyquist burst; mastered to -14 LUFS, the native AAC
# encoder rang on it to +3.1 dBTP (the WAV: -4.3). Half a decibel less on that line keeps the AAC under the gate.
VOICE_GAIN = {"vo01": -0.5}
ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS]
ev.append({"t": round(F_h + FREEZE, 4), "kind": "time.slow", "tag": "hook:freeze"})
ev.append({"t": round(F_n + 0.25, 4), "kind": "time.slow", "tag": "earth:freeze"})
for k, R in (("earth", R_n), ("moon", R_c), ("why", R_w), ("measure", R_m), ("loop", R_t)):
    ev.append({"t": round(R, 4), "kind": "contact", "tag": f"{k}:release"})
ev.append({"t": round(LAND["earth"], 4), "kind": "impact", "tag": "earth:hammer"})
for k in ("moon", "why", "measure"):
    ev.append({"t": round(LAND[k], 4), "kind": "bounce", "tag": f"{k}:both"})
ev.append({"t": round(CUE["moon"]["fade"][0], 4), "kind": "swell", "tag": "moon:arrive"})
ev.append({"t": A("vo03:together."), "kind": "reveal", "tag": "together"})
ev.append({"t": A("vo05:billion."), "kind": "reveal", "tag": "billion"})
for take, tk in TAKES.items():
    for k, t in enumerate(tk.get("stamps", [])):
        if math.isfinite(t) and 0.05 < t < tk["t1"] and (k % 3 == 0 if take == "moon" or take == "measure" else k % 2 == 0):
            ev.append({"t": round(t, 4), "kind": "strobe", "tag": f"{take}:g{k}"})
for lb in LABELS:
    ev.append({"t": lb["t0"], "kind": "label", "tag": lb["id"]})
for bd in BADGES:
    ev.append({"t": round(bd["t0"], 4), "kind": "badge", "tag": bd["id"], "text": bd["text"]})
ev.append({"t": SPINE[0]["t0"], "kind": "counter.show", "tag": "spine"})
for s in SPINE[1:]:
    if s.get("tick", True):                              # the takeaway's step changes the label only, not the number
        ev.append({"t": s["t0"], "kind": "counter.tick", "tag": "spine:" + s["label"].replace("²", "2")})   # the studio reads a tick's pitch from the tag's digits; ² is a digit int() can't read
ev.append({"t": A("vo06:seconds."), "kind": "counter.end", "tag": "spine:moon"})
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
         "voice": [{"id": v["id"], "t": v["t"], "file": v["file"], **({"gain": VOICE_GAIN[v["id"]]} if v["id"] in VOICE_GAIN else {})}
                   for v in film["voice"]]}
if shown:
    sheet["shown"] = shown


def finite(x):
    if isinstance(x, float) and not math.isfinite(x):
        return None
    if isinstance(x, dict):
        return {k: finite(v) for k, v in x.items()}
    if isinstance(x, list):
        return [finite(v) for v in x]
    return x


(HERE / "film.json").write_text(json.dumps(finite(film), indent=1, ensure_ascii=False, allow_nan=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
print(f"film.json: {len(SHOTS)} shots, {len(KEYS)} clock keys, {len(TAKES)} takes, {len(LABELS)} labels, {len(BADGES)} badges, end card {EC} s, {DUR} s")
print(f"sheet.json: {len(sheet['events'])} events ({'with' if shown else 'without'} the page's cue measurements)")
for b in BEATS:
    print(f"  {b['id']:<9} {b['t0']:6.2f}–{b['t1']:6.2f}  cut {CUTS[b['id']]:.4f}")
print("  rule 8: " + "; ".join(f"{k} " + " ".join(f"{t:.2f}:{v:.2f}" for t, v in ks[1:]) for k, ks in DIM.items()))
print(f"  held Earth rows: {HOLD['t0']:.3f}–{HOLD['t1']:.3f} (the Moon's release {R_c:.3f}); 'Not to scale' {NB['notscale']['t0']:.2f}–{NB['notscale']['t1']:.2f}; drift tag {NB['drift']['t0']:.2f}–{NB['drift']['t1']:.2f}")
print("  spine at: " + ", ".join(f"{t:.2f} {xy}" for t, xy in SPINE_AT))
print(f"  Earth: hammer {T_E:.3f} s, the feather {FEATHER_AT_HAMMER_LANDING:.1f} cm down then; Moon {T_M:.3f} s; lands {[(k, round(v, 3)) for k, v in LAND.items()]}; loop {R_t:.3f}")
