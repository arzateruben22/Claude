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
# bottom) · "const"
SPINE = [
    {"t0": cut("normal") + 0.3, "t1": cut("change"), "label": "bounce height", "unit": "cm", "dp": 0, "kind": "height", "take": "normal"},
    {"t0": cut("change"), "t1": cut("whoa"), "label": "lost, this knock", "unit": "%", "dp": 0, "kind": "const", "v": 100 * (1 - E_REST ** 2)},
    {"t0": cut("whoa"), "t1": cut("measure"), "label": "tennis ball height", "unit": "cm", "dp": 0, "kind": "stack"},
    {"t0": cut("measure"), "t1": A("vo06:A"), "label": "height missing", "unit": "cm", "dp": 0, "kind": "const", "v": DROP - TOP_H[0]},
    {"t0": A("vo06:A"), "t1": A("vo06:Even"), "label": "energy it took", "unit": "J", "dp": 3, "kind": "const", "v": 0.057 * 9.81 * (DROP - TOP_H[0]) / 100},
    {"t0": A("vo06:Even"), "t1": cut("takeaway"), "label": "ball warms by, at most", "unit": "°C", "dp": 4, "kind": "const",
     "v": 0.057 * 9.81 * (DROP - TOP_H[0]) / 100 / (57 * 2.0), "lit": [A("vo06:degree."), cut("takeaway")]},
    {"t0": cut("takeaway"), "t1": cut("tease") - 0.3, "label": "energy destroyed", "unit": "J", "dp": 3, "kind": "const", "v": 0.0,
     "lit": [A("vo07:destroys"), cut("tease") - 0.3]},
]

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
    {"id": "hk-hand", "text": "your hand", "color": "ghost", "t0": A("vo01:hand?"), "t1": cut("normal") - 0.35, "anchor": {"hand": "bench"}, "side": 1, "fixed": True},
    {"id": "nm-56", "text": "56 cm", "color": "motion", "t0": A("vo02:Fifty-six"), "t1": cut("change"), "anchor": {"point": [TOPX[0], TOP_H[0] + RB, 0]}, "side": 1, "fixed": True},
    {"id": "nm-32", "text": "32 cm", "color": "motion", "t0": A("vo02:thirty-two."), "t1": cut("change"), "anchor": {"point": [TOPX[1], TOP_H[1] + RB, 0]}, "side": 1, "fixed": True},
    {"id": "nm-18", "text": "18 cm", "color": "motion", "t0": A("vo02:eighteen."), "t1": cut("change"), "anchor": {"point": [TOPX[2], TOP_H[2] + RB, 0]}, "side": 1, "fixed": True},
    {"id": "ch-sound", "text": "sound", "color": "wave", "t0": A("vo03:sound."), "t1": cut("why") + 0.6, "anchor": {"ring": 1}, "side": 1, "fixed": True},
    {"id": "ch-heat", "text": "heat", "color": "energy", "t0": A("vo03:back."), "t1": cut("why") + 0.6, "anchor": {"ball": "macro"}, "side": -1, "fixed": True},
    {"id": "wy-joule", "text": "Joule's paddle wheel", "color": "ghost", "t0": A("vo04:James", 0.3), "t1": A("vo04:Energy#2", -0.2), "anchor": {"joule": "top"}, "side": 1, "fixed": True},
    {"id": "wy-warm", "text": "the water warms", "color": "energy", "t0": A("vo04:warmed."), "t1": A("vo04:Energy#2", -0.2), "anchor": {"joule": "therm"}, "side": 1, "fixed": True},
    {"id": "wy-heat", "text": "heat", "color": "energy", "t0": A("vo04:heat,"), "t1": cut("whoa"), "anchor": {"ball": "macro"}, "side": -1, "fixed": True},
    {"id": "wy-shake", "text": "shaking", "color": "pressure", "t0": A("vo04:shaking"), "t1": cut("whoa"), "anchor": {"point": [-30.0, 0.0, 0.0]}, "side": -1, "fixed": True},
    {"id": "wy-sound", "text": "sound", "color": "wave", "t0": A("vo04:sound,"), "t1": cut("whoa"), "anchor": {"ring": 2}, "side": 1, "fixed": True},
    {"id": "wo-hand", "text": "your hand", "color": "ghost", "t0": A("vo05:Drop"), "t1": A("vo05:The#2", -0.1), "anchor": {"hand": "stack"}, "side": 1, "fixed": True},
    {"id": "wo-7x", "text": "7× its fall", "color": "motion", "t0": A("vo05:hand."), "t1": cut("measure") - 0.35, "anchor": {"tennis": 1}, "side": 1, "fixed": True},
    {"id": "ms-44", "text": "44 cm missing", "color": "energy", "t0": A("vo06:missing"), "t1": cut("tease") - 0.3, "anchor": {"point": [-8.0, (DROP + TOP_H[0]) / 2 + RB, 0]}, "side": 1, "fixed": True, "v": "middle"},
]
BADGES = [
    {"id": "air", "text": "Air ignored", "t0": cut("normal") + 0.6, "t1": cut("change") - 0.2, "slot": "tr"},
    {"id": "illus", "text": "Not to scale", "t0": cut("change") + 0.3, "t1": A("vo04:James", -0.5), "slot": "tr"},
    {"id": "perfect", "text": "Ideal bounces", "t0": A("vo05:Drop"), "t1": cut("measure") - 0.3, "slot": "tr"},
]

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
film = {
    "id": "rest-frame-003", "fps": FPS, "bpm": BPM, "dur": DUR, "poster": 0.0,
    "_doc": "Compiled by compile.py from script.md, vo/ and the direction in compile.py. Do not edit by hand.",
    "shots": SHOTS, "beats": BEATS, "clock": KEYS, "takes": TAKES, "cue": CUE, "spine": SPINE,
    "bench": {"g": G, "drop": DROP, "r": RB, "e": E_REST, "x0": X0, "vx": VX, "dt": DT, "n": NG, "stickX": STICK_X, "land": T_LAND,
              "tops": TOPS, "topH": TOP_H, "dc": DC, "squash": SQUASH},
    "stack": {"thit": S_THIT, "drop": S_DROP, "R": S_R, "M": S_M, "m": S_m, "x": S_X, "handY": S_HAND_Y, "peak": [S_PEAK_T, S_PEAK_Y]},
    "joule": {"x": JOULE_X, "z": JOULE_Z, "s": 0.8},
    "labels": LABELS, "badges": BADGES, "cam": CAM, "hookNote": {"slow": [0.0, F_h], "paused": [F_h, cut("normal")]},
    "captionY": 0.632, "title": TITLE,
    "captions": f.captions(max_chars=24), "endCard": EC,
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
