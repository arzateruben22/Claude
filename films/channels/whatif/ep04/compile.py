"""Compile Back of the Envelope No. 004, "Count to a billion": script + voice timings + this direction →
film.json (the scene's clock: shots, camera keys, the tape's slips, the calendar and the ruler, the spine
readout's states, the show-your-work card, labels, badges, counters, captions, title and end card) and
sheet.json (the studio's cue sheet). Nothing here is a hand-typed time: every moment hangs on a beat or a
spoken word (kits/cinema/script/timeline.py anchors), and every number comes from calc.py, the same module
claims.json was written from.

  python3 -I films/channels/whatif/ep04/compile.py

The world (scene.mjs, ../set/tape04.js): one line up the graph-paper desk, away from the camera (−z), so it
runs up the vertical frame. First the counting tape: one paper slip per number, its length growing with the
syllables it takes to say (a marker dot per syllable), with "…" gaps where the count skips ahead; then the
calendar of Harper's summer (one square a day, filled as he counts); then the ruler of centuries (a quarter
unit a year), drawn in marker as the billion is counted, five blue lifetimes beside it. 1 unit ≈ 1 m of desk.
"""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[3] / "kits/cinema/script"))
sys.path.insert(0, str(HERE))
from timeline import Film   # noqa: E402
from calc import V, RESULTS, syl, LIFE_YR, HARPER_DAYS   # noqa: E402

FPS, BPM = 30, 50                         # bible §3: A lydian at 50 BPM (a 16th = 9 frames)
ID = "envelope-004"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}
R = RESULTS
assert R["naive_yr"] == 32 and R["real_yr"] == 380 and R["s_per_number_late"] == 9

# ── the tape: the numbers it shows, laid from z = 0 up the desk (−z) ─────────
SLIP_W, BASE, PER_SYL, GAP, SKIP = 5.0, 1.35, 0.16, 0.22, 2.4    # units; SKIP: the "…" gap where the count jumps
GROUPS = [list(range(1, 13)), [99, 100, 101], [999, 1000, 1001], [99_999, 100_000, 100_001],
          [999_999, 1_000_000, 1_000_001], [99_999_999, 100_000_000], [987_654_320, 987_654_321, 987_654_322]]
LONG = 987_654_321                         # the number the change beat lands on
assert syl(LONG) == 23
SLIPS, z = [], 0.0
for gi, grp in enumerate(GROUPS):
    if gi:
        z -= SKIP
    for n in grp:
        L = round(BASE + PER_SYL * syl(n), 4)
        SLIPS.append({"n": n, "syl": syl(n), "z0": round(z, 4), "z1": round(z - L, 4)})
        z -= L + GAP
TAPE_END = z
SL = {s["n"]: s for s in SLIPS}
zc = lambda n: (SL[n]["z0"] + SL[n]["z1"]) / 2                    # a slip's centre
FIG_X = -SLIP_W / 2 - 0.6                                         # "you" stand left of the tape's foot

# the calendar of Harper's summer: 7 columns (Mon–Sun) × 13 rows (weeks) up the desk; 18 June 2007 was a Monday
CELL = 0.62
CAL = {"z0": round(TAPE_END - 3.0, 4), "cell": CELL, "cols": 7, "rows": 13, "days": HARPER_DAYS, "x0": -CELL * 3.5,
       "first_dow": 0, "start": "2007-06-18"}
CAL["z1"] = round(CAL["z0"] - CELL * CAL["rows"] - 1.2, 4)
CAL_C = [0.0, 0.0, round((CAL["z0"] + CAL["z1"]) / 2, 4)]
HARPER_AT = [round(-0.4 - (CELL * 7 + 1.7) / 2 - 1.1, 4), 0.0, round(CAL["z0"] - 1.6, 4)]   # left of the calendar (scene.mjs centres it at x −0.4)

