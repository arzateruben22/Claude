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
R_BOB = 3.4
LANE = {"small": 0.0, "big": -40.0}                      # z of each lane: the small swing in front
TH = {"small": -10 * D2R, "big": -30 * D2R}              # both pulled to the left (−x), released toward +x
PEND = {k: Pendulum(L, TH[k], pivot=(0.0, PIV_Y, LANE[k])) for k in TH}
T10, T30 = PEND["small"].T, PEND["big"].T                # 2.00385 s, 2.03486 s (c2, c11)
Q10, Q30 = T10 / 4, T30 / 4                              # the bottom passes: 0.5010 s, 0.5087 s (c4)
DT, NG = 0.1, 11                                         # a ghost every 1/10 s: k = 0 … 10 (one swing)

# ── the pendulum wave (whoa): Harvard's fifteen, 51 … 65 back-and-forth swings in 60 s (c10) ────
WAVE_N, WAVE_TH, WAVE_Y, WAVE_DZ = 15, -15 * D2R, 62.0, -5.0
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
    {"t": 0.0, "rate": SLOW_H},
    {"t": F_h, "rate": 0.0, "ramp": FREEZE},
    {"t": cut("normal"), "rate": 1.0},
    {"t": R_n + T10 / 2, "rate": SLOW_N, "ramp": RAMP},
    {"t": cut("change"), "rate": SLOW},
    {"t": cut("whoa"), "rate": 1.0},
    {"t": W_UPT, "rate": W_FAST, "ramp": W_UP},
    {"t": W_DNT, "rate": 1.0, "ramp": W_DN},
    {"t": cut("measure"), "rate": FAST_M},
    {"t": F_m, "rate": 0.0, "ramp": M_FRZ},
    {"t": cut("takeaway"), "rate": 1.0},
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

