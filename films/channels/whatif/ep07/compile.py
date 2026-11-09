"""Compile Possibility Lab Season 2, Episode 1 (S2E01, folder ep07), "Walking to the Moon": script + voice timings + this direction →
film.json (the scene's clock: shots, camera keys, the three walkers' clocks, the thirty-Earths ruler, the Apollo
capsule, the spine readout's states, the show-your-work card, labels, badges, counters, captions, title and end
card) and sheet.json (the studio's cue sheet). Every moment hangs on a beat or a spoken word; every number comes
from calc.py, the same module claims.json was written from.

  python3 -I films/channels/whatif/ep07/compile.py

The world (scene.mjs, ../set/ladder05.js's planet): you (anchor blue) stand on the graph-paper desk, which is the
top of the Earth; a thin line runs straight up from you. The camera pulls back (distance eased in log space, as
rig.js does) until the Earth and the Moon sit on one vertical line, thirty Earth-widths apart (a ruler of rings).
Three walkers climb it on one clock of years: nonstop (about 9), eight hours a day (about 26, boxed) and 10,000
steps a day (about 140). The takeaway sends a small capsule up the same line in three days.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[3] / "kits/cinema/script"))
sys.path.insert(0, str(HERE))
from timeline import Film   # noqa: E402
from calc import V, RESULTS, SENS, MOON_KM, EARTH_D_KM, YEAR   # noqa: E402

FPS, BPM = 30, 50
ID = "envelope-s2e01"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}
R = RESULTS
assert R["earths"] == 30 and R["years_nonstop"] == 9 and R["years_8h"] == 26 and R["years_steps"] == 140

FIG = 1.7
R_E, R_M, D_M = 6.378e6, 1.7374e6, MOON_KM * 1e3        # metres: Earth's equatorial radius, the Moon's, the mean distance
Y_MOON = D_M - R_E                                       # the Moon's centre, on the line up from the Earth's top (the desk), y = 0
LINE_TOP = Y_MOON - R_M                                  # where a walker arrives: the Moon's near surface
YN, Y8, YS = V["years_nonstop"], V["years_8h"], V["years_steps"]

# ── times ──
t_title_out = B["normal"]["t0"] - 0.2
t_pull0 = B["normal"]["t0"]                                 # the camera lifts off the paper from the cut
t_pull1 = A("vo02:away", 0.0)                              # space is in view by "thirty Earths away"
t_rings = [A("vo02:lined", -0.1), A("vo02:between", -0.3)]   # thirty Earths appear one after another
t_walk0 = A("vo03:Walk", -0.05)
t_nine = A("vo03:years", -0.05)
t_dive0 = B["change"]["t0"]                                 # a dive from the wide view onto the nonstop walker
t_dive1 = t_dive0 + 1.3
t_run0 = t_dive1 + 0.9                                     # the nonstop walker sets off a beat after the camera arrives, with the Earth under its feet
t_halfway = t_run0 + (t_nine - t_run0) * 0.5
t_zo0 = t_nine + 0.35                                      # zoom out to the wide view again
t_zo1 = t_zo0 + 1.15
t_rw = t_zo0                                               # the clock rewinds: "nobody walks day and night"
t_b1 = t_zo1 + 1.15                                        # a second dive, onto the blue walker, who sets off at once
t_b0 = t_b1
t_sleep, t_eat, t_shoe = A("vo04:sleep", -0.05), A("vo04:eat", -0.05), A("vo04:shoe", -0.05)
t_rest = t_shoe + 5.4                                       # a rest stop: a tent pops in, the walker sits it out
PAUSES = [[round(t_sleep - 0.15, 3), round(t_sleep + 0.9, 3)], [round(t_eat - 0.1, 3), round(t_eat + 0.95, 3)], [round(t_shoe - 0.15, 3), round(t_shoe + 1.2, 3)], [round(t_rest - 0.1, 3), round(t_rest + 1.5, 3)]]
t_26 = A("vo05:years", -0.05)                              # the 8 h walker arrives on "twenty-six years"
t_zo2 = t_26 + 1.0
t_zo3 = t_zo2 + 1.2
t_steps = A("vo06:steps", -0.1)                           # the popular goal: the grey walker takes over
t_hund = A("vo06:hundred", -0.05)
t_140 = A("vo06:forty", 0.1)                               # the clock runs on to 140
t_box = t_26
t_work0, t_home, t_end = B["work"]["t0"], B["takeaway"]["t0"], A("vo08:Next", -0.25)
t_slower, t_quick = A("vo06:Slower", -0.25), A("vo06:quicker", -0.15)
t_pb, t_gf = A("vo06:steps", -0.6), A("vo06:kilometers", -0.5)      # the work beat: in on the walkers, the clock, back out to the lanes, then along the step walker
t_apollo = [A("vo07:Apollo", 0.3), A("vo07:three", -0.1)]  # the capsule crosses the gap, landing on "three days"
t_62 = t_apollo[1] + 1.8                                   # a second change
t_spread = [A("vo03:Walk", -0.3), A("vo03:Walk", 0.8)]      # the lanes open out
assert t_zo1 + 1.15 < t_sleep + 0.2, (t_zo1, t_sleep)

# the clocks, in years
CLOCK_A = [[t_run0, 0.0], [t_nine, YN]]                                      # nonstop
CLOCK_B = [[t_b1, 0.0], [t_26, Y8], [t_steps, Y8], [t_140, YS], [B["work"]["t0"] + 20, YS]]      # the race
COUNT_A = [[t_run0, 0.0], [t_nine, YN], [t_zo1 + 0.3, YN]]                    # the nonstop walker: 0 up to 9, then the counter leaves
COUNT = [[t_b1, 0.0], [t_26, Y8], [t_steps, Y8], [t_140, YS]]                 # the 8-hour walker: 0 up to 26, then the steps walker takes it on to 140

# the walkers' places along the line (0 at the Earth, 1 at the Moon), sampled every frame
import math
DT = 1.0 / FPS
NS = int(round(f.duration * FPS)) + 2
lin = lambda x, a, b_: min(1.0, max(0.0, (x - a) / (b_ - a)))
def yB_(t):
    k_ = CLOCK_B
    if t <= k_[0][0]: return 0.0
    for i in range(1, len(k_)):
        if t <= k_[i][0]: return k_[i - 1][1] + (k_[i][1] - k_[i - 1][1]) * (t - k_[i - 1][0]) / (k_[i][0] - k_[i - 1][0])
    return k_[-1][1]
def speedB(t):                                             # 8 hours a day: walk a third of the time, stop for sleep, food and a shoe
    if any(p0 <= t < p1 for p0, p1 in PAUSES): return 0.0
    ph = ((t - t_b1) / 0.5) % 1.0
    return math.sin(math.pi * ph / 0.34) ** 2 if ph < 0.34 else 0.0
cum, c_ = [], 0.0
for i in range(NS):
    t = i * DT
    if t_b1 <= t <= t_26: c_ += speedB(t) * DT
    cum.append(c_)
tot = cum[int(round(t_26 * FPS))]
PA = [round(lin(i * DT, t_run0, t_nine), 6) for i in range(NS)]
PB = [round(min(1.0, cum[i] / tot), 6) for i in range(NS)]
PS = [round(min(1.0, yB_(i * DT) / YS), 6) for i in range(NS)]
fn = lambda P: (lambda t: P[min(NS - 1, max(0, int(t * FPS)))] + (P[min(NS - 1, int(t * FPS) + 1)] - P[min(NS - 1, max(0, int(t * FPS)))]) * (t * FPS - int(t * FPS)))

# ── shots ──
SHOTS = [
    {"at": 0.0, "name": "front"},                        # hook: you, and the line that leaves the paper
    {"at": B["normal"]["t0"], "name": "pull"},           # normal: back off the paper to space
    {"at": t_dive0, "name": "chase-a"},                  # a dive onto the nonstop walker, a chase to the Moon, and back out
    {"at": t_zo1, "name": "chase-b"},                    # a dive onto the blue walker: stop and go
    {"at": t_zo3, "name": "space"},                      # the wide view for the work card and the step goal
    {"at": t_slower, "name": "work-a"},                  # push in on the three walkers at the Moon; a time clock pops over you
    {"at": t_pb, "name": "work-b"},                      # pull back to the lanes at the step-goal line
    {"at": t_gf, "name": "work-c"},                      # follow the step walker up its lane
    {"at": t_home, "name": "apollo"},                    # the capsule, then a push toward the Moon
    {"at": t_end, "name": "end"},                        # down to frame 0 and a calm hold
]
Hm = lambda d: 0.425 * d                                 # the frame's height in metres at distance d (fov 24)
def pose(P, q, d, fy, el=3, az=0, x=0.0):                # a camera that puts world height P at the fraction q of the frame (from the top)
    return {"target": [x, P - (fy - q) * Hm(d), 0], "dist": d, "el": el, "az": az, "fov": 24, "fy": fy}
k = lambda ty, dist, el, fy=0.40, az=0: {"target": [0, ty, 0], "dist": dist, "el": el, "az": az, "fov": 24, "fy": fy}
FRONT = k(1.2, 17, 8, 0.40)
SPACE = k(3.9e8, 2.3e9, 3, 0.40)
SPACE3 = pose(LINE_TOP, 0.92, 2.2e9, 0.92, el=3)                 # the walkers at the Moon in the clean band under the caption; the lanes run down off-frame
SPACE2 = SPACE3                  # the wide view with the walkers at the Moon whole, just above the spine plate; the lane runs down behind the HUD
D_C = 3.0e7                                              # a chase camera: the frame is 1.3e7 m tall, the Earth half of it
HS = 0.055 * D_C                                         # the walker's height at that distance: 13% of the frame
FYC = 0.79                                               # the walker stands low in the frame, under the caption plates' middle band, in the lower half
chase = lambda P, az=0: pose(P + HS * 0.5, FYC, D_C, FYC, el=3, az=az)
def chase_keys(t0, t1, path, az_fn=lambda t: 0.0, step=1.0 / 30):
    out, t = [], t0
    while t < t1 - 1e-9:
        out.append({"t": round(t, 4), **chase(LINE_TOP * path(t), az_fn(t)), "ease": "linear"}); t += step
    out.append({"t": round(t1, 4), **chase(LINE_TOP * path(t1), az_fn(t1)), "ease": "linear"})
    return out
def dive(t0, t1, P_to, az=0, start=None):                            # wide → mid → chase, in log steps (the same trick as the pull-back)
    mid = pose(P_to, 0.86, 2.4e8, 0.86)
    return [{"t": t0, **(start or SPACE)}, {"t": round(t0 + (t1 - t0) * 0.5, 4), **mid, "ease": "inout2"}, {"t": t1, **chase(P_to, az), "ease": "inout2"}]
def zoom_out(t0, t1, P_from, end=None):                  # chase → mid (the Moon near the top) → wide
    mid = pose(P_from + 2.0e6, 0.86, 2.4e8, 0.86)
    return [{"t": t0, **chase(P_from)}, {"t": round(t0 + (t1 - t0) * 0.5, 4), **mid, "ease": "linear"}, {"t": t1, **(end or SPACE), "ease": "inout2"}]
swing = lambda a0, a1, amp: (lambda t: amp * math.sin(math.pi * lin(t, a0, a1)) ** 2)
fA, fB, fS = fn(PA), fn(PB), fn(PS)
NEAR = chase(LINE_TOP)                                             # the walkers at the Moon, big, in the lower band
D_F = 1.2e8
follow = lambda t: pose(LINE_TOP * fS(t) + 0.5 * 0.055 * D_F, FYC, D_F, FYC, el=3, x=0.05 * D_F)   # the step walker (the right lane) up its lane, big and low
CAM = {
    "front": [{"t": 0.0, **FRONT}, {"t": B["normal"]["t0"], **k(1.2, 30, 8, 0.40), "ease": "sine"}],      # a slow back-off through "Starting at your own front door"
    "pull": [                                                                    # a constant rate of zoom in log distance
        {"t": t_pull0, **k(1.2, 30, 8, 0.40)},
        {"t": t_pull0 + (t_pull1 - t_pull0) * 0.45, **k(1.5e2, 3.0e3, 6.5, 0.40), "ease": "linear"},
        {"t": t_pull0 + (t_pull1 - t_pull0) * 0.75, **k(1.0e6, 2.0e7, 4.5, 0.40), "ease": "linear"},
        {"t": t_pull1, **SPACE, "ease": "inout2"},
        {"t": A("vo02:lined", 0.1), **SPACE, "ease": "sine"},
        {"t": t_dive0 - 1.8, **k(3.2e8, 9.0e8, 2, 0.40), "ease": "inout2"},      # up the line toward the Moon: how far it is
        {"t": t_dive0, **SPACE, "ease": "inout2"},
    ],
    "chase-a": dive(t_dive0, t_dive1, 0.0)[:-1] + [{"t": t_dive1, **chase(0.0), "ease": "inout2"}] + chase_keys(t_dive1 + 1.0 / 30, t_nine, fA, swing(t_halfway - 1.5, t_halfway + 2.5, -10.0))
               + [{"t": round(t_zo0, 4), **chase(LINE_TOP)}] + zoom_out(t_zo0, t_zo1, LINE_TOP, SPACE3)[1:],
    "chase-b": dive(t_zo1, t_b1, 0.0, 0, SPACE3)[:-1] + [{"t": t_b1, **chase(0.0), "ease": "inout2"}] + chase_keys(t_b1 + 1.0 / 30, t_26, fB, swing(A("vo04:you", -0.3) + 2.0, A("vo04:you", -0.3) + 6.5, 10.0))
               + [{"t": round(t_zo2, 4), **chase(LINE_TOP)}] + zoom_out(t_zo2, t_zo3, LINE_TOP, SPACE2)[1:],
    "space": [{"t": t_zo3, **SPACE2}, {"t": round((t_zo3 + t_slower) / 2, 4), **pose(LINE_TOP, 0.92, 1.55e9, 0.92, el=3), "ease": "sine"}, {"t": t_slower, **SPACE2, "ease": "sine"}],   # a slow lean in toward the arrived walkers and back out
    "work-a": [{"t": t_slower, **SPACE2}, {"t": round(t_slower + 0.8, 4), **pose(LINE_TOP, 0.86, 2.4e8, 0.86), "ease": "sine"}, {"t": round(t_slower + 1.7, 4), **NEAR, "ease": "inout2"}, {"t": t_pb, **NEAR, "ease": "sine"}],
    "work-b": [{"t": t_pb, **NEAR}, {"t": round(t_pb + 0.8, 4), **pose(LINE_TOP, 0.86, 2.4e8, 0.86), "ease": "linear"}, {"t": round(t_pb + 1.7, 4), **SPACE3, "ease": "inout2"}, {"t": t_gf, **SPACE3, "ease": "sine"}],
    "work-c": [{"t": t_gf, **SPACE3}, {"t": round(t_gf + 0.5, 4), **pose(LINE_TOP * fS(t_gf + 0.5) + 2.0e7, 0.80, 4.5e8, 0.60, x=0.05 * 4.5e8), "ease": "sine"}, {"t": round(t_gf + 1.0, 4), **follow(t_gf + 1.0), "ease": "inout2"}] + [{"t": round(t_gf + 1.0 + 0.15 * i, 4), **follow(t_gf + 1.0 + 0.15 * i), "ease": "linear"} for i in range(1, int((t_140 + 0.2 - t_gf - 1.0) / 0.15) + 1)]
               + [{"t": round(t_home - 1.1, 4), **pose(LINE_TOP, 0.86, 5.5e8, 0.50), "ease": "linear"}, {"t": t_home, **SPACE3, "ease": "inout2"}],
    "apollo": [{"t": t_home, **SPACE3}, {"t": t_62, **SPACE3, "ease": "sine"},
               {"t": t_end, **pose(LINE_TOP + 1.47e7, 0.87, 7.0e8, 0.87, el=3), "ease": "inout2"}],              # a second change: in toward the Moon
    "end": [                                                                      # back down to frame 0 in two seconds by the pull-back's own steps, then a calm hold: the picture behind the card
        {"t": t_end, **pose(LINE_TOP + 1.47e7, 0.87, 7.0e8, 0.87, el=3)},
        {"t": t_end + 0.6, **SPACE2, "ease": "inout2"},
        {"t": t_end + 1.1, **k(1.0e6, 2.0e7, 4.5, 0.40), "ease": "linear"},
        {"t": t_end + 1.5, **k(1.5e2, 3.0e3, 6.5, 0.40), "ease": "linear"},
        {"t": t_end + 2.0, **FRONT, "ease": "inout2"},
        {"t": B["tease"]["t1"], **FRONT},
    ],
}
for shot, keys in CAM.items():
    for a, b in zip(keys, keys[1:]):
        dt = b["t"] - a["t"]
        assert dt > 0, (shot, a["t"], b["t"])
        for kk in ("az", "el"):
            assert abs(b[kk] - a[kk]) / dt <= 8.0 + 1e-9, f"{shot}: {kk} turns too fast between {a['t']:.2f} and {b['t']:.2f}"
for x, y in zip(SHOTS[:-1], SHOTS[1:]):
    p, q_ = CAM[x["name"]][-1], CAM[y["name"]][0]
    assert p["target"] == q_["target"] and p["dist"] == q_["dist"], (x, y, p, q_)

# ── the spine readout ──
sp_ = lambda t, label, terms, **kw: {"t": t, "label": label, "terms": terms, **kw}
SPINE = [
    sp_(A("vo02:Moon", 0.1), "the Moon's mean distance", [["in", f"{R['moon_km']:,} km"]]),
    sp_(t_walk0, "an easy pace, nonstop", [["in", f"{R['moon_km']:,} km"], ["op", "÷"], ["in", "5 km/h"]]),
    sp_(A("vo03:nine", -0.05), "nonstop, day and night", [["in", f"{R['hours']:,} h"], ["ans", f"≈ {R['years_nonstop']} years"]]),
    sp_(t_b0, "walking 8 hours a day", [["in", f"{R['hours']:,} h ÷ 8 h"], ["ans", "≈ ? years"]]),
    sp_(t_box, "a working day of walking", [["ans", f"≈ {R['years_8h']} years"]], box=True),
    sp_(A("vo05:years", 0.9), "a working day of walking", [["ans", f"≈ {R['years_8h']} years"]], box=True, keep=True),
    sp_(t_hund, "10,000 steps a day", [["ans", "≈ 140 years"]], box=True, keep=True),
    sp_(t_home, "to the Moon on foot", [["ans", f"≈ {R['years_8h']} years"]], box=True, keep=True),
]
SPINE_OUT = t_end

s = R["sens_years_8h"]
WORK = {
    "t0": t_work0, "t1": t_home - 0.3, "title": "Show your work",
    "rows": [
        {"t": t_work0 + 0.15, "k": "76,880 h ÷ 8 ÷ 365", "v": f"≈ {s[1]} yr", "lit": False},
        {"t": A("vo06:Slower", -0.05), "k": "slower: 4 km/h", "v": f"≈ {s[0]} yr", "lit": True},
        {"t": A("vo06:quicker", -0.05), "k": "quicker: 6 km/h", "v": f"≈ {s[2]} yr", "lit": True},
    ],
    "assume": ["no road", "8 h a day", "0.75 m a step"],
}

# ── labels, badges, counters ──
LABELS = [
    {"id": "l-you", "text": "you", "kind": "anchor", "anchor": "you", "t0": 0.3, "t1": t_title_out + 0.1, "side": 1},
    {"id": "l-earth", "text": "Earth", "kind": "part", "anchor": "earth", "t0": t_rings[0], "t1": t_dive0 - 2.0, "side": 1},
    {"id": "l-moon", "text": "the Moon · 384,400 km", "kind": "part", "anchor": "moon", "t0": A("vo02:Moon", 0.2), "t1": t_dive0 - 0.2, "side": -1},
]
BADGES = [
    {"id": "b-thought", "text": "thought experiment", "t0": 0.3, "t1": t_title_out, "slot": "bl"},
    {"id": "b-scale", "text": "not to scale", "t0": t_pull0 + 0.7, "t1": t_pull1 - 0.3, "slot": "tl"},
    {"id": "b-pace", "text": "∵ an easy pace, 5 km/h", "t0": t_walk0, "t1": t_zo0, "slot": "tl"},
    {"id": "b-road", "text": "∵ no road, no rest", "t0": t_halfway, "t1": t_zo0, "slot": "tr"},
    {"id": "b-day", "text": "∵ 8 hours a day", "t0": t_zo1, "t1": t_work0 - 0.1, "slot": "tl"},
    {"id": "b-steps", "text": "10,000 steps a day", "t0": t_steps, "t1": t_hund, "slot": "tr"},
    {"id": "b-140", "text": "≈ 140 yr", "t0": t_hund, "t1": t_140 + 0.5, "slot": "tr"},
    {"id": "b-half", "text": "halfway", "t0": t_halfway - 0.3, "t1": t_halfway + 1.5, "slot": "tl"},
    {"id": "b-nonstop", "text": "nonstop: ≈ 9 yr", "t0": t_nine, "t1": t_zo0 + 0.8, "slot": "tr"},
    {"id": "b-rest", "text": "a rest stop", "t0": t_rest, "t1": t_rest + 1.6, "slot": "tr"},
    {"id": "b-d1", "text": "Apollo 11: ~24 h", "t0": t_apollo[0] + 0.1, "t1": t_apollo[0] + 1.05, "slot": "tr"},
    {"id": "b-d2", "text": "~48 h", "t0": t_apollo[0] + 1.05, "t1": t_apollo[0] + 2.1, "slot": "tr"},
    {"id": "b-d3", "text": "~76 h: lunar orbit", "t0": t_apollo[1], "t1": t_end - 0.4, "slot": "tr"},
    {"id": "b-figs", "text": "figures not to scale", "t0": t_dive0, "t1": t_halfway, "slot": "tr"},
    {"id": "b-figs2", "text": "figures not to scale", "t0": t_zo1, "t1": t_zo1 + 4.0, "slot": "tr"},
    {"id": "b-rounded", "text": "rounded", "t0": t_box + 0.3, "t1": t_work0 - 0.1, "slot": "tl"},
]
CUTS = [sh["at"] for sh in SHOTS[1:]]
for b in BADGES:
    if any(abs(b["t1"] - c) < 1e-6 for c in CUTS):
        b["t1"] = round(b["t1"] - 0.3, 4)
COUNTERS = [
    {"id": "c-years-a", "label": "years of walking", "t0": t_run0 - 0.2, "t1": t_zo1 + 0.3, "at": [0.66, 0.33], "keys": COUNT_A, "end": YN},
    {"id": "c-years", "label": "years at 8 h a day", "t0": t_b1 - 0.1, "t1": t_work0 - 0.3, "at": [0.66, 0.33], "keys": COUNT, "end": Y8},
]

TITLE = {"series": "Possibility Lab · Season 2 · Episode 1", "title": "Walking to the *Moon*", "t0": 0.3, "t1": t_title_out, "sig": A("line:vo01:end", 0.05)}
END = {"title": "Next envelope: *everyone, holding hands*", "follow": "Possibility Lab · Season 2 · Episode 1",
       "next": "NASA Science, Moon Facts: average distance 384,400 km."}

CUE = {"pull": [t_pull0, t_pull1], "rings": t_rings, "spread": t_spread, "clockA": CLOCK_A, "clockB": CLOCK_B, "box": t_box, "nine": t_nine,
       "apollo": t_apollo, "home": t_home, "gf": t_gf, "bigMoon": [t_slower, t_end + 0.1], "clock": [t_quick, t_quick + 1.8], "pauses": PAUSES, "props": {"bed": t_sleep, "table": t_eat, "shoe": t_shoe, "rest": t_rest}, "orbit": [t_apollo[1] + 1.2, t_end - 0.4], "lane": 1.85, "run": [t_run0, t_b1, t_zo1],
       "fps": FPS, "pathA": PA, "pathB": PB, "pathS": PS, "dc": D_C, "hs": 0.055, "fy": FYC}
film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": round(t_box + 1.0, 4),
    "shots": SHOTS, "beats": BEATS,
    "world": {"fig": FIG, "rE": R_E, "rM": R_M, "yMoon": Y_MOON, "top": LINE_TOP, "earthKm": EARTH_D_KM, "n": R["earths"]},
    "cam": CAM, "cue": CUE, "spine": SPINE, "spineOut": SPINE_OUT, "work": WORK,
    "labels": LABELS, "badges": BADGES, "counters": COUNTERS,
    "title": TITLE, "endCard": t_end, "end": END,
    "captions": f.captions(max_chars=24, balance=True, keep=("thirty Earths", "side by side", "nine years", "twenty-six years", "a hundred and forty", "an easy pace", "Apollo eleven's crew", "about three days", "the Moon")),
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}

sys.path.insert(0, str(HERE.parent))
import declutter   # noqa: E402
DECL = {"spineHide": [[15.7, 56.3]], "labels": {"l-earth": None, "l-moon": None}, "counters": {"c-years-a": 20.2, "c-years": 36.4},
        "dropEndCaptions": True}
film = declutter.apply(film, DECL)

ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS if b["id"] not in ("tease", "normal")]
ev.append({"t": TITLE["sig"], "kind": "signature", "tag": "title"})
ev.append({"t": t_end, "kind": "signature", "tag": "end"})
for L in LABELS:
    ev.append({"t": L["t0"], "kind": "label", "tag": L["id"]})
for c in COUNTERS:
    ev.append({"t": c["t0"], "kind": "counter.show", "tag": c["id"]})
for i, sp in enumerate(SPINE):
    first_box = sp.get("box") and not (i and SPINE[i - 1].get("box"))
    ev.append({"t": sp["t"], "kind": "answer.box" if first_box else "term.write", "tag": f"spine-{i}", **({"t1": round(sp["t"] + 0.5, 4)} if first_box else {})})
for r in WORK["rows"]:
    ev.append({"t": r["t"], "kind": "term.write", "tag": f"work-{r['k']}"})
ev += [
    {"t": t_run0, "kind": "swell", "tag": "walk", "t1": t_nine},
    {"t": t_apollo[0], "kind": "swell", "tag": "apollo", "t1": t_apollo[1]},
    {"t": round(f.duration - 4.0, 3), "kind": "swell", "tag": "loop", "t1": round(f.duration - 0.35, 3)},          # a riser into the loop: the last seconds are as full as the first
]
ev = [e for e in ev if declutter.keep_event(e, SPINE, DECL["spineHide"])]
sheet = {"duration": f.duration, "fps": FPS, "preset": "envelope-working", "tail_s": 0.05,
         "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: e["t"]),
         "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}

(HERE / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
print(f"film.json: {f.duration:.2f} s, {len(SHOTS)} shots, {len(LABELS)} labels, {len(BADGES)} badges, {len(SPINE)} spine states, "
      f"{len(film['captions'])} caption pages, end card {t_end:.2f} s; box {t_box:.2f} s")
for b in BEATS:
    print(f"  {b['id']:<9} {b['t0']:6.2f}–{b['t1']:6.2f}")
for p in film["captions"]:
    print("   |", " / ".join(" ".join(w[0] for w in ln) for ln in p["lines"]))
