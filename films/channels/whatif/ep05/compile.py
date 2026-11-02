"""Compile Possibility Lab No. 005, "Everybody jump": script + voice timings + this direction → film.json
(the scene's clock: shots, camera keys, the jumps, the crowd's growth, the zoom of the powers-of-ten ladder, the
spine readout's states, the show-your-work card, labels, badges, counters, captions, title and end card) and
sheet.json (the studio's cue sheet). Every moment hangs on a beat or a spoken word; every number comes from
calc.py, the same module claims.json was written from.

  python3 -I films/channels/whatif/ep05/compile.py

The world (scene.mjs, ../set/ladder05.js; rebuilt after review round 1, so it no longer re-runs No. 002's
crowd-to-planet pull-back): a model Earth on the graph-paper desk (radius 4 units, badged "a model"), you standing
on its top (not to scale), everyone gathering round you as a cap of blue beads; the jump lifts the beads while the
globe dips the other way (exaggerated, badged), and a dashed path round the Sun shows the "off course" the wrong idea
fears. The dive pushes into your foot and hands over to the ladder: a screen-space overlay that zooms by powers of
ten in true metres (z = log10 of the frame's width), centred at y 0.36 so the payoff sits above the running sum.
"""
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[3] / "kits/cinema/script"))
sys.path.insert(0, str(HERE))
from timeline import Film   # noqa: E402
from calc import V, RESULTS, ATOM, H_JUMP, shift   # noqa: E402

FPS, BPM = 30, 50
ID = "envelope-005"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}
R = RESULTS
assert R["shift_sci"] == (3, -14) and R["atoms_per_shift"] == 3100

SUP = str.maketrans("-0123456789", "⁻⁰¹²³⁴⁵⁶⁷⁸⁹")
sci = lambda m, e: f"{m} × 10{str(e).translate(SUP)}"           # "3 × 10⁻¹⁴"
DENS = 2.0                                                       # people per m² (No. 002's safe crowd)
SIDE = math.sqrt(8.2e9 / DENS)                                   # m: everyone at 2 per m², a square 64 km across
R_E = 6.371e6
SLOW = 4.0                                                       # everyone's jump, slowed ×4 (badged)

# ── the model world (units; not to scale) ──
RM = 4.0                                                         # the model Earth's radius
GC = [0.0, RM, 0.0]                                              # its centre: it rests on the desk
TOP = 2 * RM
FIG = 0.55                                                       # you, on top
CAP = 0.5                                                        # the crowd's cap half-angle (rad) once everyone has gathered
HOP_V, DIP_V = 0.6, 0.2                                          # drawn jump and the globe's drawn dip (both exaggerated, badged)
ORBIT_R = 70.0                                                   # the dashed path round the Sun: passes through the globe's centre
GHOST = [3.2, RM + 0.4, -1.5]                                    # where "off course" would put it (the wrong idea, dashed)

# ── the ladder: what the zoom passes, centred under your foot (sizes in true metres) ──
ITEMS = [
    {"kind": "bar", "size": H_JUMP, "color": "anchor", "label": f"your jump: {R['jump_cm']} cm", "lk": "anchor"},
    {"kind": "ring", "size": 1e-4, "color": "chalk", "label": "a hair ≈ 0.1 mm", "lk": "part"},
    {"kind": "ring", "size": 7e-6, "color": "chalk", "label": "a red blood cell ≈ 7 µm", "lk": "part"},
    {"kind": "fuzz", "size": ATOM, "color": "chalk", "label": "an atom ≈ 0.1 nm", "lk": "part"},
    {"kind": "bar", "size": V["shift_m"], "color": "marker", "label": f"the Earth's step ≈ {sci(*R['shift_sci'])} m", "lk": "calc"},
]
FILL = 0.55                                                      # an item "arrives" at 55% of the frame's width
zof = lambda size, frac=FILL: round(math.log10(size / frac), 4)
CY = 0.36                                                        # the ladder's centre on screen (above the spine at 0.565)