# the ruler of centuries: from the calendar's top edge up the desk, a quarter unit a year
YU = 0.25
RULER = {"z0": round(CAL["z1"] - 0.6, 4), "yu": YU, "years": 420, "x": 0.0, "w": 10.0, "life": round(LIFE_YR, 2),
         "naive": V["naive_yr"], "real": V["real_yr"]}
ZY = lambda y: round(RULER["z0"] - YU * y, 4)                     # the ruler's z at a year

# ── shots: one world; the camera moves up the line; one match cut back to the start for the takeaway ──
t_title_out = B["normal"]["t0"] - 0.2
t_work0, t_home, t_end = B["work"]["t0"], B["takeaway"]["t0"], A("vo08:Next", -0.25)
SHOTS = [
    {"at": 0.0, "name": "front"},                    # hook: you at the tape's foot (frame 0 and the loop)
    {"at": B["normal"]["t0"], "name": "count"},      # normal: a slip a second, then the tape ahead
    {"at": B["change"]["t0"], "name": "fly"},        # change: up the tape to the hundreds of millions
    {"at": B["why"]["t0"], "name": "summer"},        # why: Harper and his calendar
    {"at": B["whoa"]["t0"], "name": "ruler"},        # whoa: the ruler of centuries
    {"at": t_work0, "name": "work"},                 # show your work over the ruler
    {"at": t_home, "name": "home"},                  # takeaway: match cut to the tape's foot (Harper → you)
    {"at": t_end, "name": "end"},                    # the end card over the front view (the loop)
]

# ── timing of the tape ──
t_tick0 = A("vo02:A", -0.1)                        # a new slip lands every second from "A number a second"
N_TICK = 12 - 3                                    # slips 4..12 (1..3 lie there from frame 0)
TICKS = [round(t_tick0 + k, 4) for k in range(N_TICK)]
assert TICKS[-1] < B["change"]["t0"], TICKS
t_fly0, t_fly1 = A("vo03:Up", -0.15), A("vo03:sentence", -0.1)
t_say0, t_say1 = A("vo03:say", -0.05), A("vo03:it", 0.6)          # the long slip's words light, left to right
t_short = A("vo02:short", -0.1)                                    # the camera lifts to show the slips growing
# Harper: the calendar fills from "man" to "million"; the months light on "summer"
t_cal0, t_cal1, t_summer = A("vo04:man"), A("vo04:million", 0.2), A("vo04:summer", -0.05)
# the ruler draws from "Keep" to "years"; the lifetimes stack from "five" to "lifetimes"
t_rul0, t_rul1 = A("vo05:Keep"), A("vo05:centuries", 0.1)
t_box = A("vo05:four", -0.05)
t_life0, t_life1 = A("vo05:five", -0.05), A("vo05:lifetimes", 0.5)
t_once = A("vo07:once", -0.1)                                      # the "one billion" slip lands beside "1"

