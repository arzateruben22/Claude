"""Compile Rest Frame No. 001, "Thrown or dropped?": script + voice timings + this direction → film.json (the
scene's clock: shots, the time warp, the takes, the cue table, camera keys, labels, badges, readouts,
captions, end card) and sheet.json (the studio's cue sheet). Nothing here is a hand-typed time: every
moment hangs on a beat or a spoken word, and every physical moment (a release, a ghost, a landing) is
solved backwards from the word it must land on through the closed-form fall and the clock.

  python3 -I films/channels/physics/ep01/compile.py

Anchors: "vo02:down" is when "down" starts in line vo02; "#3" the third match; "beat:why" a beat's start
(kits/cinema/script/timeline.py). Cuts sit half a frame before a beat's first frame, so no frame's shutter
(the finish blurs over half a frame) ever straddles two takes.

If build/cues-rest-frame-001-9x16.json exists (node kits/cinema/film/render.mjs --film . --cues), its
measured positions and first-shown times are merged into the sheet (pan, and the studio's picture-sync check).
"""
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]                                   # films/channels/physics/ep01 → repo root
sys.path.insert(0, str(ROOT / "kits/cinema/script"))
from timeline import Film   # noqa: E402

FPS, BPM = 30, 112.5
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}
DUR = f.duration
EC = f.end_card                                          # the end card's first contact (its signature)
HALF = 0.5 / FPS


def cut(beat):
    return round(B[beat]["t0"] - HALF, 6)


# ── the bench (set/bench.js): centimetres, seconds of scene time ──────────────────────────────
G, DROP, RB = 981.0, 100.0, 3.35
T_LAND = math.sqrt(2 * DROP / G)                         # 0.4515 s (claims c2, c9)
DT, NG = 0.05, 10                                        # a ghost every 1/20 s: k = 0 … 9 (τ9 = 0.45 s, c8)
SLOW = 0.05                                              # ×1/20
X_DROP, X_THROW = -8.0, 0.0
V = {"t44": 44.0, "t89": 89.0, "t133": 133.0}            # cm/s: 0.44 / 0.89 / 1.33 m/s → 20 / 40 / 60 cm (c2, c6)
STICK_X = -24.0
GAP_X = -15.6                                            # the gap arrows stand between the stick and the drop line


def fall_y(tau):
    return DROP + RB - 0.5 * G * tau * tau


