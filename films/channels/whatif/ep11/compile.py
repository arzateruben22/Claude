"""Compile Possibility Lab Season 2, Episode 5 (S2E05, folder ep11), "All the water in one ball": script + voice timings + this
direction → film.json (the scene's clock) and sheet.json (the studio's cue sheet). Every moment hangs on a beat or a spoken
word; every number comes from calc.py, the same module claims.json was written from.

  python3 -I films/channels/whatif/ep11/compile.py

The world (scene.mjs): you beside a glass of water on the graph paper; the water gathers into a floating ball. Then a stage in
kilometres: six sources (oceans, ice, lakes, rivers, underground, air) stream into one ball that swells to 1,383 km across, to scale,
with a ruler. The camera pulls back to the Moon (left) and the Earth (right), all to scale; the fresh-water ball (404 km) sits beside
it in the work shot; the last shot is the Earth wearing a thin blue film (drawn thicker) with the ball beside it. The film ends on frame 0.
Hard cuts, never dissolves, between the scales.
"""
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[3] / "kits/cinema/script"))
sys.path.insert(0, str(HERE))
from timeline import Film   # noqa: E402
from calc import V, RESULTS, MOON_D_KM, EARTH_D_KM   # noqa: E402

FPS, BPM = 30, 50
ID = "envelope-s2e05"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}
R = RESULTS
assert R["d_km"] == 1380 and R["moon_pct"] == 40 and R["earth_pct"] == 11 and R["fresh_km"] == 400

# ── the stage in km: the water ball at the origin, the Moon to its left, the Earth to its right (all to scale) ──
BALL_R = round(V["d_km"] / 2, 1)                    # 691.5 km
FRESH_R = round(V["d_fresh_km"] / 2, 1)             # about 202 km
MOON_R, EARTH_R = MOON_D_KM / 2, EARTH_D_KM / 2
MOON_X, EARTH_X = -2750.0, 8200.0
WORLD = {"ballR": BALL_R, "freshR": FRESH_R, "moonR": MOON_R, "earthR": EARTH_R, "moonX": MOON_X, "earthX": EARTH_X}

# ── times ──
t_nor, t_chg, t_why, t_whoa, t_work0, t_home = (B[k]["t0"] for k in ("normal", "change", "why", "whoa", "work", "takeaway"))
t_end = A("vo08:Next", -0.25)
t_title_out = t_nor - 0.2
t_gather = A("vo01:Gather", -0.1)
t_ball1 = A("vo01:ball,", -0.3)
t_count = A("vo02:Count", -0.05)
NODE_WORDS = ["oceans,", "ice,", "lakes,", "rivers,", "underground,", "air."]
t_nodes = [A("vo02:" + w, -0.1) for w in NODE_WORDS]
t_it = A("vo02:It", 0.0)
t_bill = A("vo02:billion", 0.0)
t_km3 = A("vo02:kilometers.", 0.0)
t_squeeze = A("vo03:Squeeze", -0.05)
t_round = A("vo03:round", -0.1)
t_ballw = A("vo03:That", -0.05)
t_14 = A("vo03:fourteen", -0.1)
t_wide = A("vo03:wide.", 0.0)
t_enorm = A("vo04:enormous,", 0.0)
t_bigger = A("vo04:bigger,", -0.4)
t_planet = A("vo04:planet.", -0.2)
t_moon = A("vo05:Moon.", -0.2)
t_next = A("vo05:Next", -0.1)
t_marble = A("vo05:marble", -0.1)
t_basket = A("vo05:basketball.", -0.1)
t_fresh = A("vo06:fresh;", -0.3)
t_just = A("vo06:just", -0.1)
t_four = A("vo06:four", -0.1)
t_wide6 = A("vo06:wide.", 0.0)
t_looks = A("vo07:Earth", 0.0)
t_eighth = A("vo07:eighth", -0.1)
t_vol = A("vo07:volume.", 0.0)

