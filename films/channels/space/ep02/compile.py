"""Compile Light Minute No. 002: script + voice timings + this direction → film.json (the scene's clock:
shots, scene clocks, camera keys, the ladder, labels, badges, counters, pills, captions, title and end
card) and sheet.json (the studio's cue sheet). Nothing here is a hand-typed time: every moment hangs on
a beat or a spoken word (kits/cinema/script/timeline.py anchors), and every physical number comes from
claims.json (the "computed" notes there).

  python3 -I films/channels/space/ep02/compile.py

If build/cues-lightminute-002-9x16.json exists (render.mjs --cues), each overlay event also gets the
picture's own screen position (pan) and its measured first frame ("shown", the studio's independent
sync check).
"""
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[3] / "kits/cinema/script"))
from timeline import Film   # noqa: E402
sys.path.insert(0, str(HERE.parent / "set"))
from capglue import glue, hold, keep_units    # noqa: E402

FPS, BPM = 30, 56.25                     # DECISIONS.md: Light Minute is E dorian at 56.25 BPM (a 16th = 8 frames)
ID = "lightminute-002"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}

# ── the physics (claims.json; "computed" notes there) ──────────────────────
C_KM = 299792.458                         # km/s (c9's source, NIST)
AU = 1.495978707e8                        # km
LY = 9.4607e12                            # km
YEAR = 365.25 * 86400                     # s
LD = C_KM * 86400                         # one light-day: 2.590e10 km (c5: 25.9 billion km)
LD_AU = LD / AU                           # 173.14 AU (c5: 173.14 AU)
Y0 = 1977.677                             # c2: launch, 5 Sep 1977
Y_NOW = 2026.879                          # c5: one light-day, 18 Nov 2026
Y_SAT = 1980.87                           # the Saturn flyby (Nov 1980): the simplified curve ends here (badged)
R_SAT = 9.54                              # AU
SLOPE = (LD_AU - R_SAT) / (Y_NOW - Y_SAT) # AU a year on the straight part: 3.556 AU/yr = 16.9 km/s (c3: about 17 km/s)
Y_HP = 2012.65                            # c8: the heliopause, about 25 Aug 2012
R_HP = R_SAT + SLOPE * (Y_HP - Y_SAT)     # 122.5 AU on the drawn path (c8's 18.2 billion km is 121.7 AU; the path is simplified)
R_OORT0 = LD_AU + SLOPE * 300             # c10: about 300 years to the comet cloud's inner edge → 1,240 AU (drawn there)
R_OORT1 = R_OORT0 + SLOPE * 30000         # c19: about 30,000 years more to cross it → 108,000 AU (1.7 ly)
PROX_LY = 4.24                            # c11
PROX_AU = PROX_LY * LY / AU               # 268,000 AU
V_KMS = 17.0                              # c3
TRIP_Y = PROX_LY * LY / V_KMS / YEAR      # c12: 74,800 years ("about seventy-five thousand")
VOY_DIR_DEG = 35.0                        # Voyager 1 leaves about 35° above the ecliptic
VOY_AZ_DEG = -25.0                        # ... its ecliptic part 25° off the line of sight, so the path climbs the frame to the
                                          # right, clear of the spine on the left (the fronts, the 2012 crossing, the roads)
assert abs(LD_AU - 173.14) < 0.05, LD_AU
assert 16.5 < SLOPE * AU / YEAR < 17.3, SLOPE * AU / YEAR
assert 74000 < TRIP_Y < 75500, TRIP_Y

# ── shots: the hook (the payoff, the local view), then one continuous shot: the solar view pulls back with
# Voyager's flight, holds for the signal, pulls back ×12 to the comet cloud, then the one scale jump to Proxima ──
t_cut = B["normal"]["t0"]
t_end = A("vo08:Next", -0.25)
SHOTS = [{"at": 0.0, "name": "hook"}, {"at": t_cut, "name": "space"}, {"at": t_end, "name": "end"}]

