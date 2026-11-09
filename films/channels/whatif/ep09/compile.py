"""Compile Possibility Lab Season 2, Episode 3 (S2E03, folder ep09), "A rope around the Earth": script + voice timings + this
direction → film.json (the scene's clock) and sheet.json (the studio's cue sheet). Every moment hangs on a beat or a spoken
word; every number comes from calc.py, the same module claims.json was written from.

  python3 -I films/channels/whatif/ep09/compile.py

The world (scene.mjs): you in blue beside a rope that lies along the graph paper and, seen from far out, is a ring hugging the
whole Earth. The ring is lifted a meter (drawn exaggerated, badged "not to scale"); a guess bar says "thousands of km?"; the
camera dives to the lifted rope on poles. A flat circle diagram on the paper shows the radius grow by one meter; the extra rope
(6.3 m) is laid out beside four of you lying head to toe; the work card tries a basketball, the Earth and the Sun; a ten-meter lift
needs ten times the rope (63 m). The camera returns to frame 0 for the loop.
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
ID = "envelope-s2e03"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}
R = RESULTS
assert R["extra_m"] == 6.3 and R["people"] == 4 and R["extra_10m"] == 63

R_E = 6.378e6
# places on the paper (metres): the diagram, the laid-out rope, the ten-meter lift
DIA = (3.2, 0.0, -1.3)
LAY = (12.0, 0.0, 0.0)
TEN = (40.0, 0.0, 0.0)
EXTRA = V["extra_m"]

# ── times ──
t_nor, t_chg, t_why, t_whoa, t_work0, t_home = (B[k]["t0"] for k in ("normal", "change", "why", "whoa", "work", "takeaway"))
t_end = A("vo08:Next", -0.25)
t_title_out = t_nor - 0.2
t_forty = A("vo02:forty", 0.0)
t_lift = A("vo02:lift", -0.1)                              # "Now lift it": the ring lifts (drawn exaggerated)
t_float = A("vo02:above", 0.0)
t_guess = A("vo03:guess", -0.1)
t_thou = A("vo03:thousands", 0.0)
t_big = A("vo03:more.", -0.2)
t_circle = round(t_why + 0.15, 4)                           # the circle starts drawing with the beat: no empty grid after the cut
t_two = A("vo04:two", -0.1)
t_radius = A("vo04:radius,", -0.3)
t_center = A("vo04:center.", -0.2)
t_lift4 = A("vo04:Lift", -0.1)
t_bigger = A("vo04:meter.", -0.1)
t_grows = A("vo05:grows", -0.1)
t_six = A("vo05:six", -0.1)
t_four = A("vo05:four", -0.1)
t_toe = A("vo05:toe.", 0.0)
t_basket, t_sun = A("vo06:basketball", 0.0), A("vo06:Sun:", 0.0)
t_same = A("vo06:same.", -0.1)
t_ten = A("vo07:ten", -0.1)
t_ten2 = A("vo07:ten", 0.0)
t_dive0 = A("vo03:You", -0.15)                                       # the dive from the planet to the lifted rope on its poles
t_ph2 = A("vo07:Lift", -0.1)
t_take0 = round(t_ten - 0.1, 4)                           # "Ten times higher": the ten-meter demo; before it, the Earth and its ring with the answer

# ── the camera ──
T = lambda x, y, z, d, el=5.0, az=0.0, fy=0.50: {"target": [x, y, z], "dist": d, "el": el, "az": az, "fov": 24, "fy": fy}
PL = T(0.0, -R_E, 0.0, 1.25e8, 10.0, 0.0, 0.34)
LIFT = T(1.0, 0.9, 0.0, 18.0, 5.0, 0.0, 0.84)
def on_path(d):                                               # a camera at distance d on the way between the paper and the planet (target and where it lands, in step)
    s2 = min(1.0, max(0.0, (math.log10(d) - 5.0) / (math.log10(1.25e8) - 5.0)))
    el = 6.0 + 4.0 * min(1.0, max(0.0, math.log10(d / 18.0) / math.log10(1.25e8 / 18.0)))
    return T(0.0, 0.85 - (R_E + 0.85) * s2 ** 3, 0.0, d, el, 0.0, 0.84 - 0.57 * s2)
def path_keys(t0, t1, d0, d1, n):
    out = []
    for i in range(n + 1):
        u = i / n
        d = d0 * (d1 / d0) ** u
        out.append({"t": round(t0 + (t1 - t0) * u, 4), **on_path(d), "ease": "linear"})
    return out
t_arrive = t_nor + 2.0
DIVE = 0.8                                                   # hard cut from the space view to the ground; the ground elements settle in over DIVE
k_dive = [{"t": round(t_dive0, 4), **LIFT, "ease": "linear"}]
DIAP = T(DIA[0], 0.0, DIA[2], 15.0, 68.0, 0.0, 0.31)
LAYP = T(LAY[0] + 3.14, 0.0, -0.3, 40.0, 60.0, 0.0, 0.26)
LAYQ = T(LAY[0] + 3.14, 0.0, -0.3, 36.0, 56.0, 8.0, 0.26)
WORKP = T(LAY[0] + 3.14, 0.0, -0.3, 40.0, 46.0, 6.0, 0.90)
WORKP2 = T(LAY[0] + 3.14, 0.0, -0.3, 40.0, 46.0, 18.0, 0.90)
TENP = T(TEN[0], 5.0, 0.0, 34.0, 8.0, 0.0, 0.60)
LONGP = T(TEN[0] + 31.5, 0.0, 1.5, 190.0, 32.0, 0.0, 0.80)
LONGP2 = T(TEN[0] + 31.5, 0.0, 1.5, 175.0, 30.0, 18.0, 0.80)
k_end = path_keys(t_end + 1.0, t_end + 3.4, 190.0, 1.25e8, 12)
k_end[-1] = {"t": round(t_end + 3.4, 4), **PL, "ease": "inout2"}
def lead(pages, by=0.14):
    """a caption page is fully in when its first word starts: it fades in `by` s earlier (a page that follows another with no gap is left alone)"""
    for i, pg in enumerate(pages):
        prev = pages[i - 1]["t1"] if i else -1.0
        if pg["t0"] - prev >= by + 0.05:
            pg["t0"] = round(max(0.0, pg["t0"] - by), 4)
    return pages


CAM = {
    "planet": [{"t": 0.0, **PL}, {"t": round(t_nor + 3.0, 4), **T(0.0, -R_E, 0.0, 1.25e8, 14.0, 16.0, 0.34), "ease": "sine"}, {"t": t_dive0, **PL, "ease": "sine"}],
    "lift": k_dive + [{"t": t_why, **T(1.0, 0.9, 0.0, 18.0, 5.0, 10.0, 0.84), "ease": "sine"}],
    "why": [{"t": t_why, **DIAP}, {"t": round(t_lift4 + 0.5, 4), **DIAP, "ease": "sine"},
            {"t": t_whoa, **T(DIA[0], 0.0, DIA[2], 15.0, 68.0, 0.0, 0.31), "ease": "sine"}],
    "whoa": [{"t": t_whoa, **T(DIA[0], 0.0, DIA[2], 15.0, 68.0, 0.0, 0.31)}, {"t": round(t_grows - 0.1, 4), **T(DIA[0], 0.0, DIA[2], 15.0, 68.0, 0.0, 0.31), "ease": "sine"}, {"t": round(t_grows + 1.1, 4), **LAYP, "ease": "inout2"}, {"t": round(t_work0 - 3.6, 4), **LAYQ, "ease": "sine"}, {"t": t_work0, **LAYQ, "ease": "sine"}],
    "work": [{"t": t_work0, **WORKP}, {"t": t_home, **WORKP2, "ease": "sine"}],
    "payoff": [{"t": t_home, **T(0.0, -R_E, 0.0, 1.25e8, 10.0, 0.0, 0.40)}, {"t": t_take0, **T(0.0, -R_E, 0.0, 1.25e8, 14.0, 10.0, 0.40), "ease": "sine"}],
    "take": [{"t": t_take0, **TENP}, {"t": round(t_take0 + 1.6, 4), **TENP, "ease": "sine"},
             {"t": round(t_take0 + 3.0, 4), **LONGP, "ease": "inout2"}, {"t": t_end, **LONGP2, "ease": "sine"}],
    "end": [{"t": t_end, **LONGP2}, {"t": round(t_end + 1.0, 4), **T(0.0, 0.85, 0.0, 190.0, 12.0, 0.0, 0.7), "ease": "inout2"}] + k_end[1:] + [{"t": B["tease"]["t1"], **PL}],
}
SHOTS = [{"at": 0.0, "name": "planet"}, {"at": t_dive0, "name": "lift"}, {"at": t_why, "name": "why"},
         {"at": t_whoa, "name": "whoa"}, {"at": t_work0, "name": "work"}, {"at": t_home, "name": "payoff"}, {"at": t_take0, "name": "take"}, {"at": t_end, "name": "end"}]
for shot, keys in CAM.items():
    for a, b in zip(keys, keys[1:]):
        dt = b["t"] - a["t"]
        assert dt > 0, (shot, a["t"], b["t"])
        for kk in ("az", "el"):
            assert abs(b[kk] - a[kk]) / dt <= 30.0 + 1e-9, f"{shot}: {kk} turns too fast between {a['t']:.2f} and {b['t']:.2f}"
for x, y in zip(SHOTS[:-1], SHOTS[1:]):
    if (x["name"], y["name"]) in (("planet", "lift"), ("lift", "why"), ("whoa", "work"), ("work", "payoff"), ("payoff", "take")):         # a hard cut: space view to the ground
        continue
    p, q_ = CAM[x["name"]][-1], CAM[y["name"]][0]
    assert p["target"] == q_["target"] and p["dist"] == q_["dist"], (x, y, p, q_)

# ── the spine readout ──
sp_ = lambda t, label, terms, **kw: {"t": t, "label": label, "terms": terms, **kw}
SPINE = [
    sp_(t_forty, "a rope hugging the Earth", [["ans", "≈ 40,000 km"]]),
    sp_(t_lift, "lifted one meter, all round", [["ans", "≈ ? km more"]]),
    sp_(t_circle, "a circle's length", [["in", "2 × π × radius"]]),
    sp_(t_grows, "extra rope = 2 × π × 1 m", [["ans", "≈ ? m"]]),
    sp_(t_six, "the extra rope", [["ans", f"≈ {R['extra_m']} m"]], box=True),
    sp_(t_work0, "the extra rope", [["ans", f"≈ {R['extra_m']} m"]], box=True, keep=True),
    sp_(round(t_take0 + 1.3, 4), "lifted ten meters", [["ans", f"≈ {R['extra_10m']} m"]], box=True),
]
SPINE_OUT = t_end - 0.45
WORK = {
    "t0": t_work0, "t1": round(A("vo06:same.", 0.75), 4), "title": "Show your work",
    "rows": [
        {"t": t_work0 + 0.15, "k": "2 × π × 1 m", "v": f"≈ {R['extra_m']} m", "lit": False},
        {"t": t_basket, "k": "basketball (radius 12 cm)", "v": f"≈ {R['sens_m'][0]} m", "lit": True},
        {"t": t_sun - 0.9, "k": "Earth (radius 6,378 km)", "v": f"≈ {R['sens_m'][1]} m", "lit": True},
        {"t": t_sun, "k": "Sun (radius 695,000 km)", "v": f"≈ {R['sens_m'][2]} m", "lit": True},
    ],
    "assume": ["perfect sphere", "smooth rope", "no sag"],
}

# ── labels, badges, counters ──
LABELS = [
    {"id": "l-rod", "text": "1 m", "kind": "part", "anchor": "rod", "t0": t_dive0 + 0.9, "t1": t_why - 1.3, "side": 1},
    {"id": "l-rad", "text": "radius", "kind": "part", "anchor": "rad", "t0": t_radius, "t1": t_lift4 - 0.2, "side": 1},
    {"id": "l-gap", "text": "+ 1 m", "kind": "calc", "anchor": "gap", "t0": t_lift4 + 0.3, "t1": t_whoa - 0.2, "side": -1},
    {"id": "l-ten", "text": "10 m", "kind": "part", "anchor": "ten-top", "t0": round(t_take0 + 1.3, 4), "t1": round(t_take0 + 3.0, 4), "side": 1},
]
BADGES = [
    {"id": "b-thought", "text": "thought experiment", "t0": 0.3, "t1": t_title_out, "slot": "br"},
    {"id": "b-ring", "text": "the ring: the whole Earth", "t0": t_nor + 0.3, "t1": t_lift - 0.2, "slot": "tl"},
    {"id": "b-lift", "text": "lifted 1 m (drawn bigger)", "t0": t_lift + 0.4, "t1": t_dive0 - 0.1, "slot": "tl"},
    {"id": "b-guess", "text": "a guess, not an answer", "t0": t_guess, "t1": t_dive0 + 2.5, "slot": "tr"},
    {"id": "b-circle", "text": "∵ a perfect circle", "t0": t_circle, "t1": t_whoa - 0.3, "slot": "tl"},
    {"id": "b-scale", "text": "not to scale", "t0": t_lift4, "t1": t_whoa - 0.3, "slot": "bl"},
    {"id": "b-pi", "text": "π ≈ 3.14", "t0": t_two + 0.3, "t1": t_lift4 - 0.4, "slot": "bl"},
    {"id": "b-person", "text": "∵ 1.7 m a person", "t0": t_four - 0.4, "t1": t_work0 - 0.3, "slot": "tl"},
    {"id": "b-same", "text": "same for every planet", "t0": t_same, "t1": t_take0 - 0.3, "slot": "tr"},
    {"id": "b-smooth", "text": "∵ a smooth rope, no sag", "t0": t_work0 + 0.3, "t1": t_basket, "slot": "tl"},
    {"id": "b-x10", "text": "10 × the lift: 10 × the rope", "t0": round(t_take0 + 1.0, 4), "t1": t_end - 0.3, "slot": "tl"},
]
COUNTERS = [
    {"id": "c-extra", "label": "extra rope", "t0": t_grows, "t1": t_work0 - 3.7, "at": [0.5, 0.40], "keys": [[t_grows, 0.0], [t_six, EXTRA], [t_work0, EXTRA]], "end": EXTRA, "unit": "m"},
]
CUTS = [sh["at"] for sh in SHOTS[1:]]
for b in BADGES:
    if any(abs(b["t1"] - c) < 1e-6 for c in CUTS):
        b["t1"] = round(b["t1"] - 0.3, 4)

TITLE = {"series": "Possibility Lab · Season 2 · Episode 3", "title": "A rope round the *Earth*", "t0": 0.3, "t1": t_title_out, "sig": A("line:vo01:end", 0.05)}
END = {"title": "Next envelope: *a shuffled deck*", "follow": "Possibility Lab · Season 2 · Episode 3",
       "next": "NASA Earth Facts: equatorial diameter 12,756 km."}

CUE = {"fps": FPS, "lift": t_lift, "float": t_float, "dive": [t_dive0, t_dive0 + DIVE], "guess": [t_guess, t_big, t_big + 0.6], "arrive": t_arrive,
       "circle": [t_circle, t_radius, t_lift4, t_bigger], "dia": list(DIA), "lay": list(LAY), "ten": list(TEN), "grows": t_grows, "six": t_six, "four": t_four, "toe": t_toe,
       "home": t_home, "take0": t_take0, "work0": t_work0, "ph2": t_ph2, "ten2": t_ten2, "why": t_why, "whoa": t_whoa, "extra": EXTRA, "basket": t_basket, "sun": t_sun, "u": [t_ten]}
film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": round(t_six + 1.0, 4),
    "shots": SHOTS, "beats": BEATS,
    "world": {"rE": R_E, "extra": EXTRA, "extra10": V["extra_10m"]},
    "cam": CAM, "cue": CUE, "spine": SPINE, "spineOut": SPINE_OUT, "work": WORK,
    "labels": LABELS, "badges": BADGES, "counters": COUNTERS,
    "title": TITLE, "endCard": t_end, "end": END, "endAnswer": f"≈ {R['extra_m']} m",
    "captions": lead(f.captions(max_chars=24, balance=True, keep=("forty thousand kilometers", "one meter", "two times pi", "six meters", "four of you", "ten times", "the planet's size"))),
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}

sys.path.insert(0, str(HERE.parent))
import declutter   # noqa: E402
DECL = {"spineHide": [[10.0, 13.0], [21.0, 44.2], [48.0, 60.3]], "labels": {"l-rod": None, "l-rad": None, "l-gap": None, "l-ten": None},
        "counters": {"c-extra": 43.3}, "dropEndCaptions": True}
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
ev += [{"t": t_dive0, "kind": "swell", "tag": "dive", "t1": t_dive0 + DIVE}, {"t": t_take0, "kind": "swell", "tag": "ten", "t1": t_take0 + 3.0}]
ev = [e for e in ev if declutter.keep_event(e, SPINE, DECL["spineHide"])]
sheet = {"duration": f.duration, "fps": FPS, "preset": "envelope-working", "tail_s": 0.05,
         "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: e["t"]),
         "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}

(HERE / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
print(f"film.json: {f.duration:.2f} s, {len(SHOTS)} shots, {len(LABELS)} labels, {len(BADGES)} badges, {len(SPINE)} spine states, "
      f"{len(film['captions'])} caption pages, end card {t_end:.2f} s")
for b in BEATS:
    print(f"  {b['id']:<9} {b['t0']:6.2f}–{b['t1']:6.2f}")
