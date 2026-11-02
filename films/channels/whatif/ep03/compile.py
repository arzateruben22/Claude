"""Compile Back of the Envelope No. 003, "All the ants": script + voice timings + this direction → film.json
and sheet.json. Every moment hangs on a beat or a spoken word; every number comes from calc.py.

  python3 -I films/channels/whatif/ep03/compile.py

The world (scene.mjs, ../set): a pan balance on the graph-paper desk (1 unit = 1 cm), ants on the left pan,
people on the right. The camera moves between the macro (one ant on the millimetre ruling) and the whole
balance, rises to see the count sites dotted over the paper, and swings to a second balance (ants against every
wild bird and mammal). The beam's tilt follows the story: level (the 1994 guess), down on the ants' side
(twice as many), then hard over to ours (a fifth), then the second balance tips toward the ants.
"""
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[3] / "kits/cinema/script"))
sys.path.insert(0, str(HERE))
from timeline import Film   # noqa: E402
from calc import V, RESULTS   # noqa: E402

FPS, BPM = 30, 50
ID = "envelope-003"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}


def tilt_for(ratio):
    """The beam's tilt for left/right = ratio: a gentle, monotone mapping (a real balance tips all the way;
    this one leans in proportion, so 'a fifth' reads as a clear but not total win). + = the left pan down."""
    return math.atan(0.9 * math.log(ratio)) * 0.45


# ── moments ────────────────────────────────────────────────────────────────
t_title_out = B["normal"]["t0"] - 0.2
t_fill = A("vo02:Decades", -0.1)          # the heaps fill as the old sum is told
t_balance = A("vo02:balance", -0.1)       # level
t_sites = A("vo03:gathered", -0.1)        # count sites light up across the paper
t_twice = A("vo03:twice", -0.1)           # the ants' heap doubles; the beam dips to their side
t_tiny = A("vo04:tinier", -0.4)           # macro: one real ant on the millimetre ruling
t_weigh = A("vo04:weighed", -0.1)         # back to the balance
t_fifth = A("vo04:fifth", -0.1)           # hard over to ours
t_wild = A("vo05:wild", -0.2)             # the second balance: ants vs every wild bird and mammal
t_each = A("vo05:each", -0.15)            # macro: one person and their ants (2.4 million)
t_work0 = B["work"]["t0"]
t_count = A("vo07:count", -0.1)
t_end = A("vo08:Next", -0.25)
SHOTS = [
    {"at": 0.0, "name": "macro"},                    # hook: one ant walking to the pan
    {"at": B["normal"]["t0"], "name": "scale"},      # the whole balance
    {"at": t_sites, "name": "sites"},                # top-down over the paper: the count sites
    {"at": t_tiny, "name": "tiny"},                  # macro: one ant on the millimetre ruling
    {"at": t_weigh, "name": "scale2"},               # back to the balance: a fifth
    {"at": t_wild, "name": "wild"},                  # the second balance
    {"at": t_each, "name": "each"},                  # one person, their ants
    {"at": t_work0, "name": "work"},                 # the card over the two balances
    {"at": B["takeaway"]["t0"], "name": "home"},     # back to the first balance (the loop)
    {"at": t_end, "name": "end"},
]
T_LEVEL, T_TWICE, T_FIFTH = 0.0, tilt_for(2.0), tilt_for(V["ratio"])
TILT = [[0.0, T_LEVEL], [t_balance, T_LEVEL], [t_twice, T_LEVEL], [t_twice + 1.2, T_TWICE], [t_fifth - 1.0, T_TWICE], [t_fifth + 0.6, T_FIFTH]]
FILL = {"left": [[0.0, 0.02], [t_fill, 0.02], [t_balance, 0.6], [t_twice, 0.6], [t_twice + 1.0, 1.0]],
        "right": [[0.0, 0.0], [t_fill, 0.0], [t_balance, 1.0]]}
TILT_WILD = tilt_for(1.5)                    # claims c5 says only "exceeds", so a modest lean toward the ants (no ratio is claimed)