# ── the clock: a port of kits/cinema/sci/clock.js (tau, tOf), checked against it in Node ─────────
class Clock:
    def __init__(self, keys, tau0=0.0):
        ks = sorted(({"ramp": 0.0, "curve": "auto", **k} for k in keys), key=lambda k: k["t"])
        S, prev = [], ks[0]["rate"]
        for i, k in enumerate(ks):
            nxt = ks[i + 1]["t"] if i + 1 < len(ks) else math.inf
            ramp = max(0.0, min(k["ramp"], nxt - k["t"]))
            curve = k["curve"] if k["curve"] != "auto" else ("log" if prev > 0 and k["rate"] > 0 else "lin")
            if ramp > 0 and prev != k["rate"]:
                S.append({"t0": k["t"], "t1": k["t"] + ramp, "r0": prev, "r1": k["rate"], "curve": curve})
            elif ramp > 0:
                S.append({"t0": k["t"], "t1": k["t"] + ramp, "r0": k["rate"], "r1": k["rate"], "curve": "lin"})
            S.append({"t0": k["t"] + ramp, "t1": nxt, "r0": k["rate"], "r1": k["rate"], "curve": "lin"})
            prev = k["rate"]
        acc = 0.0
        for sg in S:
            sg["tau0"] = acc
            acc += 0.0 if sg["t1"] == math.inf else self._area(sg, 1.0)
            sg["tau1"] = math.inf if sg["t1"] == math.inf else acc
        self.ks, self.S = ks, S
        self.off = tau0 - self._raw(0.0)

    @staticmethod
    def _area(sg, u):
        d, r0, r1 = sg["t1"] - sg["t0"], sg["r0"], sg["r1"]
        if d <= 0 or u <= 0:
            return 0.0
        if sg["curve"] == "log":
            k = math.log(r1 / r0)
            return r0 * d * u if abs(k) < 1e-12 else d * r0 * (math.exp(k * u) - 1) / k
        return d * (r0 * u + (r1 - r0) * u * u / 2)

    @staticmethod
    def _reach(sg, a):
        d, r0, r1 = sg["t1"] - sg["t0"], sg["r0"], sg["r1"]
        if a <= 0:
            return 0.0
        if a > sg["tau1"] - sg["tau0"] + 1e-12:
            return None
        if sg["curve"] == "log" and abs(math.log(r1 / r0)) > 1e-12:
            k = math.log(r1 / r0)
            u = math.log(1 + a * k / (d * r0)) / k
        elif abs(r1 - r0) < 1e-15:
            u = a / (d * r0) if r0 > 0 else 0.0
        else:
            Aq, Bq, Cq = (r1 - r0) / 2, r0, -a / d
            disc = max(0.0, Bq * Bq - 4 * Aq * Cq)
            u = (-Bq + math.sqrt(disc)) / (2 * Aq)
            if not u >= 0:
                u = (-Bq - math.sqrt(disc)) / (2 * Aq)
        return min(d, max(0.0, u * d))

    def _raw(self, t):
        k0 = self.ks[0]
        if t < k0["t"]:
            return -k0["rate"] * (k0["t"] - t)
        for sg in self.S:
            if t < sg["t1"]:
                return sg["tau0"] + (sg["r0"] * (t - sg["t0"]) if sg["t1"] == math.inf else self._area(sg, (t - sg["t0"]) / (sg["t1"] - sg["t0"])))
        return self.S[-1]["tau0"]

    def tau(self, t):
        return self._raw(t) + self.off

    def tOf(self, tau):
        x = tau - self.off
        k0 = self.ks[0]
        if x < 0:
            return k0["t"] - (0 - x) / k0["rate"] if k0["rate"] > 0 else -math.inf
        for sg in self.S:
            if sg["t1"] == math.inf:
                return sg["t0"] + (x - sg["tau0"]) / sg["r0"] if sg["r0"] > 0 else (sg["t0"] if x <= sg["tau0"] + 1e-12 else math.inf)
            if x <= sg["tau1"] + 1e-12:
                dt = self._reach(sg, x - sg["tau0"])
                if dt is not None:
                    return sg["t0"] + dt
        return math.inf


# ── the takes: each release solved back from the word its landing must hit ─────────────────────
RAMP = 0.3                                               # ×1 → ×1/20 tape-stop at a release (log blend)
TAU_RAMP = RAMP * (SLOW - 1) / math.log(SLOW)            # scene time that passes during that ramp: 0.0951 s
FREEZE = 0.4                                             # ×1/20 → frozen (linear): 0.01 s of scene time passes

F_h = A("vo01:One", -0.1) - FREEZE                       # the hook freezes on its question, mid-fall ("…lands first?")
HOOK_END = 0.305                                         # … 0.305 s into its fall (its centre 58 cm up), above the captions
HOOK_TAU0 = HOOK_END - FREEZE * SLOW / 2 - SLOW * F_h    # so frame 0 is 0.23 s in: ghosts 0–4 already stamped, level in pairs
L_n = A("vo02:down")                                     # the drop lands on "down"
R_n = L_n - (RAMP + (T_LAND - TAU_RAMP) / SLOW)          # … released (at ×1, ramping to ×1/20) on "slowed"
L_c = max(A("vo03:same#3"), round((cut("change") + 0.15 + RAMP + (T_LAND - TAU_RAMP) / SLOW) * FPS + 0.5) / FPS)   # both land on "same frame" (later in the phrase if the fall needs it)
R_c = L_c - (RAMP + (T_LAND - TAU_RAMP) / SLOW)
F_w = A("vo04:same", -0.1)                               # why: the balls touch down as "same height" is said, and freeze
R_w = F_w - (T_LAND - FREEZE * SLOW / 2) / SLOW          # … so released (already slowed) while Galileo is named
assert cut("why") + 1.0 < A("vo04:drew") and A("vo04:drew") + 2.0 < R_w < A("vo04:steady") - 0.3, (A("vo04:drew"), R_w, A("vo04:steady"))
C_w = F_w + FREEZE
L_o = max(A("vo05:same"), round((cut("whoa") + T_LAND / SLOW) * FPS + 0.5) / FPS)   # whoa: all four land on "same frame" (a frame after its start if the fall needs it)
R_o = L_o - T_LAND / SLOW                                # released at ×1/20 right after the cut ("Throw")

