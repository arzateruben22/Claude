"""Compile Rest Frame No. 005, "The spinning chair": script + voice timings + this direction → film.json and sheet.json,
as in episodes 1–4. Every moment hangs on a beat or a spoken word.

  python3 -I films/channels/physics/ep05/compile.py

The physics (set/spin.js, ported in set/bench_py.py): a seated person on a swivel chair, two 2 kg dumbbells, each arm a
3.5 kg rod from the shoulder (19 cm out) to the hand; the seated body and the chair's top without the arms 2.0 kg·m²
(an assumption, badged). One push gives 30 rpm with the arms out (hands 80 cm from the axis); angular momentum is
conserved (friction ignored, badged), so pulling the hands to 20 cm spins it at 30 × 2.68 = 80 rpm.

The picture rules (kits/cinema/script/WRITING.md "The picture" 2 and 8): the spine readout holds its payoff, lit, with a
label that says what the number means, parked in each shot's empty region (SPINE_AT); one line wins (DIM: what the
caption names is the brightest thing, what delivered the beat before steps back to a third); the notes keep the
channel's corners (NOTE_SLOT, BADGES: speed top-left, cheats top-right, at most two a corner, a framing tag 4 s at most).
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
from bench_py import Clock, Spinner   # noqa: E402
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


MODEL = {"I0": 2.0, "m": 2.0, "mArm": 3.5, "rS": 0.19, "r0": 0.80, "w0": math.pi}   # w0: 30 rpm, one turn every 2 s
R_IN = 0.20
DT = 0.1

# ── the clock: real time on the chair; the hook and the loop at ×1/2; the measure frozen ────────
SLOW_H = 0.5
HOOK_MOVES = [(1.0, 1.6, R_IN)]                          # the hook's own spin: pulled in from τ 1.0 to 1.6
HOOK_TAU0 = 1.3                                          # frame 0 is mid-pull: the ghost spiral already curling in
T_PUSH = A("vo02:push.")                                 # the push lands on "push."
MOVES = [(A("vo03:pull") - T_PUSH, A("vo03:chest.") - T_PUSH, R_IN),            # in, from "pull" to "chest."
         (A("vo04:Weight") - T_PUSH, A("vo04:middle") - T_PUSH, MODEL["r0"]),   # out again: slower ("Weight near the middle…")
         (A("vo04:turns") - T_PUSH, A("vo04:faster.") - T_PUSH + 0.3, R_IN)]   # in again on "…turns you faster."
SP = Spinner(**MODEL, moves=MOVES)
SPH = Spinner(**MODEL, moves=HOOK_MOVES)
RATIO = SP.ratio(MODEL["r0"], R_IN)
RPM_OUT, RPM_IN = 30.0, 30.0 * RATIO                     # 30 → 80.3 rpm (c1)

KEYS = [
    {"t": 0.0, "rate": SLOW_H, "badge": None},          # the hook's speed note sits bottom-right (hookNote), clear of the title
    {"t": cut("normal"), "rate": 1.0},
    {"t": cut("measure"), "rate": 0.0, "badge": None},   # the record, seen from above: nothing moves
    {"t": cut("takeaway"), "rate": 1.0},
    {"t": cut("tease"), "rate": SLOW_H},
]
clk = Clock(KEYS)
R_t = clk.tOf(clk.tau(DUR) - HOOK_TAU0)                  # the loop: the last frame is frame 0's moment
assert cut("tease") + 0.05 < R_t < EC, (R_t,)
TAKES = {
    "hook": {"t0": -1e9, "t1": cut("normal"), "tauR": clk.tau(0.0) - HOOK_TAU0, "spin": "hook"},
    "chair": {"t0": cut("normal"), "t1": cut("tease"), "tauR": clk.tau(T_PUSH), "R": T_PUSH, "spin": "chair"},
    "loop": {"t0": cut("tease"), "t1": 1e9, "tauR": clk.tau(R_t), "R": R_t, "spin": "hook"},
}
assert abs(clk.tau(DUR) - TAKES["loop"]["tauR"] - HOOK_TAU0) < 1e-9

# ── the ghost ladders: both dumbbells every 1/10 s ───────────────────────────────────────────────
# the live ladders (normal, change): ten with the arms out from τ 0.2, seven with them in after the pull settles;
# the record (measure) shows the same ghosts at once. Rule 8: a ladder that delivered its beat stays into the next one
# at a third (DIM below) and leaves on a word, fading out over LEAVE: the live ones as the camera starts its turn in the
# why ("With"), the record as the takeaway names the arms ("Your arms…")
LOW, FADE, LEAVE = 1 / 3, 0.5, 0.4
T_WITH, T_YOUR = A("vo04:With"), A("vo07:Your#2")      # "Your arms just decide…" (the first "your" is "set your total spin")
GONE_WHY, GONE_TK = round(T_WITH + LEAVE - HALF, 6), round(T_YOUR + LEAVE - HALF, 6)   # window edges half a frame before a frame
T_IN = MOVES[0][1]
LADDERS = {
    "out": {"tau0": 0.2, "n": 10, "t0": cut("normal"), "t1": GONE_WHY},
    "in": {"tau0": round(T_IN + 0.15, 4), "n": 7, "t0": cut("change"), "t1": GONE_WHY},
    "hook": {"tau0": 0.4, "n": 18, "t0": -1e9, "t1": cut("normal")},
    "loop": {"tau0": 0.4, "n": 18, "t0": cut("tease"), "t1": 1e9},
    "rec": {"t0": cut("measure"), "t1": GONE_TK},       # the record: both ladders at once, frozen
}
assert cut("why") + FADE < T_WITH and LADDERS["out"]["t1"] < cut("whoa")
assert cut("takeaway") + FADE < T_YOUR and LADDERS["rec"]["t1"] < cut("tease"), "the record leaves before the loop's ladder takes its slots"
for k in ("out", "in"):
    L = LADDERS[k]
    L["stamps"] = [round(clk.tOf(TAKES["chair"]["tauR"] + L["tau0"] + i * DT), 6) for i in range(L["n"])]
    assert L["stamps"][-1] < L["t1"], (k, L["stamps"][-1], L["t1"])
    assert L["stamps"][-1] < cut("why"), (k, "every ghost is stamped before the why: the strobe events don't move")
for k, take in (("hook", "hook"), ("loop", "loop")):
    L = LADDERS[k]
    L["stamps"] = [round(clk.tOf(TAKES[take]["tauR"] + L["tau0"] + i * DT), 6) for i in range(L["n"])]
assert LADDERS["hook"]["stamps"][8] + 0.15 < 0 <= LADDERS["hook"]["stamps"][9] + 0.2, LADDERS["hook"]["stamps"][:10]
STEP_OUT = math.degrees(SP.omega(0.5) * DT)              # 18.0°
STEP_IN = math.degrees(SP.omega(T_IN + 0.5) * DT)        # 48.2°

# ── the spine: rpm on the chair, the skater's record, then degrees per 1/10 s ───────────────────
# WRITING.md "The picture" 2: at its final value it holds, lit, through the whoa and the takeaway, its label saying what
# the number now means (the takeaway: 80 rpm is what one push gives with the arms in). minCh per step: the chair's rpm
# and the degrees never pass two digits, the record's climb reaches three (the plate only widens on a cut). In the whoa
# the plate keeps the chair's 80 rpm under "spin rate", as since the normal, until the record's number is said ("three
# hundred…"): only then does the label name the record and the number climb, so "The record, set by a young Canadian
# skater:" never sits over 80 rpm under the record's label (the whoa's cut only widens the plate to three digits)
SPINE = [
    {"t0": cut("normal") + 0.3, "t1": cut("whoa"), "label": "spin rate", "unit": "rpm", "dp": 0, "kind": "rpm", "take": "chair", "minCh": 2},
    {"t0": cut("whoa"), "t1": A("vo05:three"), "label": "your spin, arms in", "unit": "rpm", "dp": 0, "kind": "rpm", "take": "chair", "minCh": 3},   # named as the chair's, so it isn't read as the skater's
    {"t0": A("vo05:three"), "t1": cut("measure"), "label": "fastest spin on ice skates", "unit": "rpm", "dp": 0, "kind": "ramp",
     "keys": [[A("vo05:three"), RPM_IN], [A("vo05:minute."), 342.0]], "lit": [A("vo05:minute."), cut("measure")], "minCh": 3},
    {"t0": cut("measure"), "t1": A("vo06:Arms#2"), "label": "turn per 1/10 s, arms out", "unit": "°", "dp": 0, "kind": "const", "v": STEP_OUT, "minCh": 2},
    {"t0": A("vo06:Arms#2"), "t1": cut("takeaway"), "label": "turn per 1/10 s, arms in", "unit": "°", "dp": 0, "kind": "const", "v": STEP_IN,
     "lit": [A("vo06:fifty."), cut("takeaway")], "minCh": 2},
    # the payoff held: lit from the cut, and gone (its 0.4 s fade included) before the tease's speed note takes the corner
    {"t0": cut("takeaway"), "t1": cut("tease") - 0.45, "label": "one push, arms in", "unit": "rpm", "dp": 0, "kind": "rpm", "take": "chair",
     "lit": [cut("takeaway"), cut("tease")], "minCh": 2},            # lit through its own fade-out, too
]
assert all(a["t1"] == b["t0"] for a, b in zip(SPINE, SPINE[1:])), "the readout never leaves between its steps"
assert SPINE[-2]["lit"][1] == SPINE[-1]["lit"][0], "lit from 'fifty.' through the takeaway, without a gap at the cut"
assert A("vo07:fast.") < SPINE[-1]["t1"], "it never leaves at the payoff"
REC_STEP = next(s for s in SPINE if s["kind"] == "ramp")
assert REC_STEP["t0"] == REC_STEP["keys"][0][0] and cut("whoa") < REC_STEP["t0"], "the record's label arrives with its number"
assert max(len(str(round(RPM_IN))), len(str(round(STEP_IN)))) <= 2 and len(str(round(342.0))) <= 3

# where it sits (set/spine.js placeSpine: [[t, [fx, fy]], ...] plate centres as fractions of the frame, a step at each
# cut). Measured with the scene's camera (placeCam) every 1/10 s of each shot: the mannequin at its pose, the hands'
# path (a full circle at the current reach: every shot turns at least once), the live and recorded ghosts, the skater
# and her arcs, the fixed labels' pills and the notes. The default [0.5, 0.245] (a plate about 276-340 × 183-227 px,
# rows 357-584) sits on the subject in every shot:
#   normal, change, measure   from above: the hands' ring spans x 140-940, y 424-1219 (its top arc, with ghosts on it,
#                             at y 446-488 under the plate's centre); the 18° label sits at about x 500-620, y 400-470
#   why                       from above, then from the side: the head's top at y 554-562, x 467-613
#   whoa                      from the side (the head, as above), then wide: the skater's raised arms top out at
#                             y 560, x 709-847, and "a scratch spin" sits at about y 560-630 left of her
#   takeaway                  from above (the ring's top at y 460) down to the side (the head at y 629)
# The one empty region in all of them is the top-left, above the ring's shoulder and left of the head: fx 0.2 clamps
# the plate's left edge to the safe line (x 90-366, or 90-430 with the record's three digits), fy 0.185 puts it at
# y 250-477; it clears every point above by 20 px or more (32 px from the ring in the normal and the change). The
# speed column (top-left) is empty while the readout is up (4.0-60.5 s; the tease's "2× slower" arrives after it
# has gone) and the cheats stay top-right, so the plate never shares a corner with a note.
SPINE_TL = [0.2, 0.185]
SPINE_PLACE = {"hook": SPINE_TL, "normal": SPINE_TL, "change": SPINE_TL, "why": SPINE_TL, "whoa": SPINE_TL,
               "measure": SPINE_TL, "takeaway": SPINE_TL, "tease": SPINE_TL}
SPINE_AT = [[0.0 if b["id"] == "hook" else cut(b["id"]), SPINE_PLACE[b["id"]]] for b in BEATS]

# ── rule 8, one line wins (WRITING.md "The picture" 8) ─────────────────────────────────────────────
# The line or object the caption names is the brightest thing in the picture; whatever delivered the previous beat
# drops to about a third of its strength as the new beat begins (eased over FADE from the cut or the word). Each table
# is [[t, strength], ...] for keyed() (cinema/film/runtime.js): 1 as built, LOW a third, 0 gone (a ladder leaving over
# LEAVE before its window ends). The scene turns it into the ghosts' opacity (one material per ladder group: "out" is
# the arms-out ladders, live and recorded, and the hook's and the loop's spirals, which share its slots; "in" is the
# arms-in ladders) and, for the chair and its sitter, a lerp toward the paper (the scene-linear value that lands on
# #E6E2D8), each through set/aces.js screenAlpha so a third keeps a third of the contrast on screen. Every key is a cut or a spoken word; between one ladder's window and the next a table may step
# (nothing of that group is on screen); every table starts and ends at 1, so frame 0 and the loop's last frame match.
T_SKATERS, T_ARMS_OUT, T_ARMS_IN = A("vo05:Skaters"), A("vo06:Arms"), A("vo06:Arms#2")
DIM = {
    # the arms-out ghosts: "once every two seconds" is theirs; in the change the arms-in ghosts open up and these step
    # back, and they leave as the why turns the camera. The record: full on "ghosts a tenth of a second apart" and
    # "Arms out, eighteen degrees"; a third from "Arms in, nearly fifty" and through the takeaway, leaving on "Your arms"
    "out": [[0.0, 1], [cut("change"), 1], [cut("change") + FADE, LOW], [T_WITH, LOW], [GONE_WHY, 0],
            [cut("measure"), 0], [cut("measure"), 1], [T_ARMS_IN, 1], [T_ARMS_IN + FADE, LOW], [T_YOUR, LOW], [GONE_TK, 0],
            [cut("tease"), 0], [cut("tease"), 1]],
    # the arms-in ghosts: they deliver the change ("more than twice as fast") and step back as the why begins; the
    # record's: a third while "Arms out, eighteen degrees" is said, full on "Arms in, nearly fifty", a third in the takeaway
    "in": [[0.0, 1], [cut("why"), 1], [cut("why") + FADE, LOW], [T_WITH, LOW], [GONE_WHY, 0],
           [cut("measure"), 0], [cut("measure"), 1], [T_ARMS_OUT, 1], [T_ARMS_OUT + FADE, LOW], [T_ARMS_IN, LOW], [T_ARMS_IN + FADE, 1],
           [cut("takeaway"), 1], [cut("takeaway") + FADE, LOW], [T_YOUR, LOW], [GONE_TK, 0], [cut("tease"), 0], [cut("tease"), 1]],
    # the chair and its sitter: the subject from the hook to the why; the whoa's skater takes over on "Skaters" (as the
    # camera brings her in), the record's ghosts in the measure; full again for the takeaway's "your total spin" and
    # through the tease, which hands back to the hook's frame
    "chair": [[0.0, 1], [T_SKATERS, 1], [T_SKATERS + FADE, LOW], [cut("takeaway"), LOW], [cut("takeaway") + FADE, 1]],
}
for name, keys in DIM.items():
    assert keys[0] == [0.0, 1] and keys[-1][1] == 1 and keys[-1][0] <= DUR, (name, "frame 0 and the loop's last frame are as built")
    assert all(a[0] <= b[0] for a, b in zip(keys, keys[1:])) and all(0 <= k <= 1 for _, k in keys), (name, keys)
assert T_ARMS_OUT + FADE <= T_ARMS_IN and cut("measure") + FADE < T_ARMS_OUT and T_SKATERS + FADE < cut("measure")
assert LADDERS["out"]["t1"] == LADDERS["in"]["t1"] == GONE_WHY < cut("measure")
assert all(abs((x * FPS) % 1 - 0.5) < 1e-3 for x in (GONE_WHY, GONE_TK)), "slots only change between frames (strobe.js)"

CUTS = {b["id"]: (0.0 if b["id"] == "hook" else cut(b["id"])) for b in BEATS}
CUE = {"push": T_PUSH, "moves": [[T_PUSH + a, T_PUSH + b, r] for a, b, r in MOVES], "skater": [cut("whoa"), cut("measure")],
       "cuts": CUTS}
# "80 cm from the axis" rides on the hand, so it leaves as the push lands: once the chair turns, the hand (and the pill
# above it) swings up over the ring's top arc toward the readout's corner. "48°" arrives on "nearly" (it must leave at the
# takeaway's cut, so "fifty." would leave it 0.6 s). "18°" leaves on "Arms in" (rule 8: its ladder steps back then, and
# the 48° the caption names is the one bright pill; the 18 stays in the ladder's third). The "easier to turn" label is
# gone: its t1 ("vo04:Your", case-insensitive, is "your total amount") came before its t0, so it never showed, and its
# cue sounded over nothing; at "Weight near the middle is easier to turn" the arms are going out (the slow half of the
# demonstration), so the chair and its sitter at full carry the line without a pill
LABELS = [
    {"id": "hk-weights", "text": "2 kg each", "color": "ghost", "t0": A("vo01:Nobody"), "t1": cut("normal") - 0.4, "anchor": {"hand": ["hook", 1]}, "side": 1, "fixed": True},
    {"id": "nm-out", "text": "80 cm from the axis", "color": "ghost", "t0": A("vo02:wide."), "t1": T_PUSH, "anchor": {"hand": ["chair", 1]}, "side": 1, "fixed": True},
    {"id": "ch-in", "text": "20 cm", "color": "ghost", "t0": A("vo03:chest."), "t1": cut("why") - 0.35, "anchor": {"hand": ["chair", 1]}, "side": 1, "fixed": True},
    {"id": "wy-arms", "text": "your arms do the work", "color": "energy", "t0": A("vo04:arms"), "t1": cut("whoa") - 0.35, "anchor": {"hand": ["chair", 1]}, "side": 1, "fixed": True},
    {"id": "wo-skater", "text": "a scratch spin", "color": "ghost", "t0": A("vo05:Skaters"), "t1": cut("measure") - 0.35, "anchor": {"skater": 1}, "side": -1, "fixed": True},
    {"id": "ms-18", "text": "18°", "color": "motion", "t0": A("vo06:eighteen"), "t1": T_ARMS_IN, "anchor": {"gap": ["out", 3]}, "side": 1, "fixed": True},
    {"id": "ms-48", "text": "48°", "color": "motion", "t0": A("vo06:nearly"), "t1": cut("takeaway") - 0.35, "anchor": {"gap": ["in", 2]}, "side": 1, "fixed": True},
]
# rule 8: a label leaves at its beat's cut (its 0.4 s fade-out ends by then, give or take a frame or two)
NEXT_CUT = {b["id"]: (cut(BEATS[k + 1]["id"]) if k + 1 < len(BEATS) else EC) for k, b in enumerate(BEATS)}
for lb in LABELS:
    assert lb["t0"] + 0.9 <= lb["t1"], (lb["id"], "on screen long enough to read (a word anchor can match an earlier word)")
    home = [b["id"] for b in BEATS if CUTS[b["id"]] <= lb["t0"]][-1]
    assert lb["t1"] <= NEXT_CUT[home] - 0.3, (lb["id"], home, lb["t1"], NEXT_CUT[home])

# ── notes (WRITING.md "The picture" 8; the channel's layout) ─────────────────────────────────────
# Honesty notes are metadata, one tier below labels. The top-left corner holds the speed column (the clock's badge),
# the top-right the standing cheats (the model card, "Illustration", "Friction ignored"); at most two notes per top
# corner at once; a framing tag (a note that names the picture, "framing": True) visits for 4 s at most, its fade-out
# included; the spine readout sits between and below them (SPINE_AT). The hook's speed note is the one exception: it
# sits bottom-right, as before, because the title drop owns the top through the hook (it falls from about y 250 onto
# its ruler at y 351), so a top-left note would sit on the title on frame 0.
NOTE_SLOT = {"clock": "tl", "hook": "br"}
BADGES = [
    {"id": "model", "title": "Model", "text": "Body 2.0 kg·m², assumed.", "t0": A("vo03:Suddenly,"), "t1": cut("why") + 0.5, "slot": "tr"},
    {"id": "friction", "text": "Friction ignored", "t0": cut("takeaway") + 0.6, "t1": cut("tease"), "slot": "tr"},
    # the skater is an ink illustration: the tag names the picture as she comes into view ("use"), and leaves on "skater"
    {"id": "skater", "text": "Illustration", "t0": A("vo05:use"), "t1": A("vo05:skater"), "slot": "tr", "framing": True},
]
NOTE_OUT = 0.3                                           # hud.js: a note fades out over 0.3 s after its t1


def rate_text(rate):                                     # kits/cinema/sci/clock.js rateText, with this episode's words
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
assert [n["text"] for n in CLOCK_NOTES] == ["2× slower"] and CLOCK_NOTES[0]["t0"] == cut("tease"), CLOCK_NOTES
NOTES = ([{"slot": NOTE_SLOT["clock"], "t0": n["t0"], "t1": min(n["t1"], EC), "text": n["text"], "speed": True} for n in CLOCK_NOTES]
         + [{"slot": NOTE_SLOT["hook"], "t0": 0.0, "t1": cut("normal"), "text": "2× slower", "speed": True}]
         + [{**b, "speed": False} for b in BADGES])
assert all(n["slot"] == "tl" for n in NOTES if n["speed"] and n["t0"] >= cut("normal")), "the speed column is top-left"
assert all(b["slot"] == "tr" for b in BADGES), "the standing cheats are top-right"
for n in NOTES:
    assert not n.get("framing") or n["t1"] + NOTE_OUT - n["t0"] <= 4.0, (n, "a framing tag visits for 4 s at most")
for slot in ("tl", "tr"):
    for fr in range(int(DUR * FPS) + 1):
        t = fr / FPS
        on = [n["text"] for n in NOTES if n["slot"] == slot and n["t0"] <= t < n["t1"] + NOTE_OUT]
        assert len(on) <= 2, (slot, t, on)
# the readout's corner: no note in the top-left while the plate is up (its 0.4 s fade-out included)
assert all(n["t0"] >= SPINE[-1]["t1"] + 0.4 or n["t1"] + NOTE_OUT <= SPINE[0]["t0"] for n in NOTES if n["slot"] == "tl")


def view(look, dist, pitch, yaw=0.0, fov=32.0):
    return {"look": [round(v, 3) for v in look], "dist": round(dist, 2), "yaw": yaw, "pitch": pitch, "fov": fov}


def key(t, v, ease="p2", **over):
    return {"t": round(t, 4), **v, **over, "ease": ease}


HOOK = view([0.0, 95.0, 16.0], 900.0, 85.0)              # from above: the chair's circle between the title and the captions
TOP = view([0.0, 95.0, 30.0], 740.0, 85.0)
SIDE = view([0.0, 72.0, 0.0], 470.0, 12.0)
WIDE = view([60.0, 80.0, -10.0], 760.0, 8.0)
CAM = {
    "hook": [key(0.0, HOOK), key(cut("normal"), {**HOOK, "dist": 880.0}, "sine")],
    "normal": [key(cut("normal"), {**HOOK, "dist": 880.0}), key(A("vo02:Sit"), TOP, "p3"), key(cut("change"), {**TOP, "dist": 730.0}, "sine")],
    "change": [key(cut("change"), {**TOP, "dist": 730.0}), key(cut("why"), {**TOP, "dist": 700.0}, "sine")],
    # the turn: from above down to the side as "With no twist from outside" is said
    "why": [key(cut("why"), {**TOP, "dist": 700.0}), key(A("vo04:With"), {**TOP, "dist": 690.0}, "sine"), key(A("vo04:change."), SIDE, "p3"),
            key(cut("whoa"), {**SIDE, "dist": 480.0}, "sine")],
    "whoa": [key(cut("whoa"), {**SIDE, "dist": 480.0}), key(A("vo05:record,"), WIDE, "p3"), key(cut("measure"), {**WIDE, "dist": 770.0}, "sine")],
    "measure": [key(cut("measure"), TOP), key(cut("takeaway"), {**TOP, "dist": 750.0}, "sine")],
    "takeaway": [key(cut("takeaway"), {**TOP, "dist": 750.0}), key(cut("tease"), {**SIDE, "pitch": 30.0, "dist": 560.0}, "p3")],
    "tease": [key(cut("tease"), {**SIDE, "pitch": 30.0, "dist": 560.0}), key(EC, HOOK, "p3"), key(DUR, HOOK, "sine")],
}
SHOTS = [{"at": CUTS[b["id"]], "name": b["id"]} for b in BEATS]

TITLE = {"series": "Rest Frame · No. 005", "title": "The spinning *chair*", "t1": round(cut("normal") - 0.45, 4), "y": 0.183, "sig": 0.3}
# caption pages the phrase pager can't break well on its own (set/captions_py.py: ' / ' row, ' | ' page)
CAP_FIX = [
    'Measure it: | ghosts a tenth / of a second apart.',
    'The record, set by / a young Canadian skater: | three hundred forty-two turns a minute.',
]

film = {
    "id": "rest-frame-005", "fps": FPS, "bpm": BPM, "dur": DUR, "poster": 0.0,
    "_doc": "Compiled by compile.py from script.md, vo/ and the direction in compile.py. Do not edit by hand.",
    "shots": SHOTS, "beats": BEATS, "clock": KEYS, "takes": TAKES, "cue": CUE, "spine": SPINE, "spineAt": SPINE_AT, "dim": DIM,
    "notes": NOTE_SLOT,
    "model": MODEL, "moves": MOVES, "hookMoves": HOOK_MOVES, "dt": DT, "ladders": LADDERS,
    "skater": {"x": 115.0, "z": -25.0, "h": 162.0},
    "labels": LABELS, "badges": BADGES, "cam": CAM,
    "captionY": 0.632, "title": TITLE, "hookNote": {"text": "2× slower", "t1": cut("normal")},
    "captions": phrase_captions(f, max_chars=24, fix=CAP_FIX, until=EC - 0.3), "endCard": EC,
    "end": {"title": "Next drop: the ten-meter *straw*", "follow": "Follow Rest Frame",
            "foot": "Olivia Oliver, 342 rpm, Warsaw 2015: the Guinness record for the fastest spin on ice skates (as of 2026)."},
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}

ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS]
ev.append({"t": round(T_PUSH, 4), "kind": "contact", "tag": "push"})
for i, (a, b, r) in enumerate(CUE["moves"]):
    ev.append({"t": round(b, 4), "kind": "spring", "tag": f"move{i + 1}"})                  # a boing as the arms settle
    ev.append({"t": round(a, 4), "kind": "swell" if r < 0.5 else "energy.loss", "tag": f"move{i + 1}:start"})
ev.append({"t": round(cut("measure"), 4), "kind": "time.slow", "tag": "measure:freeze"})
ev.append({"t": A("vo05:minute."), "kind": "reveal", "tag": "342"})
for k in ("out", "in", "hook", "loop"):
    L = LADDERS[k]
    for i, t in enumerate(L["stamps"]):
        # one shutter per three ghosts; none in the last 0.15 s or past the end (the loop's ladder runs on past DUR,
        # and a click cut off by the film's end can't be heard or synced)
        if math.isfinite(t) and 0.05 < t < min(L["t1"], DUR - 0.15) and i % 3 == 0:
            ev.append({"t": round(t, 4), "kind": "strobe", "tag": f"{k}:g{i}"})
for lb in LABELS:
    ev.append({"t": lb["t0"], "kind": "label", "tag": lb["id"]})
for bd in BADGES:
    ev.append({"t": round(bd["t0"], 4), "kind": "badge", "tag": bd["id"], "text": bd["text"]})
ev.append({"t": SPINE[0]["t0"], "kind": "counter.show", "tag": "spine"})
for a, s in zip(SPINE, SPINE[1:]):
    if s["label"] != a["label"]:                         # a tick where the label changes (the whoa's cut only widens the plate)
        ev.append({"t": s["t0"], "kind": "counter.tick", "tag": f"spine:{s['label']}"})
ev.append({"t": A("vo06:fifty."), "kind": "counter.end", "tag": "spine:fifty"})
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
    if isinstance(x, tuple):
        return [finite(v) for v in x]
    return x


(HERE / "film.json").write_text(json.dumps(finite(film), indent=1, ensure_ascii=False, allow_nan=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
print(f"film.json: {len(SHOTS)} shots, {len(KEYS)} clock keys, {len(TAKES)} takes, {len(LABELS)} labels, {len(BADGES)} badges, end card {EC} s, {DUR} s")
print(f"sheet.json: {len(sheet['events'])} events ({'with' if shown else 'without'} the page's cue measurements)")
for b in BEATS:
    print(f"  {b['id']:<9} {b['t0']:6.2f}–{b['t1']:6.2f}  cut {CUTS[b['id']]:.4f}")
print(f"  ratio {RATIO:.3f}: {RPM_OUT:.0f} → {RPM_IN:.1f} rpm; steps {STEP_OUT:.1f}° → {STEP_IN:.1f}°; push {T_PUSH:.3f}; moves {[[round(a, 2), round(b, 2), r] for a, b, r in CUE['moves']]}; loop {R_t:.3f}")