# the hook: low behind the ant, the whole balance looming beyond it (the ant walks toward it)
MACRO = {"target": [-60, 0.4, 30], "dist": 9, "el": 9, "az": -63, "fov": 30, "fy": 0.38}
BAL = {"target": [0, 18, 0], "dist": 340, "el": 12, "az": 18, "fov": 30, "fy": 0.36}
CAM = {
    "macro": [
        {"t": 0.0, **MACRO},
        {"t": B["normal"]["t0"], **MACRO, "dist": 7, "el": 10, "az": -61, "ease": "sine"},
    ],
    "scale": [
        {"t": B["normal"]["t0"], **BAL, "dist": 320, "az": 24},
        {"t": t_sites, **BAL, "ease": "inout2"},
    ],
    "sites": [
        {"t": t_sites, **BAL},
        {"t": t_sites + 2.6, "target": [0, 0, 0], "dist": 560, "el": 72, "az": 18, "fov": 30, "fy": 0.4, "ease": "inout3"},
        {"t": t_twice - 0.2, "target": [0, 18, 0], "dist": 360, "el": 20, "az": 16, "fov": 30, "fy": 0.36, "ease": "inout3"},   # down in time to see the dip
        {"t": t_tiny, "target": [0, 18, 0], "dist": 340, "el": 18, "az": 15, "fov": 30, "fy": 0.36, "ease": "sine"},
    ],
    "tiny": [
        {"t": t_tiny, "target": [40.8, 0.3, 30.3], "dist": 5.2, "el": 40, "az": 12, "fov": 30, "fy": 0.42},
        {"t": t_weigh, "target": [40.8, 0.3, 30.3], "dist": 6, "el": 44, "az": 14, "fov": 30, "fy": 0.42, "ease": "sine"},
    ],
    "scale2": [
        {"t": t_weigh, **BAL, "dist": 360},
        {"t": t_wild, **BAL, "dist": 345, "az": 14, "ease": "sine"},
    ],
    "wild": [
        {"t": t_wild, "target": [95, 18, 0], "dist": 345, "el": 12, "az": 10, "fov": 30, "fy": 0.36},
        {"t": t_each, "target": [95, 18, 0], "dist": 330, "el": 13, "az": 6, "fov": 30, "fy": 0.36, "ease": "sine"},
    ],
    "each": [
        {"t": t_each, "target": [-260, 90, 160], "dist": 520, "el": 18, "az": 20, "fov": 30, "fy": 0.4},
        {"t": t_work0, "target": [-260, 60, 160], "dist": 760, "el": 26, "az": 28, "fov": 30, "fy": 0.4, "ease": "sine"},
    ],
    "work": [
        {"t": t_work0, "target": [45, 18, 0], "dist": 430, "el": 10, "az": 14, "fov": 30, "fy": 0.5},
        {"t": B["takeaway"]["t0"], "target": [45, 18, 0], "dist": 420, "el": 10, "az": 16, "fov": 30, "fy": 0.5, "ease": "sine"},
    ],
    "home": [
        {"t": B["takeaway"]["t0"], **BAL, "dist": 360},
        {"t": t_count - 1.6, "target": [-50, 4, 26], "dist": 150, "el": 40, "az": -50, "fov": 30, "fy": 0.4, "ease": "inout2"},   # up and round the stand, never through it
        {"t": t_count, **MACRO, "dist": 9, "ease": "inout3"},
        {"t": t_end, **MACRO, "dist": 8, "ease": "sine"},
    ],
    "end": [
        {"t": t_end, **MACRO, "dist": 8},
        {"t": B["tease"]["t1"], **MACRO},   # = frame 0: the loop
    ],
}
for shot, keys in CAM.items():
    for a, b in zip(keys, keys[1:]):
        assert b["t"] > a["t"], (shot, a["t"], b["t"])