KEYS = [
    {"t": 0.0, "rate": SLOW},
    {"t": F_h, "rate": 0.0, "ramp": FREEZE},
    {"t": cut("normal"), "rate": 1.0},
    {"t": R_n, "rate": SLOW, "ramp": RAMP},
    {"t": cut("change"), "rate": 1.0},
    {"t": R_c, "rate": SLOW, "ramp": RAMP},
    {"t": F_w, "rate": 0.0, "ramp": FREEZE},
    {"t": cut("whoa"), "rate": SLOW},
    {"t": cut("measure"), "rate": 0.0, "badge": None},   # the record: nothing moves, no speed badge
]
clk = Clock(KEYS)

TAKES = {
    "hook": {"t0": -1e9, "t1": cut("normal"), "tauR": clk.tau(0.0) - HOOK_TAU0, "R": clk.tOf(clk.tau(0.0) - HOOK_TAU0),
             "balls": [{"id": "drop", "x0": X_DROP, "vx": 0.0}, {"id": "t89", "x0": X_THROW, "vx": V["t89"]}]},
    "normal": {"t0": cut("normal"), "t1": cut("change"), "tauR": clk.tau(R_n), "R": R_n,
               "balls": [{"id": "drop", "x0": X_DROP, "vx": 0.0}]},
    "change": {"t0": cut("change"), "t1": cut("why"), "tauR": clk.tau(R_c), "R": R_c,
               "balls": [{"id": "drop", "x0": X_DROP, "vx": 0.0}, {"id": "t44", "x0": X_THROW, "vx": V["t44"]}]},
    "why": {"t0": cut("why"), "t1": cut("whoa"), "tauR": clk.tau(R_w), "R": R_w,
            "balls": [{"id": "drop", "x0": X_DROP, "vx": 0.0}, {"id": "t44", "x0": X_THROW, "vx": V["t44"]}]},
    "whoa": {"t0": cut("whoa"), "t1": cut("measure"), "tauR": clk.tau(R_o), "R": R_o, "keep": True,
             "balls": [{"id": "drop", "x0": X_DROP, "vx": 0.0}] + [{"id": k, "x0": X_THROW, "vx": v} for k, v in V.items()]},
}
LAND = {"normal": L_n, "change": L_c, "why": C_w, "whoa": L_o}
for name, tk in TAKES.items():
    tk["stamps"] = [round(clk.tOf(tk["tauR"] + k * DT), 6) for k in range(NG)]          # a stamp after the take's cut is never shown
    if name in LAND:
        assert abs(clk.tOf(tk["tauR"] + T_LAND) - LAND[name]) < 1e-6, (name, clk.tOf(tk["tauR"] + T_LAND), LAND[name])
assert TAKES["hook"]["stamps"][4] + 0.2 < 0 < TAKES["hook"]["stamps"][5], "ghosts 0–4 are fully stamped on frame 0"
assert TAKES["hook"]["stamps"][6] < F_h + FREEZE < TAKES["hook"]["stamps"][7], "ghost 6 is stamped just before the freeze"
assert TAKES["hook"]["stamps"][8] > TAKES["hook"]["t1"], "the hook freezes before ghost 8"
for name in ("normal", "change", "why", "whoa"):           # every ghost is stamped inside its take
    s = [x for x in TAKES[name]["stamps"] if math.isfinite(x)]
    assert len(s) == NG and TAKES[name]["t0"] < s[0] and s[-1] < TAKES[name]["t1"], (name, s)


