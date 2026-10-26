"""Compile Rest Frame No. 003, "Where does the bounce go?": script + voice timings + this direction → film.json and
sheet.json, as in episodes 1 and 2. Every moment hangs on a beat or a spoken word; every physical moment (a top, a
contact, the stacked hit, the tennis ball's peak) is solved backwards through the closed-form motion and the clock.

  python3 -I films/channels/physics/ep03/compile.py

The physics (set/bench.js; set/balls.js for the stack): a tennis ball dropped from 1 m (its bottom 100 cm up),
drifting sideways at 22 cm/s, bouncing with restitution 0.75 (each top 56.25% of the last; claims c1–c3). The change
looks at one contact slowed ×40 with a 5 ms squash (an illustration: the bench's bounces are instants). The whoa
drops a tennis ball resting on a basketball from 50 cm with perfect bounces (badged): it leaves at 2.65× its
landing speed and climbs 7.0× its fall.
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


# ── the bench: the single bounce (set/bench.js) ─────────────────────────────────────────────────
G, DROP, RB, E_REST = 981.0, 100.0, 3.35, 0.75
X0, VX = -22.0, 22.0                                     # released at x −22 under the hand, drifting right at 22 cm/s
T_LAND = math.sqrt(2 * DROP / G)                         # 0.4515 s


def tops(n=4):
    out, t, v = [], T_LAND, G * T_LAND
    for _ in range(n):
        v *= E_REST
        out.append(t + v / G)
        t += 2 * v / G
    return out


TOPS = tops()                                            # τ 0.790, 1.383, 1.827, 2.161
TOP_H = [DROP * E_REST ** (2 * (k + 1)) for k in range(4)]   # 56.25, 31.64, 17.80, 10.01 cm (c1, c2, c16)
DT, NG = 0.05, 37                                        # a ghost every 1/20 s through the third top (τ 1.80)
STICK_X = -44.0                                          # the meter stick stands left of the hand
DC, SQUASH = 0.005, 0.9                                  # the macro's contact: 5 ms, 0.9 cm deep (illustration, badged)

# ── the stack (set/balls.js): perfect bounces, basketball 0.6 kg, r 12 cm; tennis ball 0.057 kg ─────
S_DROP, S_R, S_M, S_m, S_X = 50.0, 12.0, 0.6, 0.057, 30.0
S_THIT = math.sqrt(2 * S_DROP / G)
S_V = G * S_THIT
S_U = (3 * S_M - S_m) / (S_M + S_m) * S_V                # 2.653 v (c9, c10)
S_PEAK_T = S_THIT + S_U / G
S_PEAK_Y = 2 * S_R + RB + S_U ** 2 / (2 * G)             # the tennis ball's centre at its peak: 377 cm
S_HAND_Y = S_DROP + 2 * S_R + 2 * RB                     # the hand that dropped the stack: the tennis ball's top, 80.7 cm

# ── the clock and the takes ────────────────────────────────────────────────────────────────────
SLOW = 0.2                                               # ×1/5 (hook, the loop)
FREEZE = 0.4
F_h = A("vo01:hand?") - FREEZE                          # the hook freezes on the first top as "hand?" is said
HOOK_TAU0 = TOPS[0] - FREEZE * SLOW / 2 - SLOW * F_h
SLOW_N = 1 / 3                                           # the normal: the drop and three bounces at ×1/3
R_n = cut("normal") + 0.25
MACRO = 1 / 40                                           # the change: one contact at ×1/40
TAU_C0 = T_LAND                                          # the macro take's contact begins (τ local)
T_CONTACT = A("vo03:knock:")                             # … on "knock:"
R_c = T_CONTACT - TAU_C0 / MACRO                         # (a virtual release long before the cut: the take starts mid-fall)
F_c = T_CONTACT + (DC / 2) / MACRO                       # deepest squash: frozen there through "squashes"
U_c = A("vo03:spring")                                   # and released again on "spring"
SLOW_W = 0.25                                            # the whoa: the stack at ×1/4, the tennis ball's peak on "hand."
R_w = A("vo05:hand.") - S_PEAK_T / SLOW_W
assert A("vo05:together.") < R_w < A("vo05:hands"), (R_w,)
F_w = A("vo05:hand.") + 1.2                              # it falls a little, then freezes for the hold

KEYS = [
    {"t": 0.0, "rate": SLOW, "badge": None},             # the hook's speed note sits bottom-right (hookNote), clear of the title
    {"t": F_h, "rate": 0.0, "ramp": FREEZE, "badge": None},
    {"t": cut("normal"), "rate": SLOW_N},
    {"t": cut("change"), "rate": MACRO},
    {"t": F_c, "rate": 0.0},
    {"t": U_c, "rate": MACRO},
    {"t": cut("why"), "rate": 0.0, "badge": None},       # the why: nothing on the bench moves
    {"t": cut("whoa"), "rate": SLOW_W},
    {"t": F_w, "rate": 0.0, "ramp": 0.5},
    {"t": cut("measure"), "rate": 0.0, "badge": None},   # the record: the normal's ladder, all stamped
    {"t": cut("tease"), "rate": SLOW, "ramp": 0.4},
]
clk = Clock(KEYS)
# the loop: re-released in the tease so the last frame is frame 0's moment again
R_t = None
for _ in range(1):
    R_t = DUR - (HOOK_TAU0) / SLOW                       # τ(DUR) − τ(R_t) = HOOK_TAU0 when the tease runs at ×1/5 from R_t on
assert cut("tease") + 0.45 < R_t < EC, (cut("tease"), R_t, EC)

TAKES = {
    "hook": {"t0": -1e9, "t1": cut("normal"), "tauR": clk.tau(0.0) - HOOK_TAU0, "kind": "ball"},
    "normal": {"t0": cut("normal"), "t1": cut("change"), "tauR": clk.tau(R_n), "R": R_n, "kind": "ball"},
    "macro": {"t0": cut("change"), "t1": cut("whoa"), "tauR": clk.tau(cut("change")) - (TAU_C0 - (T_CONTACT - cut("change")) * MACRO), "kind": "macro"},
    "stack": {"t0": cut("whoa"), "t1": cut("measure"), "tauR": clk.tau(R_w), "R": R_w, "kind": "stack"},
    "record": {"t0": cut("measure"), "t1": cut("tease"), "tauR": clk.tau(cut("measure")) - TOPS[2], "kind": "ball"},
    "loop": {"t0": cut("tease"), "t1": 1e9, "tauR": clk.tau(R_t), "R": R_t, "kind": "ball"},
}
assert abs(clk.tau(T_CONTACT) - TAKES["macro"]["tauR"] - TAU_C0) < 1e-9
assert abs(clk.tau(DUR) - TAKES["loop"]["tauR"] - HOOK_TAU0) < 1e-9
for name in ("hook", "normal", "loop"):
    tk = TAKES[name]
    tk["stamps"] = [round(clk.tOf(tk["tauR"] + k * DT), 6) for k in range(NG)]
TAKES["record"]["stamps"] = [round(cut("measure") - 1.0, 6)] * NG          # the record shows every ghost at once
assert TAKES["hook"]["stamps"][9] + 0.2 < 0, TAKES["hook"]["stamps"][:12]

TOP_T = {name: [clk.tOf(TAKES[name]["tauR"] + tt) for tt in TOPS[:3]] for name in ("normal",)}
LAND_T = {name: [clk.tOf(TAKES[name]["tauR"] + tt) for tt in (T_LAND, TOPS[0] + (TOPS[0] - T_LAND), TOPS[1] + (TOPS[1] - (TOPS[0] + (TOPS[0] - T_LAND))))] for name in ("normal",)}
S_HIT_T = clk.tOf(TAKES["stack"]["tauR"] + S_THIT)
S_PEAK_FT = clk.tOf(TAKES["stack"]["tauR"] + S_PEAK_T)
assert abs(S_PEAK_FT - A("vo05:hand.")) < 1e-6

# ── the spine readout ──────────────────────────────────────────────────────────────────────────
# kinds: "height" (the live ball's bottom, cm) · "top" (the latest top reached in a take) · "stack" (the tennis ball's
# bottom) · "const". minCh: the value's minimum width (4 for a live number, so the plate keeps its width as digits come
# and go; 0 lets a constant's plate fit its text). tick: False keeps a step off the cue sheet (it rides another event).
# WRITING.md "The picture" 2: at the whoa's payoff the readout stops at the peak and holds it, lit, its label saying
# what the number now is; from "degree." it stays lit to the end of the takeaway (no unlit gap at the cut) and through
# its 0.4 s exit (hud.js presence), so the payoff never turns from the accent to ink as it leaves.
S_PEAK_H = S_PEAK_Y - RB                                 # the tennis ball's bottom at its peak: 376 cm
SPINE = [
    {"t0": cut("normal") + 0.3, "t1": cut("change"), "label": "bounce height", "unit": "cm", "dp": 0, "kind": "height", "take": "normal", "minCh": 4},
    {"t0": cut("change"), "t1": cut("whoa"), "label": "lost, this knock", "unit": "%", "dp": 0, "kind": "const", "v": 100 * (1 - E_REST ** 2), "minCh": 0},
    {"t0": cut("whoa"), "t1": A("vo05:hand."), "label": "tennis ball height", "unit": "cm", "dp": 0, "kind": "stack", "minCh": 4},
    {"t0": A("vo05:hand."), "t1": cut("measure"), "label": "tennis ball's peak", "unit": "cm", "dp": 0, "kind": "const", "v": S_PEAK_H,
     "lit": [A("vo05:hand."), cut("measure")], "minCh": 4, "tick": False},
    {"t0": cut("measure"), "t1": A("vo06:A"), "label": "height missing", "unit": "cm", "dp": 0, "kind": "const", "v": DROP - TOP_H[0], "minCh": 4},
    {"t0": A("vo06:A"), "t1": A("vo06:Even"), "label": "energy it took", "unit": "J", "dp": 3, "kind": "const", "v": 0.057 * 9.81 * (DROP - TOP_H[0]) / 100, "minCh": 4},
    {"t0": A("vo06:Even"), "t1": cut("takeaway"), "label": "average warming, about", "unit": "°C", "dp": 3, "kind": "const",
     "v": 0.057 * 9.81 * (DROP - TOP_H[0]) / 100 / (57 * 1.5), "lit": [A("vo06:degree."), cut("takeaway")], "minCh": 4},   # c12: a filled core, about 1.5 J/(g·K)
    {"t0": cut("takeaway"), "t1": cut("tease") - 0.3, "label": "energy destroyed", "unit": "J", "dp": 3, "kind": "const", "v": 0.0,
     "lit": [cut("takeaway"), cut("tease") + 0.2], "minCh": 4},   # lit past t1: scene.mjs keeps the last step after it
]
assert abs(S_PEAK_FT - SPINE[3]["t0"]) < 1e-6 and SPINE[3]["lit"][0] == SPINE[3]["t0"]   # the hold starts on the peak itself
assert all(a["t1"] == b["t0"] for a, b in zip(SPINE, SPINE[1:])), "the readout never leaves between its steps"
assert SPINE[-2]["lit"][1] == SPINE[-1]["lit"][0], "lit from 'degree.' through the takeaway, without a gap at the cut"
assert SPINE[-1]["lit"][1] >= SPINE[-1]["t1"] + 0.4 and SPINE[-1]["lit"][1] < EC, "the payoff stays lit through its exit"

# where it sits (set/spine.js placeSpine: [[t, [fx, fy]], ...] plate centres as fractions of the frame, a step at each
# cut). The corners hold the notes (speed left, cheats right; 250–323 px), the readout sits between and below them.
# fy 0.225 rather than 0.245: the bench's ink hand tops out at 539–558 px in these views, and the plate is 175 px tall.
# Measured with the scene's camera on every frame (the subject, its path, the fixed labels, the notes, the caption):
#   normal, measure, takeaway  centred: the ball and its ladder are below the hand, the tops labels to the right
#   change, why                left (fx 0.2 clamps the plate's left edge to the safe line): the macro ball is 400 px wide
#                              in the middle of the frame and springs back up into the top half; the narrow constant
#                              plate (minCh 0) also leaves the why's "Joule's paddle wheel" label its own spot
#   whoa                       left, under the speed note: the tennis ball climbs the middle of the frame
SPINE_C, SPINE_L = [0.5, 0.225], [0.2, 0.225]
SPINE_PLACE = {"hook": SPINE_C, "normal": SPINE_C, "change": SPINE_L, "why": SPINE_L, "whoa": SPINE_L,
               "measure": SPINE_C, "takeaway": SPINE_C, "tease": SPINE_C}
SPINE_AT = [[0.0 if b["id"] == "hook" else cut(b["id"]), SPINE_PLACE[b["id"]]] for b in BEATS]

# ── rule 8, one line wins (WRITING.md "The picture" 8) ─────────────────────────────────────────────
# The line or object the caption names is the brightest thing in the picture; whatever delivered the previous beat
# drops to about a third of its strength as the new beat begins (eased over half a second from the cut or the word).
# Each table is [[t, strength], ...] for keyed() (cinema/film/runtime.js), 1 = as built, LOW = a third: the scene turns
# it into opacity (ink, the glow) or a lerp toward the paper #E6E2D8 (the ghost ladders, the live ball), each through
# set/aces.js screenAlpha so a third keeps a third of the contrast on screen (opacity 1/3 would keep about 1/11).
# Every key is a cut or a spoken word; every table starts and ends at 1, so frame 0 and the loop's last frame match.
LOW, FADE = 1 / 3, 0.5
T_PRICE, T_GIVES = A("vo06:A"), A("vo07:It")
DIM = {
    # the ink hand: named in the hook ("your hand?"); from the normal on it has delivered, so it steps back. The stack's
    # hand is named again in the whoa ("past your hand"), so it is full there. The bench's hand comes back at full with
    # the measure: it marks the 100 cm end of "those missing forty-four centimeters?" (the record's release ghosts are
    # the same end, its first top the other), so it steps back only when the caption turns to the readout ("A quarter
    # of a joule"), and comes back in the tease, where it re-drops the ball for the loop
    "hand": [[0.0, 1], [cut("normal"), 1], [cut("normal") + FADE, LOW], [cut("whoa"), LOW], [cut("whoa"), 1],
             [T_PRICE, 1], [T_PRICE + FADE, LOW], [cut("tease"), LOW], [cut("tease") + FADE, 1]],
    # the live ball: it delivered the change ("squashes, and doesn't spring back as hard"); in the why the heat, the
    # shaking and the sound are named, so the ball steps back (the whoa's tennis ball is full again)
    "ball": [[0.0, 1], [cut("why"), 1], [cut("why") + FADE, LOW], [cut("whoa"), LOW], [cut("whoa"), 1]],
    # the heat glow: it delivered "back" in the change; it steps back with the ball and is full again on "heat,"
    "glow": [[0.0, 1], [cut("why"), 1], [cut("why") + FADE, LOW], [A("vo04:heat,"), LOW], [A("vo04:heat,") + FADE, 1]],
    # Joule's ink: the weights and the paddle delivered "falling weights turn a paddle"; on "warmed." the thermometer's
    # red column (the accent, untouched) is what the caption names
    "jouleInk": [[0.0, 1], [A("vo04:warmed."), 1], [A("vo04:warmed.") + FADE, LOW], [cut("whoa"), LOW], [cut("whoa"), 1]],
    # the ghost ladders (one on screen at a time): the record draws the missing 44 cm (its release ghosts at 100 cm, its
    # first top at 56 cm), so it is full while the caption names them; it steps back with the hand when the caption
    # turns to the readout ("A quarter of a joule"), and comes back on "It gives it away, knock by knock"
    "ghost": [[0.0, 1], [T_PRICE, 1], [T_PRICE + FADE, LOW], [T_GIVES, LOW], [T_GIVES + FADE, 1]],
}
for name, keys in DIM.items():
    assert keys[0] == [0.0, 1] and keys[-1][1] == 1, (name, "frame 0 and the loop's last frame are as built")
    assert all(a[0] <= b[0] for a, b in zip(keys, keys[1:])) and all(LOW - 1e-9 <= k <= 1 for _, k in keys), (name, keys)
assert A("vo06:centimeters?") < T_PRICE and T_GIVES + FADE < cut("tease"), "the record steps back after the 44 cm are named, is full before the loop"

# ── cue table, labels, badges ──────────────────────────────────────────────────────────────────
CUTS = {b["id"]: (0.0 if b["id"] == "hook" else cut(b["id"])) for b in BEATS}
CUE = {
    "hook": {"freeze": [F_h, F_h + FREEZE]},
    "normal": {"R": R_n, "tops": TOP_T["normal"], "lands": LAND_T["normal"]},
    "change": {"contact": T_CONTACT, "freeze": F_c, "spring": U_c, "rings": A("vo03:puff"), "heat": A("vo03:squashes,")},
    "why": {"joule": [A("vo04:James"), A("vo04:Energy#2")], "fall": [A("vo04:let"), A("vo04:warmed.")], "heat": A("vo04:heat,"),
            "shaking": A("vo04:shaking"), "sound": A("vo04:sound,")},
    "whoa": {"R": R_w, "hit": S_HIT_T, "peak": S_PEAK_FT, "freeze": F_w},
    "measure": {"gap": A("vo06:missing")},
    "cuts": CUTS,
}
# anchor: {"ball": take} · {"top": k} (the record ladder's top k) · {"hand": "bench" | "stack"} · {"tennis": 1} ·
# {"basket": 1} · {"point": [x, y, z]} · {"joule": "therm" | "weights"}
TOPX = [X0 + VX * tt for tt in TOPS]
LABELS = [
    {"id": "hk-hand", "text": "your hand", "color": "ghost", "t0": A("vo01:hand?"), "t1": cut("normal") - 0.35, "anchor": {"hand": "bench"}, "side": 1, "fixed": False},
    {"id": "nm-56", "text": "56 cm", "color": "motion", "t0": A("vo02:Fifty-six"), "t1": cut("change") - 0.35, "anchor": {"point": [TOPX[0], TOP_H[0] + RB, 0]}, "side": 1, "fixed": False},
    {"id": "nm-32", "text": "32 cm", "color": "motion", "t0": A("vo02:thirty-two."), "t1": cut("change") - 0.35, "anchor": {"point": [TOPX[1], TOP_H[1] + RB, 0]}, "side": 1, "fixed": False},
    {"id": "nm-18", "text": "18 cm", "color": "motion", "t0": A("vo02:eighteen."), "t1": cut("change") - 0.35, "anchor": {"point": [TOPX[2], TOP_H[2] + RB, 0]}, "side": 1, "fixed": False},
    {"id": "ch-sound", "text": "sound", "color": "wave", "t0": A("vo03:sound."), "t1": A("vo03:The#2", -0.1), "anchor": {"ring": 1}, "side": 1, "fixed": True},
    {"id": "ch-heat", "text": "heat", "color": "energy", "t0": A("vo03:back."), "t1": cut("why") - 0.6, "anchor": {"ball": "macro", "off": [-0.92, -0.62]}, "side": -1, "fixed": True},   # the contact patch, at the ball's lower-left edge
    {"id": "wy-joule", "text": "Joule's paddle wheel", "color": "ghost", "t0": A("vo04:James", 0.3), "t1": A("vo04:warmed.", -0.1), "anchor": {"joule": "top"}, "side": 1, "fixed": False},
    {"id": "wy-warm", "text": "the water warms", "color": "energy", "t0": A("vo04:warmed."), "t1": A("vo04:Energy#2", -0.2), "anchor": {"joule": "therm"}, "side": 1, "fixed": True},
    {"id": "wy-heat", "text": "heat", "color": "energy", "t0": A("vo04:heat,"), "t1": cut("whoa") - 0.35, "anchor": {"ball": "macro", "off": [-0.92, -0.62]}, "side": -1, "fixed": True},   # the contact patch, at the ball's lower-left edge
    {"id": "wy-shake", "text": "shaking", "color": "pressure", "t0": A("vo04:shaking"), "t1": cut("whoa") - 0.35, "anchor": {"point": [-30.0, 0.0, 0.0]}, "side": -1, "fixed": True},
    {"id": "wy-sound", "text": "sound", "color": "wave", "t0": A("vo04:sound,"), "t1": cut("whoa") - 0.35, "anchor": {"ring": 2}, "side": 1, "fixed": True},
    {"id": "wo-hand", "text": "your hand", "color": "ghost", "t0": A("vo05:Drop"), "t1": A("vo05:The#2", -0.1), "anchor": {"hand": "stack"}, "side": 1, "fixed": True},
    {"id": "wo-7x", "text": "7× its fall", "color": "motion", "t0": A("vo05:hand."), "t1": cut("measure") - 0.35, "anchor": {"tennis": 1}, "side": 1, "fixed": True},
    {"id": "ms-44", "text": "44 cm missing", "color": "energy", "t0": A("vo06:missing"), "t1": A("vo06:A", -0.1), "anchor": {"point": [-8.0, (DROP + TOP_H[0]) / 2 + RB, 0]}, "side": 1, "fixed": True, "v": "middle"},
]
# rule 8: a label leaves at its beat's cut (its 0.4 s fade-out ends by then, give or take a frame or two)
NEXT_CUT = {b["id"]: (cut(BEATS[k + 1]["id"]) if k + 1 < len(BEATS) else EC) for k, b in enumerate(BEATS)}
for lb in LABELS:
    home = [b["id"] for b in BEATS if CUTS[b["id"]] <= lb["t0"]][-1]
    assert lb["t1"] <= NEXT_CUT[home] - 0.3, (lb["id"], home, lb["t1"], NEXT_CUT[home])
# … and within a beat, a label leaves when the caption leaves what it names, or with the drawing it names as that
# steps back (its 0.4 s fade lands by the time the drawing is at a third)
LB = {lb["id"]: lb for lb in LABELS}
assert LB["ch-sound"]["t1"] < A("vo03:The#2"), "'sound' leaves as the caption turns to the ball"
assert LB["wy-joule"]["t1"] <= A("vo04:warmed.") and LB["wy-joule"]["t1"] + 0.4 <= A("vo04:warmed.") + FADE, "Joule's label leaves with its ink"
assert LB["ms-44"]["t1"] <= T_PRICE and LB["ms-44"]["t1"] + 0.4 <= T_PRICE + FADE, "'44 cm missing' leaves as its span steps back"
assert LB["ms-44"]["t1"] - LB["ms-44"]["t0"] >= 2.0, "… after it has been up long enough to read"

# ── notes (WRITING.md "The picture" 8; the channel's layout) ─────────────────────────────────────
# Honesty notes are metadata, one tier below labels. The top-left corner holds the speed column (the clock's badge),
# the top-right the standing cheats; at most two notes per top corner at once; a framing tag (a note that names the
# picture, "framing": True) visits for 4 s at most; the spine readout sits between and below them. The hook's speed
# note is the one exception: it sits bottom-right because the title drop owns the top through the hook (frame 0 falls
# through 256–530 px, where a top-left note would sit on the title).
NOTE_SLOT = {"clock": "tl", "hook": "br"}
BADGES = [
    {"id": "air", "text": "Air ignored", "t0": cut("normal") + 0.6, "t1": cut("change") - 0.2, "slot": "tr"},
    {"id": "illus", "text": "Not to scale", "t0": cut("change") + 0.3, "t1": A("vo04:James", -0.5), "slot": "tr"},
    {"id": "perfect", "text": "Ideal bounces", "t0": A("vo05:Drop"), "t1": cut("measure") - 0.3, "slot": "tr"},
]


def rate_text(rate):                                     # kits/cinema/sci/clock.js rateText, with its default words
    if rate == 0:
        return "paused"
    if abs(rate - 1) < 1e-12:
        return None
    n = 1 / rate if rate < 1 else rate
    return f"{round(n) if abs(n - round(n)) < 1e-9 else round(n, 2)}× {'slower' if rate < 1 else 'faster'}"


CLOCK_NOTES = []                                         # clock.js C.badges: one per run of keys with the same wording
for i, k in enumerate(KEYS):
    text, t1 = (k["badge"] if "badge" in k else rate_text(k["rate"])), (KEYS[i + 1]["t"] if i + 1 < len(KEYS) else math.inf)
    if text is None:
        continue
    if CLOCK_NOTES and CLOCK_NOTES[-1]["t1"] == k["t"] and CLOCK_NOTES[-1]["text"] == text:
        CLOCK_NOTES[-1]["t1"] = t1
    else:
        CLOCK_NOTES.append({"text": text, "t0": k["t"], "t1": t1})
NOTES = ([{"slot": NOTE_SLOT["clock"], "t0": n["t0"], "t1": min(n["t1"], EC), "text": n["text"], "speed": True} for n in CLOCK_NOTES]
         + [{"slot": NOTE_SLOT["hook"], "t0": 0.0, "t1": cut("normal"), "text": "5× slower / paused", "speed": True}]
         + [{**b, "speed": False} for b in BADGES])
assert all(n["slot"] == "tl" for n in NOTES if n["speed"] and n["t0"] >= cut("normal")), "the speed column is top-left"
assert all(b["slot"] == "tr" for b in BADGES), "the standing cheats are top-right"
for n in NOTES:
    assert not n.get("framing") or n["t1"] - n["t0"] <= 4.0, (n, "a framing tag visits for 4 s at most")
for slot in ("tl", "tr"):                                # each note fades out over 0.3 s after its t1
    for fr in range(int(DUR * FPS) + 1):
        t = fr / FPS
        on = [n["text"] for n in NOTES if n["slot"] == slot and n["t0"] <= t < n["t1"] + 0.3]
        assert len(on) <= 2, (slot, t, on)

# ── camera (level measure views, ep01's helper; the macro and the tilt-up as their own keys) ───
FPX = 960 / math.tan(math.radians(16))


def view(cx, top_px=300.0, floor_px=1140.0, top=DROP + 2 * RB + 6, fov=32.0, yaw=0.0, pitch=0.0):
    fpx = 960 / math.tan(math.radians(fov / 2))
    ppc = (floor_px - top_px) / top
    return {"look": [round(cx, 3), round(top - (960 - top_px) / ppc, 3), 0.0], "dist": round(fpx / ppc, 2), "yaw": yaw, "pitch": pitch, "fov": fov}


def key(t, v, ease="p2", **over):
    return {"t": round(t, 4), **v, **over, "ease": ease}


BENCH = view(-8.0, top_px=570.0)                          # the hand, the stick, the bounces; room above the hand for the spine
HOOK = view(-6.0, top_px=640.0, floor_px=1150.0)          # under the title: the hand line and the first rebound
MACRO_V = {"look": [X0 + VX * T_LAND, 4.0, 0.0], "dist": 62.0, "yaw": 0.0, "pitch": 4.0, "fov": 32.0}
JOULE_X, JOULE_Z = 120.0, -20.0
JOULE_V = {"look": [JOULE_X - 12.0, 20.0, JOULE_Z], "dist": 380.0, "yaw": 0.0, "pitch": 0.0, "fov": 32.0}
BALL_REST = {"look": [X0 + VX * T_LAND, 4.0, 0.0], "dist": 170.0, "yaw": 0.0, "pitch": 3.0, "fov": 32.0}
STACK_LO = view(S_X, top=S_HAND_Y + 30, top_px=420.0)
STACK_MID = {"look": [S_X, 150.0, 0.0], "dist": 420.0, "yaw": 0.0, "pitch": 0.0, "fov": 32.0}
STACK_HI = {"look": [S_X, 350.0, 0.0], "dist": 300.0,          # the cyc wall stops at 420 cm: keep the frame under it
            "yaw": 0.0, "pitch": 0.0, "fov": 32.0}
CAM = {
    "hook": [key(0.0, HOOK), key(cut("normal"), {**HOOK, "dist": HOOK["dist"] + 8}, "sine")],
    "normal": [key(cut("normal"), {**HOOK, "dist": HOOK["dist"] + 8}), key(A("vo02:down."), BENCH, "p3"), key(cut("change"), {**BENCH, "dist": BENCH["dist"] - 10}, "sine")],
    "change": [key(cut("change"), {**MACRO_V, "dist": 120.0}), key(A("vo03:knock:"), MACRO_V, "p3"), key(cut("why"), {**MACRO_V, "dist": 56.0}, "sine")],
    "why": [key(cut("why"), {**MACRO_V, "dist": 56.0}), key(A("vo04:James", -0.3), JOULE_V, "p3"), key(A("vo04:Energy#2", -0.4), {**JOULE_V, "dist": 370.0}, "sine"),
            key(A("vo04:vanish."), BALL_REST, "p3"), key(cut("whoa"), {**BALL_REST, "dist": 200.0}, "sine")],
    # the camera rides up with the tennis ball: fast off the hit, easing into its peak on "hand."
    "whoa": [key(cut("whoa"), STACK_LO), key(CUE["whoa"]["hit"], STACK_LO, "sine"), key(clk.tOf(TAKES["stack"]["tauR"] + S_THIT + 0.2), STACK_MID, "p2"),
             key(A("vo05:hand."), STACK_HI, "sine"), key(cut("measure"), {**STACK_HI, "dist": 310.0}, "sine")],
    "measure": [key(cut("measure"), BENCH), key(cut("takeaway"), {**BENCH, "dist": BENCH["dist"] + 12}, "sine")],
    "takeaway": [key(cut("takeaway"), {**BENCH, "dist": BENCH["dist"] + 12}), key(cut("tease"), {**BENCH, "dist": BENCH["dist"] + 20}, "sine")],
    "tease": [key(cut("tease"), {**BENCH, "dist": BENCH["dist"] + 20}), key(EC, HOOK, "p3"), key(DUR, HOOK, "sine")],
}
SHOTS = [{"at": CUTS[b["id"]], "name": b["id"]} for b in BEATS]

TITLE = {"series": "Rest Frame · No. 003", "title": "Where does the *bounce* go?", "t1": round(cut("normal") - 0.45, 4), "y": 0.183, "sig": 0.3}
# caption pages the phrase pager can't break well on its own (set/captions_py.py: ' / ' row, ' | ' page)
CAP_FIX = [
    'Even if it all / stays in the ball: | about three thousandths / of a degree.',
]

film = {
    "id": "rest-frame-003", "fps": FPS, "bpm": BPM, "dur": DUR, "poster": 0.0,
    "_doc": "Compiled by compile.py from script.md, vo/ and the direction in compile.py. Do not edit by hand.",
    "shots": SHOTS, "beats": BEATS, "clock": KEYS, "takes": TAKES, "cue": CUE, "spine": SPINE, "spineAt": SPINE_AT, "dim": DIM,
    "notes": NOTE_SLOT,
    "bench": {"g": G, "drop": DROP, "r": RB, "e": E_REST, "x0": X0, "vx": VX, "dt": DT, "n": NG, "stickX": STICK_X, "land": T_LAND,
              "tops": TOPS, "topH": TOP_H, "dc": DC, "squash": SQUASH},
    "stack": {"thit": S_THIT, "drop": S_DROP, "R": S_R, "M": S_M, "m": S_m, "x": S_X, "handY": S_HAND_Y, "peak": [S_PEAK_T, S_PEAK_Y]},
    "joule": {"x": JOULE_X, "z": JOULE_Z, "s": 0.8},
    "labels": LABELS, "badges": BADGES, "cam": CAM, "hookNote": {"slow": [0.0, F_h], "paused": [F_h, cut("normal")]},
    "captionY": 0.632, "title": TITLE,
    "captions": phrase_captions(f, max_chars=24, fix=CAP_FIX, until=EC - 0.3), "endCard": EC,
    "end": {"title": "Next drop: the hammer and the *feather*", "follow": "Follow Rest Frame",
            "foot": "Joule, 1850: 772 foot-pounds warm a pound of water 1 °F. Today's value is 778."},
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}

# ── the studio's cue sheet ─────────────────────────────────────────────────────────────────────
ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS]
ev.append({"t": round(F_h + FREEZE, 4), "kind": "time.slow", "tag": "hook:freeze"})
ev.append({"t": round(cut("change") + 0.02, 4), "kind": "time.slow", "tag": "change:macro"})
ev.append({"t": round(R_n, 4), "kind": "contact", "tag": "normal:release", "pos": [0.42, 0.25]})
for i, t in enumerate(LAND_T["normal"]):
    ev.append({"t": round(t, 4), "kind": "bounce", "tag": f"normal:land{i + 1}", "gain": -3.0 * i})
ev.append({"t": round(T_CONTACT, 4), "kind": "impact", "tag": "change:knock"})
ev.append({"t": round(A("vo03:puff"), 4), "kind": "wave.on", "tag": "change:rings"})
ev.append({"t": round(A("vo03:squashes,"), 4), "kind": "heat", "tag": "change:heat"})
ev.append({"t": round(A("vo04:warmed."), 4), "kind": "heat", "tag": "why:warm"})
ev.append({"t": round(R_w, 4), "kind": "contact", "tag": "whoa:release"})
ev.append({"t": round(S_HIT_T, 4), "kind": "impact", "tag": "whoa:hit"})
ev.append({"t": round(S_HIT_T, 4), "kind": "swell", "tag": "whoa:climb"})
ev.append({"t": round(S_PEAK_FT, 4), "kind": "reveal", "tag": "whoa:peak"})
ev.append({"t": round(R_t, 4), "kind": "contact", "tag": "loop:release"})
for take in ("hook", "normal", "loop"):
    tk = TAKES[take]
    for k, t in enumerate(tk["stamps"]):
        if math.isfinite(t) and 0.05 < t < tk["t1"] and k % 2 == 0:            # one shutter per two ghosts: under 3 a second
            ev.append({"t": round(t, 4), "kind": "strobe", "tag": f"{take}:g{k}"})
for lb in LABELS:
    ev.append({"t": lb["t0"], "kind": "label", "tag": lb["id"]})
for bd in BADGES:
    ev.append({"t": round(bd["t0"], 4), "kind": "badge", "tag": bd["id"], "text": bd["text"]})
ev.append({"t": SPINE[0]["t0"], "kind": "counter.show", "tag": "spine"})
for s in SPINE[1:]:
    if s.get("tick", True):
        ev.append({"t": s["t0"], "kind": "counter.tick", "tag": f"spine:{s['label']}"})
ev.append({"t": A("vo06:degree."), "kind": "counter.end", "tag": "spine:degree"})
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
print(f"  tops (normal) {[round(t, 2) for t in TOP_T['normal']]}, heights {[round(h, 2) for h in TOP_H[:3]]}; contact {T_CONTACT:.3f} freeze {F_c:.3f}–{U_c:.3f}")
print(f"  stack: hit {S_HIT_T:.3f}, peak {S_PEAK_FT:.3f} at {S_PEAK_Y:.1f} cm (×{S_U / S_V:.3f} speed, ×{(S_U / S_V) ** 2:.2f} height); loop release {R_t:.3f}")
print(f"  spine at {[(round(t, 2), xy) for t, xy in SPINE_AT]}; peak held at {S_PEAK_H:.0f} cm")
print("  rule 8: " + "; ".join(f"{k} " + " ".join(f"{t:.2f}:{v:.2f}" for t, v in ks[1:]) for k, ks in DIM.items()))