SPINE = [
    {"t": A("vo01:weighs", -0.05), "label": "the question", "terms": [["in", "all ants"], ["op", "vs"], ["in", "all of us"]]},
    {"t": t_balance, "label": "Hölldobler & Wilson, 1994", "terms": [["in", "10 quadrillion"], ["op", "≈"], ["ans", "our weight"]]},
    {"t": t_twice, "label": "Schultheiss et al., 2022", "terms": [["in", f"{RESULTS['ants_quadrillion']} quadrillion ants"], ["op", "="], ["ans", "×2"]]},
    {"t": t_fifth, "label": "weighed as carbon", "terms": [["in", "12 Mt C"], ["op", "÷"], ["in", "60 Mt C"], ["op", "≈"], ["ans", "20%"]], "box": True},
    {"t": t_wild, "label": "ants vs every wild bird and mammal", "terms": [["in", "12 Mt C"], ["op", ">"], ["in", "wild birds + mammals"]]},
    {"t": t_each, "label": "for each person", "terms": [["ans", f"≈ {RESULTS['ants_per_person_m']} million ants"]]},
    {"t": t_work0, "label": "the heaviest estimate", "terms": [["in", "50 Mt C"], ["op", "÷"], ["in", "60 Mt C"], ["op", "≈"], ["ans", f"{RESULTS['ratio_hi_pct']}%"]]},
    {"t": B["takeaway"]["t0"], "label": "ants' weight, against ours", "terms": [["in", "12 Mt C"], ["op", "÷"], ["in", "60 Mt C"], ["op", "≈"], ["ans", "20%"]], "box": True, "keep": True},
]
WORK = {
    "t0": t_work0, "t1": B["takeaway"]["t0"] + 0.1, "title": "Show your work",
    "rows": [
        {"t": t_work0 + 0.15, "k": "12 Mt C ÷ 60 Mt C", "v": f"≈ {RESULTS['ratio_pct']}%", "lit": False},
        {"t": A("vo06:heaviest", -0.05), "k": "heaviest estimate, 50 Mt C", "v": f"≈ {RESULTS['ratio_hi_pct']}%", "lit": True},
        {"t": A("vo06:scale", -0.5), "k": "lightest estimate, 3.6 Mt C", "v": f"≈ {RESULTS['ratio_lo_pct']}%", "lit": True},
    ],
    "assume": [],                                   # short card: the pans stay in view below it (the carbon note is a badge)
}
LABELS = [
    {"id": "l-ants", "text": "all the ants", "kind": "part", "anchor": "left", "t0": A("vo02:scale"), "t1": t_sites, "shot": "scale", "side": -1},
    {"id": "l-us", "text": "all of us", "kind": "anchor", "anchor": "right", "t0": A("vo02:scale", 0.3), "t1": t_sites, "shot": "scale", "side": 1},
    {"id": "l-mm", "text": "a worker ant, a few mm", "kind": "part", "anchor": "ant2", "t0": t_tiny + 0.4, "t1": t_weigh, "shot": "tiny", "side": 1},
    {"id": "l-wild", "text": "every wild bird and mammal", "kind": "part", "anchor": "wild", "t0": t_wild + 0.4, "t1": t_each - 0.3, "shot": "wild", "side": 1, "v": "above"},
    {"id": "l-you", "text": "you", "kind": "anchor", "anchor": "you", "t0": t_each + 0.3, "t1": t_work0, "shot": "each", "side": 1},
]
BADGES = [
    {"id": "b-carbon", "text": "∵ weighed as carbon (dry)", "t0": t_weigh, "t1": t_work0, "slot": "tl"},
    {"id": "b-nts", "text": "heaps not to scale", "t0": B["normal"]["t0"] + 0.5, "t1": t_end, "slot": "tr"},
]
TITLE = {"series": "Back of the Envelope · No. 003", "title": "All the *ants*", "sub": "a thought experiment", "t1": t_title_out, "sig": A("line:vo01:end", 0.05)}
END = {"title": "Next envelope: *count to a billion*", "follow": "Back of the Envelope · No. 004",
       "next": "Schultheiss et al., PNAS 2022: about 20 quadrillion ants, 12 megatonnes of carbon."}
CUE = {"fill": t_fill, "balance": t_balance, "sites": t_sites, "twice": t_twice, "tiny": t_tiny, "weigh": t_weigh, "fifth": t_fifth,
       "wild": t_wild, "each": t_each, "count": t_count}

film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": round(t_fifth + 1.5, 4),
    "shots": SHOTS, "beats": BEATS,
    "phys": {"ratio": V["ratio"], "ants_per_person": V["ants_per_person"], "tilt_wild": TILT_WILD},
    "tilt": TILT, "fill": FILL, "cam": CAM, "cue": CUE, "spine": SPINE, "spineOut": t_end, "work": WORK,
    "labels": LABELS, "badges": BADGES, "counters": [], "pills": [],
    "title": TITLE, "endCard": t_end, "end": END,
    "captions": f.captions(max_chars=24, balance=True, keep=("two and a half million ants", "there are about", "wild bird", "ant scientists", "a billion")),
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}
ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS if b["id"] != "tease"]
ev.append({"t": TITLE["sig"], "kind": "signature", "tag": "title"})
ev.append({"t": t_end, "kind": "signature", "tag": "end"})
for L in LABELS:
    ev.append({"t": L["t0"], "kind": "label", "tag": L["id"]})
for b in BADGES:
    ev.append({"t": b["t0"], "kind": "badge", "tag": b["id"]})
for i, s in enumerate(SPINE):
    if s.get("keep"):
        continue
    ev.append({"t": s["t"], "kind": "answer.box" if s.get("box") else "term.write", "tag": f"spine-{i}", **({"t1": round(s["t"] + 0.5, 4)} if s.get("box") else {})})
for r in WORK["rows"]:
    ev.append({"t": r["t"], "kind": "term.write", "tag": f"work-{r['k']}"})
ev += [{"t": t_twice + 1.2, "kind": "arrive", "tag": "dip"}, {"t": t_fifth + 0.6, "kind": "arrive", "tag": "fifth"}]
sheet = {"duration": f.duration, "fps": FPS, "preset": "envelope-working",
         "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: e["t"]),
         "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}
(HERE / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
print(f"film.json: {f.duration:.2f} s, {len(SHOTS)} shots, {len(LABELS)} labels, {len(SPINE)} spine states, {len(film['captions'])} caption pages, "
      f"end card {t_end:.2f} s; tilts level 0, twice {T_TWICE:.3f}, fifth {T_FIFTH:.3f}, wild {TILT_WILD:.3f}")