TAKES = {
    "hook": {"t0": -1e9, "t1": cut("normal"), "tauR": clk.tau(0.0) - HOOK_TAU0, "pend": ["small", "big"]},
    "normal": {"t0": cut("normal"), "t1": cut("change"), "tauR": clk.tau(R_n), "R": R_n, "pend": ["small"]},
    "change": {"t0": cut("change"), "t1": cut("why"), "tauR": clk.tau(R_c), "R": R_c, "pend": ["small", "big"]},
    "why": {"t0": cut("why"), "t1": cut("whoa"), "tauR": clk.tau(R_w), "R": R_w, "pend": ["small", "big"]},
    "wave": {"t0": cut("whoa"), "t1": cut("measure"), "tauR": clk.tau(W_R), "R": W_R, "pend": []},
    "measure": {"t0": cut("measure"), "t1": 1e9, "tauR": clk.tau(R_m), "R": R_m, "pend": ["small", "big"]},
}
# where each take's ghost ladders start (τ local) and when their stamps show
LADDER = {"hook": 0.0, "normal": T10 / 2, "change": 0.0, "why": 0.0}
for name, tau0 in LADDER.items():
    tk = TAKES[name]
    tk["ladder"] = tau0
    tk["stamps"] = [round(clk.tOf(tk["tauR"] + tau0 + k * DT), 6) for k in range(NG)]
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
    "why": {"R": R_w, "bottom": BOTTOM["why"], "pull": A("vo04:pull"), "speed": A("vo04:triple#2"), "rungs": A("vo04:same")},
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
    {"id": "nm-apart", "text": "1/10 s apart", "color": "ghost", "t0": A("vo02:Ghosts"), "t1": cut("change"), "anchor": {"ghost": ["normal", "small", 9]}, "side": 1, "fixed": True},
    {"id": "ch-30", "text": "30°", "color": "ghost", "t0": A("vo03:farther."), "t1": cut("why"), "anchor": {"bob": ["change", "big"]}, "side": -1, "fixed": True},
    {"id": "ch-10", "text": "10°", "color": "ghost", "t0": A("vo03:Let"), "t1": cut("why"), "anchor": {"bob": ["change", "small"]}, "side": -1, "fixed": True},
    {"id": "wy-pull-big", "text": "pull ×2.9", "color": "force", "t0": A("vo04:pull"), "t1": R_w, "anchor": {"arrow": "wy-f-big"}, "side": 1, "fixed": True},
    {"id": "wy-pull-small", "text": "pull ×1", "color": "force", "t0": A("vo04:pull", 0.15), "t1": R_w, "anchor": {"arrow": "wy-f-small"}, "side": 1, "fixed": True},
    {"id": "wy-v-big", "text": "speed ×3", "color": "motion", "t0": A("vo04:triple#2"), "t1": A("vo04:same", -0.15), "anchor": {"arrow": "wy-v-big"}, "side": 1, "fixed": True},
    {"id": "wy-v-small", "text": "speed ×1", "color": "motion", "t0": A("vo04:triple#2", 0.15), "t1": A("vo04:same", -0.15), "anchor": {"arrow": "wy-v-small"}, "side": 1, "fixed": True},
    {"id": "wy-same", "text": "same moments", "color": "ghost", "t0": A("vo04:same"), "t1": cut("whoa"), "anchor": {"ghost": ["why", "big", 8]}, "side": 1, "fixed": True},
    {"id": "wo-15", "text": "15 lengths", "color": "ghost", "t0": A("vo05:shorter."), "t1": A("vo05:For", -0.1), "anchor": {"wave": 14}, "side": 1, "fixed": True},
    {"id": "wo-line", "text": "in line", "color": "ghost", "t0": W_LINE, "t1": cut("measure") - 0.3, "anchor": {"wave": 0}, "side": 1, "fixed": True},
    {"id": "ms-home", "text": "home", "color": "motion", "t0": A("vo06:behind."), "t1": cut("takeaway") - 0.3, "anchor": {"bob": ["measure", "small"]}, "side": 1, "fixed": True},
    {"id": "ms-behind", "text": "0.31 s behind", "color": "energy", "t0": A("vo06:behind.", 0.12), "t1": cut("takeaway") - 0.3, "anchor": {"bob": ["measure", "big"]}, "side": -1, "fixed": True},
    {"id": "ms-1in57", "text": "30°: 1.7% slower than a tiny swing", "color": "ghost", "t0": A("vo06:sixty."), "t1": cut("takeaway") - 0.3, "anchor": {"string": "big", "u": 0.3}, "side": 1, "fixed": True, "v": "middle"},
    {"id": "tk-len", "text": "same length", "color": "ghost", "t0": A("vo07:Length"), "t1": A("vo07:A", -0.1), "anchor": {"string": "small", "u": 0.45}, "side": 1, "fixed": True, "v": "middle"},
    {"id": "tk-fast", "text": "faster, not quite enough", "color": "motion", "t0": A("vo07:almost"), "t1": None, "anchor": {"bob": ["measure", "big"]}, "side": 1, "fixed": True},
]
BADGES = [
    {"id": "galileo", "title": "Galileo's claim", "text": "Wide or narrow, every swing takes the same time.", "t0": A("vo04:Galileo"), "t1": A("vo04:Three", -0.2), "slot": "tr"},
    {"id": "harvard", "text": "Harvard's design: 51 to 65 swings a minute", "t0": A("vo05:Only"), "t1": cut("measure") - 0.3, "slot": "bl"},
    {"id": "ideal", "title": "Ideal pendulums", "text": "No air, no friction. The motion is exact, not the small-swing formula.", "t0": cut("takeaway") + 0.8, "t1": None, "slot": "tr"},
]

# ── camera: orbit keys per shot (yaw 0 = the measure view, looking along −z; pitch > 0 looks down) ─
def cam(look, dist, yaw=0.0, pitch=14.0, fov=32.0):
    return {"look": [round(v, 3) for v in look], "dist": round(dist, 2), "yaw": yaw, "pitch": pitch, "fov": fov}


def key(t, v, ease="p2", **over):
    return {"t": round(t, 4), **v, **over, "ease": ease}