# ── the camera ──
T = lambda x, y, z, d, el=5.0, az=0.0, fy=0.50: {"target": [x, y, z], "dist": d, "el": el, "az": az, "fov": 24, "fy": fy}
GLASS = T(0.2, 0.9, 0.0, 11.0, 10.0, 0.0, 0.35)
GLASS2 = T(0.2, 0.9, 0.0, 10.4, 10.0, 6.0, 0.35)
BALLP = T(0.0, 0.0, 0.0, 9500.0, 8.0, 0.0, 0.30)
BALLQ = T(0.0, 0.0, 0.0, 8600.0, 8.0, 0.0, 0.30)
MOONP = T(-1700.0, 0.0, 0.0, 27000.0, 8.0, 0.0, 0.30)
EARTHP = T(5900.0, 0.0, 0.0, 79000.0, 8.0, 0.0, 0.30)
WORKP = T(250.0, 0.0, 0.0, 14000.0, 8.0, 0.0, 0.84)
FILMP = T(6800.0, 0.0, 0.0, 80000.0, 8.0, 0.0, 0.30)
def lead(pages, by=0.14):
    """a caption page is fully in when its first word starts: it fades in `by` s earlier (a page that follows another with no gap is left alone)"""
    for i, pg in enumerate(pages):
        prev = pages[i - 1]["t1"] if i else -1.0
        if pg["t0"] - prev >= by + 0.05:
            pg["t0"] = round(max(0.0, pg["t0"] - by), 4)
    return pages

CAM = {
    "glass": [{"t": 0.0, **GLASS}, {"t": t_nor, **GLASS2, "ease": "sine"}],
    "pool": [{"t": t_nor, **BALLP}, {"t": t_why, **BALLQ, "ease": "sine"}],
    "why": [{"t": t_why, **BALLQ}, {"t": round(t_planet, 4), **EARTHP, "ease": "inout2"}, {"t": t_whoa, **EARTHP, "ease": "linear"}],
    "moon": [{"t": t_whoa, **MOONP}, {"t": t_next, **T(-1700.0, 0.0, 0.0, 26000.0, 8.0, 0.0, 0.30), "ease": "sine"}],
    "earth": [{"t": t_next, **EARTHP}, {"t": t_work0, **T(5900.0, 0.0, 0.0, 76000.0, 8.0, 0.0, 0.30), "ease": "sine"}],
    "work": [{"t": t_work0, **WORKP}, {"t": t_home, **T(250.0, 0.0, 0.0, 13200.0, 8.0, 0.0, 0.84), "ease": "sine"}],
    "take": [{"t": t_home, **FILMP}, {"t": t_end, **T(6800.0, 0.0, 0.0, 77000.0, 8.0, 0.0, 0.30), "ease": "sine"}],
    "end": [{"t": t_end, **GLASS}, {"t": B["tease"]["t1"], **GLASS}],
}
SHOTS = [{"at": 0.0, "name": "glass"}, {"at": t_nor, "name": "pool"}, {"at": t_why, "name": "why"}, {"at": t_whoa, "name": "moon"},
         {"at": t_next, "name": "earth"}, {"at": t_work0, "name": "work"}, {"at": t_home, "name": "take"}, {"at": t_end, "name": "end"}]
CUTS_OK = {("glass", "pool"), ("why", "moon"), ("moon", "earth"), ("earth", "work"), ("work", "take"), ("take", "end")}
for shot, keys in CAM.items():
    for a, b in zip(keys, keys[1:]):
        dt = b["t"] - a["t"]
        assert dt > 0, (shot, a["t"], b["t"])
        for kk in ("az", "el"):
            assert abs(b[kk] - a[kk]) / dt <= 30.0 + 1e-9, f"{shot}: {kk} turns too fast between {a['t']:.2f} and {b['t']:.2f}"