# ── the camera (rig.js keys: target, dist, el, az, fov, fx, fy); az 0 = the camera on +z, the line runs up ──
EL, AZ = 48, -8
FRONT = {"target": [-0.55, 0, -1.6], "dist": 36, "el": EL, "az": AZ, "fov": 24, "fy": 0.40}
RUL_T, RUL_D = 230, 430                      # the ruler shot: target at year 95, the far end climbing into the distance
k_cal = lambda zz, dist, el, az: {"target": [-1.4, 0, round(zz, 3)], "dist": dist, "el": el, "az": az, "fov": 24, "fy": 0.34}
k_ruler = lambda zz, dist, el, az: {"target": [-3.0, 0, round(zz, 3)], "dist": dist, "el": el, "az": az, "fov": 24, "fy": 0.30}
k_count = lambda zz, dist=30, el=EL, az=AZ, fy=0.42: {"target": [0, 0, round(zz, 3)], "dist": dist, "el": el, "az": az, "fov": 24, "fy": fy}
z_tick_end = zc(12)
CAM = {
    "front": [{"t": 0.0, **FRONT}, {"t": B["normal"]["t0"], **FRONT, "dist": 31, "ease": "sine"}],
    "count": [
        {"t": B["normal"]["t0"], **FRONT, "dist": 31},
        {"t": TICKS[-1] + 0.3, **k_count(z_tick_end + 2.5, 34, 50, -6), "ease": "inout2"},
        {"t": B["change"]["t0"], **k_count(z_tick_end - 6.0, 52, 48, -5, 0.45), "ease": "inout3"},   # lift: the slips ahead grow
    ],
    "fly": [
        {"t": B["change"]["t0"], **k_count(z_tick_end - 6.0, 52, 48, -5, 0.45)},
        {"t": t_fly0, **k_count(z_tick_end - 7.0, 54, 48, -5, 0.45), "ease": "sine"},
        {"t": t_fly1, **k_count(zc(LONG), 30, 54, -4, 0.40), "ease": "inout3"},
        {"t": B["why"]["t0"], **k_count(zc(LONG) - 0.3, 28, 54, -4, 0.40), "ease": "sine"},
    ],
    "summer": [
        {"t": B["why"]["t0"], **k_count(zc(LONG) - 0.3, 28, 54, -4, 0.40)},
        {"t": t_cal0 - 0.2, **k_cal(CAL_C[2] + 1.6, 38, 58, -6), "ease": "inout3"},
        {"t": B["whoa"]["t0"], **k_cal(CAL_C[2] + 0.6, 46, 62, -7), "ease": "sine"},       # a slow drift up the calendar through the hold
    ],
    "ruler": [
        {"t": B["whoa"]["t0"], **k_cal(CAL_C[2] + 0.6, 46, 62, -7)},
        {"t": t_box + 0.6, **k_ruler(ZY(RUL_T), RUL_D, 46, -6), "ease": "out3"},   # the scale jump: the centuries recede up the desk
        {"t": t_work0, **k_ruler(ZY(RUL_T + 12), RUL_D + 30, 44, -5), "ease": "sine"},
    ],
    "work": [
        {"t": t_work0, **k_ruler(ZY(RUL_T + 12), RUL_D + 30, 44, -5)},
        {"t": t_home, **k_ruler(ZY(RUL_T + 20), RUL_D + 50, 44, -5), "ease": "sine"},
    ],
    "home": [
        {"t": t_home, **k_ruler(ZY(RUL_T + 20), RUL_D + 50, 44, -5)},
        {"t": t_home + 1.8, **FRONT, "ease": "out3"},                                 # back down the whole line to its foot
        {"t": A("vo07:reach", -0.3), **FRONT, "target": [-0.55, 0, -3.2], "dist": 38, "ease": "sine"},
        {"t": t_end, **FRONT, "target": [-0.55, 0, -2.6], "dist": 37, "ease": "sine"},
    ],
    "end": [
        {"t": t_end, **FRONT, "target": [-0.55, 0, -2.6], "dist": 37},
        {"t": B["tease"]["t1"], **FRONT, "ease": "inout2"},          # the last frame is frame 0's composition: the loop
    ],
}
for shot, keys in CAM.items():           # slow turns: ≤ 3° a second in azimuth and elevation
    for a, b in zip(keys, keys[1:]):
        dt = b["t"] - a["t"]
        assert dt > 0, (shot, a["t"], b["t"])
        for kk in ("az", "el"):
            assert abs(b[kk] - a[kk]) / dt <= 3.0 + 1e-9, f"{shot}: {kk} turns too fast between {a['t']:.2f} and {b['t']:.2f}"
for x, y in zip(SHOTS[1:7], SHOTS[2:7]):  # inside the one continuous move, each shot starts where the last ended
    assert CAM[x["name"]][-1]["target"] == CAM[y["name"]][0]["target"] and CAM[x["name"]][-1]["dist"] == CAM[y["name"]][0]["dist"], (x, y)