# ── scene clocks (clock.js keys; "anchor": [t, τ]) ──────────────────────────
RATE_F = 2.5e8                            # the flight: 49 years in 6.2 s ("250,000,000× faster")
T49 = (Y_NOW - Y0) * YEAR
t_launch = A("vo02:nineteen")             # the year counter starts as the year is spoken
RAMP_F = 0.6
t_stop = round(t_launch + (T49 - RATE_F * RAMP_F / 2) / RATE_F, 4)   # a linear ramp to a stop lands τ on 18 Nov 2026 exactly
RATE_S = 5e4                              # the signal: a day in 1.73 s ("50,000× faster")
LEG = 86400 / RATE_S
t_arr1 = A("vo03:day")                    # the signal reaches Voyager on "a full *day*"
t_sig = round(t_arr1 - LEG, 4)
t_arr2 = A("vo03:tomorrow")               # the answer reaches Earth on "the day after *tomorrow*"
t_ans = round(t_arr2 - LEG, 4)            # ... so it leaves Voyager a day earlier, the moment the command arrives
t_cmd = round(t_ans - LEG, 4)             # the command leaves Earth ("The team sends a command today")
assert t_sig > A("vo03:line:end"), (t_sig, A("vo03:line:end"))
assert t_cmd > t_arr1 + 0.5 and abs(t_cmd - A("vo03:team")) < 0.6, (t_cmd, t_arr1, A("vo03:team"))
assert t_stop + RAMP_F < B["change"]["t0"], (t_stop, B["change"]["t0"])
CLK = {
    "flight": {"keys": [{"t": t_launch, "rate": RATE_F}, {"t": t_stop, "rate": 0.0, "ramp": RAMP_F, "badge": None}], "anchor": [t_launch, 0.0]},
    # τ: Voyager's signal on its way to Earth 0 → 1 day; the command out 1 → 2 days; the answer back 2 → 3 days
    "signal": {"keys": [{"t": t_sig, "rate": RATE_S}, {"t": t_arr1, "rate": 0.0, "badge": None},
                        {"t": t_cmd, "rate": RATE_S}, {"t": t_arr2, "rate": 0.0, "badge": None}], "anchor": [t_sig, 0.0]},
}

# ── the ladder: a gentle pull-back (×12) to the comet cloud in the why, then the one scale jump (≤ 3 s) ──
S_AU, S_12 = AU, 12 * AU
PROX_SCENE = 131.0                        # Proxima this many scene units from the Sun in the local view
S_END = PROX_AU * AU / PROX_SCENE         # 2.79e11 km a scene unit
t_p0, t_p1 = A("vo04:even"), A("vo04:comets", 0.3)
t_j0, t_j1 = B["whoa"]["t0"] + 0.1, A("vo05:Centauri", 0.2)
assert 1.2 < t_p1 - t_p0 <= 3.0 and 1.2 < t_j1 - t_j0 <= 3.0, (t_p0, t_p1, t_j0, t_j1)
LADDER = {
    "units": {"solar": AU, "oort": AU, "local": LY / 100},
    "keys": [{"t": t_p0, "scale": S_AU}, {"t": t_p1, "scale": S_12, "ease": "inout2"},
             {"t": t_j0, "scale": S_12}, {"t": t_j1, "scale": S_END, "ease": "inout3"}],
    "end": S_END,
    "show": {"solar": [6.0, 9.35], "oort": [8.95, 13.0], "local": [10.5, 13.0]},
    "fade": {"solar": 0.5, "oort": 0.4, "local": 0.6},
}