# ── times ──
t_title_out = B["normal"]["t0"] - 0.2
t_hop1 = A("vo02:jump", -0.15)                                   # you leave the globe on "jump"
t_g0, t_g1 = A("vo02:gather", -0.1), A("vo02:together", 0.5)     # the crowd gathers round you
t_hop2 = A("vo03:all", -0.1)                                     # everyone leaves the globe on "all in the air"
t_land2 = round(t_hop2 + SLOW * V["t_air_s"], 4)
t_ghost = [A("vo04:knock", -0.1), A("vo04:But", 0.2)]            # the wrong idea: knocked off its path, then back
t_work0, t_home, t_end = B["work"]["t0"], B["takeaway"]["t0"], A("vo08:Next", -0.25)
t_dist = A("vo05:distance")
d0 = t_dist
t_atom = A("vo05:single", -0.1)
t_atom1 = A("vo05:atom", 0.25)                                   # a short hold on the atom
t_step = A("vo05:land", -0.05)                                   # the zoom reaches the Earth's step on "land": the box closes
t_land = [A("vo05:was", -0.25), A("vo05:was", 0.55)]            # landing: the step shrinks back to nothing on "was"
gap = (t_atom - (d0 + 0.7)) / 3                                  # the jump's hold, then hair, cell and atom spaced evenly
ZK = [
    [d0 - 0.2, zof(H_JUMP)], [d0 + 0.7, zof(H_JUMP)],
    [d0 + 0.7 + gap * 0.7, zof(1e-4)], [d0 + 0.7 + gap, zof(1e-4)],
    [d0 + 0.7 + gap * 1.7, zof(7e-6)], [d0 + 0.7 + gap * 2, zof(7e-6)],
    [t_atom, zof(ATOM)], [t_atom1, zof(ATOM) - 0.1],
    [t_step, zof(V["shift_m"], 0.3)],
    [t_work0 - 0.2, zof(V["shift_m"], 0.3)], [t_work0 + 1.2, zof(ATOM, 0.2)],      # out to the atom for the work card
    [t_home, zof(ATOM, 0.2)], [A("vo07:jump", 0.3), zof(H_JUMP * 4)],               # and out to you for the takeaway
]
ZK = [[round(a, 4), b] for a, b in ZK]
LADDER = [round(d0 - 1.1, 4), A("vo07:jump", 0.3)]
assert all(b[0] > a[0] for a, b in zip(ZK, ZK[1:])), ZK


def z_at(t):
    if t <= ZK[0][0]:
        return ZK[0][1]
    for (t0, z0), (t1, z1) in zip(ZK, ZK[1:]):
        if t <= t1:
            u = (t - t0) / (t1 - t0)
            return z0 + (z1 - z0) * u * u * (3 - 2 * u)
    return ZK[-1][1]


def item_window(size, lo=0.1, hi=0.8):
    """When the item is between lo and hi of the frame's width, in the dive (the first stretch), for its label."""
    ts = [LADDER[0] + k / FPS for k in range(int((LADDER[1] - LADDER[0]) * FPS))]
    on = [t for t in ts if lo <= size / 10 ** z_at(t) <= hi]
    if not on:
        return None
    run = [on[0]]
    for t in on[1:]:
        if t - run[-1] > 1.5 / FPS:
            break
        run.append(t)
    return round(run[0], 4), round(run[-1], 4)


# ── shots ──
SHOTS = [
    {"at": 0.0, "name": "front"},                    # hook: you, crouched on the model Earth (frame 0 and the loop)
    {"at": B["normal"]["t0"], "name": "gather"},     # normal: your jump, the globe pushed down, everyone gathers
    {"at": B["change"]["t0"], "name": "air"},        # change: everyone in the air, the globe dips
    {"at": B["why"]["t0"], "name": "path"},          # why: the path round the Sun; shared out by weight
    {"at": B["whoa"]["t0"], "name": "dive"},         # whoa: into your foot, through the powers of ten
    {"at": t_work0, "name": "work"},
    {"at": t_home, "name": "home"},                  # takeaway: up the ladder to you, landed
    {"at": t_end, "name": "end"},
]