def stamps(take):
    return TAKES[take]["stamps"]


def ghost_xy(take, ball, k):
    b = next(b for b in TAKES[take]["balls"] if b["id"] == ball)
    tau = k * DT
    return [b["x0"] + b["vx"] * tau, fall_y(tau), 0.0]


# ── the measure segment: nine gaps counted down the dropped ball's trail ───────────────────────
m0, m1 = A("vo06:it"), A("vo06:second")                    # counted from "Measure it:" to "…of a second."
GAPS = [round(m0 + (m1 - m0) * i / 8, 4) for i in range(9)]   # gap i+1 is counted at GAPS[i]

# the gravity arrows (20 cm, hung below the ball's centre) end when their tip reaches the floor, so they never
# shrink into it and read as gravity weakening: centre at 20 cm, 0.412 s into the fall
TAU_TIP = math.sqrt(2 * (DROP + RB - 20.0) / G)

# "Old gunnery books drew cannonballs flying straight, then dropping": the 1500s drawing as dots, from the
# thrown ball's release: straight out 24 cm, a quarter turn of radius 10 cm, then straight down to the floor
# (it lands 34 cm out, against the real throw's 20)
def _old_path(step=3.2):
    y0, pts = DROP + RB, []
    segs = [("line", (X_THROW, y0), (X_THROW + 24.0, y0)), ("arc", (X_THROW + 24.0, y0 - 10.0), 10.0), ("line", (X_THROW + 34.0, y0 - 10.0), (X_THROW + 34.0, RB))]
    for sg in segs:
        if sg[0] == "line":
            (ax, ay), (bx, by) = sg[1], sg[2]
            n = max(1, round(math.hypot(bx - ax, by - ay) / step))
            pts += [[round(ax + (bx - ax) * i / n, 3), round(ay + (by - ay) * i / n, 3), -2.0] for i in range(n)]
        else:
            (cx, cy), r = sg[1], sg[2]
            n = max(1, round(math.pi / 2 * r / step))
            pts += [[round(cx + r * math.sin(math.pi / 2 * i / n), 3), round(cy + r * math.cos(math.pi / 2 * i / n), 3), -2.0] for i in range(n)]
    return pts + [[X_THROW + 34.0, RB, -2.0]]


OLD_PTS = _old_path()

# ── the cue table the scene reads (film seconds) ────────────────────────────────────────────────
CUTS = {b["id"]: (0.0 if b["id"] == "hook" else cut(b["id"])) for b in BEATS}
CUE = {
    "hook": {"tau0": HOOK_TAU0, "freeze": [F_h, F_h + FREEZE]},
    "normal": {"R": R_n, "L": L_n, "gaps": A("vo02:gaps"), "gravity": A("vo02:falling"), "gTip": clk.tOf(TAKES["normal"]["tauR"] + TAU_TIP)},
    "change": {"R": R_c, "L": L_c},
    "why": {"R": R_w, "contact": C_w, "gravity": A("vo04:Gravity"), "gTip": clk.tOf(TAKES["why"]["tauR"] + TAU_TIP), "two": A("vo04:two"), "glide": A("vo04:glide"),
            "rungs": A("vo04:every"), "turn": [A("vo04:So"), A("vo04:same")], "old": {"pts": OLD_PTS, "drew": A("vo04:drew"), "out": A("vo04:Gravity", -0.3)}},
    "whoa": {"R": R_o, "L": L_o, "rungs": A("vo05:Every")},
    # warpOut: the speed badge fades out over 0.15 s at the record's cut, not hud.js's 0.3 s: the stack reflows
    # "3 throws overlaid" up as the leaving note fades, and over 0.3 s the two plates overlapped (51.4 s)
    "measure": {"gaps": GAPS, "counter": [cut("measure") + 0.35, cut("takeaway")], "lit": [[A("vo06:point"), A("vo06:thrown")], [A("vo07:when"), A("vo07:In")]],
                "warpOut": [cut("measure"), cut("measure") + 0.15]},
    "tease": {"out": A("vo08:Next")},
    "cuts": CUTS,
}

