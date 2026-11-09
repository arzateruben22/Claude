"""Compile Possibility Lab Season 2, Episode 6 (S2E06, folder ep12), "Catch all the lightning": script + voice timings + this
direction → film.json (the scene's clock) and sheet.json (the studio's cue sheet). Every moment hangs on a beat or a spoken
word; every number comes from calc.py, the same module claims.json was written from.

  python3 -I films/channels/whatif/ep12/compile.py

The world (scene.mjs): you and a bulb under a night sky on the graph paper (a bolt strikes far off, the bulb blinks: frame 0 is the calm
before it); the globe with ~44 flashes a second; one bolt beside a log-scale meter (10^8 to 10^10 J); the year's flashes pour into a
tank that fills to 390 billion kWh; beside a tank for the world's electricity, 77 times taller, the lightning is a thin slice (5 days);
the sensitivity bars (0.5, 5, 47 days); the globe again, bolts everywhere, each gone in a blink. Hard cuts between the scales.
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
ID = "envelope-s2e06"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}
R = RESULTS
assert R["rate"] == 44 and R["twh"] == 390 and R["days"] == 5 and R["times"] == 80 and R["sens_days"] == [0.5, 4.7, 47.0]

H1 = 1.0                                              # tank 1 (all the lightning of a year) is 1 unit tall
H2 = round(H1 / V["share"], 1)                        # tank 2 (a year of world electricity): 77.6 units
TANK1X, TANK2X, TW = -5.0, 5.0, 8.0                   # their centres and width
WORLD = {"h1": H1, "h2": H2, "t1x": TANK1X, "t2x": TANK2X, "tw": TW, "rate": R["rate"], "sens": [d / 365.25 for d in R["sens_days"]]}

# ── times ──
t_nor, t_chg, t_why, t_whoa, t_work0, t_home = (B[k]["t0"] for k in ("normal", "change", "why", "whoa", "work", "takeaway"))
t_end = A("vo08:Next", -0.25)
t_title_out = t_nor - 0.2
t_catch = A("vo01:Catch", -0.1)
t_now = A("vo02:Lightning", -0.1)
t_44 = A("vo02:forty-four", -0.1)
t_planet = A("vo02:planet.", 0.0)
t_year2 = A("vo02:year.", -0.3)
t_J = A("vo03:billion", -0.1)
t_range = A("vo03:wide", -0.1)
t_mult = A("vo03:Multiply", -0.1)
t_390 = A("vo04:four", -0.1)
t_kwhw = A("vo04:kilowatt-hours,", 0.0)
t_but = A("vo04:But", -0.1)
t_use = A("vo04:use.", -0.3)
t_80 = A("vo05:eighty", -0.1)
t_all = A("vo05:All", -0.1)
t_five = A("vo05:five", -0.1)
t_days = A("vo05:days.", 0.0)
t_ten = A("vo06:ten", -0.1)
t_half = A("vo06:half", -0.1)
t_seven = A("vo06:seven", -0.1)
t_prob = A("vo07:problem.", -0.4)
t_every = A("vo07:sound,", -0.1)
t_blink = A("vo07:split", -0.1)
t_heat = A("vo07:Most", -0.1)
t_bolt = 0.9                                          # the hook's bolt: a short flash while the voice asks (frame 0 is the calm before)

# ── the camera ──
T = lambda x, y, z, d, el=5.0, az=0.0, fy=0.50: {"target": [x, y, z], "dist": d, "el": el, "az": az, "fov": 24, "fy": fy}
HOOK = T(0.3, 1.0, 0.0, 11.0, 8.0, 0.0, 0.35)
HOOK2 = T(0.3, 1.0, 0.0, 10.4, 8.0, 6.0, 0.35)
GLOBE = T(0.0, 0.0, 0.0, 12.6, 14.0, 0.0, 0.37)
GLOBE2 = T(0.0, 0.0, 0.0, 12.0, 14.0, 6.0, 0.37)
BOLTP = T(0.8, 1.0, 0.0, 14.0, 14.0, 0.0, 0.35)
BOLTQ = T(0.8, 1.0, 0.0, 13.0, 14.0, 6.0, 0.35)
TANKP = T(TANK1X, 0.5, 0.0, 58.0, 28.0, 0.0, 0.34)
TANKQ = T(TANK1X, 0.5, 0.0, 54.0, 28.0, 5.0, 0.34)
TOWER = T(0.0, 0.0, 0.0, 520.0, 4.0, 0.0, 0.50)
TOWER2 = T(0.0, 0.0, 0.0, 500.0, 10.0, 8.0, 0.50)
WORKG = T(0.0, 0.0, 0.0, 34.0, 14.0, 0.0, 0.91)
WORKG2 = T(0.0, 0.0, 0.0, 32.0, 14.0, 5.0, 0.91)
def lead(pages, by=0.14):
    """a caption page is fully in when its first word starts: it fades in `by` s earlier (a page that follows another with no gap is left alone)"""
    for i, pg in enumerate(pages):
        prev = pages[i - 1]["t1"] if i else -1.0
        if pg["t0"] - prev >= by + 0.05:
            pg["t0"] = round(max(0.0, pg["t0"] - by), 4)
    return pages

CAM = {
    "hook": [{"t": 0.0, **HOOK}, {"t": t_nor, **HOOK2, "ease": "sine"}],
    "globe": [{"t": t_nor, **GLOBE}, {"t": t_chg, **GLOBE2, "ease": "sine"}],
    "bolt": [{"t": t_chg, **BOLTP}, {"t": t_why, **BOLTQ, "ease": "sine"}],
    "tank": [{"t": t_why, **TANKP}, {"t": t_whoa, **TANKQ, "ease": "sine"}],
    "tower": [{"t": t_whoa, **TOWER}, {"t": t_work0, **TOWER2, "ease": "sine"}],
    "work": [{"t": t_work0, **WORKG}, {"t": t_home, **WORKG2, "ease": "sine"}],
    "take": [{"t": t_home, **GLOBE}, {"t": t_end, **GLOBE2, "ease": "sine"}],
    "end": [{"t": t_end, **HOOK}, {"t": B["tease"]["t1"], **HOOK}],
}
SHOTS = [{"at": 0.0, "name": "hook"}, {"at": t_nor, "name": "globe"}, {"at": t_chg, "name": "bolt"}, {"at": t_why, "name": "tank"},
         {"at": t_whoa, "name": "tower"}, {"at": t_work0, "name": "work"}, {"at": t_home, "name": "take"}, {"at": t_end, "name": "end"}]
for shot, keys in CAM.items():
    for a, b in zip(keys, keys[1:]):
        dt = b["t"] - a["t"]
        assert dt > 0, (shot, a["t"], b["t"])
        for kk in ("az", "el"):
            assert abs(b[kk] - a[kk]) / dt <= 30.0 + 1e-9, f"{shot}: {kk} turns too fast between {a['t']:.2f} and {b['t']:.2f}"
assert CAM["end"][0]["target"] == CAM["hook"][0]["target"] and CAM["end"][0]["dist"] == CAM["hook"][0]["dist"]   # the loop; every other scale change is a hard cut

# ── the spine readout ──
sp_ = lambda t, label, terms, **kw: {"t": t, "label": label, "terms": terms, **kw}
SPINE = [
    sp_(t_44, "lightning flashes on Earth", [["ans", "≈ 44 a second"]]),
    sp_(t_year2, "flashes in a year", [["ans", f"≈ {R['flashes_bn']} billion"]]),
    sp_(t_J, "energy of one flash", [["ans", "≈ 1 billion J"]]),
    sp_(t_mult, "all flashes, one year", [["ans", f"≈ {R['joules_e18']} × 10¹⁸ J"]]),
    sp_(t_390, "the same, in kilowatt-hours", [["ans", f"≈ {R['kwh_bn']} billion kWh"]]),
    sp_(t_80, "as days of the world's electricity", [["ans", "≈ ? days"]]),
    sp_(t_all, "as days of the world's electricity", [["ans", f"≈ {R['days']} days"]], box=True),
    sp_(t_work0, "as days of the world's electricity", [["ans", f"≈ {R['days']} days"]], box=True, keep=True),
    sp_(t_home, "can we catch it?", [["ans", "the hard part"]]),
]
SPINE_OUT = t_end - 0.45
sd = R["sens_days"]
WORK = {
    "t0": t_work0, "t1": round(t_seven + 1.6, 4), "title": "Show your work",
    "rows": [
        {"t": t_work0 + 0.15, "k": "44 /s × 1 year × 1 GJ", "v": f"≈ {R['joules_e18']} × 10¹⁸ J", "lit": False},
        {"t": t_work0 + 0.55, "k": "÷ 30,000 TWh", "v": f"≈ {R['share_pct']} % ≈ {R['days']} days", "lit": False},
        {"t": t_ten, "k": "10 × less per flash", "v": f"≈ {sd[0]} days", "lit": True},
        {"t": t_ten + 1.0, "k": "10 × more per flash", "v": f"≈ {int(sd[2])} days", "lit": True},
    ],
    "assume": ["every bolt caught", "nothing lost", "about 1 GJ a flash"],
}

# ── labels, badges, counters ──
LABELS = [
    {"id": "l-j", "text": "1 billion J", "kind": "calc", "anchor": "meter-mid", "t0": t_J, "t1": t_why - 0.3, "side": 1, "shot": "bolt"},
    {"id": "l-rough", "text": "a rough guess", "kind": "assume", "anchor": "meter-range", "t0": t_range, "t1": t_why - 0.3, "side": 1, "shot": "bolt"},
    {"id": "l-lo", "text": "100 million J", "kind": "part", "anchor": "meter-lo", "t0": t_J + 0.2, "t1": t_why - 0.3, "side": 1, "shot": "bolt"},
    {"id": "l-hi", "text": "10 billion J", "kind": "part", "anchor": "meter-hi", "t0": t_J + 0.2, "t1": t_why - 0.3, "side": 1, "shot": "bolt"},
    {"id": "l-mark", "text": "390 billion kWh", "kind": "calc", "anchor": "tank1-top", "t0": t_390 + 0.8, "t1": t_whoa - 0.3, "side": 1, "shot": "tank"},
    {"id": "l-slice", "text": "all the lightning", "kind": "anchor", "anchor": "tank1-top-w", "t0": t_all - 0.2, "t1": t_work0 - 0.3, "side": -1, "shot": "tower"},
    {"id": "l-year", "text": "a year of world electricity", "kind": "part", "anchor": "tank2-top", "t0": t_80 - 0.2, "t1": t_work0 - 0.3, "side": -1, "shot": "tower"},
]
BADGES = [
    {"id": "b-thought", "text": "thought experiment", "t0": 0.3, "t1": t_title_out, "slot": "br"},
    {"id": "b-rate", "text": "worldwide, all kinds of flash", "t0": t_44, "t1": t_chg - 0.3, "slot": "tl"},
    {"id": "b-every", "text": "∵ every bolt caught, nothing lost", "t0": t_why + 0.2, "t1": t_whoa - 0.3, "slot": "tl"},
    {"id": "b-times", "text": "≈ 80 × more", "t0": t_80, "t1": t_work0 - 0.3, "slot": "tr"},
    {"id": "b-bars", "text": "bars: a year = the full bar", "t0": t_ten - 0.2, "t1": t_home - 0.3, "slot": "tl"},
    {"id": "b-heat", "text": "most of it: heat, light, sound, radio", "t0": t_heat, "t1": t_end - 0.3, "slot": "tl"},
    {"id": "b-blink", "text": "random places, a split second", "t0": t_blink, "t1": t_end - 0.3, "slot": "tr"},
]
COUNTERS = [
    {"id": "c-flash", "label": "flashes since the film began", "t0": t_now, "t1": t_year2 + 0.2, "at": [0.5, 0.37], "keys": [[t_now, 0.0], [t_year2, 44.0 * (t_year2 - t_now)]], "end": 44.0 * (t_year2 - t_now), "unit": ""},
]
CUTS = [sh["at"] for sh in SHOTS[1:]]
for b in BADGES + LABELS:
    if any(abs(b["t1"] - c) < 1e-6 for c in CUTS):
        b["t1"] = round(b["t1"] - 0.3, 4)

TITLE = {"series": "Possibility Lab · Season 2 · Episode 6", "title": "Catch all the *lightning*", "t0": 0.3, "t1": t_title_out, "sig": A("line:vo01:end", 0.05)}
END = {"title": "Next envelope: *your what-if*", "follow": "Possibility Lab · Season 2 · Episode 6",
       "next": "About 44 flashes a second: Christian et al., J. Geophys. Res. 108 (2003)."}

CUE = {"fps": FPS, "bolt": [t_bolt, t_bolt + 0.28], "now": t_now, "year": t_year2, "j": t_J, "range": t_range, "mult": t_mult, "fill": [t_390, t_kwhw + 1.6],
       "why": t_why, "whoa": t_whoa, "eighty": t_80, "all": t_all, "five": t_five, "work0": t_work0, "ten": t_ten, "home": t_home, "blink": t_blink, "end": t_end, "seed": 6}
film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": round(t_390 + 1.0, 4),
    "shots": SHOTS, "beats": BEATS, "world": WORLD,
    "cam": CAM, "cue": CUE, "spine": SPINE, "spineOut": SPINE_OUT, "work": WORK,
    "labels": LABELS, "badges": BADGES, "counters": COUNTERS,
    "title": TITLE, "endCard": t_end, "end": END, "endAnswer": f"≈ {R['days']} days",
    "captions": lead(f.captions(max_chars=24, balance=True, keep=("forty-four times", "a billion joules", "four hundred billion", "kilowatt-hours", "nearly eighty times", "about five days", "seven weeks"))),
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}

sys.path.insert(0, str(HERE.parent))
import declutter   # noqa: E402
DECL = {"spineHide": [[9.0, 18.2], [20.3, 24.5], [29.2, 32.4], [44.7, 68.7]],
        "labels": {"l-j": None, "l-rough": None, "l-lo": 24.4, "l-hi": 24.4, "l-mark": None, "l-year": None},
        "dropEndCaptions": True, "noEndAnswer": True}
film = declutter.apply(film, DECL)
film["noBars"] = True                                     # the work card carries the 0.5 / 5 / 47 day numbers; the bars would be a second block

ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS if b["id"] not in ("tease", "normal")]
ev.append({"t": TITLE["sig"], "kind": "signature", "tag": "title"})
ev.append({"t": t_end, "kind": "signature", "tag": "end"})
for c in COUNTERS:
    ev.append({"t": c["t0"], "kind": "counter.show", "tag": c["id"]})
for i, sp in enumerate(SPINE):
    first_box = sp.get("box") and not (i and SPINE[i - 1].get("box"))
    ev.append({"t": sp["t"], "kind": "answer.box" if first_box else "term.write", "tag": f"spine-{i}", **({"t1": round(sp["t"] + 0.5, 4)} if first_box else {})})
for r in WORK["rows"]:
    ev.append({"t": r["t"], "kind": "term.write", "tag": f"work-{r['k']}"})
ev += [{"t": t_390, "kind": "swell", "tag": "tank", "t1": t_whoa}]
ev = [e for e in ev if declutter.keep_event(e, SPINE, DECL["spineHide"])]
sheet = {"duration": f.duration, "fps": FPS, "preset": "envelope-working", "tail_s": 0.05,
         "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: e["t"]),
         "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}

(HERE / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
print(f"film.json: {f.duration:.2f} s, {len(SHOTS)} shots, {len(BADGES)} badges, {len(SPINE)} spine states, "
      f"{len(film['captions'])} caption pages, end card {t_end:.2f} s")
for b in BEATS:
    print(f"  {b['id']:<9} {b['t0']:6.2f}–{b['t1']:6.2f}")
vg = [round(b["t"] - a["t"] - a["dur"], 2) for a, b in zip(f.lines, f.lines[1:])]
print("voiceless gaps between lines:", vg, "max", max(vg))