# ── the camera (rig.js keys); az 0 = the camera on +z ──
k = lambda tgt, dist, el, fy=0.42, az=0: {"target": [round(v, 4) for v in tgt], "dist": dist, "el": el, "az": az, "fov": 24, "fy": fy}
FRONT = k([0, TOP + 0.2, 0], 10.5, 10, 0.40)
CAM = {
    "front": [{"t": 0.0, **FRONT}, {"t": B["normal"]["t0"], **k([0, TOP + 0.2, 0], 10.0, 10, 0.40), "ease": "sine"}],
    "gather": [
        {"t": B["normal"]["t0"], **k([0, TOP + 0.2, 0], 10.0, 10, 0.40)},
        {"t": A("vo02:ground#2", -0.3), **k([-1.0, RM + 0.6, 0], 30, 12, 0.50), "ease": "inout3"},     # the whole planet, pushed
        {"t": t_g1, **k([0, TOP - 0.3, 0], 15, 20, 0.50), "ease": "inout3"},                        # back up to the cap as everyone gathers
        {"t": B["change"]["t0"], **k([0, TOP - 0.3, 0], 14.5, 20, 0.50), "ease": "sine"},
    ],
    "air": [
        {"t": B["change"]["t0"], **k([0, TOP - 0.3, 0], 14.5, 20, 0.50)},
        {"t": t_hop2 - 0.1, **k([0.4, TOP - 0.6, 0], 17, 16, 0.50, 4), "ease": "inout3"},
        {"t": B["why"]["t0"], **k([0.4, TOP - 0.8, 0], 19, 15, 0.50, 7), "ease": "sine"},
    ],
    "path": [
        {"t": B["why"]["t0"], **k([0.4, TOP - 0.8, 0], 19, 15, 0.50, 7)},
        {"t": t_ghost[0] + 0.6, **k([1.2, RM + 0.4, -0.5], 52, 18, 0.50, 4), "ease": "inout3"},           # out to the path round the Sun
        {"t": t_ghost[1] + 0.8, **k([0.6, RM + 0.8, 0], 50, 18, 0.52, 0), "ease": "inout2"},
        {"t": B["whoa"]["t0"], **k([0, RM + 1.0, 0], 42, 18, 0.54, -12), "ease": "sine"},   # a slow turn while the counters speak                   # a slow push in through "ten trillion times over"
    ],
    "dive": [
        {"t": B["whoa"]["t0"], **k([0, RM + 1.0, 0], 42, 18, 0.54, -12)},
        {"t": t_dist, **k([0, TOP + 0.02, 0], 3.0, 22, CY, -6), "ease": "inout3"},   # it stops short of your foot: the ladder dissolves in over it                        # down to your foot: the ladder takes over
        {"t": t_work0, **k([0, TOP + 0.02, 0], 2.9, 22, CY, -6), "ease": "sine"},
    ],
    "work": [{"t": t_work0, **k([0, TOP + 0.02, 0], 2.9, 22, CY, -6)}, {"t": t_home, **k([0, TOP + 0.02, 0], 2.9, 22, CY, -6), "ease": "sine"}],
    "home": [
        {"t": t_home, **k([0, TOP + 0.02, 0], 2.9, 22, CY, -6)},
        {"t": LADDER[1], **k([0, TOP - 0.4, 0], 9.6, 19, 0.42, -3), "ease": "out3"},
        {"t": t_end, **k([0, TOP - 0.5, 0], 9.2, 14, 0.42), "ease": "sine"},
    ],
    "end": [{"t": t_end, **k([0, TOP - 0.5, 0], 9.2, 14, 0.42)}, {"t": B["tease"]["t1"], **FRONT, "ease": "inout2"}],
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
SH = sci(*R["shift_sci"]) + " m"
EK = sci(*R["earth_kg_sci"]) + " kg"
SPINE = [
    {"t": A("vo02:gather", -0.05), "label": "all of us", "terms": [["in", "8.2 billion"], ["op", "×"], ["in", f"{R['body_kg']} kg"]]},
    {"t": A("vo02:together", -0.05), "label": "all of us", "terms": [["in", "8.2 bn × 62 kg"], ["op", "≈"], ["ans", f"{sci(5, 11)} kg"]]},
    {"t": A("vo03:air", -0.05), "label": "all of us, jumping", "terms": [["in", f"{sci(5, 11)} kg"], ["op", "×"], ["in", f"{R['jump_cm']} cm"]]},
    {"t": A("vo04:Earth", -0.05), "label": f"{EK} ÷ {sci(5, 11)} kg", "terms": [["in", "the Earth"], ["op", "÷"], ["in", "all of us"], ["op", "≈"], ["ans", sci(*R["earth_over_us_sci"]).replace("1 × ", "")]]},
    {"t": A("vo05:moves", -0.05), "label": "shared out by weight", "terms": [["op", "…"], ["op", "÷"], ["in", EK], ["op", "="], ["ans", "? m"]]},
    {"t": t_step, "label": "the Earth's step", "terms": [["op", "Earth moves"], ["ans", f"≈ {SH}"]], "box": True},
    {"t": A("vo05:land", -0.05), "label": f"an atom is ≈ {R['atoms_per_shift']:,}× wider", "terms": [["op", "Earth moves"], ["ans", f"≈ {SH}"]], "box": True, "keep": True},
]
SPINE_OUT = t_end

s = V["sensitivity_m"]
fm = lambda x: sci(*__import__("calc").sci(x, 1)) + " m"
WORK = {
    "t0": t_work0, "t1": t_home - 0.3, "title": "Show your work",
    "rows": [
        {"t": t_work0 + 0.15, "k": f"8.2 bn × 62\u00a0kg × 40\u00a0cm ÷ {EK.replace(' ', '\u00a0')}", "v": f"≈ {SH}", "lit": False},   # no number parted from its unit
        {"t": A("vo06:higher", -0.05), "k": "jump 50 cm", "v": f"≈ {fm(s['jump 0.50 m'])}", "lit": True},
        {"t": A("vo06:lighter", -0.05), "k": "everyone half as heavy", "v": f"≈ {fm(s['everyone 31 kg (half)'])}", "lit": True},
        {"t": A("vo06:atom", -0.05), "k": "one atom (hydrogen)", "v": f"≈ {fm(ATOM)}", "lit": True},
    ],
    "assume": ["everyone in one place", "rigid Earth", "62 kg each"],
}

# ── labels, badges, counters ──
LABELS = [
    {"id": "l-you", "text": "you", "kind": "anchor", "anchor": "you", "t0": 0.0, "t1": t_title_out + 0.1, "shot": "front", "side": 1, "v": "middle"},
    {"id": "l-push", "text": "pushed down: the whole planet", "kind": "calc", "anchor": "arrow", "t0": A("vo02:ground#2"), "t1": t_g0 - 0.2, "shot": "gather", "side": 1},
    {"id": "l-all", "text": "everyone, together", "kind": "anchor", "anchor": "cap", "t0": A("vo02:billion"), "t1": B["change"]["t0"] - 0.2, "shot": "gather", "side": 1},
    {"id": "l-drop", "text": "the planet drops the other way", "kind": "calc", "anchor": "arrow", "t0": A("vo03:planet", -0.1), "t1": B["why"]["t0"] - 0.2, "shot": "air", "side": -1, "v": "above"},
    {"id": "l-path", "text": "its path round the Sun", "kind": "part", "anchor": "path", "t0": A("vo04:course", -0.3), "t1": A("vo04:weight"), "shot": "path", "side": -1},
    {"id": "l-ghost", "text": "knocked off course?", "kind": "part", "anchor": "ghost", "t0": t_ghost[0] + 0.3, "t1": t_ghost[1], "shot": "path", "side": 1},
]
for i, it in enumerate(ITEMS):
    w = item_window(it["size"])
    assert w, it
    t1 = t_land[0] if i == len(ITEMS) - 1 else max(w[1], w[0] + 1.0)
    if i + 1 < len(ITEMS) and i < 3:                             # one label at a time: each leaves before the next arrives
        nw = item_window(ITEMS[i + 1]["size"])
        t1 = min(t1, nw[0] - 0.05)
    LABELS.append({"id": f"l-item{i}", "text": it["label"], "kind": it["lk"], "item": i, "t0": max(w[0], t_dist - 0.1), "t1": t1,   # not before the dissolve has landed
                   "side": 1, "shot": None})
LABELS.append({"id": "l-back", "text": "back where it was", "kind": "part", "item": len(ITEMS) - 1, "t0": t_land[1], "t1": t_work0 - 0.7, "side": 1, "shot": None})
BADGES = [
    {"id": "b-thought", "text": "thought experiment", "t0": 0.0, "t1": t_title_out, "slot": "bl"},
    {"id": "b-model", "text": "a model Earth; you not to scale", "t0": B["normal"]["t0"], "t1": A("vo04:shared", -0.3), "slot": "tr"},
    {"id": "b-one", "text": "∵ everyone in one place", "t0": A("vo02:gather"), "t1": B["why"]["t0"] - 0.3, "slot": "tl"},
    {"id": "b-slow", "text": f"{SLOW:g}× slower, dip exaggerated", "t0": t_hop2 - 0.2, "t1": t_land2 + 0.4, "slot": "tl"},
    {"id": "b-rigid", "text": "∵ rigid Earth, no air", "t0": B["whoa"]["t0"], "t1": t_work0 - 0.3, "slot": "tl"},
    {"id": "b-rounded", "text": "rounded", "t0": t_step + 0.3, "t1": t_work0 - 0.3, "slot": "tr"},
]
CUTS = [sh["at"] for sh in SHOTS[1:]]
for b in BADGES:
    if any(abs(b["t1"] - c) < 1e-6 for c in CUTS):
        b["t1"] = round(b["t1"] - 0.3, 4)
ve = __import__("calc").sci(V["v_earth_ms"], 2)
COUNTERS = [
    {"id": "c-you", "label": "you, taking off", "text": f"{V['v_off_ms']:.1f}", "unit": "m/s", "t0": A("vo04:shared", -0.1), "t1": B["whoa"]["t0"] - 0.3, "at": [0.5, 0.165]},
    {"id": "c-earth", "label": "the Earth, pushed back", "text": sci(*ve), "unit": "m/s", "t0": A("vo04:weight", -0.1), "t1": B["whoa"]["t0"] - 0.3, "at": [0.5, 0.25], "lit": True},
]

TITLE = {"series": "Possibility Lab · No. 005", "title": "Everybody *jump*", "t1": t_title_out, "sig": A("line:vo01:end", 0.05)}
END = {"title": "Next envelope: *every raindrop at once*", "follow": "Possibility Lab · No. 006",
       "next": "Earth 5.97 × 10²⁴ kg (NASA) · 8.2 bn people (UN 2024) · 62 kg, average adult (Walpole 2012)"}

CUE = {"hop1": t_hop1, "hop2": t_hop2, "slow": SLOW, "gather": [t_g0, t_g1], "ghost": t_ghost, "zkeys": ZK, "ladder": LADDER, "land": t_land, "step": t_step}
film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": round(t_step + 0.8, 4),
    "shots": SHOTS, "beats": BEATS,
    "world": {"RM": RM, "centre": GC, "fig": FIG, "cap": CAP, "hop": HOP_V, "dip": DIP_V, "orbitR": ORBIT_R, "ghost": GHOST, "cy": CY,
              "air": round(V["t_air_s"], 4), "items": [{k2: v for k2, v in it.items() if k2 in ("kind", "size", "color")} for it in ITEMS]},
    "cam": CAM, "cue": CUE, "spine": SPINE, "spineOut": SPINE_OUT, "work": WORK,
    "labels": LABELS, "badges": BADGES, "counters": COUNTERS,
    "title": TITLE, "endCard": t_end, "end": END,
    "captions": f.captions(max_chars=24, balance=True, keep=("eight billion", "ten trillion", "three thousand", "half a second", "a single atom", "all of us", "count us lighter", "shared out by weight", "thousands of times", "knock the planet")),
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}
for pg in film["captions"]:                      # numerals.py writes "one second" as "1 second"; the voice says one
    for ln in pg["lines"]:
        for i, w in enumerate(ln):
            w[0] = w[0].replace("1 second", "one second")
            if w[0] == "1" and i + 1 < len(ln) and ln[i + 1][0].startswith("second"):
                w[0] = "one"