# ── labels (hud.js pins), badges, readouts: one table for the scene and the sound ───────────────
# anchor: {"ball": [take, ball]} · {"ghost": [take, ball, k], "dx": cm} · {"gap": [take, k], "dx": cm} ·
# {"arrow": id} (its tip) · {"rung": [take, k], "u": 0–1 along it} · {"point": [x, y, z]}
LABELS = [
    {"id": "hk-thrown", "text": "thrown", "color": "ghost", "t0": A("vo01:thrown"), "t1": cut("normal") - 0.45, "anchor": {"ball": ["hook", "t89"]}, "side": 1, "fixed": True},
    {"id": "hk-dropped", "text": "dropped", "color": "ghost", "t0": A("vo01:dropped"), "t1": cut("normal") - 0.45, "anchor": {"ball": ["hook", "drop"]}, "side": -1, "fixed": True},
    # beside its gap, not above it: above, its plate tucked under the speed badge's (gap 3 would point past the live ball)
    {"id": "nm-apart", "text": "1/20 s apart", "color": "ghost", "t0": A("vo02:Ghosts"), "t1": cut("change"), "anchor": {"gap": ["normal", 2], "dx": 4.4}, "side": 1, "fixed": True, "v": "middle"},
    {"id": "nm-gravity", "text": "gravity", "color": "force", "t0": A("vo02:falling"), "t1": clk.tOf(TAKES["normal"]["tauR"] + TAU_TIP), "anchor": {"arrow": "nm-g"}, "side": 1, "fixed": True, "v": "middle"},
    {"id": "ch-dropped", "text": "dropped", "color": "ghost", "t0": A("vo03:Now"), "t1": cut("why"), "anchor": {"ball": ["change", "drop"]}, "side": -1, "fixed": True},
    # beside the ball, not above it: above, its plate ran into the speed badge's as the throw left the rail (14.6–15.2 s)
    {"id": "ch-thrown", "text": "thrown · 0.44 m/s", "color": "motion", "t0": A("vo03:sideways", 0.3), "t1": cut("why"), "anchor": {"ball": ["change", "t44"]}, "side": 1, "fixed": True},   # above its ball; it arrives once the speed badge has gone (it touched it at 14.6–15.2 s); "middle" clamped it over the ball
    # leaves on "tick", before the turn carries the arrow's tip (and the label's dot) under the caption plate (35.3 s)
    {"id": "wy-gravity", "text": "gravity", "color": "force", "t0": A("vo04:Gravity"), "t1": A("vo04:tick"), "anchor": {"arrow": "wy-g-drop"}, "side": -1, "fixed": True, "v": "middle"},
    # gone (its 0.4 s fade included) before the turn carries the ball, the arrow tip and the label's dot under the caption plate
    {"id": "wy-glide", "text": "steady glide", "color": "motion", "t0": A("vo04:steady"), "t1": A("vo04:only"),   # gone (0.4 s fade) before the ball drops to where the plate clamps over it (33.9 s)
     "anchor": {"arrow": "wy-v"}, "side": 1, "fixed": True, "v": "middle"},
    # the drawing's label leaves on "plus a fall", before the falling glide label reaches it (the dots stay until "Gravity")
    {"id": "wy-old", "text": "1500s drawing", "color": "ghost", "t0": A("vo04:drew", 0.5), "t1": A("vo04:plus"), "anchor": {"point": OLD_PTS[len(OLD_PTS) // 2]}, "side": 1, "fixed": True, "v": "middle"},
    # gone by the cut: fading across it, it jumped to the whoa camera's projection of a rung no longer drawn, its dot in the caption plate
    {"id": "wy-same", "text": "same height", "color": "ghost", "t0": A("vo04:same"), "t1": cut("whoa") - 0.45, "anchor": {"rung": ["why", 5], "u": 0.5}, "side": 1, "fixed": True},
    # on row 5, not 4: from row 4 its plate sat under "3 throws overlaid"
    {"id": "wo-level", "text": "level", "color": "ghost", "t0": A("vo05:level"), "t1": cut("measure") - 0.45, "anchor": {"rung": ["whoa", 5], "u": 1.0}, "side": 1, "fixed": True},
    {"id": "ms-1m", "text": "1 m", "color": "ghost", "t0": A("vo06:one-meter"), "t1": None, "anchor": {"point": [STICK_X, 100.0, 0.0]}, "side": 1, "fixed": True, "v": "middle"},
    {"id": "tk-when", "text": "all 0.45 s", "color": "ghost", "t0": A("vo07:when"), "t1": None, "anchor": {"rung": ["whoa", 9], "u": 0.0}, "side": -1, "fixed": True, "v": "above"},
]
BADGES = [
    {"id": "overlaid", "text": "3 throws overlaid", "t0": R_o, "t1": cut("takeaway") - 0.3, "slot": "tr"},
    {"id": "air", "title": "Air ignored", "text": "With air, the fastest throw lands 0.3 ms after the drop. One frame here is 1.7 ms.", "t0": cut("takeaway") + 1.0, "t1": None, "slot": "tr",
     "maxW": 1.0},   # the card's widest (760 px): the text keeps two lines, so the card clears the "1 m" label under it
]
READOUTS = [
    {"id": "ch-0", "text": "0", "at": [0.0, 0.0, 0.0], "t0": A("vo03:twenty"), "t1": cut("why")},     # the throw point: distances are measured from here
    {"id": "ch-20", "text": "20 cm", "at": [20.0, 0.0, 0.0], "t0": A("vo03:twenty"), "t1": cut("why")},
    {"id": "wo-0", "text": "0", "at": [0.0, 0.0, 0.0], "t0": A("vo05:forty", -0.2), "t1": cut("measure")},
    {"id": "wo-20", "text": "20 cm", "at": [20.0, 0.0, 0.0], "t0": A("vo05:forty", -0.2), "t1": cut("measure")},   # once the pull-back shows the floor
    {"id": "wo-40", "text": "40 cm", "at": [40.0, 0.0, 0.0], "t0": A("vo05:forty"), "t1": cut("measure")},
    {"id": "wo-60", "text": "60 cm", "at": [60.0, 0.0, 0.0], "t0": A("vo05:sixty"), "t1": cut("measure")},
    {"id": "tk-0", "text": "0", "at": [0.0, 0.0, 0.0], "t0": A("vo07:where"), "t1": None},
    {"id": "tk-20", "text": "20 cm", "at": [20.0, 0.0, 0.0], "t0": A("vo07:where"), "t1": None},
    {"id": "tk-40", "text": "40 cm", "at": [40.0, 0.0, 0.0], "t0": A("vo07:where", 0.12), "t1": None},
    {"id": "tk-60", "text": "60 cm", "at": [60.0, 0.0, 0.0], "t0": A("vo07:where", 0.24), "t1": None},
]

# ── camera: orbit keys per shot (yaw 0 = the measure view, square to the grid; pitch 0 = level) ─
FPX = 960 / math.tan(math.radians(16))                   # focal length in px at 1920 high, fov 32°


def view(cx, top_px=300.0, floor_px=1140.0, top=DROP + 2 * RB, fov=32.0, yaw=0.0):
    """A level camera that puts world height `top` at top_px and the floor at floor_px."""
    fpx = 960 / math.tan(math.radians(fov / 2))
    ppc = (floor_px - top_px) / top
    return {"look": [cx, round(top - (960 - top_px) / ppc, 3), 0.0], "dist": round(fpx / ppc, 2), "yaw": yaw, "pitch": 0.0, "fov": fov}


def key(t, v, ease="p2", **over):
    return {"t": round(t, 4), **v, **over, "ease": ease}


hook_v = view(9.0, top_px=600.0, floor_px=600.0 + 11.0 * (DROP + 2 * RB))   # the title card owns y 250–590; the floor sits under the captions
full = lambda cx: view(cx)                                 # noqa: E731
CAM = {
    "hook": [key(0.0, hook_v), key(cut("normal"), {**hook_v, "look": [11.0, hook_v["look"][1], 0.0]}, "sine")],
    "normal": [key(cut("normal"), full(8.0)), key(cut("change"), full(3.0), "sine")],
    # labels sit to the right of what they name, so the action keeps to the left half (room above the rail for the badge)
    "change": [key(cut("change"), view(19.0, top_px=345.0)), key(cut("why"), view(16.0, top_px=345.0), "sine")],
    "why": [key(cut("why"), full(26.0)), key(A("vo04:So", -0.2), full(23.0), "sine"),
            key(A("vo04:same"), {**view(2.0), "yaw": 52.0, "pitch": 7.0, "look": [2.0, 40.0, 0.0], "dist": view(2.0)["dist"] + 10}, "p3"),
            key(cut("whoa"), {**view(2.0), "yaw": 55.0, "pitch": 7.5, "look": [2.0, 40.0, 0.0], "dist": view(2.0)["dist"] + 16}, "sine")],
    "whoa": [key(cut("whoa"), {"look": [-2.0, 97.0, 0.0], "dist": 232.0, "yaw": 0.0, "pitch": 0.0, "fov": 32.0}),
             key(R_o + 0.35, {"look": [-2.0, 96.0, 0.0], "dist": 238.0, "yaw": 0.0, "pitch": 0.0, "fov": 32.0}, "sine"),
             key(A("vo05:forty"), full(26.0), "p3"), key(L_o + 0.6, full(27.0), "sine"),
             # the hold: a slow pull-back, so the fastest ball, sliding on after its bounce, stays clear of the apps' right-hand UI
             key(cut("measure"), view(36.0, top_px=430.0), "sine")],
    "measure": [key(cut("measure"), full(30.0)), key(cut("takeaway"), {**full(30.0), "dist": full(30.0)["dist"] - 6}, "sine")],
    # the takeaway pulls back a little, so the honesty badge has the top of the frame to itself
    "takeaway": [key(cut("takeaway"), {**full(30.0), "dist": full(30.0)["dist"] - 6}), key(cut("takeaway") + 1.15, view(30.0, top_px=440.0), "p3"),
                 key(cut("tease"), view(30.0, top_px=446.0), "sine")],
    "tease": [key(cut("tease"), view(30.0, top_px=446.0)), key(DUR, view(30.0, top_px=520.0), "sine")],
}
SHOTS = [{"at": CUTS[b["id"]], "name": b["id"]} for b in BEATS]


def screen_x(shot, x):
    """Approximate frame x (0–1) of world x in a shot's measure view: for panning sounds only."""
    k = CAM[shot][0]
    ppc = FPX / k["dist"]
    return round(min(1.0, max(0.0, (540 + (x - k["look"][0]) * ppc) / 1080)), 3)


TITLE = {"series": "Rest Frame · No. 001", "title": "Thrown or *dropped*?", "t1": round(cut("normal") - 0.55, 4), "y": 0.183, "sig": 0.3}
film = {
    "id": "rest-frame-001", "fps": FPS, "bpm": BPM, "dur": DUR, "poster": 0.0,
    "_doc": "Compiled by compile.py from script.md, vo/ and the direction in compile.py. Do not edit by hand.",
    "shots": SHOTS, "beats": BEATS, "clock": KEYS, "takes": TAKES, "cue": CUE,
    "bench": {"g": G, "drop": DROP, "r": RB, "dt": DT, "n": NG, "stickX": STICK_X, "gapX": GAP_X, "landing": T_LAND},
    "labels": LABELS, "badges": BADGES, "readouts": READOUTS, "cam": CAM,
    "captionY": 0.632, "title": TITLE,
    "captions": f.captions(max_chars=24), "endCard": EC,
    "end": {"title": "Next drop: the swing's *secret*", "follow": "Follow Rest Frame",
            "foot": "Two motions at once: Galileo, Two New Sciences, 1638"},   # the book's title never breaks
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}

# ── the studio's cue sheet: the same moments as sound events ────────────────────────────────────
ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS]
# time warps: the tape-stop lands where the slow-down (or the freeze) completes
for t in (F_h + FREEZE, R_n + RAMP, R_c + RAMP, C_w):
    ev.append({"t": round(t, 4), "kind": "time.slow", "tag": f"slow@{t:.2f}"})
# releases (the gates drop) and landings (one knock per ball, panned where it lands)
for take in ("normal", "change", "why", "whoa"):
    tk = TAKES[take]
    ev.append({"t": round(tk["R"], 4), "kind": "contact", "tag": f"{take}:release", "pos": [screen_x(take, 0.0), 0.2]})
    for b in tk["balls"]:
        x_land = b["x0"] + b["vx"] * T_LAND
        ev.append({"t": round(LAND[take], 4), "kind": "bounce", "tag": f"{take}:{b['id']}:land", "pos": [screen_x(take, x_land), 0.6]})
# the strobe: one shutter per stamp moment (all ladders of a take stamp together)
for take, tk in TAKES.items():
    for k, t in enumerate(tk["stamps"]):
        if math.isfinite(t) and t > 0.05 and t < tk["t1"]:
            ev.append({"t": round(t, 4), "kind": "strobe", "tag": f"{take}:g{k}"})
# the HUD: labels, readouts, badges, the counter, the title and end-card signatures, the reveal
# HUD parts fade in from t0, so the studio puts their sound on the first frame after t0 ("after" in
# events.json). Their times stay unrounded: rounded to 4 decimals, a t0 that falls on a frame (61/30 =
# 2.03333…) became 2.0333, just before that frame, and the blip led the label by one frame (33 ms)
for lb in LABELS:
    ev.append({"t": lb["t0"], "kind": "label", "tag": lb["id"]})
seen = set()
for rd in READOUTS:                                      # the takeaway's three readouts share one blip
    if rd["id"].startswith("tk-") and "tk" in seen:
        continue
    seen.add(rd["id"][:2])
    ev.append({"t": rd["t0"], "kind": "label", "tag": rd["id"]})
for bd in BADGES:
    ev.append({"t": round(bd["t0"], 4), "kind": "badge", "tag": bd["id"], "text": bd["text"]})
for i, t in enumerate(GAPS):
    ev.append({"t": t, "kind": "counter.end" if i == 8 else "counter.tick", "tag": f"gap{i + 1}"})
ev.append({"t": CUE["measure"]["counter"][0], "kind": "counter.show", "tag": "clock"})
ev.append({"t": TITLE["sig"], "kind": "signature", "tag": "title", "gain": -4.0})
ev.append({"t": EC, "kind": "signature", "tag": "end"})
ev.append({"t": A("vo04:same"), "kind": "reveal", "tag": "same-height"})

# merge the page's own measurements, when render.mjs --cues has run
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
    """JSON has no Infinity: a ghost that is never stamped (the hook freezes first) is written as null."""
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
      f"{len(LABELS)} labels, {len(BADGES)} badges, {len(READOUTS)} readouts, {len(film['captions'])} caption pages, end card {EC} s, {DUR} s")
print(f"sheet.json: {len(sheet['events'])} events ({'with' if shown else 'without'} the page's cue measurements), {len(sheet['voice'])} voice lines")
for b in BEATS:
    print(f"  {b['id']:<9} {b['t0']:6.2f}–{b['t1']:6.2f}  line {b['line']}  cut {CUTS[b['id']]:.4f}")
print(f"  releases: normal {R_n:.3f} (lands {L_n:.3f}), change {R_c:.3f} ({L_c:.3f}), why {R_w:.3f} (contact {C_w:.3f}), whoa {R_o:.3f} ({L_o:.3f}); hook freeze {F_h:.3f}")