SET = cam([0.0, 62.0, -20.0], 520.0)                      # both lanes, pivots to floor
SMALL = cam([0.0, 58.0, 0.0], 470.0, pitch=10.0)          # the front swing alone
HOOK = cam([4.0, 40.0, -20.0], 400.0, pitch=16.0)         # the bottoms of both arcs, under the title
WAVE_END = cam([0.0, 40.0, -35.0], 300.0, yaw=0.0, pitch=4.0)
WAVE_TOP = cam([0.0, 30.0, -35.0], 210.0, yaw=0.0, pitch=62.0)
CAM = {
    "hook": [key(0.0, HOOK), key(cut("normal"), {**HOOK, "dist": 390.0}, "sine")],
    "normal": [key(cut("normal"), SMALL), key(cut("change"), {**SMALL, "dist": 455.0}, "sine")],
    "change": [key(cut("change"), SET), key(cut("why"), {**SET, "dist": 505.0}, "sine")],
    "why": [key(cut("why"), {**SET, "dist": 505.0}), key(A("vo04:So"), {**SET, "dist": 490.0}, "sine"), key(cut("whoa"), {**SET, "dist": 480.0, "look": [2.0, 60.0, -20.0]}, "sine")],
    # the turn: end-on (fifteen look like one) craning up over the row as "each a little shorter" is said
    "whoa": [key(cut("whoa"), WAVE_END), key(A("vo05:hang"), WAVE_END, "sine"), key(A("vo05:Only"), WAVE_TOP, "p3"), key(cut("measure"), {**WAVE_TOP, "dist": 200.0}, "sine")],
    "measure": [key(cut("measure"), SET), key(cut("takeaway"), {**SET, "dist": 500.0}, "sine")],
    "takeaway": [key(cut("takeaway"), {**SET, "dist": 500.0}), key(cut("tease"), {**SET, "dist": 515.0}, "sine")],
    "tease": [key(cut("tease"), {**SET, "dist": 515.0}), key(DUR, {**SET, "dist": 540.0, "look": [0.0, 50.0, -20.0]}, "sine")],
}
SHOTS = [{"at": CUTS[b["id"]], "name": b["id"]} for b in BEATS]

TITLE = {"series": "Rest Frame · No. 002", "title": "The swing's *secret*", "t1": round(cut("normal") - 0.45, 4), "y": 0.183, "sig": 0.3}
film = {
    "id": "rest-frame-002", "fps": FPS, "bpm": BPM, "dur": DUR, "poster": 0.0,
    "_doc": "Compiled by compile.py from script.md, vo/ and the direction in compile.py. Do not edit by hand.",
    "shots": SHOTS, "beats": BEATS, "clock": KEYS, "takes": TAKES, "cue": CUE,
    "swing": {"L": L, "pivotY": PIV_Y, "r": R_BOB, "lanes": LANE, "theta": TH, "dt": DT, "n": NG, "T": {"small": T10, "big": T30}, "thetaBigFreeze": TH_BIG_F},
    "wave": {"n": WAVE_N, "L": WAVE_L, "theta": WAVE_TH, "y": WAVE_Y, "dz": WAVE_DZ, "r": WAVE_R, "align": WAVE_ALIGN},
    "labels": LABELS, "badges": BADGES, "cam": CAM,
    "captionY": 0.632, "title": TITLE,
    "captions": f.captions(max_chars=24), "endCard": EC,
    "end": {"title": "Next drop: where does the bounce *go*?", "follow": "Follow Rest Frame"},
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
ev.append({"t": CUE["measure"]["counter"][0], "kind": "counter.show", "tag": "swings"})
ev.append({"t": TITLE["sig"], "kind": "signature", "tag": "title", "gain": -4.0})
ev.append({"t": EC, "kind": "signature", "tag": "end"})
ev.append({"t": W_LINE, "kind": "reveal", "tag": "in-line"})
ev.append({"t": A("vo04:same"), "kind": "reveal", "tag": "same-moments"})
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