# ── the camera: one telescope pose for the local view and the far solar view; the flight pulls back to it ──
POSE = {"target": [0, 0, 0], "el": 8, "fov": 24, "fx": 0.62, "fy": 0.55}
WIDE = dict(POSE, fx=0.53)
CAM = {
    "hook": [{"t": 0.0, **POSE, "dist": 1169, "az": -1.2}, {"t": t_cut, **POSE, "dist": 1184, "az": 0.0, "ease": "sine"}],
    "space": [
        {"t": t_cut, **WIDE, "dist": 70, "az": 0.0},
        {"t": t_launch, **WIDE, "dist": 70, "az": 0.0, "ease": "sine"},
        # the pull-back follows Voyager: the camera's distance grows with Voyager's, so it climbs to the same height
        *[{"t": round(t_launch + (yr - Y0) * YEAR / RATE_F, 4), **WIDE, "dist": round(70.0 + 1135.0 * max(0.0, (R_SAT + SLOPE * (yr - Y_SAT) - R_SAT) / (LD_AU - R_SAT)) ** 0.75, 1),
           "az": round((yr - Y0) / (Y_NOW - Y0), 3), "ease": "lin"} for yr in (1983, 1990, 2000, 2010, 2020)],
        {"t": t_stop + RAMP_F, **WIDE, "dist": 1205, "az": 1.0, "ease": "sine"},
        # the change: the camera eases back and the Sun to the middle, so the light-day circle through Voyager fits
        # the frame (and, at this distance, so do the comet cloud and the ring through Proxima later)
        {"t": B["change"]["t0"], **WIDE, "dist": 1205, "az": 1.2, "ease": "sine"},
        {"t": A("vo03:line"), **WIDE, "dist": 1600, "az": 2.0, "ease": "inout2"},
        {"t": B["why"]["t0"], **WIDE, "dist": 1590, "az": 2.6, "ease": "sine"},
        {"t": t_j0, **WIDE, "dist": 1580, "az": 4.0, "ease": "sine"},
        {"t": t_j1, **WIDE, "dist": 1580, "az": 3.8, "ease": "sine"},
        {"t": B["takeaway"]["t0"], **WIDE, "dist": 1470, "az": 2.6, "ease": "sine"},     # a slow push through the whoa
        {"t": t_end + 0.4, **WIDE, "dist": 1420, "az": 1.5, "ease": "sine"},
    ],
    # the end card: back to the hook's pose, so the replay's first frame continues the last
    "end": [{"t": t_end, **WIDE, "dist": 1428, "az": 1.6}, {"t": B["tease"]["t1"], **POSE, "dist": 1169, "az": -1.2, "ease": "inout2"}],
}
for shot, keys in CAM.items():           # the bible's arc limit: ≤ 1.5° a second
    for a, b in zip(keys, keys[1:]):
        for k in ("az", "el"):
            rate = abs(b[k] - a[k]) / (b["t"] - a["t"])
            assert rate <= 1.5 + 1e-9, f"{shot}: {k} turns {rate:.2f}°/s"

# Voyager's drawn path: year samples for the trail (dense on the simplified curve, sparse on the straight part)
YS = [round(Y0 + (Y_SAT - Y0) * (i / 16) ** 1.0, 4) for i in range(17)] + [round(Y_SAT + (Y_NOW - Y_SAT) * i / 8, 4) for i in range(1, 9)]