# ── the spine readout: the running sum (set/spine.js) ──
SPINE = [
    {"t": A("vo02:second", -0.05), "label": "a number a second", "terms": [["in", "1,000,000,000"], ["op", "×"], ["in", "1 s"], ["op", "≈"], ["ans", "? yr"]]},
    {"t": A("vo02:thirtytwo", -0.05), "label": "a number a second, nonstop", "terms": [["in", "1,000,000,000"], ["op", "×"], ["in", "1 s"], ["op", "≈"], ["ans", f"{R['naive_yr']} yr"]]},
    {"t": A("vo03:sentence", -0.05), "label": "one number, said in full", "terms": [["in", "987,654,321"], ["op", "="], ["in", f"{syl(LONG)} syllables"]]},
    {"t": A("vo03:say", -0.05), "label": "at a real counting pace", "terms": [["in", f"{syl(LONG)} syllables"], ["op", "≈"], ["ans", f"{R['s_per_number_late']} s"]]},
    {"t": A("vo04:man", -0.05), "label": "his count", "terms": [["in", "1,000,000"], ["op", "in"], ["in", f"{HARPER_DAYS} days"], ["op", "×"], ["in", f"{R['harper_h']} h"]]},
    {"t": t_summer, "label": "his pace", "terms": [["in", f"{R['rate_syl_s']} syllables"], ["op", "a"], ["in", "second"]]},
    {"t": t_rul0, "label": "a billion at his pace", "terms": [["assume", "his pace"], ["op", "→"], ["ans", "? yr"]]},
    {"t": t_box, "label": "to a billion, out loud", "terms": [["assume", "his pace"], ["op", "→"], ["ans", f"≈ {R['real_yr']} yr"]], "box": True},
    {"t": A("vo05:lifetimes", -0.05), "label": f"about {round(V['lifetimes'])} lifetimes of {R['life_yr']} years", "terms": [["assume", "his pace"], ["op", "→"], ["ans", f"≈ {R['real_yr']} yr"]], "box": True, "keep": True},
    {"t": t_once, "label": "\u201cone billion\u201d: 3 syllables to say", "terms": [["assume", "his pace"], ["op", "→"], ["ans", f"≈ {R['real_yr']} yr"]], "box": True, "keep": True},
]
SPINE_OUT = t_end

# ── show your work (the segment) ──
WORK = {
    "t0": t_work0, "t1": t_home - 0.3,
    "title": "Show your work",
    "rows": [
        {"t": t_work0 + 0.15, "k": f"10⁹ numbers × ≈ {R['syl_mean_billion']} syllables ÷ {R['rate_syl_s']} a second, {R['harper_h']} h a day", "v": f"≈ {R['real_yr']} yr", "lit": False},
        {"t": A("vo06:Never", -0.05), "k": "never sleep", "v": f"≈ {R['sens_nonstop_yr']} yr", "lit": True},
        {"t": A("vo06:twice", -0.05), "k": "count twice as fast", "v": f"≈ {R['sens_double_yr']} yr", "lit": True},
        {"t": A("vo06:centuries", -0.05), "k": "British “hundred and”", "v": f"≈ {R['sens_british_yr']} yr", "lit": False},
    ],
    "assume": ["every number in full", "American names", "his pace holds"],
}