for x, y in zip(SHOTS[:-1], SHOTS[1:]):
    if (x["name"], y["name"]) in CUTS_OK:
        continue                                                 # a hard cut between scales
    p, q_ = CAM[x["name"]][-1], CAM[y["name"]][0]
    assert p["target"] == q_["target"] and p["dist"] == q_["dist"], (x, y, p, q_)
# the loop: the end shot is frame 0's pose
assert CAM["end"][0]["target"] == CAM["glass"][0]["target"] and CAM["end"][0]["dist"] == CAM["glass"][0]["dist"]

# ── the spine readout ──
sp_ = lambda t, label, terms, **kw: {"t": t, "label": label, "terms": terms, **kw}
SPINE = [
    sp_(t_count, "all of Earth's water", [["ans", "≈ ? km³"]]),
    sp_(t_bill, "all of Earth's water", [["ans", "≈ 1.4 billion km³"]]),
    sp_(t_round, "a ball of that volume", [["in", "(6 × V ÷ π)^⅓"]]),
    sp_(t_14, "the ball's width", [["ans", f"≈ {R['d_say']:,} km".replace(",", ",")]]),
    sp_(t_whoa, "the ball's width", [["ans", f"≈ {R['d_say']:,} km"]], box=True),
    sp_(t_work0, "the ball's width", [["ans", f"≈ {R['d_say']:,} km"]], box=True, keep=True),
    sp_(t_home, "water as a share of Earth", [["ans", "≈ ? % of its volume"]]),
    sp_(t_eighth, "water as a share of Earth", [["ans", f"≈ {R['share_pct']} % of its volume"]], box=True),
]
SPINE_OUT = t_end - 0.45
WORK = {
    "t0": t_work0, "t1": round(t_wide6 + 0.9, 4), "title": "Show your work",
    "rows": [
        {"t": t_work0 + 0.15, "k": "(6 × 1.386 bn km³ ÷ π)^⅓", "v": f"≈ {R['d_say']:,} km".replace(",", ","), "lit": False},
        {"t": t_fresh, "k": "fresh water only (2.5 %)", "v": f"≈ {R['fresh_km']} km", "lit": True},
        {"t": t_four, "k": "÷ the Moon (3,480 km)", "v": f"≈ {R['moon_pct']} %", "lit": True},
        {"t": t_wide6 - 0.4, "k": "÷ the Earth (12,756 km)", "v": f"≈ {R['earth_pct']} %", "lit": True},
    ],
    "assume": ["liquid, ice and vapor alike", "a perfect sphere", "one density"],
}

# ── labels, badges, counters ──
LABELS = []
for i, (w, nm, side) in enumerate(zip(NODE_WORDS, ["oceans", "ice", "lakes", "rivers", "underground", "air"], [-1, 1, -1, 1, -1, 1])):
    LABELS.append({"id": f"l-n{i}", "text": nm, "kind": "part", "anchor": f"node{i}", "t0": t_nodes[i] + 0.1, "t1": t_bill + 0.6, "side": side, "shot": "pool"})