# ── the overlay ─────────────────────────────────────────────────────────────
end_out = t_end
LABELS = [
    # hook: the payoff, Proxima far off and the speck that holds everything we've sent
    {"id": "l-prox-h", "text": "Proxima Centauri", "kind": "star", "anchor": "prox", "t0": 0.0, "t1": t_cut, "shot": "hook", "side": -1, "v": "middle"},
    {"id": "l-in-h", "text": "Voyager 1 is in here", "kind": "light", "anchor": "speck", "t0": 0.0, "t1": t_cut, "shot": "hook", "side": -1},
    # normal: the flight
    {"id": "l-nep", "text": "Neptune's orbit", "kind": "gravity", "anchor": "neptune", "t0": A("vo02:farthest"), "t1": A("vo02:left"), "shot": "space", "side": -1},
    # Voyager's name in two fixed placements (no hopping): from its launch spot through the flight, the change and the
    # why, then at the comet cloud's scale; hidden through the pull-back itself. Its speed rides the trail behind it.
    {"id": "l-voy", "text": "Voyager 1", "kind": "body", "anchor": "voy", "t0": A("vo02:Voyager"), "t1": round(t_p0 - 0.1, 4), "shot": "space", "side": -1, "fixed": True},
    {"id": "l-v", "text": "about 17 km/s", "kind": "body", "anchor": "voy-v", "t0": A("vo02:seventeen"), "t1": B["change"]["t0"], "shot": "space", "side": 1, "v": "middle", "fixed": True},
    {"id": "l-voy-o", "quiet": True, "text": "Voyager 1", "kind": "body", "anchor": "voy", "t0": round(t_p1 + 0.2, 4), "t1": t_j0, "shot": "space", "side": 1, "v": "middle", "fixed": True},
    # change: the signal
    {"id": "l-ld", "text": "1 light-day", "kind": "light", "anchor": "ldring", "t0": A("vo03:line"), "t1": B["why"]["t0"], "shot": "space", "side": 1},
    {"id": "l-earth", "text": "Earth, by the Sun", "kind": "body", "anchor": "sun", "t0": round(t_sig + 0.2, 4), "t1": A("vo03:us", 0.4), "shot": "space", "side": 1},
    {"id": "l-sig", "text": "signal", "kind": "light", "anchor": "front1", "t0": round(t_sig + 0.25, 4), "t1": round(t_arr1 - 0.2, 4), "shot": "space", "side": 1},
    {"id": "l-cmd", "text": "command", "kind": "light", "anchor": "frontc", "t0": round(t_cmd + 0.25, 4), "t1": round(t_ans - 0.1, 4), "shot": "space", "side": 1},
    {"id": "l-ans", "text": "answer", "kind": "light", "anchor": "front2", "t0": round(t_ans + 0.25, 4), "t1": round(t_arr2 - 0.2, 4), "shot": "space", "side": 1},
    # why: the heliopause, then the comet cloud
    {"id": "l-hp", "text": "Sun's wind ends", "kind": "body", "anchor": "hp", "t0": A("vo04:twenty"), "t1": round(t_p0 - 0.1, 4), "shot": "space", "side": -1, "fixed": True},
    {"id": "l-oort", "text": "comet cloud", "kind": "body", "anchor": "oort", "t0": t_p1, "t1": t_j0, "shot": "space", "side": 1, "fixed": True},   # once the rim has settled
    # whoa: Proxima arrives
    {"id": "l-prox", "text": "Proxima Centauri", "kind": "star", "anchor": "prox", "t0": round(t_j1 - 0.4, 4), "t1": end_out, "shot": "space", "side": -1, "v": "middle", "fixed": True},   # as the star settles
    # takeaway: day one of fifteen hundred
    {"id": "l-day1", "text": "day 1", "kind": "light", "anchor": "speck", "t0": A("vo06:day"), "t1": B["readout"]["t0"], "shot": "space", "side": -1},
    # readout: a ping per ring
    {"id": "l-ring-ld", "text": "Voyager 1", "kind": "light", "anchor": "speck", "t0": A("vo07:Earth"), "t1": end_out, "shot": "space", "side": -1},
]
BADGES = [
    {"id": "b-nts-h", "text": "not to scale · illustration", "t0": 0.0, "t1": t_cut, "slot": "bl"},
    {"id": "b-nts", "text": "not to scale · illustration", "t0": t_cut, "t1": t_end, "slot": "tr"},
    {"id": "b-path", "text": "path simplified", "t0": t_launch, "t1": t_p1, "slot": "tr"},   # the trail stays until the pull-back ends
    {"id": "b-time-f", "clock": "flight", "t0": t_launch, "t1": round(t_stop + RAMP_F + 0.4, 4), "slot": "tl"},
    {"id": "b-time-s", "clock": "signal", "t0": t_sig, "t1": B["why"]["t0"], "slot": "tl"},
    {"id": "b-theory", "text": "comet cloud: theory", "t0": A("vo04:cloud"), "t1": round(t_j1 + 0.6, 4), "slot": "tr"},   # the cloud thins out through the jump
    {"id": "b-head", "text": "Voyager isn't headed there", "t0": t_j1, "t1": t_end, "slot": "tr"},
    {"id": "b-today", "text": "at today's distance", "t0": A("vo05:seventy-five"), "t1": B["takeaway"]["t0"], "slot": "bl"},   # right under the 75,000
]
CUTS = [sh["at"] for sh in SHOTS[1:]]


def before_cut(t1, lead=0.55):   # faded out before the cut, so nothing of one shot sits on the next
    return round(t1 - lead, 4) if any(abs(t1 - c) < 1e-6 for c in CUTS) else t1