# ── the overlay: labels, badges, counters ──
LABELS = [
    {"id": "l-you", "text": "you", "kind": "anchor", "anchor": "you", "t0": 0.0, "t1": t_title_out + 0.1, "shot": "front", "side": -1, "v": "below"},
    {"id": "l-slip", "text": "one slip a number", "kind": "part", "anchor": "slip4", "t0": TICKS[0] + 0.5, "t1": TICKS[0] + 3.6, "shot": "count", "side": 1},
    {"id": "l-dots", "text": "a dot a syllable", "kind": "calc", "anchor": "dots", "t0": A("vo03:sentence", 0.3), "t1": B["why"]["t0"] - 0.2, "shot": "fly", "side": 1},
    {"id": "l-harper", "text": "Jeremy Harper", "kind": "anchor", "anchor": "harper", "t0": A("vo04:man"), "t1": B["whoa"]["t0"] - 0.2, "shot": "summer", "side": -1, "v": "above"},
    {"id": "l-summer", "text": "his summer: 89 days", "kind": "part", "anchor": "cal", "t0": t_summer, "t1": B["whoa"]["t0"] - 0.2, "shot": "summer", "side": 1, "v": "above"},
    {"id": "l-naive", "text": "a number a second: 32 yr", "kind": "part", "anchor": "naive", "t0": t_box + 0.6, "t1": t_work0 - 0.3, "shot": "ruler", "side": 1},
    {"id": "l-life", "text": "a lifetime: 73 yr", "kind": "anchor", "anchor": "life1", "t0": t_life0, "t1": t_work0 - 0.3, "shot": "ruler", "side": -1},
]
BADGES = [
    {"id": "b-thought", "text": "thought experiment", "t0": 0.0, "t1": t_title_out, "slot": "bl"},
    {"id": "b-second", "text": "∵ a number a second", "t0": A("vo02:second"), "t1": B["change"]["t0"] - 0.3, "slot": "tl"},
    {"id": "b-full", "text": "∵ every number said in full", "t0": A("vo03:every"), "t1": B["why"]["t0"] - 0.3, "slot": "tl"},
    {"id": "b-skip", "text": "skipping ahead", "t0": t_fly0, "t1": t_fly1 + 1.0, "slot": "tr"},
    {"id": "b-pace", "text": "∵ his pace, his hours", "t0": A("vo04:fast"), "t1": t_work0 - 0.3, "slot": "tl"},
    {"id": "b-rounded", "text": "rounded", "t0": t_box + 0.3, "t1": t_work0 - 0.3, "slot": "tr"},
]
CUTS = [sh["at"] for sh in SHOTS[1:]]
for b in BADGES:
    if any(abs(b["t1"] - c) < 1e-6 for c in CUTS):
        b["t1"] = round(b["t1"] - 0.3, 4)
COUNTERS = [
    # the clock while a number a second ticks by
    {"id": "c-tick", "label": "counting", "fmt": "secs", "t0": t_tick0, "t1": B["change"]["t0"] - 0.3, "at": [0.66, 0.30], "keys": [[t_tick0, 3], [TICKS[-1], 12]]},
    # Harper's count, climbing with the calendar
    {"id": "c-harper", "label": "counted", "fmt": "int", "t0": t_cal0, "t1": B["whoa"]["t0"] - 0.3, "at": [0.66, 0.30], "keys": [[t_cal0, 0], [t_cal1, 1_000_000]], "end": 1_000_000},
    # the years of counting as the ruler draws
    {"id": "c-years", "label": "years counting", "fmt": "int", "t0": t_rul0 + 0.2, "t1": t_work0 - 0.3, "at": [0.66, 0.30], "keys": [[t_rul0, 0], [t_rul1, R["real_yr"]]], "end": R["real_yr"]},
]

# ── the title card and the end card ──
TITLE = {"series": "Back of the Envelope · No. 004", "title": "Count to a *billion*", "t1": t_title_out, "sig": A("line:vo01:end", 0.05)}
END = {"title": "Next envelope: *everybody jump*", "follow": "Back of the Envelope · No. 005",
       "next": "Jeremy Harper counted aloud from 1 to 1,000,000 in 89 days, 18 June to 14 September 2007, about 16 hours a day."}

CUE = {"ticks": TICKS, "short": t_short, "fly": [t_fly0, t_fly1], "say": [t_say0, t_say1], "cal": [t_cal0, t_cal1], "summer": t_summer,
       "ruler": [t_rul0, t_rul1], "box": t_box, "life": [t_life0, t_life1], "once": t_once, "home": t_home}