# ── the cue sheet ──
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
    {"t": t_hop1, "kind": "counter.tick", "tag": "you-jump"},
    {"t": round(t_hop1 + V["t_air_s"], 4), "kind": "arrive", "tag": "you-land"},
    {"t": t_g0, "kind": "swell", "tag": "gather", "t1": t_g1},
    {"t": t_ghost[0] + 0.3, "kind": "term.write", "tag": "ghost"},
    {"t": t_hop2, "kind": "counter.tick", "tag": "all-jump"},
    {"t": t_land2, "kind": "arrive", "tag": "all-land"},
    {"t": B["whoa"]["t0"], "kind": "swell", "tag": "dive", "t1": t_dist},
]
sheet = {"duration": f.duration, "fps": FPS, "preset": "envelope-working",
         "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: e["t"]),
         "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}

(HERE / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
print(f"film.json: {f.duration:.2f} s, {len(SHOTS)} shots, {len(LABELS)} labels, {len(BADGES)} badges, {len(SPINE)} spine states, "
      f"{len(film['captions'])} caption pages, end card {t_end:.2f} s; everyone {t_hop2:.2f}–{t_land2:.2f} s; step {t_step:.2f} s")
for L in LABELS:
    if "item" in L:
        print(f"  {L['text']:<36} {L['t0']:6.2f}–{L['t1']:6.2f}")
for b in BEATS:
    print(f"  {b['id']:<9} {b['t0']:6.2f}–{b['t1']:6.2f}")
for p in film["captions"]:
    print("   |", " / ".join(" ".join(w[0] for w in ln) for ln in p["lines"]))
