"""Compile Back of the Envelope No. 006, "Every raindrop at once": script + voice timings + this direction →
film.json (the scene's clock: shots, camera keys, the rain's fall, the waffle of where it lands, the water layer,
the coins and the storm column, the spine readout's states, the show-your-work card, labels, badges, counters,
captions, title and end card) and sheet.json (the studio's cue sheet). Every moment hangs on a beat or a spoken
word; every number comes from calc.py, the same module claims.json was written from.

  python3 -I films/channels/whatif/ep06/compile.py

The world (scene.mjs, ../set/rain06.js, ../set/tape04.js's sheets), in true metres: you (anchor blue) stand on the
graph-paper desk under a sky of chalk rain streaks. An ordinary day's rain drizzles; squeezed into one second it
pours; a waffle of 100 squares on the paper shows where it lands (78 ocean, 22 land); then a macro push to your
feet, where the day's water stands as a layer 2.8 mm deep beside two stacked coins; the takeaway pulls back to a
thin film round you, and a record storm day's column rises beside you, taller than you.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[3] / "kits/cinema/script"))
sys.path.insert(0, str(HERE))
from timeline import Film   # noqa: E402
from calc import V, RESULTS, SENS   # noqa: E402

FPS, BPM = 30, 50
ID = "envelope-006"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}
R = RESULTS
assert R["amazons_m"] == 7 and R["real_amazons"] == 80 and R["day_km3"] == 1400

FIG = 1.7
DEPTH = round(V["depth_mm"] / 1000, 6)                           # m: the day's rain, spread over the planet
STORM = 1.825                                                    # m: the record day (Foc-Foc, Réunion, 7–8 Jan 1966; WMO)
COINS_AT = [1.3, 0.6]                                            # on the paper in front of your feet (x, z)
WAFFLE = {"at": [3.4, -2.2], "cell": 0.42, "ocean": round(100 * (1 - V["land_share"]))}

# ── times ──
t_title_out = B["normal"]["t0"] - 0.2
t_day = [A("vo02:ordinary", -0.1), A("vo02:notice", 0.4)]        # an ordinary day passes on the clock
t_amz = A("vo02:eighty", -0.05)
t_sq = [A("vo03:squeeze", -0.1), A("vo03:second", 0.2)]          # the day squeezed into one second
t_pour = A("vo03:pours", -0.1)
t_seven = A("vo03:seven", -0.05)
t_flood = A("vo04:flood", -0.1)
t_ocean = A("vo04:lands", -0.1)                                  # the waffle lights on "lands where it always lands"
t_layer = [A("vo05:Spread", -0.1), A("vo05:deep", 0.2)]          # the layer fills to its depth
t_box = A("vo05:three", -0.05)
t_coins = A("vo05:two", -0.1)
t_work0, t_home, t_end = B["work"]["t0"], B["takeaway"]["t0"], A("vo08:Next", -0.25)
t_film = B["takeaway"]["t0"]                                     # the film is there from the cut
t_storm = [A("vo07:storm", -0.1), A("vo07:up", 0.5)]             # the record storm day rises beside you

# ── the rain's fall (metres fallen in the scene's clock; any frame is a pure function of t) ──
SLOW_V, FAST_V = 1.2, 24.0                                       # drawn speeds (m/s of film time): a drizzle, then the pour
FALL = [[0.0, 0.0], [t_day[0], 0.0]]                             # frozen through the hook
def fall_keys():
    keys, v = [[0.0, 0.0, 0.0], [t_day[0], 0.0, SLOW_V], [t_sq[0], None, SLOW_V], [t_sq[1], None, FAST_V], [B["why"]["t0"], None, FAST_V],
               [t_ocean + 1.0, None, SLOW_V * 2], [t_layer[0], None, 0.0]], None
    out, y = [], 0.0
    for i, (t, _, vv) in enumerate(keys):
        if i:
            t0, v0 = out[-1][0], out[-1][2]
            y += (v0 + vv) / 2 * (t - t0)                         # speed eased linearly between keys: distance is the trapezoid
        out.append([round(t, 4), round(y, 4), vv])
    return out
FALLK = fall_keys()

# ── shots ──
SHOTS = [
    {"at": 0.0, "name": "front"},                    # hook: you under the frozen rain (frame 0 and the loop)
    {"at": B["normal"]["t0"], "name": "day"},        # normal: an ordinary day's drizzle
    {"at": B["change"]["t0"], "name": "pour"},       # change: the day in one second
    {"at": B["why"]["t0"], "name": "where"},         # why: where it lands (the waffle)
    {"at": B["whoa"]["t0"], "name": "macro"},        # whoa: down to your feet: 2.8 mm and two coins
    {"at": t_work0, "name": "work"},
    {"at": t_home, "name": "home"},                  # takeaway: a thin film round you; the storm column rises
    {"at": t_end, "name": "end"},
]

k = lambda tgt, dist, el, fy=0.42, az=0: {"target": [round(v, 4) for v in tgt], "dist": dist, "el": el, "az": az, "fov": 24, "fy": fy}
FRONT = k([0, 2.4, 0], 17, 8, 0.40)
MACRO = k([COINS_AT[0], 0.0031, COINS_AT[1]], 0.076, 4, 0.40, 0)   # face on to the cross-section card, about 19 mm across
CAM = {
    "front": [{"t": 0.0, **FRONT}, {"t": B["normal"]["t0"], **k([0, 2.4, 0], 16.5, 8, 0.40), "ease": "sine"}],
    "day": [
        {"t": B["normal"]["t0"], **k([0, 2.4, 0], 16.5, 8, 0.40)},
        {"t": t_amz, **k([0, 3.2, 0], 20, 4, 0.40), "ease": "inout3"},                # look up into the falling rain
        {"t": B["change"]["t0"], **k([0, 3.2, 0], 20.5, 4, 0.40), "ease": "sine"},
    ],
    "pour": [
        {"t": B["change"]["t0"], **k([0, 3.2, 0], 20.5, 4, 0.40)},
        {"t": t_pour, **k([0, 1.8, 0], 14, 8, 0.38), "ease": "inout3"},              # in close as it pours
        {"t": B["why"]["t0"], **k([0, 1.7, 0], 13.5, 12, 0.38), "ease": "sine"},
    ],
    "where": [
        {"t": B["why"]["t0"], **k([0, 1.7, 0], 13.5, 12, 0.38)},
        {"t": t_flood + 1.0, **k([WAFFLE["at"][0] - 0.5, 0.2, WAFFLE["at"][1]], 21, 21, 0.44, -8), "ease": "inout3"},      # up and over: the waffle beside you
        {"t": B["whoa"]["t0"], **k([WAFFLE["at"][0] - 0.5, 0.2, WAFFLE["at"][1]], 20, 8, 0.44, -4), "ease": "sine"},
    ],
    "macro": [                                                                                   # a match cut on "Spread": the squares to the card
        {"t": B["whoa"]["t0"], **{**MACRO, "dist": 0.082, "az": -3}},
        {"t": t_work0, **{**MACRO, "dist": 0.064, "az": 3}, "ease": "sine"},                # a slow drift in through the line and the hold
    ],
    "work": [{"t": t_work0, **{**MACRO, "dist": 0.064, "az": 3}}, {"t": t_home, **{**MACRO, "dist": 0.062, "az": 4}, "ease": "sine"}],
    "home": [                                                                                    # a clean cut on "So" (review round 1): you, standing in a thin film
        {"t": t_home, **k([0.4, 0.9, 0.3], 9.6, 8, 0.34, -4)},
        {"t": t_storm[0], **k([-0.4, 1.1, 0.2], 11.5, 10, 0.36, -6), "ease": "inout2"},
        {"t": t_end, **k([-0.4, 1.2, 0.2], 12.5, 9, 0.38, -4), "ease": "sine"},
    ],
    "end": [{"t": t_end, **k([-0.4, 1.2, 0.2], 12.5, 9, 0.38, -4)}, {"t": B["tease"]["t1"], **FRONT, "ease": "inout2"}],
}
for shot, keys in CAM.items():
    for a, b in zip(keys, keys[1:]):
        dt = b["t"] - a["t"]
        assert dt > 0, (shot, a["t"], b["t"])
        for kk in ("az", "el"):
            assert abs(b[kk] - a[kk]) / dt <= 3.0 + 1e-9, f"{shot}: {kk} turns too fast between {a['t']:.2f} and {b['t']:.2f}"
for x, y in zip(SHOTS[:-1], SHOTS[1:]):
    if y["name"] in ("home", "macro"):
        continue                                 # the two cuts
    assert CAM[x["name"]][-1]["target"] == CAM[y["name"]][0]["target"] and CAM[x["name"]][-1]["dist"] == CAM[y["name"]][0]["dist"], (x, y)

# ── the spine readout ──
SPINE = [
    {"t": A("vo02:ordinary", -0.05), "label": "rain, snow and hail, a year", "terms": [["in", "520,000 km³"], ["op", "÷"], ["in", "365 days"]]},
    {"t": A("vo02:Great", -0.05), "label": "a day's rain", "terms": [["in", "520,000 km³ ÷ 365"], ["op", "≈"], ["ans", f"{R['day_km3']:,} km³"]]},
    {"t": t_amz, "label": "spread over a day", "terms": [["in", f"{R['day_km3']:,} km³ ÷ 24 h"], ["op", "≈"], ["ans", f"{R['real_amazons']} Amazons"]]},
    {"t": A("vo03:second", -0.05), "label": f"{R['day_km3']:,} km³ in one second", "terms": [["op", "≈"], ["ans", "? Amazons"]]},
    {"t": t_seven, "label": f"{R['day_km3']:,} km³ in one second", "terms": [["op", "≈"], ["ans", f"{R['amazons_m']} million Amazons"]]},
    {"t": t_ocean, "label": "where it lands", "terms": [["in", f"{WAFFLE['ocean']}% ocean"], ["op", "·"], ["in", f"{100 - WAFFLE['ocean']}% land"]]},
    {"t": B["whoa"]["t0"], "label": f"{R['day_km3']:,} km³ ÷ 510 million km²", "terms": [["op", "spread over the planet"], ["op", "≈"], ["ans", "? mm"]]},
    {"t": A("vo05:layer", -0.05), "label": f"{R['day_km3']:,} km³ ÷ 510 million km²", "terms": [["op", "spread over the planet"], ["op", "≈"], ["ans", f"{R['depth_mm']} mm"]]},
    {"t": t_box, "label": "a day's rain, everywhere", "terms": [["op", "a layer"], ["ans", "≈ 3 mm"]], "box": True},
    {"t": t_coins, "label": "about two coins, stacked", "terms": [["op", "a layer"], ["ans", "≈ 3 mm"]], "box": True, "keep": True},
    {"t": t_home, "label": "a day's rain, everywhere", "terms": [["op", "a layer"], ["ans", "≈ 3 mm"]], "box": True, "keep": True},
]
SPINE_OUT = t_end

sd = R["sens_depth_mm"]
WORK = {
    "t0": t_work0, "t1": t_home - 0.3, "title": "Show your work",
    "rows": [
        {"t": t_work0 + 0.15, "k": "1,400\u00a0km³ ÷ 510\u00a0million\u00a0km²", "v": f"≈ {sd[1]} mm", "lit": False},
        {"t": A("vo06:wetter", -0.05), "k": "upper bound: 577,000\u00a0km³/yr", "v": f"≈ {sd[2]} mm", "lit": True},
        {"t": A("vo06:depth", -0.05), "k": "drier: 486,000\u00a0km³/yr", "v": f"≈ {sd[0]} mm", "lit": True},
    ],
    "assume": ["the same places", "one second", "planet-wide average"],
}

# ── labels, badges, counters ──
LABELS = [
    {"id": "l-you", "text": "you", "kind": "anchor", "anchor": "you", "t0": 0.0, "t1": t_title_out + 0.1, "shot": "front", "side": 1},
    {"id": "l-ocean", "text": f"{WAFFLE['ocean']} in 100 drops: the ocean (hatched: land)", "kind": "part", "anchor": "waffle", "t0": t_ocean, "t1": B["whoa"]["t0"] - 0.6, "shot": "where", "side": 1, "v": "above"},
    {"id": "l-storm", "text": "a record storm day: 1.8 m", "kind": "part", "anchor": "storm", "t0": A("vo07:piles", -0.2), "t1": t_end, "shot": "home", "side": -1},
]
BADGES = [
    {"id": "b-thought", "text": "thought experiment", "t0": 0.0, "t1": t_title_out, "slot": "bl"},
    {"id": "b-day", "text": "a day in 6 seconds", "t0": t_day[0], "t1": B["change"]["t0"] - 0.3, "slot": "tr"},
    {"id": "b-same", "text": "∵ same places", "t0": t_sq[0], "t1": B["whoa"]["t0"] - 0.3, "slot": "tl"},
    {"id": "b-avg", "text": "∵ a planet-wide average", "t0": t_layer[0], "t1": t_work0 - 0.3, "slot": "tl"},
    {"id": "b-rounded", "text": "rounded", "t0": t_box + 0.3, "t1": t_work0 - 0.3, "slot": "tr"},
    {"id": "b-storm", "text": "storms get far more; deserts none", "t0": A("vo07:storm"), "t1": t_end - 0.3, "slot": "tl"},
]
CUTS = [sh["at"] for sh in SHOTS[1:]]
for b in BADGES:
    if any(abs(b["t1"] - c) < 1e-6 for c in CUTS):
        b["t1"] = round(b["t1"] - 0.3, 4)
COUNTERS = [
    {"id": "c-clock", "label": [[t_day[0], "an ordinary day"], [t_sq[0], "the whole day, in"]], "fmt": "hours", "t0": t_day[0], "t1": B["why"]["t0"] - 0.3, "at": [0.62, 0.2],
     "keys": [[t_day[0], 0], [t_day[1], 24], [t_sq[0], 24], [t_sq[0] + 0.02, 99]]},          # 99 shows as "1 second": the snap
    {"id": "c-amz", "label": "Amazons' worth, pouring", "fmt": "int", "t0": t_amz, "t1": B["why"]["t0"] - 0.3, "at": [0.62, 0.31],
     "keys": [[t_amz, R["real_amazons"]], [t_sq[1], R["real_amazons"]], [t_seven + 0.4, V["amazons"]]], "end": V["amazons"]},
]

TITLE = {"series": "Back of the Envelope · No. 006", "title": "Every raindrop *at once*", "t1": t_title_out, "sig": A("line:vo01:end", 0.05)}
END = {"title": "Next envelope: *walking to the Moon*", "follow": "Back of the Envelope · No. 007",
       "next": "Rodell et al., J. Climate 28, 8289 (2015): about 520,000 km³ of rain, snow and hail a year."}

CUE = {"fall": FALLK, "day": t_day, "squeeze": t_sq, "pour": t_pour, "ocean": t_ocean, "layer": t_layer, "box": t_box, "coins": t_coins,
       "film": t_film, "storm": t_storm, "home": t_home}
film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": round(t_box + 1.0, 4),
    "shots": SHOTS, "beats": BEATS,
    "world": {"fig": FIG, "depth": DEPTH, "storm": STORM, "coins": COINS_AT, "waffle": WAFFLE},
    "cam": CAM, "cue": CUE, "spine": SPINE, "spineOut": SPINE_OUT, "work": WORK,
    "labels": LABELS, "badges": BADGES, "counters": COUNTERS,
    "title": TITLE, "endCard": t_end, "end": END,
    "captions": f.captions(max_chars=24, balance=True, keep=("a Great Lake", "eighty Amazons", "seven million", "Amazon rivers", "all at once", "the open ocean", "three millimeters", "two coins", "a thin film", "a single second", "the whole planet", "most of it", "millimeters deep", "a day of", "coins, stacked")),
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}
for pg in film["captions"]:                      # numerals.py writes "one second" as "1 second"; the voice says one
    for ln in pg["lines"]:
        for i, w in enumerate(ln):
            w[0] = w[0].replace("1 second", "one second")
            if w[0] == "1" and i + 1 < len(ln) and ln[i + 1][0].startswith("second"):
                w[0] = "one"

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
for hh in range(1, 25, 3):                                       # a tick every three hours of the day
    ev.append({"t": round(t_day[0] + (t_day[1] - t_day[0]) * hh / 24, 4), "kind": "counter.tick", "tag": f"hour-{hh}"})
ev += [
    {"t": t_sq[0], "kind": "swell", "tag": "squeeze", "t1": t_seven},
    {"t": B["whoa"]["t0"], "kind": "arrive", "tag": "macro"},
    {"t": t_storm[0], "kind": "swell", "tag": "storm", "t1": t_storm[1]},
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