film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": round(t_box + 1.2, 4),
    "shots": SHOTS, "beats": BEATS,
    "world": {"slipW": SLIP_W, "slips": SLIPS, "long": LONG, "figX": FIG_X, "cal": CAL, "harper": HARPER_AT, "ruler": RULER,
              "tapeEnd": round(TAPE_END, 4), "billionSyl": syl(10 ** 9)},
    "cam": CAM, "cue": CUE, "spine": SPINE, "spineOut": SPINE_OUT, "work": WORK,
    "labels": LABELS, "badges": BADGES, "counters": COUNTERS,
    "title": TITLE, "endCard": t_end, "end": END,
    "captions": f.captions(max_chars=24, balance=True, keep=("waking hours", "a sentence of its own", "five whole lifetimes", "every number", "in the hundreds", "hundreds of millions", "out of reach", "at that pace", "if everyone", "the whole count", "you'd be", "jumped at once")),
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}
for pg in film["captions"]:                      # numerals.py writes "a billion" as "1 billion"; the voice says "a"
    for ln in pg["lines"]:
        for w in ln:
            w[0] = re.sub(r"^1 (billion|million)", r"a \1", w[0])

# ── the studio's cue sheet ──
# the tease opens on the end card's signature; the normal beat's section scratch would land 0.5 s into the title's
# signature, which masks it (qa.py measured it 60 ms off), so that one is left to the signature
ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS if b["id"] not in ("tease", "normal")]
ev.append({"t": TITLE["sig"], "kind": "signature", "tag": "title"})
ev.append({"t": t_end, "kind": "signature", "tag": "end"})
for L in LABELS:
    ev.append({"t": L["t0"], "kind": "label", "tag": L["id"]})
for c in COUNTERS:
    ev.append({"t": c["t0"], "kind": "counter.show", "tag": c["id"]})
for i, s in enumerate(SPINE):
    ev.append({"t": s["t"], "kind": "answer.box" if s.get("box") and not (i and SPINE[i - 1].get("box")) else "term.write", "tag": f"spine-{i}",
               **({"t1": round(s["t"] + 0.5, 4)} if s.get("box") and not (i and SPINE[i - 1].get("box")) else {})})
for r in WORK["rows"]:
    ev.append({"t": r["t"], "kind": "term.write", "tag": f"work-{r['k']}"})
for k, t in enumerate(TICKS):                                    # a pencil tick per slip landing
    ev.append({"t": t, "kind": "counter.tick", "tag": f"slip-{k + 4}"})
for wk in range(CAL["rows"]):                                    # a tick per week filled
    ev.append({"t": round(t_cal0 + (t_cal1 - t_cal0) * (wk + 1) / CAL["rows"], 4), "kind": "counter.tick", "tag": f"week-{wk + 1}"})
for k in range(5):                                               # each lifetime lands with a label pluck
    ev.append({"t": round(t_life0 + (t_life1 - t_life0) * k / 4, 4), "kind": "label", "tag": f"life-{k + 1}"})
ev += [
    {"t": t_fly0, "kind": "swell", "tag": "fly", "t1": t_fly1},
    {"t": t_fly1, "kind": "arrive", "tag": "long-slip"},
]
sheet = {"duration": f.duration, "fps": FPS, "preset": "envelope-working",
         "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: e["t"]),
         "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}

(HERE / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
print(f"film.json: {f.duration:.2f} s, {len(SHOTS)} shots, {sum(len(k) for k in CAM.values())} camera keys, {len(LABELS)} labels, "
      f"{len(BADGES)} badges, {len(COUNTERS)} counters, {len(SPINE)} spine states, {len(film['captions'])} caption pages, end card {t_end:.2f} s")
print(f"  tape {len(SLIPS)} slips to z {TAPE_END:.1f}; calendar z {CAL['z0']}..{CAL['z1']}; ruler from z {RULER['z0']} ({RULER['years']} yr)")
print(f"sheet.json: {len(sheet['events'])} events, {len(sheet['voice'])} voice lines")
for b in BEATS:
    print(f"  {b['id']:<9} {b['t0']:6.2f}–{b['t1']:6.2f}  line {b['line']}")
for p in film["captions"]:
    print("   |", " / ".join(" ".join(w[0] for w in ln) for ln in p["lines"]))