# the spine readout (WRITING.md, "The picture", rule 2): one number in one place for the whole story, its small
# label naming the beat; then the channel's readout segment takes over in its usual place and size
SPINE = [0.31, 0.47]                     # the widest label (24 characters) stays inside the safe box
t_tk = B["takeaway"]["t0"]
COUNTERS = [
    {"id": "c-prox-h", "label": "light-years to Proxima", "fmt": "text", "text": "4.24", "t0": 0.0, "t1": t_cut, "at": [0.29, 0.40]},
    {"id": "c-year", "label": "Voyager 1 · year", "fmt": "year", "t0": t_launch, "t1": t_sig, "at": SPINE},
    {"id": "c-sig1", "label": "signal travel · hours", "fmt": "hours", "off": 0, "t0": t_sig, "t1": t_cmd, "at": SPINE, "lit": 24},
    {"id": "c-sig2", "label": "command → answer", "fmt": "hours", "off": 24, "t0": t_cmd, "t1": A("vo04:twenty"), "at": SPINE, "lit": 48},
    {"id": "c-hp", "label": "out of the Sun's wind", "fmt": "text", "text": "2012", "t0": A("vo04:twenty"), "t1": A("vo04:three"), "at": SPINE},
    {"id": "c-oort0", "label": "years to the comet cloud", "fmt": "text", "text": "≈300", "t0": A("vo04:three"), "t1": A("vo04:thirty"), "at": SPINE},
    {"id": "c-oort1", "label": "years more to cross it", "fmt": "text", "text": "≈30,000", "t0": A("vo04:thirty"), "t1": t_j0, "at": SPINE},
    {"id": "c-ld0", "label": "light-days to Proxima", "fmt": "text", "text": "≈1,550", "t0": A("vo05:fifteen"), "t1": A("vo05:seventy-five"), "at": SPINE},
    {"id": "c-trip", "label": "years at Voyager's speed", "fmt": "text", "text": "75,000", "t0": A("vo05:seventy-five"), "t1": t_tk, "at": SPINE},
    {"id": "c-days", "label": "light-days to Proxima", "fmt": "text", "text": "≈1,550", "t0": t_tk, "t1": B["readout"]["t0"], "at": SPINE},
    {"id": "c-read-ld", "label": "light time · Earth to Voyager", "fmt": "text", "text": "1 day", "read": True, "t0": A("vo07:Light"), "t1": A("vo07:To#2"), "at": [0.5, 0.27]},
    {"id": "c-read-px", "label": "light time · Earth to Proxima", "fmt": "text", "text": "4 years, 3 months", "read": True, "t0": A("vo07:To#2"), "t1": end_out, "at": [0.5, 0.27]},   # above Proxima and its lane, not on them
]
for row in BADGES + COUNTERS:
    row["t1"] = before_cut(row["t1"])
# two values never share the screen: each counter leaves 0.4 s before the next one arrives (the spine hands over to the
# readout in another place, so the rule holds wherever they sit)
for a, b in zip(COUNTERS, COUNTERS[1:]):
    if b["t0"] - a["t1"] < 0.4:
        a["t1"] = round(b["t0"] - 0.4, 4)
PILLS = []   # (the two pills only repeated their captions under the plate)

TITLE = {"series": "Light Minute · No. 002", "title": "The *nearest star*", "t1": B["normal"]["t0"] - 0.5, "sig": A("line:vo01:end", 0.05)}
END = {"title": "Next light: a planet that turns *backwards*", "follow": "Light Minute · No. 003",
       "next": "Voyager 1 reaches one light-day from Earth on 18 November 2026 (NASA)."}   # the true-fact footnote (c5)

CUE = {"voy": A("vo02:Voyager"), "launch": t_launch, "stop": t_stop, "line": A("vo03:line"), "sig": t_sig, "arr1": t_arr1, "cmd": t_cmd, "ans": t_ans, "arr2": t_arr2, "takeaway": t_tk,
       "hp": A("vo04:twenty"), "ghost": A("vo04:three"), "deep": A("vo04:thirty"), "jump": [t_j0, t_j1], "pull": [t_p0, t_p1],
       "lane": A("vo05:fifteen"), "lane2": A("vo06:fifteen"), "pxring": A("vo07:Proxima"), "speck": A("vo06:day")}

POSTER = A("vo05:years", 0.4)               # Proxima, the speck and "about 75,000 years"
# captions: number phrases and fixed phrases stay on one line (after the last anchor lookup)
glue(f, {"vo01": ["the nearest star?"], "vo03": ["a full day", "the day after tomorrow."],
         "vo02": ["nineteen seventy-seven", "kilometers a second.", "Earth to the Moon", "in six hours."],
         "vo04": ["twenty twelve,", "into interstellar space.", "hundred years away.", "thirty thousand", "cloud of comets."],
         "vo05": ["Proxima Centauri,", "fifteen hundred", "about seventy-five", "thousand years.", "wasn't in Europe."],
         "vo06": ["day one", "of fifteen hundred."], "vo07": ["four years", "three months."]})

film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": POSTER,
    "shots": SHOTS, "beats": BEATS,
    "phys": {"c_km": C_KM, "au": AU, "ly": LY, "year": YEAR, "ld_au": LD_AU, "y0": Y0, "y_now": Y_NOW, "y_sat": Y_SAT, "r_sat": R_SAT,
             "slope": SLOPE, "y_hp": Y_HP, "r_hp": R_HP, "r_oort0": R_OORT0, "r_oort1": R_OORT1, "prox_au": PROX_AU, "prox_scene": PROX_SCENE,
             "voy_dir": VOY_DIR_DEG, "voy_az": VOY_AZ_DEG, "ys": YS, "planets": [["Earth", 1.0], ["Jupiter", 5.2], ["Saturn", 9.54], ["Uranus", 19.2], ["Neptune", 30.1]]},
    "clk": CLK, "cam": CAM, "ladder": LADDER, "cue": CUE,
    "labels": LABELS, "badges": BADGES, "counters": COUNTERS, "pills": PILLS,
    "title": TITLE, "endCard": t_end, "end": END,
    "captions": hold(f, keep_units(f.captions(max_chars=24))),   # each page stays until its last phrase has been spoken
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}

