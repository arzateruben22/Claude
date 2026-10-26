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
VOY_AZ_DEG = 25.0                         # ... its ecliptic part 25° off the line of sight, so the path climbs the frame
assert abs(LD_AU - 173.14) < 0.05, LD_AU
assert 16.5 < SLOPE * AU / YEAR < 17.3, SLOPE * AU / YEAR
assert 74000 < TRIP_Y < 75500, TRIP_Y

# ── shots: the hook (the payoff, the local view), then one continuous shot: the solar view pulls back with
# Voyager's flight, holds for the signal, pulls back ×12 to the comet cloud, then the one scale jump to Proxima ──
t_cut = B["normal"]["t0"]
t_end = A("vo08:Next", -0.25)
SHOTS = [{"at": 0.0, "name": "hook"}, {"at": t_cut, "name": "space"}, {"at": t_end, "name": "end"}]

# ── scene clocks (clock.js keys; "anchor": [t, τ]) ──────────────────────────
RATE_F = 2e8                              # the flight: 49 years in 7.8 s ("200,000,000× faster")
T49 = (Y_NOW - Y0) * YEAR
t_launch = A("vo02:Voyager")
RAMP_F = 0.6
t_stop = round(t_launch + (T49 - RATE_F * RAMP_F / 2) / RATE_F, 4)   # a linear ramp to a stop lands τ on 18 Nov 2026 exactly
RATE_S = 5e4                              # the signal: a day in 1.73 s ("50,000× faster")
LEG = 86400 / RATE_S
t_arr1 = A("vo03:day")                    # the signal reaches Voyager on "a full *day*"
t_sig = round(t_arr1 - LEG, 4)
t_arr2 = A("vo03:tomorrow")               # the answer reaches Earth on "the day after *tomorrow*"
t_ans = round(t_arr2 - LEG, 4)
assert t_sig > A("vo03:line:end"), (t_sig, A("vo03:line:end"))
assert t_ans > t_arr1 + 0.5
CLK = {
    "flight": {"keys": [{"t": t_launch, "rate": RATE_F}, {"t": t_stop, "rate": 0.0, "ramp": RAMP_F, "badge": None}], "anchor": [t_launch, 0.0]},
    "signal": {"keys": [{"t": t_sig, "rate": RATE_S}, {"t": t_arr1, "rate": 0.0, "badge": None},
                        {"t": t_ans, "rate": RATE_S}, {"t": t_arr2, "rate": 0.0, "badge": None}], "anchor": [t_sig, 0.0]},
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
CAM = {
    "hook": [{"t": 0.0, **POSE, "dist": 1169, "az": -1.2}, {"t": t_cut, **POSE, "dist": 1184, "az": 0.0, "ease": "sine"}],
    "space": [
        {"t": t_cut, **POSE, "dist": 70, "az": 0.0},
        {"t": t_launch, **POSE, "dist": 70, "az": 0.0, "ease": "sine"},
        # the pull-back follows Voyager: the camera's distance grows with Voyager's, so it climbs to the same height
        *[{"t": round(t_launch + (yr - Y0) * YEAR / RATE_F, 4), **POSE, "dist": round(max(70.0, (R_SAT + SLOPE * (yr - Y_SAT)) * 1205 / LD_AU), 1),
           "az": round((yr - Y0) / (Y_NOW - Y0), 3), "ease": "lin"} for yr in (1983, 1990, 2000, 2010, 2020)],
        {"t": t_stop + RAMP_F, **POSE, "dist": 1205, "az": 1.0, "ease": "sine"},
        {"t": B["why"]["t0"], **POSE, "dist": 1193, "az": 2.0, "ease": "sine"},
        {"t": t_j0, **POSE, "dist": 1184, "az": 4.0, "ease": "sine"},
        {"t": B["takeaway"]["t0"], **POSE, "dist": 1184, "az": 3.0, "ease": "sine"},
        {"t": t_end + 0.4, **POSE, "dist": 1169, "az": 1.5, "ease": "sine"},
    ],
    "end": [{"t": t_end, **POSE, "dist": 1169, "az": 1.5}, {"t": B["tease"]["t1"], **POSE, "dist": 1184, "az": 0.5, "ease": "sine"}],
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
    {"id": "l-prox-h", "text": "Proxima Centauri", "kind": "star", "anchor": "prox", "t0": 0.0, "t1": t_cut, "shot": "hook", "side": -1},
    {"id": "l-in-h", "text": "Voyager 1 is in here", "kind": "light", "anchor": "speck", "t0": 0.0, "t1": t_cut, "shot": "hook", "side": -1},
    # normal: the flight
    {"id": "l-sun", "text": "Sun", "kind": "star", "anchor": "sun", "t0": A("vo02:ride"), "t1": A("vo02:left"), "shot": "space", "side": 1},
    {"id": "l-voy", "text": "Voyager 1", "kind": "body", "anchor": "voy", "t0": A("vo02:Voyager", 0.2), "t1": t_p0, "shot": "space", "side": -1},
    {"id": "l-nep", "text": "Neptune's orbit", "kind": "gravity", "anchor": "neptune", "t0": A("vo02:farthest"), "t1": A("vo02:coasts"), "shot": "space", "side": 1},
    {"id": "l-v", "text": "about 17 km/s", "kind": "gravity", "anchor": "voy-v", "t0": A("vo02:seventeen"), "t1": B["change"]["t0"], "shot": "space", "side": 1},
    # change: the signal
    {"id": "l-earth", "text": "Earth", "kind": "body", "anchor": "sun", "t0": t_sig, "t1": A("vo03:us"), "shot": "space", "side": 1},
    {"id": "l-sig", "text": "signal", "kind": "light", "anchor": "front1", "t0": round(t_sig + 0.25, 4), "t1": round(t_arr1 + 0.5, 4), "shot": "space", "side": 1},
    {"id": "l-ld", "text": "1 light-day", "kind": "light", "anchor": "ldring", "t0": round(t_arr1 + 0.5, 4), "t1": B["why"]["t0"], "shot": "space", "side": 1},
    {"id": "l-ans", "text": "answer", "kind": "light", "anchor": "front2", "t0": round(t_ans + 0.25, 4), "t1": round(t_arr2 + 0.4, 4), "shot": "space", "side": 1},
    # why: the heliopause, then the comet cloud
    {"id": "l-hp", "text": "edge of the Sun's wind", "kind": "light", "anchor": "hp", "t0": A("vo04:twenty"), "t1": t_p0, "shot": "space", "side": 1, "fixed": True},
    {"id": "l-oort", "text": "comet cloud", "kind": "body", "anchor": "oort", "t0": A("vo04:cloud"), "t1": t_j0, "shot": "space", "side": 1},
    {"id": "l-300", "text": "300 years", "kind": "body", "anchor": "ghost", "t0": A("vo04:three"), "t1": t_j0, "shot": "space", "side": -1},
    {"id": "l-30k", "text": "30,000 more to cross", "kind": "body", "anchor": "oort-deep", "t0": A("vo04:thirty"), "t1": t_j0, "shot": "space", "side": -1},
    # whoa: Proxima arrives
    {"id": "l-prox", "text": "Proxima Centauri", "kind": "star", "anchor": "prox", "t0": t_j1, "t1": end_out, "shot": "space", "side": -1},
    # takeaway: day one of fifteen hundred
    {"id": "l-day1", "text": "day 1", "kind": "light", "anchor": "speck", "t0": A("vo06:day"), "t1": B["readout"]["t0"], "shot": "space", "side": -1},
    {"id": "l-1500", "text": "of about 1,550", "kind": "light", "anchor": "lane", "t0": A("vo06:fifteen"), "t1": B["readout"]["t0"], "shot": "space", "side": 1},
    # readout: a ping per ring
    {"id": "l-ring-ld", "text": "1 day", "kind": "light", "anchor": "speck", "t0": A("vo07:Earth"), "t1": end_out, "shot": "space", "side": -1},
    {"id": "l-ring-px", "text": "4 years, 3 months", "kind": "light", "anchor": "pxring", "t0": A("vo07:Centauri"), "t1": end_out, "shot": "space", "side": 1},
]
BADGES = [
    {"id": "b-nts-h", "text": "not to scale", "t0": 0.0, "t1": t_cut, "slot": "bl"},
    {"id": "b-nts", "text": "not to scale", "t0": t_cut, "t1": t_end, "slot": "tr"},
    {"id": "b-path", "text": "path simplified", "t0": t_launch, "t1": B["change"]["t0"], "slot": "tr"},
    {"id": "b-time-f", "clock": "flight", "t0": t_launch, "t1": round(t_stop + RAMP_F + 0.4, 4), "slot": "tl"},
    {"id": "b-time-s", "clock": "signal", "t0": t_sig, "t1": B["why"]["t0"], "slot": "tl"},
    {"id": "b-theory", "text": "comet cloud: theory", "t0": A("vo04:cloud"), "t1": B["takeaway"]["t0"], "slot": "tr"},
    {"id": "b-head", "text": "Voyager isn't headed there", "t0": t_j1, "t1": t_end, "slot": "tr"},
    {"id": "b-today", "text": "at today's distance", "t0": A("vo05:seventy-five"), "t1": B["takeaway"]["t0"], "slot": "tl"},
]
CUTS = [sh["at"] for sh in SHOTS[1:]]


def before_cut(t1, lead=0.3):
    return round(t1 - lead, 4) if any(abs(t1 - c) < 1e-6 for c in CUTS) else t1


# the spine readout (WRITING.md, "The picture", rule 2): one number in one place for the whole story, its small
# label naming the beat; then the channel's readout segment takes over in its usual place and size
SPINE = [0.26, 0.47]
t_tk = B["takeaway"]["t0"]
COUNTERS = [
    {"id": "c-prox-h", "label": "light-years to Proxima", "fmt": "text", "text": "4.24", "t0": 0.0, "t1": t_cut, "at": SPINE},
    {"id": "c-year", "label": "Voyager 1 · year", "fmt": "year", "t0": t_launch, "t1": t_sig, "at": SPINE},
    {"id": "c-sig1", "label": "signal travel · hours", "fmt": "hours", "t0": t_sig, "t1": t_ans, "at": SPINE, "lit": 24},
    {"id": "c-sig2", "label": "command → answer · hours", "fmt": "hours", "t0": t_ans, "t1": A("vo04:twenty"), "at": SPINE, "lit": 48},
    {"id": "c-hp", "label": "into interstellar space · year", "fmt": "text", "text": "2012", "t0": A("vo04:twenty"), "t1": A("vo04:hasn't"), "at": SPINE},
    {"id": "c-oort0", "label": "years to the comet cloud", "fmt": "text", "text": "300", "t0": A("vo04:hasn't"), "t1": A("vo04:thirty"), "at": SPINE},
    {"id": "c-oort1", "label": "years more to cross it", "fmt": "text", "text": "30,000", "t0": A("vo04:thirty"), "t1": A("vo05:fifteen"), "at": SPINE},
    {"id": "c-ld0", "label": "light-days to Proxima, about", "fmt": "text", "text": "1,550", "t0": A("vo05:fifteen"), "t1": A("vo05:seventy-five"), "at": SPINE},
    {"id": "c-trip", "label": "years to Proxima, at Voyager's speed", "fmt": "text", "text": "75,000", "t0": A("vo05:seventy-five"), "t1": t_tk, "at": SPINE},
    {"id": "c-days", "label": "light-days to Proxima", "fmt": "text", "text": "1,550", "t0": t_tk, "t1": B["readout"]["t0"], "at": SPINE},
    {"id": "c-read-ld", "label": "light time · Earth to Voyager", "fmt": "text", "text": "1 day", "read": True, "t0": A("vo07:Light"), "t1": round(A("vo07:To") - 0.05, 4), "at": [0.5, 0.43]},
    {"id": "c-read-px", "label": "light time · Proxima to Sun", "fmt": "text", "text": "4 years, 3 months", "read": True, "t0": A("vo07:To"), "t1": end_out, "at": [0.5, 0.43]},
]
for row in BADGES + COUNTERS:
    row["t1"] = before_cut(row["t1"])
PILLS = [
    {"id": "p-moon", "text": "Earth to the Moon: 6 hours", "t0": A("vo02:Earth"), "t1": B["change"]["t0"], "shot": "space", "at": [90 / 1080, 0.53]},
    {"id": "p-europe", "text": "75,000 years ago: no Homo sapiens in Europe", "t0": A("vo05:Count"), "t1": B["takeaway"]["t0"], "shot": "space", "at": [90 / 1080, 0.53]},
]

TITLE = {"series": "Light Minute · No. 002", "title": "The *nearest star*", "t1": B["normal"]["t0"] - 0.25, "sig": A("line:vo01:end", 0.05)}
END = {"title": "Next light: the planet that turns *backwards*", "follow": "Light Minute · No. 003",
       "next": "Voyager 1 reaches one light-day from Earth on 18 November 2026 (NASA)."}   # the true-fact footnote (c5)

CUE = {"launch": t_launch, "stop": t_stop, "sig": t_sig, "arr1": t_arr1, "ans": t_ans, "arr2": t_arr2,
       "hp": A("vo04:twenty"), "ghost": A("vo04:three"), "deep": A("vo04:thirty"), "jump": [t_j0, t_j1], "pull": [t_p0, t_p1],
       "lane": A("vo05:fifteen"), "pxring": A("vo07:Proxima"), "speck": A("vo06:day")}

film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": A("vo05:years", 0.4),   # Proxima, the speck and "about 75,000 years"
    "shots": SHOTS, "beats": BEATS,
    "phys": {"c_km": C_KM, "au": AU, "ly": LY, "year": YEAR, "ld_au": LD_AU, "y0": Y0, "y_now": Y_NOW, "y_sat": Y_SAT, "r_sat": R_SAT,
             "slope": SLOPE, "y_hp": Y_HP, "r_hp": R_HP, "r_oort0": R_OORT0, "r_oort1": R_OORT1, "prox_au": PROX_AU, "prox_scene": PROX_SCENE,
             "voy_dir": VOY_DIR_DEG, "voy_az": VOY_AZ_DEG, "ys": YS, "planets": [["Earth", 1.0], ["Jupiter", 5.2], ["Saturn", 9.54], ["Uranus", 19.2], ["Neptune", 30.1]]},
    "clk": CLK, "cam": CAM, "ladder": LADDER, "cue": CUE,
    "labels": LABELS, "badges": BADGES, "counters": COUNTERS, "pills": PILLS,
    "title": TITLE, "endCard": t_end, "end": END,
    "captions": f.captions(max_chars=24),
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}

# ── the studio's cue sheet ─────────────────────────────────────────────────
ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS]
ev.append({"t": TITLE["sig"], "kind": "signature", "tag": "title"})
ev.append({"t": t_end, "kind": "signature", "tag": "end"})
for L in LABELS:
    if L["t0"] > 0:
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
    {"t": t_sig, "kind": "probe.ping", "tag": "command"},
    {"t": t_sig, "kind": "light.front", "tag": "signal-out", "t1": t_arr1},
    {"t": t_arr1, "kind": "arrive", "tag": "signal-in"},
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
