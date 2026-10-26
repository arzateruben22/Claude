"""Compile Rest Frame No. 002, "The swing's secret": script + voice timings + this direction → film.json (the
scene's clock: shots, the time warp, the takes, the cue table, camera keys, labels, badges, captions, end card)
and sheet.json (the studio's cue sheet). Nothing here is a hand-typed time: every moment hangs on a beat or a
spoken word, and every physical moment (a release, a bottom pass, the realignment, the twentieth swing) is
solved backwards from the word it must land on, through the exact pendulum and the clock.

  python3 -I films/channels/physics/ep02/compile.py

Anchors: "vo02:second" is when "second" starts in line vo02; "#2" the second match; "beat:why" a beat's start
(kits/cinema/script/timeline.py). Cuts sit half a frame before a beat's first frame, as in ep01.

The physics (set/swing.js, ported in set/bench_py.py): two identical 99.4 cm pendulums (the seconds pendulum),
released from rest at 10° (front lane, z = 0) and 30° (back lane, z = −40), exact large-angle motion, no air.
The whoa's fifteen pendulums are Harvard's design (51 … 65 back-and-forth swings in 60 s), all from 15°.
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
from bench_py import Clock, Pendulum, period_ratio, G   # noqa: E402
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
D2R = math.pi / 180


def cut(beat):
    return round(B[beat]["t0"] - HALF, 6)


# ── the swing set ───────────────────────────────────────────────────────────────────────────────
L, PIV_Y = 99.4, 116.0                                   # the seconds pendulum (c1); pivots 116 cm up
R_BOB = 4.6
LANE = {"small": 30.0, "big": -20.0}                     # z of each lane: the small swing in front, the big 50 cm behind
                                                         # (the cyc wall curves forward on the left: z −44 at x −50, so the rig stands forward)
TH = {"small": -10 * D2R, "big": -30 * D2R}              # both pulled to the left (−x), released toward +x
PEND = {k: Pendulum(L, TH[k], pivot=(0.0, PIV_Y, LANE[k])) for k in TH}
T10, T30 = PEND["small"].T, PEND["big"].T                # 2.00385 s, 2.03486 s (c2, c11)
Q10, Q30 = T10 / 4, T30 / 4                              # the bottom passes: 0.5010 s, 0.5087 s (c4)
DT, NG = 0.1, 11                                         # a ghost every 1/10 s: k = 0 … 10 (one swing)

# ── the pendulum wave (whoa): Harvard's fifteen, 51 … 65 back-and-forth swings in 60 s (c10) ────
WAVE_N, WAVE_TH, WAVE_Y, WAVE_DZ, WAVE_Z0 = 15, -15 * D2R, 62.0, -5.0, 30.0
WAVE_L = [round(G * (60.0 / (51 + n) / (2 * math.pi)) ** 2, 4) for n in range(WAVE_N)]   # 34.39 … 21.17 cm
WAVE_ALIGN = 60.0 * period_ratio(WAVE_TH)                # 15° lengthens every period alike: realigned at 60.26 s (c17)
WAVE_R = 1.7

# ── the clock and the takes, each solved back from its word ────────────────────────────────────
SLOW = 0.2                                               # ×1/5
FREEZE = 0.4                                             # → frozen (linear)
RAMP = 0.3                                               # ×1 → ×1/3 tape-stop (log)

# hook: frame 0 is both swings 0.32 s into the fall, just before the bottom; it freezes on the question
F_h = A("vo01:Big?", -0.1) - FREEZE
HOOK_END = 0.485                                         # τ when the freeze completes: both just short of the bottom
SLOW_H = 0.1                                             # the hook runs at ×1/10
HOOK_TAU0 = HOOK_END - FREEZE * SLOW_H / 2 - SLOW_H * F_h
# normal: the small swing alone, released at ×1 so it arrives across on "second" (c2); then ×1/3 for the swing back
R_n = A("vo02:second") - T10 / 2
SLOW_N = 1 / 3
# change: both released together at ×1/5 on "go"; the small one passes the bottom on "neck" (c4)
R_c = A("vo03:neck") - Q10 / SLOW
assert A("vo03:Let") < R_c < A("vo03:three#2"), (A("vo03:Let"), R_c)
# why: held at release through Galileo and the pull; released at ×1/5 so the small one passes the bottom on "speed"
R_w = A("vo04:speed") - Q10 / SLOW
assert A("vo04:stronger.") + 0.3 < R_w < A("vo04:triple"), (R_w,)
# whoa: the fifteen released on the cut; ×1 → ×10 → ×1 (log ramps), so τ reaches the realignment exactly on "line"
W_R = cut("whoa") + 0.5
W_UP, W_DN, W_FAST = 1.2, 1.2, 10.0
W_LINE = A("vo05:line.")
_lr = (W_FAST - 1) / math.log(W_FAST)                    # a log ramp's area per second, 1 ↔ W_FAST
_plateau = (WAVE_ALIGN - (W_UP + W_DN) * _lr - 0.0) / W_FAST
W_UPT = W_R + 0.25                                       # ×1 for a quarter second after release, then up
W_DNT = W_LINE - W_DN                                    # the down-ramp ends on "line"
_plateau_avail = W_DNT - (W_UPT + W_UP)
# measure: both released on the cut at ×5; the small one completes its twentieth swing (back home) on "behind" (c11)
FAST_M = 5.0
TAU_20 = 10 * T10                                        # twenty one-way swings of the small one: 20.04 s
M_FRZ = 0.25                                             # ×5 → frozen over 0.25 s (linear): FAST_M · M_FRZ / 2 of τ passes
F_m = A("vo06:behind.") - M_FRZ
R_m = F_m - (TAU_20 - FAST_M * M_FRZ / 2) / FAST_M
assert cut("measure") + 0.1 < R_m < A("vo06:twenty"), (cut("measure"), R_m)

KEYS = [
    {"t": 0.0, "rate": SLOW_H, "badge": None},          # the hook's speed note is its own badge (film.json hookNote), bottom-left
    {"t": F_h, "rate": 0.0, "ramp": FREEZE, "badge": None},
    {"t": cut("normal"), "rate": 1.0},
    {"t": R_n + T10 / 2, "rate": SLOW_N, "ramp": RAMP},
    {"t": cut("change"), "rate": SLOW},
    {"t": cut("whoa"), "rate": 1.0},
    {"t": W_UPT, "rate": W_FAST, "ramp": W_UP},
    {"t": W_DNT, "rate": 1.0, "ramp": W_DN},
    {"t": cut("measure"), "rate": FAST_M},
    {"t": F_m, "rate": 0.0, "ramp": M_FRZ},
    {"t": cut("takeaway"), "rate": 1.0},
    {"t": cut("tease"), "rate": SLOW_H, "ramp": 0.4},
]
# the plateau is whatever fits between the ramps; check the realignment lands on "line" and adjust the release
clk = Clock(KEYS)
for _ in range(60):                                      # solve W_R (and so W_UPT) so τ(line) − τ(W_R) = WAVE_ALIGN
    got = clk.tau(W_LINE) - clk.tau(W_R)
    err = got - WAVE_ALIGN
    if abs(err) < 1e-9:
        break
    W_UPT += err / W_FAST                                # more τ than needed: start the fast part later
    W_R = W_UPT - 0.25
    KEYS[6]["t"] = W_UPT
    clk = Clock(KEYS)
assert cut("whoa") + 0.2 < W_R < A("vo05:fifteen,"), (cut("whoa"), W_R)

# the tease re-releases both so the film's last frame is frame 0's moment again (a seamless replay): at ×1/10,
# τ reaches the hook's frame-0 τ exactly at the film's end
R_t = DUR - HOOK_TAU0 / SLOW_H
assert cut("tease") + 0.4 < R_t < EC - 0.3, (cut("tease"), R_t, EC)
TAKES = {
    "hook": {"t0": -1e9, "t1": cut("normal"), "tauR": clk.tau(0.0) - HOOK_TAU0, "pend": ["small", "big"]},
    "normal": {"t0": cut("normal"), "t1": cut("change"), "tauR": clk.tau(R_n), "R": R_n, "pend": ["small"]},
    "change": {"t0": cut("change"), "t1": cut("why"), "tauR": clk.tau(R_c), "R": R_c, "pend": ["small", "big"]},
    "why": {"t0": cut("why"), "t1": cut("whoa"), "tauR": clk.tau(R_w), "R": R_w, "pend": ["small", "big"]},
    "wave": {"t0": cut("whoa"), "t1": cut("measure"), "tauR": clk.tau(W_R), "R": W_R, "pend": []},
    "measure": {"t0": cut("measure"), "t1": cut("tease"), "tauR": clk.tau(R_m), "R": R_m, "pend": ["small", "big"]},
    "loop": {"t0": cut("tease"), "t1": 1e9, "tauR": clk.tau(R_t), "R": R_t, "pend": ["small", "big"]},
}
# where each take's ghost ladders start (τ local) and when their stamps show
LADDER = {"hook": 0.0, "normal": T10 / 2, "change": 0.0, "why": 0.0, "loop": 0.0}
for name, tau0 in LADDER.items():
    tk = TAKES[name]
    tk["ladder"] = tau0
    tk["stamps"] = [round(clk.tOf(tk["tauR"] + tau0 + k * DT), 6) for k in range(NG)]
assert abs(clk.tau(DUR) - TAKES["loop"]["tauR"] - HOOK_TAU0) < 1e-9
assert TAKES["hook"]["stamps"][3] + 0.2 < 0 < TAKES["hook"]["stamps"][4], TAKES["hook"]["stamps"][:6]
for name in ("normal", "why"):                            # (the change cuts away mid-swing: its later ghosts never show)
    s = TAKES[name]["stamps"]
    assert TAKES[name]["t0"] < s[0] and s[-1] < TAKES[name]["t1"], (name, s[0], s[-1], TAKES[name]["t1"])


def at_tau(take, t):
    return clk.tau(t) - TAKES[take]["tauR"]


# moments the sound and labels hang on
BOTTOM = {"change": clk.tOf(TAKES["change"]["tauR"] + Q10), "why": clk.tOf(TAKES["why"]["tauR"] + Q10)}
BOTTOM_BIG = {k: clk.tOf(TAKES[k]["tauR"] + Q30) for k in ("change", "why")}
ARRIVE_N = clk.tOf(TAKES["normal"]["tauR"] + T10 / 2)
SWINGS = [round(clk.tOf(TAKES["measure"]["tauR"] + k * T10 / 2), 6) for k in range(1, 21)]
assert abs(SWINGS[-1] - A("vo06:behind.")) < 1e-6, (SWINGS[-1], A("vo06:behind."))
W_REAL = clk.tOf(TAKES["wave"]["tauR"] + WAVE_ALIGN)
assert abs(W_REAL - W_LINE) < 1e-4, (W_REAL, W_LINE)
LAG = 10 * (T30 - T10)                                   # 0.310 s (c11)
# the big one at the freeze: still climbing home, 0.31 s short
TH_BIG_F = PEND["big"].theta(TAU_20)

# ── cue table (film seconds) ───────────────────────────────────────────────────────────────────
CUTS = {b["id"]: (0.0 if b["id"] == "hook" else cut(b["id"])) for b in BEATS}
CUE = {
    "hook": {"freeze": [F_h, F_h + FREEZE]},
    "normal": {"R": R_n, "arrive": ARRIVE_N},
    "change": {"pull": [A("vo03:Pull"), A("vo03:farther.")], "R": R_c, "bottom": BOTTOM["change"]},
    # the speed arrows leave as their caption page ends ("nearly the same time." takes over: rule 8)
    "why": {"R": R_w, "bottom": BOTTOM["why"], "pull": A("vo04:pull"), "speed": A("vo04:triple#2"), "speedOut": A("vo04:nearly#3"), "rungs": A("vo04:same#2")},
    "whoa": {"R": W_R, "line": W_LINE},
    "measure": {"R": R_m, "freeze": F_m + M_FRZ, "swings": SWINGS, "counter": [cut("measure") + 0.3, cut("takeaway") - 0.3],
                "lit": [A("vo06:behind."), cut("takeaway") - 0.3]},
    "tease": {"out": A("vo08:Next:")},
    "cuts": CUTS,
}

# ── labels, badges ──────────────────────────────────────────────────────────────────────────────
# anchor: {"bob": [take, lane]} · {"ghost": [take, lane, k]} · {"string": lane, "u": 0–1 from the pivot} ·
# {"arrow": id} (its tip) · {"wave": n} (bob n of the fifteen) · {"point": [x, y, z]}
LABELS = [
    {"id": "hk-big", "text": "big swing", "color": "ghost", "t0": A("vo01:Big?"), "t1": cut("normal") - 0.4, "anchor": {"bob": ["hook", "big"]}, "side": -1, "fixed": True},
    {"id": "hk-small", "text": "small swing", "color": "ghost", "t0": A("vo01:small?"), "t1": cut("normal") - 0.4, "anchor": {"bob": ["hook", "small"]}, "side": 1, "fixed": True},
    {"id": "nm-len", "text": "99.4 cm", "color": "ghost", "t0": A("vo02:meter,"), "t1": A("vo02:One", -0.1), "anchor": {"string": "small", "u": 0.5}, "side": 1, "fixed": True, "v": "middle"},
    {"id": "nm-1s", "text": "1 s across", "color": "motion", "t0": A("vo02:second."), "t1": A("vo02:Ghosts", -0.1), "anchor": {"bob": ["normal", "small"]}, "side": -1, "fixed": True},
    {"id": "nm-apart", "text": "1/10 s apart", "color": "ghost", "t0": A("vo02:tenth"),   # on its word, after "1 s across" has faded (no crossfade overlap)
     "t1": cut("change"), "anchor": {"ghost": ["normal", "small", 9]}, "side": 1, "fixed": True},
    {"id": "ch-30", "text": "30°", "color": "ghost", "t0": A("vo03:farther."), "t1": cut("why"), "anchor": {"bob": ["change", "big"]}, "side": -1, "fixed": True},
    {"id": "ch-10", "text": "10°", "color": "ghost", "t0": A("vo03:Let"), "t1": cut("why"), "anchor": {"bob": ["change", "small"]}, "side": -1, "fixed": True},
    {"id": "wy-pull-big", "text": "pull ×2.9", "color": "force", "t0": A("vo04:pull"), "t1": R_w, "anchor": {"arrow": "wy-f-big"}, "side": 1, "fixed": True},
    {"id": "wy-pull-small", "text": "pull ×1", "color": "force", "t0": A("vo04:pull", 0.15), "t1": R_w, "anchor": {"arrow": "wy-f-small"}, "side": 1, "fixed": True},
    {"id": "wy-v-big", "text": "speed ×3", "color": "motion", "t0": A("vo04:triple#2"), "t1": CUE["why"]["speedOut"], "anchor": {"arrow": "wy-v-big"}, "side": 1, "fixed": True},
    {"id": "wy-v-small", "text": "speed ×1", "color": "motion", "t0": A("vo04:triple#2", 0.15), "t1": CUE["why"]["speedOut"], "anchor": {"arrow": "wy-v-small"}, "side": 1, "fixed": True},
    {"id": "wy-same", "text": "same moments", "color": "ghost", "t0": A("vo04:same#2"), "t1": cut("whoa"), "anchor": {"ghost": ["why", "big", 8]}, "side": 1, "fixed": True},
    {"id": "wo-15", "text": "15 lengths", "color": "ghost", "t0": A("vo05:shorter."), "t1": A("vo05:For", -0.1), "anchor": {"wave": 7}, "side": 1, "fixed": True},
    {"id": "wo-line", "text": "in line", "color": "ghost", "t0": W_LINE, "t1": cut("measure") - 0.3, "anchor": {"wave": 0}, "side": 1, "fixed": True},
    {"id": "ms-home", "text": "home", "color": "motion", "t0": A("vo06:behind."), "t1": cut("takeaway") - 0.3, "anchor": {"bob": ["measure", "small"]}, "side": 1, "fixed": True},
    {"id": "ms-behind", "text": "0.31 s behind", "color": "energy", "t0": A("vo06:behind.", 0.12), "t1": cut("takeaway") - 0.3, "anchor": {"bob": ["measure", "big"]}, "side": -1, "fixed": True},
    {"id": "tk-len", "text": "same length", "color": "ghost", "t0": A("vo07:Length"), "t1": A("vo07:A", -0.1), "anchor": {"string": "small", "u": 0.45}, "side": 1, "fixed": True, "v": "middle"},
    {"id": "tk-fast", "text": "faster, not quite enough", "color": "motion", "t0": A("vo07:almost"), "t1": cut("tease") - 0.2, "anchor": {"bob": ["measure", "big"]}, "side": 1, "fixed": True},
]
# Notes (WRITING.md, "The picture" 8): the speed column top-left, the standing cheats and cards top-right, at most two
# in a top corner at once; a framing tag (one that names the picture) visits for 4 s at most. The hook's speed note is
# the one exception to the speed column: through the hook the title drop owns the top band (at frame 0 the falling
# title's first line spans y ≈ 256–350 px from the safe line, exactly where a top-left note would sit), so the
# hook's note sits bottom-left, clear of the small bob (in the old bottom-right spot the bob's lower edge reached
# the note from about 1 s on).
# Cards are narrowed to 0.52 of the safe width (421 px: "Ideal pendulums" still fits its heading line) so the
# spine plate on the left and a card on the right never meet.
NOTE_SLOT = {"speed": "tl", "hook": "bl"}
CARD_W = 0.52
BADGES = [
    {"id": "galileo", "title": "Galileo's claim", "text": "Wide or narrow, every swing takes the same time.", "t0": A("vo04:Galileo"), "t1": A("vo04:Three", -0.2), "slot": "tr", "maxW": CARD_W},
    # a framing tag: it names the picture, so it visits from "Only" for 3.7 s (4.0 s with its fade), leaving as "Then," begins
    {"id": "harvard", "text": "Harvard's pendulum wave", "t0": A("vo05:Only"), "t1": min(A("vo05:Then,"), A("vo05:Only") + 3.7), "slot": "tr", "frame": True},   # a framing tag: 4 s at most
    # the number behind "about one part in sixty", from the start of its sentence ("At thirty degrees") to the takeaway
    {"id": "1in57", "text": "30° swing: 1.7% slower", "t0": A("vo06:At"), "t1": cut("takeaway") - 0.3, "slot": "tr"},
    {"id": "ideal", "title": "Ideal pendulums", "text": "No air, no friction.", "t0": cut("takeaway") + 0.8, "t1": cut("tease"), "slot": "tr", "maxW": CARD_W},
]
NOTE_OUT = 0.3                                            # hud.js: a note takes 0.3 s to leave after its t1


def speed_windows(keys):
    """the clock's speed note (one element in the speed slot) is up wherever a key's badge text is not None (clock.js)"""
    out = []
    for i, k in enumerate(keys):
        text = k["badge"] if "badge" in k else (None if abs(k["rate"] - 1) < 1e-12 else "on")
        if text is not None:
            out.append((k["t"], keys[i + 1]["t"] if i + 1 < len(keys) else math.inf))
    return out


_corner = {"tl": [], "tr": []}
_corner[NOTE_SLOT["speed"]] += speed_windows(KEYS)
for bd in BADGES:
    if bd["slot"] in _corner:
        _corner[bd["slot"]].append((bd["t0"], bd["t1"]))
    if bd.get("frame"):
        assert bd["t1"] + NOTE_OUT - bd["t0"] <= 4.0 + 1e-9, ("a framing tag visits for 4 s at most", bd["id"])
for _slot, _wins in _corner.items():
    _peak = max(sum(1 for a, b in _wins if a <= i / FPS < b + NOTE_OUT) for i in range(int(DUR * FPS) + 1))
    assert _peak <= 2, ("at most two notes in a top corner", _slot, _peak)

# ── the spine readout: one number on screen from the normal to the end card; its label names the beat ──
# kind "watch": scene seconds since a take's release, capped; "const": a fixed value; "count": swings passed (cue.measure.swings)
# From "behind." it holds its final value, lit, to the end, and its label changes to say what 0.31 s now means
# (rule 2), always with its base, so the number stays true (c11: the 30° swing's lag on the 10° one over twenty
# swings): the big one's lag; on "At thirty degrees", that lag named as the 30° swing's over twenty swings (the
# 1.7% against the small-swing ideal is the top-right note's, c12); on "A wider swing", what it lost in them.
SPINE = [
    {"t0": cut("normal") + 0.3, "t1": cut("change"), "label": "one swing", "unit": "s", "dp": 2, "kind": "watch", "take": "normal", "cap": T10 / 2},
    {"t0": cut("change"), "t1": A("vo04:pull"), "label": "to the bottom", "unit": "s", "dp": 2, "kind": "watch", "take": "change", "cap": Q10},
    {"t0": A("vo04:pull"), "t1": A("vo04:triple#2"), "label": "pull, big ÷ small", "unit": "×", "dp": 2, "kind": "const", "v": math.sin(30 * D2R) / math.sin(10 * D2R)},
    {"t0": A("vo04:triple#2"), "t1": cut("whoa"), "label": "speed, big ÷ small", "unit": "×", "dp": 2, "kind": "const", "v": math.sin(15 * D2R) / math.sin(5 * D2R)},
    {"t0": cut("whoa"), "t1": cut("measure"), "label": "the wave's minute", "unit": "s", "dp": 1, "kind": "watch", "take": "wave", "cap": WAVE_ALIGN},
    {"t0": cut("measure"), "t1": A("vo06:behind."), "label": "swings, small one", "unit": "", "dp": 0, "kind": "count"},
    {"t0": A("vo06:behind."), "t1": A("vo06:At"), "label": "big one, behind", "unit": "s", "dp": 2, "kind": "const", "v": LAG, "lit": True},
    {"t0": A("vo06:At"), "t1": A("vo07:A"), "label": "30° lag, 20 swings", "unit": "s", "dp": 2, "kind": "const", "v": LAG, "lit": True},
    {"t0": A("vo07:A"), "t1": cut("tease") - 0.3, "label": "lost in 20 swings", "unit": "s", "dp": 2, "kind": "const", "v": LAG, "lit": True},
]
for a, b in zip(SPINE, SPINE[1:]):
    assert abs(a["t1"] - b["t0"]) < 1e-9, (a["label"], b["label"])
assert all(len(s["label"]) <= 18 for s in SPINE)                # one line under the 34vmin wrap: a narrow plate

# Where the spine plate sits (centre fractions; placeSpine clamps the plate into the safe box, so fx 0 puts its left
# edge on the safe line and fx 1 its right edge). Every shot hangs its subject from the frame's centre line (the
# pivots at x 0.5, the strings fanning ±30° below them; the wave's row at x 0.40–0.60), so the centred default would
# sit on the strings, and a plate 0.32 W wide on either side reaches the 30° string at about y 0.27. The empty side
# is the one the swings are not on, so the place steps with them, on a cut or where the plate's own label and value
# change. Measured by projecting the strings and bobs, beam, arm, post, ghosts, the clock drawing and the wave rig
# frame by frame through the camera keys against the plate (an 8 px margin; overlap with the subject per shot):
#   normal  [0.28, 0.28]: x 0.12–0.44, y 0.23–0.33, below the gantry's arm, left of the strings and of the clock
#           (0.4 s, while the camera pulls out to the clock and back)
#   change and the why's hold [1, 0.38] (x 0.52–0.83, y 0.33–0.43): the big one is pulled out and held on the
#           left, so the right is empty until they swing over at the change's end (1.4 s, after "neck and neck")
#   from "triple" #2 (the speed page, its label and value change) [0, 0.26] (x 0.08–0.40, y 0.21–0.31): the swings
#           are on their way right; the wave never reaches it (why 0 s, measure 1.3 s in flicks at ×5)
#   from "Length" (the takeaway's first word, once the measure's "paused" note has left the top-left corner) [0, 0.19]
#           (y 0.14–0.24): the takeaway runs at ×1, so that corner is empty, and up there the 30° string's left
#           turns pass below the plate (takeaway 0.3 s, from the cut to "Length"; 1.8 s at [0, 0.26]). It covers the
#           gantry's arm there (y 0.17–0.18), the set rather than the subject; the 'Ideal pendulums' card stays right of it.
SPINE_AT = [[cut("normal"), [0.28, 0.28]], [cut("change"), [1.0, 0.38]], [A("vo04:triple#2"), [0.0, 0.26]],
            [A("vo07:Length"), [0.0, 0.19]]]
_steps = set(CUTS.values()) | {s["t0"] for s in SPINE} | {A("vo07:Length")}
assert all(k in _steps for k, _ in SPINE_AT) and SPINE_AT[0][0] <= SPINE[0]["t0"], SPINE_AT   # on cuts, label changes or a beat's first word
assert all(a[0] < b[0] for a, b in zip(SPINE_AT, SPINE_AT[1:])), SPINE_AT
assert A("vo07:Length") >= cut("takeaway") + NOTE_OUT, "the plate moves up only once the measure's speed note has left"
# up in the top-left corner from "Length", the plate meets no speed note: the tease's arrives as the plate leaves
assert all(not (a < SPINE[-1]["t1"] and b + NOTE_OUT > A("vo07:Length")) for a, b in speed_windows(KEYS)), speed_windows(KEYS)

# ── rule 8, "One line wins": the line or object the caption names is the brightest thing in the picture; whatever
# delivered the previous beat drops to about a third of its strength as the new one begins (eased over 0.5 s from
# the cut or the word). Per element, [[t, k], ...] for keyed(): k is the opacity of a lane's bob and string, or a
# factor on the clock drawing's own draw-on. The ghost ladders, labels, arrows and cards already leave at their
# cuts and page changes (each take's ladder lives cut to cut), so only what stays in frame needs a dim.
# The opacity blends in scene-linear light, before the finish's ACES, which squeezes the pale end: on the cyc
# (L* 90) opacity 0.33 leaves a brass bob (L* 40) at L* 85, a tenth of its contrast. Through the curve 0.70 is a
# third (brass L* 73, the ink-2 clock 0.31, the ink string 0.29), and 0.50 is a sixth (brass L* 81), under the pale
# ghost beads (L* 79, about a fifth): the live bobs drop to it on the pages that name the ghosts or the rungs.
DIM_LANE, DIM_UNDER, DIM_EASE = 0.70, 0.50, 0.5


def dimkeys(steps, k0=1.0):
    keys, k = [[0.0, k0]], k0
    for t, v in steps:
        assert t >= keys[-1][0] + DIM_EASE - 1e-9, ("dim steps closer than their ease", t, keys[-1])
        keys += [[round(t, 4), k], [round(t + DIM_EASE, 4), v]]
        k = v
    return keys


# Both lanes, on the pages that name a trace of the swing rather than the swing: "Ghosts every tenth of a second"
# (the normal's ladder; the hanging big one is in frame behind it), "So it covers triple the path" (the why's
# ladders), back for "at nearly triple the speed" (the speed arrows ride on the bobs), and under again for "nearly
# the same time." (the ink rungs), to the whoa's cut (the swing set is out of shot there, so the measure opens at full)
UNDER_WHY = [(A("vo04:So"), DIM_UNDER), (A("vo04:at"), 1.0), (A("vo04:nearly#3"), DIM_UNDER), (cut("whoa"), 1.0)]
DIMS = {
    # the big one: hangs at rest through the normal (the small string is named), under its ghosts, named again on
    # "Pull its twin"; drops for "For small swings, he was nearly right" and is back for "Three times farther out"
    "big": dimkeys([(cut("normal"), DIM_LANE), (A("vo02:Ghosts"), DIM_UNDER), (cut("change"), 1.0),
                    (A("vo04:For"), DIM_LANE), (A("vo04:Three"), 1.0)] + UNDER_WHY),
    # the small one: under its ghosts, then a third while its twin is pulled out (it delivered the normal), back on
    # "Let both go"; drops for "and the big one is three tenths of a second behind" (its "home" label still marks
    # it), back for "Length sets the beat" (both strings), drops again for "A wider swing…", back for the tease
    "small": dimkeys([(A("vo02:Ghosts"), DIM_UNDER), (cut("change"), DIM_LANE), (A("vo03:Let"), 1.0)] + UNDER_WHY
                     + [(A("vo06:big"), DIM_LANE), (cut("takeaway"), 1.0), (A("vo07:A"), DIM_LANE), (cut("tease"), 1.0)]),
    # the grandfather clock delivered "as in a grandfather clock": it drops as "One swing: about one second" begins
    "gclock": dimkeys([(A("vo02:One"), DIM_LANE)]),
}
for k in ("big", "small"):                                # the loop: by the film's end both are back at frame 0's state
    assert DIMS[k][0][1] == 1.0 and DIMS[k][-1][1] == 1.0 and DIMS[k][-1][0] < DUR, (k, DIMS[k][-1])
assert A("vo04:triple#2") < CUE["why"]["speedOut"] < A("vo04:same#2"), CUE["why"]
# "as in a grandfather clock": a 2 m long-case clock drawn in ink beside the rig, its 99.4 cm pendulum swinging with the small one
CLOCK = {"x": 90.0, "z": -30.0, "h": 212.0, "w": 50.0, "pivotY": 168.0, "t0": A("vo02:as", -0.2), "t1": A("vo02:Ghosts", -0.2)}

# ── camera: orbit keys per shot (yaw 0 = the measure view, looking along −z; pitch > 0 looks down) ─
def cam(look, dist, yaw=0.0, pitch=14.0, fov=32.0):
    return {"look": [round(v, 3) for v in look], "dist": round(dist, 2), "yaw": yaw, "pitch": pitch, "fov": fov}


def key(t, v, ease="p2", **over):
    return {"t": round(t, 4), **v, **over, "ease": ease}


SET = cam([0.0, 29.0, 5.0], 492.0, pitch=20.0)          # both lanes: pivots at y 338 px, the front bottom at 1129 px
SMALL = cam([0.0, 34.0, 30.0], 516.0, pitch=10.0)          # the front swing alone
WIDE = cam([25.0, 43.0, 5.0], 924.0, pitch=10.0)        # the rig beside a 2 m grandfather clock (the human-scale anchor)
HOOK = cam([-14.0, 15.0, 5.0], 324.0, pitch=30.0)       # looking down on both bottoms: the strings run up the right, clear of the title
WAVE_END = cam([0.0, 32.0, -5.0], 300.0, yaw=0.0, pitch=4.0)
WAVE_TOP = cam([0.0, -3.0, -5.0], 352.0, yaw=0.0, pitch=55.0)   # the row from y 267 (far) to 1079 px (near)
CAM = {
    "hook": [key(0.0, HOOK), key(cut("normal"), {**HOOK, "dist": 262.0}, "sine")],
    "normal": [key(cut("normal"), {**HOOK, "dist": 262.0}), key(A("vo02:Each"), SMALL, "p3"), key(A("vo02:as"), SMALL, "sine"),
               key(A("vo02:clock.", 0.2), WIDE, "p3"), key(A("vo02:One", 0.1), WIDE, "sine"), key(A("vo02:about"), SMALL, "p3"),
               key(cut("change"), {**SMALL, "dist": 505.0}, "sine")],
    "change": [key(cut("change"), {**SMALL, "dist": 505.0}), key(A("vo03:farther."), SET, "p3"), key(cut("why"), {**SET, "dist": 486.0}, "sine")],
    "why": [key(cut("why"), {**SET, "dist": 486.0}), key(A("vo04:So"), {**SET, "dist": 476.0}, "sine"), key(cut("whoa"), {**SET, "dist": 470.0}, "sine")],
    # a cut on the section's sound, then the turn: end-on (fifteen look like one), craning up over the row
    "whoa": [key(cut("whoa"), WAVE_END), key(A("vo05:hang"), WAVE_END, "sine"), key(A("vo05:Only"), WAVE_TOP, "p3"), key(cut("measure"), {**WAVE_TOP, "dist": 345.0}, "sine")],
    "measure": [key(cut("measure"), SET), key(cut("takeaway"), {**SET, "dist": 482.0}, "sine")],
    "takeaway": [key(cut("takeaway"), {**SET, "dist": 482.0}), key(cut("tease"), {**SET, "dist": 470.0}, "sine")],
    # the tease eases back to the hook's framing, so the last frame hands back to frame 0
    "tease": [key(cut("tease"), {**SET, "dist": 470.0}), key(EC, HOOK, "p3"), key(DUR, HOOK, "sine")],
}
SHOTS = [{"at": CUTS[b["id"]], "name": b["id"]} for b in BEATS]

TITLE = {"series": "Rest Frame · No. 002", "title": "The swing's *secret*", "t1": round(cut("normal") - 0.45, 4), "y": 0.183, "sig": 0.3}
# caption pages the phrase pager can't break well on its own (set/captions_py.py: ' / ' row, ' | ' page)
CAP_FIX = [
    'Ghosts every tenth / of a second | bunch up at the turns.',
    'Pull its twin / three times farther.',
    'Three times farther out, | the pull is almost / three times stronger.',
    'Measure it: / twenty swings, | and the big one | is three tenths / of a second behind.',
    'At thirty degrees, / Galileo is off | by about / one part in sixty.',
]

film = {
    "id": "rest-frame-002", "fps": FPS, "bpm": BPM, "dur": DUR, "poster": 0.0,
    "_doc": "Compiled by compile.py from script.md, vo/ and the direction in compile.py. Do not edit by hand.",
    "shots": SHOTS, "beats": BEATS, "clock": KEYS, "takes": TAKES, "cue": CUE,
    "swing": {"L": L, "pivotY": PIV_Y, "r": R_BOB, "lanes": LANE, "theta": TH, "dt": DT, "n": NG, "T": {"small": T10, "big": T30}, "thetaBigFreeze": TH_BIG_F},
    "wave": {"z0": WAVE_Z0, "n": WAVE_N, "L": WAVE_L, "theta": WAVE_TH, "y": WAVE_Y, "dz": WAVE_DZ, "r": WAVE_R, "align": WAVE_ALIGN},
    "labels": LABELS, "badges": BADGES, "hookNote": {"slow": [0.0, F_h], "paused": [F_h, cut("normal")]}, "noteSlots": NOTE_SLOT,
    "cam": CAM, "spine": SPINE, "spineAt": SPINE_AT, "dim": DIMS, "gclock": CLOCK,
    "captionY": 0.632, "title": TITLE,
    "captions": phrase_captions(f, max_chars=24, fix=CAP_FIX, until=EC - 0.3), "endCard": EC,
    "end": {"title": "Next drop: where does the bounce *go*?", "follow": "Follow Rest Frame",
            "foot": "Huygens built the first pendulum clock in 1656. It kept time to about a minute a day."},
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}

# ── the studio's cue sheet ─────────────────────────────────────────────────────────────────────
ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS]
for t, tag in ((F_h + FREEZE, "hook:freeze"), (ARRIVE_N + RAMP, "normal:slow"), (F_m + M_FRZ, "measure:freeze")):
    ev.append({"t": round(t, 4), "kind": "time.slow", "tag": tag})
ev.append({"t": round(W_UPT + W_UP, 4), "kind": "time.normal", "tag": "whoa:fast"})
ev.append({"t": round(W_LINE, 4), "kind": "time.slow", "tag": "whoa:normal"})
for take, R in (("normal", R_n), ("change", R_c), ("why", R_w), ("wave", W_R), ("measure", R_m)):
    ev.append({"t": round(R, 4), "kind": "contact", "tag": f"{take}:release", "pos": [0.5, 0.35]})
# the bottom passes, panned with the bob: a soft tick, both swings (2 frames apart: neck and neck)
for take in ("change", "why"):
    ev.append({"t": round(BOTTOM[take], 4), "kind": "counter.tick", "tag": f"{take}:bottom-small"})
    ev.append({"t": round(BOTTOM_BIG[take], 4), "kind": "counter.tick", "tag": f"{take}:bottom-big"})
ev.append({"t": round(ARRIVE_N, 4), "kind": "contact", "tag": "normal:arrive", "pos": [0.62, 0.55]})
for take, tk in TAKES.items():
    for k, t in enumerate(tk.get("stamps", [])):
        if math.isfinite(t) and 0.05 < t < tk["t1"]:
            ev.append({"t": round(t, 4), "kind": "strobe", "tag": f"{take}:g{k}"})
for lb in LABELS:
    ev.append({"t": lb["t0"], "kind": "label", "tag": lb["id"]})
for bd in BADGES:
    ev.append({"t": round(bd["t0"], 4), "kind": "badge", "tag": bd["id"], "text": bd["text"]})
for i, t in enumerate(SWINGS):
    ev.append({"t": t, "kind": "counter.end" if i == 19 else "counter.tick", "tag": f"swing{i + 1}"})
ev.append({"t": SPINE[0]["t0"], "kind": "counter.show", "tag": "spine"})
ev.append({"t": TITLE["sig"], "kind": "signature", "tag": "title", "gain": -4.0})
ev.append({"t": EC, "kind": "signature", "tag": "end"})
ev.append({"t": W_LINE, "kind": "reveal", "tag": "in-line"})
ev.append({"t": A("vo04:same#2"), "kind": "reveal", "tag": "same-moments"})
ev.append({"t": round(A("vo05:hang"), 4), "kind": "swell", "tag": "whoa:turn"})

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
    if isinstance(x, list):
        return [finite(v) for v in x]
    return x


(HERE / "film.json").write_text(json.dumps(finite(film), indent=1, ensure_ascii=False, allow_nan=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
print(f"film.json: {len(SHOTS)} shots, {len(KEYS)} clock keys, {len(TAKES)} takes, {sum(len(v) for v in CAM.values())} camera keys, "
      f"{len(LABELS)} labels, {len(BADGES)} badges, {len(film['captions'])} caption pages, end card {EC} s, {DUR} s")
print(f"sheet.json: {len(sheet['events'])} events ({'with' if shown else 'without'} the page's cue measurements), {len(sheet['voice'])} voice lines")
for b in BEATS:
    print(f"  {b['id']:<9} {b['t0']:6.2f}–{b['t1']:6.2f}  line {b['line']}  cut {CUTS[b['id']]:.4f}")
print(f"  periods: 10° {T10:.5f} s, 30° {T30:.5f} s; lag after 20 swings {LAG:.4f} s; big one at the freeze {TH_BIG_F / D2R:.2f}°")
print(f"  releases: normal {R_n:.3f} (arrives {ARRIVE_N:.3f}), change {R_c:.3f} (bottom {BOTTOM['change']:.3f}/{BOTTOM_BIG['change']:.3f}), "
      f"why {R_w:.3f} (bottom {BOTTOM['why']:.3f}), wave {W_R:.3f} (fast {W_UPT:.3f}–{W_DNT:.3f}, aligned {W_REAL:.3f}), measure {R_m:.3f} (freeze {F_m:.3f})")
print(f"  wave lengths {WAVE_L[0]}…{WAVE_L[-1]} cm, realign τ {WAVE_ALIGN:.3f} s")
