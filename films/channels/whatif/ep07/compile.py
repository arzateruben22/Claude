"""Compile Possibility Lab No. 007, "Walking to the Moon": script + voice timings + this direction →
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
ID = "envelope-007"
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
t_rw = A("vo04:But", 0.1)                                  # the clock rewinds: "nobody walks day and night"
t_b0 = A("vo04:working", -0.1)                             # the race begins: a working day of walking
t_26 = A("vo05:years", -0.05)                              # the 8 h walker arrives on "twenty-six years"
t_140 = A("vo05:forty", 0.15)                              # the clock runs on to 140
t_box = t_26
t_work0, t_home, t_end = B["work"]["t0"], B["takeaway"]["t0"], A("vo08:Next", -0.25)
t_apollo = [A("vo07:Apollo", 0.3), A("vo07:days", 0.1)]    # the capsule crosses the gap
t_spread = [A("vo03:Walk", -0.3), A("vo03:Walk", 0.8)]      # the lanes open out

# the clocks, in years
CLOCK_A = [[t_walk0, 0.0], [t_nine, YN]]                                     # nonstop
CLOCK_B = [[t_b0, 0.0], [t_26, Y8], [t_140, YS], [B["work"]["t0"], YS]]      # the race
COUNT = [[t_walk0, 0.0], [t_nine, YN], [t_rw, YN], [t_rw + 0.6, 0.0], [t_b0, 0.0], [t_26, Y8], [t_140, YS]]

# ── shots ──
SHOTS = [
    {"at": 0.0, "name": "front"},                        # hook: you, and the line that leaves the paper
    {"at": B["normal"]["t0"], "name": "pull"},           # normal: back off the paper to space
    {"at": B["change"]["t0"], "name": "space"},          # change … takeaway: one frame of the Earth–Moon line
    {"at": t_end, "name": "end"},
]
k = lambda ty, dist, el, fy=0.40, az=0: {"target": [0, ty, 0], "dist": dist, "el": el, "az": az, "fov": 24, "fy": fy}
FRONT = k(1.2, 17, 8, 0.40)
SPACE = k(1.10e8, 2.2e9, 3, 0.40)
CAM = {
    "front": [{"t": 0.0, **FRONT}, {"t": B["normal"]["t0"], **k(1.2, 30, 8, 0.40), "ease": "sine"}],      # a slow back-off through "Starting at your own front door"
    "pull": [                                                                    # a constant rate of zoom in log distance
        {"t": t_pull0, **k(1.2, 30, 8, 0.40)},
        {"t": t_pull0 + (t_pull1 - t_pull0) * 0.45, **k(1.0e3, 3.0e3, 6.5, 0.40), "ease": "linear"},
        {"t": t_pull0 + (t_pull1 - t_pull0) * 0.75, **k(3.0e6, 2.0e7, 4.5, 0.40), "ease": "linear"},
        {"t": t_pull1, **SPACE, "ease": "inout2"},
    ],
    "space": [{"t": B["change"]["t0"], **SPACE}, {"t": t_home, **{**SPACE, "dist": 2.15e9}, "ease": "sine"}, {"t": t_end, **{**SPACE, "dist": 2.15e9}}],
    "end": [{"t": t_end, **{**SPACE, "dist": 2.15e9}}, {"t": B["tease"]["t1"], **FRONT, "ease": "inout2"}],
}
for shot, keys in CAM.items():
    for a, b in zip(keys, keys[1:]):
        dt = b["t"] - a["t"]
        assert dt > 0, (shot, a["t"], b["t"])
        for kk in ("az", "el"):
            assert abs(b[kk] - a[kk]) / dt <= 3.0 + 1e-9, f"{shot}: {kk} turns too fast between {a['t']:.2f} and {b['t']:.2f}"
for x, y in zip(SHOTS[:-1], SHOTS[1:]):
    assert CAM[x["name"]][-1]["target"] == CAM[y["name"]][0]["target"] and CAM[x["name"]][-1]["dist"] == CAM[y["name"]][0]["dist"], (x, y)

# ── the spine readout ──
sp_ = lambda t, label, terms, **kw: {"t": t, "label": label, "terms": terms, **kw}
SPINE = [
    sp_(A("vo02:Moon", 0.1), "the Moon's mean distance", [["in", f"{R['moon_km']:,} km"]]),
    sp_(t_walk0, "an easy pace, nonstop", [["in", f"{R['moon_km']:,} km"], ["op", "÷"], ["in", "5 km/h"]]),
    sp_(A("vo03:nine", -0.05), "nonstop, day and night", [["in", f"{R['hours']:,} h"], ["op", "≈"], ["ans", f"{R['years_nonstop']} years"]]),
    sp_(t_b0, "walking 8 hours a day", [["in", f"{R['hours']:,} h ÷ 8 h"], ["op", "≈"], ["ans", "? years"]]),
    sp_(t_box, "a working day of walking", [["op", "≈"], ["ans", f"{R['years_8h']} years"]], box=True),
    sp_(A("vo05:popular", 0.0), "a working day of walking", [["op", "≈"], ["ans", f"{R['years_8h']} years"]], box=True, keep=True),
    sp_(t_home, "to the Moon on foot", [["op", "≈"], ["ans", f"{R['years_8h']} years"]], box=True, keep=True),
]
SPINE_OUT = t_end

s = R["sens_years_8h"]
WORK = {
    "t0": t_work0, "t1": t_home - 0.3, "title": "Show your work",
    "rows": [
        {"t": t_work0 + 0.15, "k": "384,400 km ÷ 5 km/h ÷ 8 h ÷ 365", "v": f"≈ {s[1]} yr", "lit": False},
        {"t": A("vo06:Slower", -0.05), "k": "slower: 4 km/h", "v": f"≈ {s[0]} yr", "lit": True},
        {"t": A("vo06:quicker", -0.05), "k": "quicker: 6 km/h", "v": f"≈ {s[2]} yr", "lit": True},
    ],
    "assume": ["no road", "8 h a day", "0.75 m a step"],
}

# ── labels, badges, counters ──
LABELS = [
    {"id": "l-you", "text": "you", "kind": "anchor", "anchor": "you", "t0": 0.0, "t1": t_title_out + 0.1, "shot": "front", "side": 1},
    {"id": "l-earth", "text": "Earth", "kind": "part", "anchor": "earth", "t0": t_rings[0], "t1": t_end, "shot": "space", "side": 1},
    {"id": "l-moon", "text": "the Moon · 384,400 km", "kind": "part", "anchor": "moon", "t0": A("vo02:Moon", 0.2), "t1": t_end, "shot": "space", "side": -1},
    {"id": "l-nonstop", "text": "nonstop: ≈ 9 yr", "kind": "part", "anchor": "laneA", "t0": t_nine, "t1": t_rw, "shot": "space", "side": -1},
    {"id": "l-steps", "text": "10,000 steps a day: ≈ 140 yr", "kind": "calc", "anchor": "laneS", "t0": A("vo05:popular", 0.0), "t1": t_work0 - 0.3, "shot": "space", "side": -1},
    {"id": "l-apollo", "text": "Apollo: about 3 days", "kind": "anchor", "anchor": "capsule", "t0": t_apollo[0], "t1": t_end - 0.3, "shot": "space", "side": 1},
]
BADGES = [
    {"id": "b-thought", "text": "thought experiment", "t0": 0.0, "t1": t_title_out, "slot": "bl"},
    {"id": "b-scale", "text": "not to scale until the Moon", "t0": t_pull0, "t1": t_pull1 - 0.3, "slot": "tr"},
    {"id": "b-pace", "text": "∵ an easy pace, 5 km/h", "t0": t_walk0, "t1": t_rw - 0.2, "slot": "tl"},
    {"id": "b-road", "text": "∵ no road, no rest", "t0": t_nine + 0.3, "t1": t_rw, "slot": "tr"},
    {"id": "b-day", "text": "∵ 8 hours a day", "t0": t_b0, "t1": t_work0 - 0.3, "slot": "tl"},
    {"id": "b-stride", "text": "∵ 0.75 m a step", "t0": A("vo05:popular", 0.0), "t1": t_work0 - 0.3, "slot": "tr"},
    {"id": "b-rounded", "text": "rounded", "t0": t_box + 0.3, "t1": t_work0 - 0.3, "slot": "bl"},
]
CUTS = [sh["at"] for sh in SHOTS[1:]]
for b in BADGES:
    if any(abs(b["t1"] - c) < 1e-6 for c in CUTS):
        b["t1"] = round(b["t1"] - 0.3, 4)
COUNTERS = [
    {"id": "c-years", "label": "years of walking", "t0": t_walk0, "t1": t_work0 - 0.3, "at": [0.80, 0.33], "keys": COUNT, "end": Y8},
]

TITLE = {"series": "Possibility Lab · No. 007", "title": "Walking to the *Moon*", "t1": t_title_out, "sig": A("line:vo01:end", 0.05)}
END = {"title": "Next envelope: *everyone, holding hands*", "follow": "Possibility Lab · No. 007",
       "next": "NASA Moon fact sheet: mean distance about 384,400 km."}

CUE = {"pull": [t_pull0, t_pull1], "rings": t_rings, "spread": t_spread, "clockA": CLOCK_A, "clockB": CLOCK_B, "box": t_box, "nine": t_nine,
       "apollo": t_apollo, "home": t_home}
film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": round(t_box + 1.0, 4),
    "shots": SHOTS, "beats": BEATS,
    "world": {"fig": FIG, "rE": R_E, "rM": R_M, "yMoon": Y_MOON, "top": LINE_TOP, "earthKm": EARTH_D_KM, "n": R["earths"]},
    "cam": CAM, "cue": CUE, "spine": SPINE, "spineOut": SPINE_OUT, "work": WORK,
    "labels": LABELS, "badges": BADGES, "counters": COUNTERS,
    "title": TITLE, "endCard": t_end, "end": END,
    "captions": f.captions(max_chars=24, balance=True, keep=("thirty Earths", "side by side", "nine years", "twenty-six years", "a hundred and forty", "an easy pace", "the Apollo crews", "about three days", "never gets close", "the Moon")),
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}

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
    {"t": t_walk0, "kind": "swell", "tag": "walk", "t1": t_nine},
    {"t": t_apollo[0], "kind": "swell", "tag": "apollo", "t1": t_apollo[1]},
]
sheet = {"duration": f.duration, "fps": FPS, "preset": "envelope-working",
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