LABELS += [
    {"id": "l-ruler", "text": "≈ 1,400 km across", "kind": "calc", "anchor": "ruler-end", "t0": t_14, "t1": t_why - 0.3, "side": 1, "shot": "pool"},
    {"id": "l-moon", "text": "the Moon · 3,480 km", "kind": "part", "anchor": "moon-top", "t0": t_whoa + 0.3, "t1": t_next - 0.2, "side": -1, "shot": "moon"},
    {"id": "l-ballm", "text": "water ball · 1,383 km", "kind": "anchor", "anchor": "ball-top", "t0": t_whoa + 0.3, "t1": t_next - 0.2, "side": 1, "shot": "moon"},
    {"id": "l-earth", "text": "the Earth · 12,756 km", "kind": "part", "anchor": "earth-top", "t0": t_next + 0.3, "t1": t_work0 - 0.2, "side": 1, "shot": "earth"},
    {"id": "l-balle", "text": "water ball", "kind": "anchor", "anchor": "ball-top", "lift": 110, "t0": t_next + 0.3, "t1": t_work0 - 0.2, "side": -1, "shot": "earth"},
]
BADGES = [
    {"id": "b-thought", "text": "thought experiment", "t0": 0.3, "t1": t_title_out, "slot": "br"},
    {"id": "b-src", "text": "∵ liquid, ice and vapor counted together", "t0": t_count, "t1": t_bill, "slot": "tl"},
    {"id": "b-ns", "text": "sources: not to scale", "t0": t_nodes[0], "t1": t_bill + 0.4, "slot": "tr"},
    {"id": "b-round", "text": "∵ a perfect sphere", "t0": t_squeeze + 0.2, "t1": t_why - 0.3, "slot": "tl"},
    {"id": "b-scale", "text": "everything to scale", "t0": t_why + 0.4, "t1": t_whoa - 0.3, "slot": "tr"},
    {"id": "b-m", "text": "40 % of the Moon's width", "t0": t_whoa + 0.2, "t1": t_next - 0.2, "slot": "tl"},
    {"id": "b-e", "text": "11 % of the Earth's width", "t0": t_next + 0.2, "t1": t_work0 - 0.2, "slot": "tl"},
    {"id": "b-mb", "text": "a marble : a basketball", "t0": t_marble, "t1": t_work0 - 0.2, "slot": "tr"},
    {"id": "b-fresh", "text": "fresh water only: ≈ 400 km", "t0": t_just + 0.2, "t1": t_wide6 + 0.3, "slot": "tr"},
    {"id": "b-film", "text": "film drawn about 30 × thicker", "t0": t_looks + 0.4, "t1": t_end - 0.3, "slot": "tr"},
]
COUNTERS = [
    {"id": "c-vol", "label": "all the water", "t0": t_count, "t1": t_squeeze - 0.1, "at": [0.5, 0.29], "keys": [[t_count, 0.0], [t_bill, 1386.0]], "end": 1386.0, "unit": "million km³"},
]
CUTS = [sh["at"] for sh in SHOTS[1:]]
for b in BADGES + LABELS:
    if any(abs(b["t1"] - c) < 1e-6 for c in CUTS):
        b["t1"] = round(b["t1"] - 0.3, 4)

TITLE = {"series": "Possibility Lab · Season 2 · Episode 5", "title": "All the water in *one ball*", "t0": 0.3, "t1": t_title_out, "sig": A("line:vo01:end", 0.05)}
END = {"title": "Next envelope: *catching all the lightning*", "follow": "Possibility Lab · Season 2 · Episode 5",
       "next": "USGS Water Science School: about 1.386 billion km³ of water on Earth."}

CUE = {"fps": FPS, "gather": [t_gather, t_ball1], "vol": [t_count, t_bill], "nodes": t_nodes, "squeeze": [t_squeeze, t_14], "ruler": [t_14, t_wide],
       "why": [t_why, t_planet], "whoa": t_whoa, "next": t_next, "work0": t_work0, "fresh": [t_fresh, t_just], "home": t_home, "eighth": t_eighth, "end": t_end,
       "seed": 5}
def clean(pages):
    return pages
film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": round(t_14 + 0.8, 4),
    "shots": SHOTS, "beats": BEATS,
    "world": WORLD,
    "cam": CAM, "cue": CUE, "spine": SPINE, "spineOut": SPINE_OUT, "work": WORK,
    "labels": LABELS, "badges": BADGES, "counters": COUNTERS,
    "title": TITLE, "endCard": t_end, "end": END, "endAnswer": f"≈ {R['d_say']:,} km",
    "captions": lead(f.captions(max_chars=24, balance=True, keep=("one point four billion", "cubic kilometers", "fourteen hundred kilometers", "four hundred kilometers", "an eighth of one percent", "the Moon"))),
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}

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
ev += [{"t": t_squeeze, "kind": "swell", "tag": "squeeze", "t1": t_wide}]
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