# ── the studio's cue sheet ─────────────────────────────────────────────────
ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS]
ev.append({"t": TITLE["sig"], "kind": "signature", "tag": "title"})
ev.append({"t": t_end, "kind": "signature", "tag": "end"})
for L in LABELS:
    if L["t0"] > 0 and not L.get("quiet"):   # a label that only moves Voyager's name to its next placement makes no sound
        ev.append({"t": L["t0"], "kind": "label", "tag": L["id"]})
for c in COUNTERS:
    ev.append({"t": c["t0"], "kind": "counter.show", "tag": c["id"]})
for b in BADGES:
    if b["t0"] > 0:
        ev.append({"t": b["t0"], "kind": "badge", "tag": b["id"]})   # silent (the preset maps no badge sound)
for p in PILLS:
    if p["t0"] > 0:
        ev.append({"t": p["t0"], "kind": "scale", "tag": p["id"]})   # silent
for yr in (1980, 1990, 2000, 2010, 2020):                            # the year counter ticks each decade
    ev.append({"t": round(t_launch + (yr - Y0) * YEAR / RATE_F, 4), "kind": "counter.tick", "tag": f"c-year-{yr}"})
ev += [
    {"t": t_sig, "kind": "probe.ping", "tag": "signal"},
    {"t": t_sig, "kind": "light.front", "tag": "signal-in", "t1": t_arr1},
    {"t": t_arr1, "kind": "arrive", "tag": "signal-home"},
    {"t": t_cmd, "kind": "probe.ping", "tag": "command"},
    {"t": t_cmd, "kind": "light.front", "tag": "command-out", "t1": t_ans},
    {"t": t_ans, "kind": "probe.ping", "tag": "answer"},
    {"t": t_ans, "kind": "light.front", "tag": "signal-back", "t1": t_arr2},
    {"t": t_arr2, "kind": "arrive", "tag": "answer-in"},
    {"t": t_p0, "kind": "scale.jump", "tag": "to-comets", "t1": t_p1},
    {"t": t_j0, "kind": "scale.jump", "tag": "to-proxima", "t1": t_j1},
]
cues_file = HERE / "build" / f"cues-{ID}-9x16.json"
if cues_file.exists():
    cj = json.loads(cues_file.read_text())
    pic = {e.get("tag"): e for e in cj.get("events", [])}
    for e in ev:
        p = pic.get(e.get("tag"))
        if p and p.get("pos") and e["kind"] in ("label", "counter.show"):
            e["pos"] = p["pos"]
    shown = {k: v for k, v in (cj.get("shown") or {}).items() if k.startswith("l-") and v > 0}
else:
    shown = {}
sheet = {"duration": f.duration, "fps": FPS, "preset": "lightminute-vacuum",
         "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: e["t"]),
         "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}
if shown:
    sheet["shown"] = shown

(HERE / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
print(f"film.json: {f.duration:.2f} s, {len(SHOTS)} shots, {sum(len(k) for k in CAM.values())} camera keys, {len(LABELS)} labels, "
      f"{len(BADGES)} badges, {len(COUNTERS)} counters, {len(film['captions'])} caption pages, end card {t_end:.2f} s")
print(f"  flight {t_launch:.2f}–{t_stop + RAMP_F:.2f} s, signal {t_sig:.2f}→{t_arr1:.2f}, answer {t_ans:.2f}→{t_arr2:.2f}, "
      f"pull {t_p0:.2f}–{t_p1:.2f}, jump {t_j0:.2f}–{t_j1:.2f} s; trip {TRIP_Y:,.0f} years; Oort {R_OORT0:,.0f}–{R_OORT1:,.0f} AU")
print(f"sheet.json: {len(sheet['events'])} events" + (f", {len(shown)} shown times from the picture" if shown else ""))
for b in BEATS:
    print(f"  {b['id']:<9} {b['t0']:6.2f}–{b['t1']:6.2f}")
