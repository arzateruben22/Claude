"""Compile Reality Rulebook Season 3's long film lf01 AND its eight 9:16 parts from script + voice timings + this direction.

  python3 -I films/channels/physics/lf01/build.py            # the long film (16:9): lf01/film.json, sheet.json
  python3 -I films/channels/physics/lf01/build.py 3          # Part 3 of 8 (9:16): ep15/film.json, sheet.json   (parts.py writes the scripts)

One kitchen, one counter. The slow-motion factor F (k = log10 F) only goes up until the last beat: the counter is the live number, and every picture reads
its own local real time r = (t - t0) / F from the film clock. Numbers come from calc.py (calc.json). A part is a chapter on its own clock: the same scene,
the same events, anchored to the part's own voice.
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

PART = int(sys.argv[1]) if len(sys.argv) > 1 else 0
BSLOT = "tl" if PART else "tr"   # the badge sits top-left in the portrait parts, clear of the feeder and the counter
CHAPTERS = ["wings", "fly", "pop", "sound", "bullet", "leader", "light", "still"]
OUT = HERE if not PART else HERE.parent / f"ep{12 + PART}"
FPS, BPM = 30, 112.5
f = Film(OUT / "script.md", OUT / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
DUR, EC, HALF = f.duration, f.end_card, 0.5 / FPS
CALC = json.loads((HERE / "calc.json").read_text())
R = lambda x: round(x, 4)   # noqa: E731
BIG = 1e9


def cut(beat):
    return round([b for b in BEATS if b["id"] == beat][0]["t0"] - HALF, 6)


CUTS = {b["id"]: (0.0 if b["id"] == "hook" else cut(b["id"])) for b in BEATS}
# the voice line of each part of the film (long: one line per beat; a part: hook = vo01, the chapter = vo02, the sign-off = vo03)
if PART:
    NL = len(f.lines)    # 3 lines (hook, chapter, sign-off), or 4 when the chapter is split by a silent beat
    LID = {CHAPTERS[PART - 1]: "vo02", "hook": "vo01", "tease": f"vo{NL:02d}"}
    LAST = f"vo{NL:02d}"
else:
    LID = {"hook": "vo01", "wings": "vo02", "fly": "vo03", "pop": "vo04", "sound": "vo05", "bullet": "vo06", "leader": "vo07", "light": "vo08", "still": "vo09",
           "real": "vo10", "takeaway": "vo11", "tease": "vo12"}
    LAST = "vo12"


def W(ch, word, dt=0.0):
    if PART and ch == CHAPTERS[PART - 1] and NL == 4:     # a word may be in the first or the second half of a split chapter
        try:
            return A(f"vo02:{word}", dt)
        except Exception:
            return A(f"vo03:{word}", dt)
    return A(f"{LID[ch]}:{word}", dt)


def has(ch):
    return ch in LID


ENDSHOW = R(max(A(f"{LAST}:Thanks" if not PART else f"{LAST}:Part") - 0.2, DUR - 2.0)) if not PART else R(max(A(f"{LAST}:Full") - 0.2, DUR - 2.0))

# ── per chapter: factor keys (time, k), events, camera keys, badges ───────────────────────────────────────────────────────────
RAMP = 1.1
KEYS, EV, CAM, BADGES = [], {}, [], []
NEVER = [BIG, BIG]


def ck(t, look, fitW, yaw=0.0, ease="p2", pitch=3.0):
    return {"t": R(t), "look": [round(v, 3) for v in look], "fitW": fitW, "yaw": yaw, "pitch": pitch, "ease": ease}


CUP, PAN, BUB, APP = [-0.3, 1.0, -1.0], [1.57, 1.02, -1.0], [-2.05, 1.12, -1.05], [0.8, 0.98, -1.0]
BUB_T = [-2.05, 1.16, -1.05]   # the bubble sits above the caption plate: the camera looks a little below it
WIN, HUM, CHIP = [-1.0, 1.85, -1.8], [-1.39, 1.85, -1.45], [2.4, 0.97, -0.85]
WIDE = ([0.0, 1.2, -0.8], 5.6)
EV.update({"fly1": BIG, "fly2": BIG, "fly3": BIG, "fly4": BIG, "wire": NEVER, "bird": NEVER, "blur": NEVER, "cupfly": NEVER, "fly100": NEVER, "mosq": NEVER,
           "tapdrop": [BIG, BIG, BIG], "settle": BIG, "kernel": {"jump": BIG, "pop": BIG, "foamEnd": BIG}, "bubble": {"in": BIG, "pop": BIG}, "clap": BIG,
           "bullet": {"enter": BIG, "approach": BIG}, "storm": BIG, "leader": {"t0": BIG, "stepEvery": 3.0, "steps": 8, "ground": BIG}, "flash8": BIG, "light9": BIG,
           "chip": NEVER, "ruler": NEVER, "hair": NEVER, "pulse": BIG, "lab": NEVER, "back": BIG, "fades": []})
K0 = {"wings": 0.0, "fly": 2.0, "pop": 3.0, "sound": 3.0, "bullet": 4.0, "leader": 6.0, "light": 7.0, "still": 9.0}


def plateau(t, k0, k1, dur=RAMP):
    KEYS.extend([(R(t - 1.0), k0), (R(t + 0.1), k1)])   # the ramp lands on the spoken number as it is spoken


if PART:
    KEYS.append((0.0, K0[CHAPTERS[PART - 1]]))
else:
    KEYS.append((0.0, 0.0))
    KEYS.extend([(R(A("vo01:slower") - 0.2), 0.0), (R(A("vo01:slower") + 0.7), 0.301), (R(A("vo01:slower#2") - 0.2), 0.301), (R(A("vo01:slower#2") + 0.7), 0.602)])
    EV.update({"fly1": R(A("vo01:crosses") - 0.55), "fly2": R(A("vo01:slower") + 0.6), "fly3": R(A("vo01:slower#2") + 0.5)})
    CAM += [ck(0.0, WIDE[0], WIDE[1], -4.0), ck(A("vo01:Coffee") - 0.3, CUP, 1.5, 3.0), ck(A("vo01:fly") - 0.5, WIDE[0], 5.0, -3.0), ck(A("vo01:Now") + 0.2, WIDE[0], WIDE[1], 3.0, "sine")]

if has("wings"):
    if not PART:
        EV["wire"] = [R(W("wings", "No") + 0.2), R(W("wings", "Ten") - 0.6)]
        CAM += [ck(W("wings", "No"), WIDE[0], WIDE[1], 0.0), ck(W("wings", "Ten") - 1.5, WIDE[0], 5.2, 3.0, "sine")]
        plateau(W("wings", "Ten"), 0.602, 1.0)
    else:
        CAM += [ck(0.0, HUM, 0.8, -2.0)]     # the part opens on the bird itself, blurred at full speed, and slows at "ten times"
        plateau(W("wings", "Ten"), 0.0, 1.0)
    EV["bird"] = [0.0 if PART else R(W("wings", "hummingbird") - 0.6), R(W("wings", "But") - 0.2)]
    if PART: EV["blur2"] = [0.0, R(W("wings", "Ten") - 0.2)]
    EV["blur"] = [R(W("wings", "Here's")), R(W("wings", "But") - 0.3)]
    EV["cupfly"] = [R(W("wings", "But") + 0.2), R(W("wings", "But") + 24.0)]
    CAM += [ck(W("wings", "hummingbird") - 0.9, HUM, 0.8, -2.0), ck(W("wings", "Here's") - 0.5, HUM, 0.72, 2.0, "sine"), ck(W("wings", "But") - 0.5, HUM, 0.72, 1.0, "sine"),
            ck(W("wings", "But") + 0.1, [-0.3, 1.1, -1.0], 0.5, -6.0)]
    CAM += [ck(DUR if False else W("wings", "blur#2") + 3.0, [-0.3, 1.1, -1.0], 0.5, 3.0, "sine")] if PART else []
    BADGES.append({"id": "code", "kind": "tag", "text": "Model · drawn by code", "t0": R(W("wings", "Ten") - 5.0), "t1": R(cut("tease") - 0.3 if PART else cut("takeaway")), "slot": BSLOT})

if has("fly"):
    if not PART:
        plateau(W("fly", "hundred"), 1.0, 2.0)
    else:
        CAM += [ck(0.0, [-0.3, 1.1, -1.0], 0.5, 3.0)]
    EV["fly100"] = [R(W("fly", "First,") + 0.2), R(W("fly", "mosquito's"))]
    EV["mosq"] = [R(W("fly", "mosquito's")), R(W("fly", "tap") - 0.8)]
    EV["tapdrop"] = [R(W("fly", "swells") - 0.3), R(W("fly", "falls")), R(W("fly", "hits") + 0.1)]
    EV["settle"] = R(W("fly", "settles"))
    CAM += [ck(W("fly", "First,") - 0.3, [-0.3, 1.12, -1.0], 0.4, 6.0, "sine"), ck(W("fly", "tap") - 0.9, [-0.3, 1.1, -1.0], 0.34, -5.0),
            ck(W("fly", "hits") - 0.6, CUP, 0.26, 5.0), ck(W("fly", "settles"), CUP, 0.3, -4.0, "sine"), ck(W("fly", "But") + 0.2, CUP, 0.5, 3.0)]
    if PART:
        BADGES.append({"id": "code", "kind": "tag", "text": "Model · drawn by code", "t0": R(0.5), "t1": R(cut("tease") - 0.3), "slot": BSLOT})

if has("pop"):
    if not PART:
        plateau(W("pop", "thousand"), 2.0, 3.0)
    EV["kernel"] = {"jump": R(W("pop", "jumps") - 0.6), "pop": R(W("pop", "splits") - 0.1), "foamEnd": R(W("pop", "settles"))}
    EV["bubble"] = {"in": R(W("pop", "sink,") - 0.4), "pop": R(W("pop", "pops#2") - 0.1)}
    if PART:
        CAM += [ck(0.0, PAN, 0.5, 8.0, "p2", 20.0), ck(W("pop", "Then") + 0.3, PAN, 0.22, -4.0, "p2", 42.0)]
        BADGES.append({"id": "code", "kind": "tag", "text": "Model · drawn by code", "t0": R(0.5), "t1": R(cut("tease") - 0.3), "slot": BSLOT})
    else:
        CAM += [ck(W("pop", "thousand") - 0.2, PAN, 0.5, 8.0, "p2", 20.0), ck(W("pop", "Then") + 0.3, PAN, 0.22, -4.0, "p2", 42.0)]
    CAM += [ck(W("pop", "splits") - 1.2, PAN, 0.24, 4.0, "p2", 42.0), ck(W("pop", "sink,") - 1.6, PAN, 0.26, 3.0, "sine", 40.0), ck(W("pop", "sink,") - 0.2, BUB, 0.4, -8.0),
            ck(W("pop", "pops#2") - 0.8, BUB_T, 0.17, 6.0), ck(W("pop", "And#2") + 0.3, BUB_T, 0.3, -4.0, "sine")]

if has("sound"):
    EV["clap"] = R(cut("sound") + 16.8) if not PART else R(cut("body") + 16.8)
    if PART:
        CAM += [ck(0.0, WIDE[0], WIDE[1], 0.0)]
        BADGES.append({"id": "code", "kind": "tag", "text": "Model · drawn by code", "t0": R(0.5), "t1": R(cut("tease") - 0.3), "slot": BSLOT})
    CAM += [ck(W("sound", "Now,") + 0.6, [1.0, 1.2, -0.8], 2.6, -5.0), ck(W("sound", "five") - 0.6, WIDE[0], 5.4, 5.0, "sine"), ck(W("sound", "Something") - 0.6, [0.4, 1.0, -1.0], 1.8, -5.0)]
    if not PART:
        CAM = [ck(cut("sound") - 0.2, WIDE[0], WIDE[1], 0.0)] + CAM

if has("bullet"):
    if not PART:
        plateau(W("bullet", "thousand"), 3.0, 4.0)
    EV["bullet"] = {"enter": R(W("bullet", "dimples.") + 2.0), "approach": R(W("bullet", "small,") - 0.2)}
    CAM += ([ck(0.0, APP, 1.1, 6.0)] if PART else [ck(cut("bullet") - 0.2, APP, 1.1, 6.0)])
    CAM += [ck(W("bullet", "small,") + 0.6, APP, 0.3, -6.0), ck(W("bullet", "dimples.") - 0.4, APP, 0.3, 4.0, "sine"), ck(W("bullet", "Then") + 0.2, [0.9, 0.98, -1.0], 0.4, 5.0, "sine"),
            ck(W("bullet", "And") + 0.2, [1.1, 1.0, -1.0], 1.1, -5.0, "sine"), ck(W("bullet", "But") + 0.2, [0.4, 1.0, -1.0], 3.0, 3.0)]
    if PART:
        BADGES.append({"id": "code", "kind": "tag", "text": "Model · drawn by code", "t0": R(0.5), "t1": R(cut("tease") - 0.3), "slot": BSLOT})

if has("leader"):
    if not PART:
        plateau(W("leader", "million"), 4.0, 6.0)
    EV["storm"] = R(W("leader", "Beyond"))
    EV["leader"] = {"t0": R(W("leader", "jumps.") - 0.3), "stepEvery": 3.0, "steps": 8, "ground": R(W("leader", "touches") + 0.3)}
    CAM += ([ck(0.0, WIN, 2.8, -3.0)] if PART else [ck(cut("leader") - 0.2, WIN, 2.8, -3.0)])
    CAM += [ck(W("leader", "First,") - 0.3, [-1.2, 2.3, -1.8], 3.0, 5.0, "sine"), ck(W("leader", "Look") + 0.2, [-1.2, 2.0, -1.8], 2.8, -4.0, "sine"), ck(W("leader", "And#3") + 0.4, [-0.6, 1.5, -1.0], 3.8, 3.0)]
    BADGES.append({"id": "skip", "kind": "tag", "text": "Skipping ahead", "t0": R(W("leader", "So")), "t1": R(W("leader", "And#3") - 0.2), "slot": BSLOT})
    if PART:
        BADGES.append({"id": "code", "kind": "tag", "text": "Model · drawn by code", "t0": R(0.5), "t1": R(W("leader", "So") - 0.2), "slot": BSLOT})

if has("light"):
    if PART:
        KEYS.append((0.0, 6.0)) if False else None
        plateau(W("light", "million"), 6.0, 7.0)
    else:
        plateau(W("light", "million"), 6.0, 7.0)
    plateau(W("light", "hundred#2"), 7.0, 8.0)
    plateau(W("light", "billion"), 8.0, 9.0)
    EV["flash8"] = R(W("light", "flash") - 0.3)
    EV["light9"] = R(W("light", "glowing") + 1.1)
    CAM += ([ck(0.0, WIDE[0], WIDE[1], -3.0)] if PART else [ck(cut("light") - 0.2, WIDE[0], WIDE[1], -3.0)])
    TC = EV["light9"] + 2.2 / (CALC["light"]["m_per_ns"] * 1e9 / 1e9 * 1.0)   # (placeholder, replaced below)
    TC = EV["light9"] + 2.2 / 0.2998                                         # the front reaches the cup (2.2 m from the lens at 0.2998 m per slowed second)
    CAM += [ck(W("light", "million") - 0.2, WIDE[0], WIDE[1], -3.0, "sine"), ck(W("light", "million") + 3.5, [-1.0, 1.4, -1.0], 2.8, 8.0, "sine"), ck(W("light", "hundred#2") - 0.2, [0.5, 1.0, -1.0], 2.4, -6.0, "sine"),
            ck(W("light", "flash") - 0.8, WIDE[0], 5.4, 0.0, "sine"), ck(W("light", "Now#2") + 0.5, WIDE[0], 5.2, 4.0, "sine"),
            ck(W("light", "Someone") - 0.2, [-2.0, 1.0, -0.9], 2.2, -10.0, "sine"), ck(EV["light9"] + 1.5, [-2.0, 1.0, -0.9], 2.2, -10.0, "sine"),
            ck(TC - 3.6, [-1.0, 1.0, -1.0], 1.2, -62.0, "sine", 4.0), ck(TC + 4.6, [0.15, 1.0, -1.0], 1.0, -48.0, "sine", 4.0),
            ck(W("light", "seventeen") - 0.6, WIDE[0], 5.4, -3.0, "sine"), ck(W("light", "corner,") - 0.2, CHIP, 0.9, 4.0)]
    if PART:
        BADGES.append({"id": "code", "kind": "tag", "text": "Model · drawn by code", "t0": R(0.5), "t1": R(cut("tease") - 0.3), "slot": BSLOT})

if has("still"):
    L = "still"
    if PART:
        KEYS.append((0.0, 9.0)) if False else None
    plateau(W(L, "billion#2"), 9.0, 10.0)
    plateau(W(L, "billion#3"), 10.0, 11.0)
    plateau(W(L, "trillion"), 11.0, 12.0)
    EV["chip"] = [R(W(L, "Here,")), R(W(L, "Keep"))]
    EV["ruler"] = [R(W(L, "Now,") - 0.3), R(W(L, "Here's") - 0.2)]
    EV["hair"] = [R(W(L, "human") - 0.2), R(W(L, "takes") - 0.3)]
    EV["pulse"] = R(W(L, "Keep"))
    CAM += ([ck(0.0, CHIP, 0.8, 4.0)] if PART else [ck(cut("still") - 0.2, CHIP, 0.8, 4.0)])
    CAM += [ck(W(L, "Keep") + 0.3, [-2.3, 0.93, -1.0], 0.5, -4.0, "p2", 30.0), ck(W(L, "Now,") + 0.5, [-2.43, 0.91, -1.0], 0.1, 4.0, "sine", 45.0),
            ck(W(L, "Here's") - 0.2, [-2.45, 0.91, -1.0], 0.03, -3.0, "sine", 50.0), ck(EV["hair"][0] - 0.3 - 0.4, [-2.45, 0.91, -1.0], 0.03, -3.0, "sine", 50.0), ck(EV["hair"][0] - 0.3 + 0.1, [0.0, 3.0, 0.0], 0.0006, 0.0, "p2", 0.0),
            ck(EV["hair"][1] + 4.1 - 0.1, [0.0, 3.0, 0.0], 0.0006, 0.0, "p2", 0.0), ck(EV["hair"][1] + 4.1 + 0.2, WIDE[0], 5.4, 0.0, "p2", 3.0)]
    EV["fades"] = [R(EV["hair"][0] - 0.3), R(EV["hair"][1] + 4.1)]
    if PART:
        BADGES.append({"id": "code", "kind": "tag", "text": "Model · drawn by code", "t0": R(0.5), "t1": R(cut("tease") - 0.3), "slot": BSLOT})

if not PART:
    # the close: the lab bench (MIT), then the kitchen again
    EV["lab"] = [cut("real"), cut("takeaway")]
    EV["back"] = R(A("vo11:Now"))
    EV["fly4"] = R(A("vo11:fly") + 0.1)
    plateau(A("vo11:Now"), 12.0, 0.0, 1.5)
    EV["fades"] = EV.get("fades", []) + [cut("real") + 0.0, cut("takeaway")]
    CAM += [ck(cut("real") - 0.2, WIDE[0], WIDE[1], 3.0, "sine"), ck(cut("real") + 0.1, [0.0, 2.85, 0.0], 1.0, 0.0), ck(cut("takeaway") - 0.2, [0.0, 2.85, 0.0], 1.0, 0.0), ck(cut("takeaway") + 0.1, WIDE[0], WIDE[1], 0.0), ck(DUR, WIDE[0], WIDE[1], 3.0, "sine")]
    BADGES += [{"id": "code", "kind": "tag", "text": "Model · drawn by code", "t0": R(A("vo02:Ten") - 5.0), "t1": R(cut("takeaway")), "slot": BSLOT},
               {"id": "bench", "kind": "tag", "text": "Model of the MIT setup", "t0": R(cut("real") + 3.0), "t1": R(cut("takeaway") - 0.4), "slot": BSLOT}]
    _seen = set(); BADGES = [b for b in BADGES if not (b["id"] in _seen or _seen.add(b["id"]))]

# one small honesty badge for the whole film (and each part, which is watched alone): simulations are never presented as footage; no other chips
BADGES = [{"id": "code", "kind": "tag", "text": "Drawn by code · model", "t0": R(0.6), "t1": R(cut("tease") - 0.3) if PART else R(cut("tease") - 0.3), "slot": BSLOT}]
if not PART:
    BADGES.append({"id": "bench", "kind": "tag", "text": "Model of the MIT experiment", "t0": R(cut("real") + 3.0), "t1": R(cut("takeaway") - 0.4), "slot": BSLOT})

# the factor keys: sort, round, and guard the order
KEYS = sorted({(R(t), R(k)) for t, k in KEYS}, key=lambda x: (x[0], x[1]))
KEYS = [(t, k) for t, k in KEYS]
for (t0, _), (t1, _) in zip(KEYS, KEYS[1:]):
    assert t1 >= t0
LABEL_TXT = {0.0: "1 second", 0.301: "2 seconds", 0.602: "4 seconds"}
for r in CALC["rows"]:
    LABEL_TXT[round(math.log10(r["factor"]), 3)] = r["lasts"]
LBL = [[-1e9, f"1 real second now lasts {LABEL_TXT[round(KEYS[0][1], 3)]}"]]
for (t0, k0), (t1, k1) in zip(KEYS, KEYS[1:]):
    if abs(k1 - k0) > 1e-6:
        LBL.append([R(t1 + 0.9), f"1 real second now lasts {LABEL_TXT[round(k1, 3)]}"])
CAM.sort(key=lambda k: k["t"])
SPINE = [{"t0": 0.45, "t1": R(cut("tease") - 0.3) if PART else R(cut("takeaway") + 12.0), "label": "slow-motion"}]
SPINE_AT = [[-1e9, [0.5, 0.29]]] if PART else [[-1e9, [0.3, 0.19]]]
TITLES = ["Watch a wing, slowed ten times", "A fly's wings, then a splash", "A popcorn pop, in slow motion", "Watch sound cross a kitchen", "A bullet, through an apple, slowly",
          "Lightning, a million times slower", "Slow light until it crawls", "Slower than a snail: light"]
if PART:
    END = {"title": f"Part {PART} of *8*", "follow": "Full video on YouTube · Follow Reality Rulebook", "foot": "Reality Rulebook · Season 3"}
    CAPCH, CAPY = 20, 0.62
else:
    END = {"title": "Next drop: why the sky is *blue*", "follow": "Follow Reality Rulebook", "foot": "Velten et al., femto-photography (2012-2013)."}
    CAPCH, CAPY = 44, 0.77

film = {
    "id": f"reality-rulebook-s3p{PART}" if PART else "reality-rulebook-lf01", "fps": FPS, "bpm": BPM, "dur": DUR, "poster": 0.0,
    "_doc": "Compiled by build.py from script.md, vo/ and the direction in build.py. Do not edit by hand.",
    "scene": "../lf01/scene.mjs" if PART else "scene.mjs", "part": PART,
    "shots": [{"at": CUTS[b["id"]], "name": b["id"]} for b in BEATS], "beats": BEATS, "cue": {"cuts": CUTS},
    "spine": SPINE, "spineAt": SPINE_AT, "factorKeys": KEYS, "ramp": RAMP, "labelKeys": LBL, "ev": EV, "cam": CAM,
    "calc": {"c": CALC["c"], "hz": {"hum": 50.0, "fly": 200.0, "mosq": 500.0}, "bubble_t": CALC["bubble"]["t_s"], "bullet": CALC["bullet"],
             "sound": 343.0, "leader": CALC["leader"], "light": CALC["light"]["m_per_ns"], "hair_m": CALC["hair"]["m"]},
    "badges": BADGES, "captionY": CAPY,
    "title": ({"series": f"Reality Rulebook · Season 3 · Part {PART} of 8", "title": TITLES[PART - 1]} if PART else {"series": "Reality Rulebook · Season 3", "title": "How Much Would You Slow Time to Watch Light Move?"}),
    "disclosures": {"aiVoice": True},
    "captions": [pg for pg in phrase_captions(f, max_chars=CAPCH, fix=[], until=ENDSHOW - 0.3) if pg["t0"] < ENDSHOW - 0.35], "endShow": ENDSHOW, "endCard": EC, "end": END,
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}
if PART:
    film["theme"] = "../theme.json"
ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS]
ev.append({"t": SPINE[0]["t0"], "kind": "counter.show", "tag": "spine"})
for bd in BADGES:
    ev.append({"t": R(bd["t0"]), "kind": "badge", "tag": bd["id"], "text": bd.get("text", "")})
for nm, t in (("pop", EV["kernel"]["pop"]), ("clap", EV["clap"]), ("bullet", EV["bullet"]["enter"]), ("strike", EV["leader"]["ground"])):
    if t < BIG / 2:
        ev.append({"t": t, "kind": "contact", "tag": nm})
ev.append({"t": 0.0, "kind": "signature", "tag": "title", "gain": -4.0})
ev.append({"t": ENDSHOW, "kind": "signature", "tag": "end"})
sheet = {"duration": DUR, "fps": FPS, "preset": "restframe-bench", "duck_db": -9.0,
         "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: (e["t"], e["kind"])),
         "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}
(OUT / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False, allow_nan=False))
(OUT / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
print(f"{OUT.name}/film.json: {len(film['shots'])} shots, {len(CAM)} camera keys, {len(film['captions'])} caption pages, {DUR:.1f} s ({int(DUR//60)}:{DUR%60:04.1f})" + (f", Part {PART}: {TITLES[PART-1]}" if PART else ""))
for b in BEATS:
    print(f"  {b['id']:<9} {b['t0']:7.2f}–{b['t1']:7.2f}  ({b['t1']-b['t0']:.1f} s)")
