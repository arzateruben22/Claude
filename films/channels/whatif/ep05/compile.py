"""Compile Back of the Envelope No. 005, "Everybody jump": script + voice timings + this direction → film.json
(the scene's clock: shots, camera keys, the jumps, the crowd's growth, the zoom of the powers-of-ten ladder, the
spine readout's states, the show-your-work card, labels, badges, counters, captions, title and end card) and
sheet.json (the studio's cue sheet). Every moment hangs on a beat or a spoken word; every number comes from
calc.py, the same module claims.json was written from.

  python3 -I films/channels/whatif/ep05/compile.py

The world (scene.mjs, ../set/ladder05.js), in metres: the graph-paper desk is the ground; you crouch at the
origin; the crowd (No. 002's set/crowd.js, 2 people per m²) grows round you to everyone; the planet (radius
6,371 km) lies under the desk, touching it at the origin, so pulling back past the paper's horizon finds it.
The ladder is a screen-space overlay that zooms by powers of ten (z = log10 of the frame's width in metres).
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

# ── the ladder: what the zoom passes, centred under your foot (sizes in m) ──
ITEMS = [
    {"kind": "bar", "size": H_JUMP, "color": "anchor", "label": f"your jump: {R['jump_cm']} cm", "lk": "anchor"},
    {"kind": "ring", "size": 1e-4, "color": "chalk", "label": "a hair ≈ 0.1 mm", "lk": "part"},
    {"kind": "ring", "size": 7e-6, "color": "chalk", "label": "a red blood cell ≈ 7 µm", "lk": "part"},
    {"kind": "fuzz", "size": ATOM, "color": "chalk", "label": "an atom ≈ 0.1 nm", "lk": "part"},
    {"kind": "bar", "size": V["shift_m"], "color": "marker", "label": f"the Earth's step ≈ {sci(*R['shift_sci'])} m", "lk": "calc"},
]
FILL = 0.6                                                       # an item "arrives" when it is 60% of the frame wide
zof = lambda size, frac=FILL: round(math.log10(size / frac), 4)

# ── times ──
t_title_out = B["normal"]["t0"] - 0.2
t_hop1 = A("vo02:jump", -0.15)                                   # you leave the ground on "jump"
t_g0, t_g1 = A("vo02:gather", -0.1), A("vo02:together", 0.5)     # the crowd gathers round you
t_hop2 = A("vo03:all", -0.1)                                     # everyone leaves the ground on "all in the air"
t_land2 = round(t_hop2 + SLOW * V["t_air_s"], 4)
t_work0, t_home, t_end = B["work"]["t0"], B["takeaway"]["t0"], A("vo08:Next", -0.25)
t_dist = A("vo05:distance")
t_atom1 = A("vo05:atom:end", 0.2)
t_step = A("vo05:And", -0.05)                                    # the zoom reaches the Earth's step: the box closes
t_land = [A("vo05:settles", -0.1), A("vo05:was", 0.3)]           # landing: the step shrinks to nothing
ZK = [
    [t_dist - 0.2, zof(H_JUMP)], [t_dist + 0.4, zof(H_JUMP)],
    [A("vo05:three"), zof(1e-4)], [A("vo05:times"), zof(7e-6)],
    [A("vo05:single", -0.1), zof(ATOM)], [t_atom1, zof(ATOM) - 0.15],
    [t_step, zof(V["shift_m"])],
    [B["work"]["t0"] - 0.2, zof(V["shift_m"])], [B["work"]["t0"] + 1.2, zof(ATOM)],      # out to the atom for the work card
    [t_home, zof(ATOM)], [A("vo07:jump", 0.3), zof(H_JUMP * 4)],                         # and out to you for the takeaway
]
LADDER = [t_dist - 0.35, A("vo07:jump", 0.3)]
assert all(b[0] > a[0] for a, b in zip(ZK, ZK[1:])), ZK


def z_at(t):
    if t <= ZK[0][0]:
        return ZK[0][1]
    for (t0, z0), (t1, z1) in zip(ZK, ZK[1:]):
        if t <= t1:
            u = (t - t0) / (t1 - t0)
            return z0 + (z1 - z0) * u * u * (3 - 2 * u)
    return ZK[-1][1]


def item_window(size, lo=0.08, hi=1.15):
    """When the item is between lo and hi of the frame's width, inside the ladder's window (for its label)."""
    ts = [LADDER[0] + k / FPS for k in range(int((LADDER[1] - LADDER[0]) * FPS))]
    on = [t for t in ts if lo <= size / 10 ** z_at(t) <= hi]
    if not on:
        return None
    run = [on[0]]                                                # the first contiguous stretch only (the dive), not the climb back
    for t in on[1:]:
        if t - run[-1] > 1.5 / FPS:
            break
        run.append(t)
    return round(run[0], 4), round(run[-1], 4)


# ── shots ──
SHOTS = [
    {"at": 0.0, "name": "front"},                    # hook: you, crouched (frame 0 and the loop)
    {"at": B["normal"]["t0"], "name": "gather"},     # normal: your jump, then everyone gathers
    {"at": B["change"]["t0"], "name": "air"},        # change: everyone in the air
    {"at": B["why"]["t0"], "name": "planet"},        # why: out to the planet
    {"at": B["whoa"]["t0"], "name": "dive"},         # whoa: back down, through the powers of ten
    {"at": t_work0, "name": "work"},
    {"at": t_home, "name": "home"},                  # takeaway: up the ladder to you, landed
    {"at": t_end, "name": "end"},
]

# ── the camera ──
FRONT = {"target": [0, 0.85, 0], "dist": 14.0, "el": 16, "az": 0, "fov": 24, "fy": 0.42}
k = lambda tgt, dist, el, fy=0.40, az=0: {"target": tgt, "dist": dist, "el": el, "az": az, "fov": 24, "fy": fy}
CAM = {
    "front": [{"t": 0.0, **FRONT}, {"t": B["normal"]["t0"], **FRONT, "dist": 13.4, "ease": "sine"}],
    "gather": [
        {"t": B["normal"]["t0"], **FRONT, "dist": 13.4},
        {"t": t_g0, **k([0, 0.7, 0], 13.0, 18, 0.42), "ease": "sine"},
        {"t": t_g1, **k([0, 0, 0], 1.6e5, 30, 0.40), "ease": "inout3"},              # the crowd grows to everyone
        {"t": B["change"]["t0"], **k([0, 0, 0], 1.75e5, 31, 0.40), "ease": "sine"},
    ],
    "air": [
        {"t": B["change"]["t0"], **k([0, 0, 0], 1.75e5, 31, 0.40)},
        {"t": t_hop2 - 0.1, **k([0, 0.8, 0], 17, 26, 0.42), "ease": "inout3"},       # back down to you, among everyone
        {"t": B["why"]["t0"], **k([0, 0.8, 0], 16, 25, 0.42), "ease": "sine"},
    ],
    "planet": [
        {"t": B["why"]["t0"], **k([0, 0.8, 0], 16, 25, 0.42)},
        {"t": A("vo04:planet"), **k([0, 0, 0], 4e5, 30, 0.40), "ease": "in2"},
        {"t": A("vo04:course", 0.4), **k([0, -R_E, 0], 1.35e8, 34, 0.44), "ease": "out3"},   # the planet the paper was resting on
        {"t": B["whoa"]["t0"], **k([0, -R_E, 0], 1.4e8, 35, 0.44), "ease": "sine"},
    ],
    "dive": [
        {"t": B["whoa"]["t0"], **k([0, -R_E, 0], 1.4e8, 35, 0.44)},
        {"t": B["whoa"]["t0"] + 0.9, **k([0, 0, 0], 3e5, 35, 0.40), "ease": "in2"},
        {"t": t_dist, **k([0, 0.05, 0], 1.4, 35, 0.40), "ease": "out3"},               # down to your foot: the ladder takes over
        {"t": t_work0, **k([0, 0.05, 0], 1.4, 35, 0.40), "ease": "sine"},
    ],
    "work": [{"t": t_work0, **k([0, 0.05, 0], 1.4, 35, 0.40)}, {"t": t_home, **k([0, 0.05, 0], 1.4, 35, 0.40), "ease": "sine"}],
    "home": [
        {"t": t_home, **k([0, 0.05, 0], 1.4, 35, 0.40)},
        {"t": LADDER[1], **k([0, 0.85, 0], 15.0, 29, 0.42), "ease": "out3"},
        {"t": t_end, **k([0, 0.85, 0], 14.0, 21, 0.42), "ease": "sine"},
    ],
    "end": [{"t": t_end, **k([0, 0.85, 0], 14.0, 21, 0.42)}, {"t": B["tease"]["t1"], **FRONT, "ease": "inout2"}],
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
    {"t": A("vo04:Earth", -0.05), "label": "shared out by weight", "terms": [["op", "…"], ["op", "÷"], ["in", EK], ["op", "="], ["ans", "? m"]]},
    {"t": t_step, "label": "the Earth's step", "terms": [["op", "Earth moves"], ["ans", f"≈ {SH}"]], "box": True},
    {"t": A("vo05:land", -0.05), "label": f"an atom is ≈ {R['atoms_per_shift']:,}× wider", "terms": [["op", "Earth moves"], ["ans", f"≈ {SH}"]], "box": True, "keep": True},
]
SPINE_OUT = t_end

s = V["sensitivity_m"]
fm = lambda x: sci(*__import__("calc").sci(x, 1)) + " m"
WORK = {
    "t0": t_work0, "t1": t_home - 0.3, "title": "Show your work",
    "rows": [
        {"t": t_work0 + 0.15, "k": "8.2 bn × 62 kg × 40 cm ÷ Earth", "v": f"≈ {SH}", "lit": False},
        {"t": A("vo06:higher", -0.05), "k": "jump 50 cm", "v": f"≈ {fm(s['jump 0.50 m'])}", "lit": True},
        {"t": A("vo06:lighter", -0.05), "k": "everyone half as heavy", "v": f"≈ {fm(s['everyone 31 kg (half)'])}", "lit": True},
        {"t": A("vo06:atom", -0.05), "k": "one atom (hydrogen)", "v": f"≈ {fm(ATOM)}", "lit": True},
    ],
    "assume": ["everyone in one place", "rigid Earth", "62 kg each"],
}

# ── labels, badges, counters ──
LABELS = [
    {"id": "l-you", "text": "you", "kind": "anchor", "anchor": "you", "t0": 0.0, "t1": t_title_out + 0.1, "shot": "front", "side": 1, "v": "middle"},
    {"id": "l-push", "text": "pushed down: the whole planet", "kind": "calc", "anchor": "ground", "t0": A("vo02:ground#2"), "t1": t_g0 - 0.2, "shot": "gather", "side": 1, "v": "below"},
    {"id": "l-all", "text": "everyone: 64 km across", "kind": "anchor", "anchor": "crowd", "t0": A("vo02:billion"), "t1": B["change"]["t0"] - 0.2, "shot": "gather", "side": 1},
    {"id": "l-drop", "text": "the planet drops: too small to see", "kind": "calc", "anchor": "ahead", "t0": A("vo03:drops", -0.2), "t1": B["why"]["t0"] - 0.2, "shot": "air", "side": 1},
]
for i, it in enumerate(ITEMS):
    w = item_window(it["size"])
    assert w, it
    t1 = t_land[1] if i == len(ITEMS) - 1 else max(w[1], w[0] + 0.6)
    LABELS.append({"id": f"l-item{i}", "text": it["label"], "kind": it["lk"], "item": i, "t0": w[0], "t1": t1,
                   "side": 1, "shot": None})
BADGES = [
    {"id": "b-thought", "text": "thought experiment", "t0": 0.0, "t1": t_title_out, "slot": "bl"},
    {"id": "b-one", "text": "∵ everyone in one place", "t0": A("vo02:gather"), "t1": B["why"]["t0"] - 0.3, "slot": "tl"},
    {"id": "b-slow", "text": f"{SLOW:g}× slower", "t0": t_hop2 - 0.2, "t1": t_land2 + 0.4, "slot": "tr"},
    {"id": "b-rigid", "text": "∵ rigid Earth, no air", "t0": A("vo04:shared"), "t1": t_work0 - 0.3, "slot": "tl"},
    {"id": "b-dot", "text": "dot not to scale", "t0": A("vo04:course", 0.4), "t1": B["whoa"]["t0"] - 0.3, "slot": "tr"},
    {"id": "b-rounded", "text": "rounded", "t0": t_step + 0.3, "t1": t_work0 - 0.3, "slot": "tr"},
]
CUTS = [sh["at"] for sh in SHOTS[1:]]
for b in BADGES:
    if any(abs(b["t1"] - c) < 1e-6 for c in CUTS):
        b["t1"] = round(b["t1"] - 0.3, 4)
ve = __import__("calc").sci(V["v_earth_ms"], 2)
COUNTERS = [
    {"id": "c-you", "label": "you, taking off", "text": f"{V['v_off_ms']:.1f}", "unit": "m/s", "t0": A("vo04:shared", -0.1), "t1": B["whoa"]["t0"] - 0.3, "at": [0.5, 0.205]},
    {"id": "c-earth", "label": "the Earth, pushed back", "text": sci(*ve), "unit": "m/s", "t0": A("vo04:weight", -0.1), "t1": B["whoa"]["t0"] - 0.3, "at": [0.5, 0.29], "lit": True},
]

TITLE = {"series": "Back of the Envelope · No. 005", "title": "Everybody *jump*", "t1": t_title_out, "sig": A("line:vo01:end", 0.05)}
END = {"title": "Next envelope: *every raindrop at once*", "follow": "Back of the Envelope · No. 006",
       "next": "Earth 5.97 × 10²⁴ kg (NASA); 8.2 billion people (UN, 2024); 62 kg average adult (Walpole et al., 2012)."}

CUE = {"hop1": t_hop1, "hop2": t_hop2, "slow": SLOW, "gather": [t_g0, t_g1], "zkeys": ZK, "ladder": LADDER, "land": t_land, "step": t_step}
film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": round(t_step + 0.8, 4),
    "shots": SHOTS, "beats": BEATS,
    "world": {"density": DENS, "side": round(SIDE, 1), "side0": 1.2, "R": R_E, "figH": 1.7, "air": round(V["t_air_s"], 4), "v0": round(V["v_off_ms"], 4),
              "items": [{k2: v for k2, v in it.items() if k2 in ("kind", "size", "color")} for it in ITEMS]},
    "cam": CAM, "cue": CUE, "spine": SPINE, "spineOut": SPINE_OUT, "work": WORK,
    "labels": LABELS, "badges": BADGES, "counters": COUNTERS,
    "title": TITLE, "endCard": t_end, "end": END,
    "captions": f.captions(max_chars=24, balance=True, keep=("eight billion", "ten trillion", "three thousand", "half a second", "a single atom", "all of us", "count us lighter", "shared out by weight")),
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}

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
