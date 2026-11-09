"""Compile Possibility Lab Season 2, Episode 4 (S2E04, folder ep10), "Every shuffle is new": script + voice timings + this
direction → film.json (the scene's clock) and sheet.json (the studio's cue sheet). Every moment hangs on a beat or a spoken
word; every number comes from calc.py, the same module claims.json was written from.

  python3 -I films/channels/whatif/ep10/compile.py

The world (scene.mjs): fifty-two cards laid out face up on the graph paper, seen from above. A shuffle re-deals them into a new order;
three picks light up the choices (52, 51, 50 ...); the 68 digits of 52! type across the screen; the camera lifts to a crowd of
people, each with a deck, shuffling once a second; two bars compare every shuffle ever made with all possible orders (the second
is far too tall); the camera returns to your deck, one new order, held. The last frame is frame 0 (the loop).
"""
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[3] / "kits/cinema/script"))
sys.path.insert(0, str(HERE))
from timeline import Film   # noqa: E402
from calc import V, RESULTS, SENS, ORDERS   # noqa: E402

FPS, BPM = 30, 50
ID = "envelope-s2e04"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}
R = RESULTS
assert R["digits"] == 68 and R["shuffles"] == (3.6, 27) and R["coverage"] == (4.4, -41)

SUP = str.maketrans("-0123456789", "⁻⁰¹²³⁴⁵⁶⁷⁸⁹")
sup = lambda n: str(n).translate(SUP)

# ── times ──
t_nor, t_chg, t_why, t_whoa, t_work0, t_home = (B[k]["t0"] for k in ("normal", "change", "why", "whoa", "work", "takeaway"))
t_end = A("vo08:Next", -0.25)
t_title_out = t_nor - 0.2
t_shuffle = A("vo01:Shuffle", -0.1)
t_p1, t_p2, t_p3 = A("vo02:fifty-two,", 0.0), A("vo02:next", -0.1), A("vo02:rest.", -0.5)
t_multi = A("vo02:Multiply", -0.1)
t_orders = A("vo02:orders.", 0.0)
t_digits0 = A("vo03:answer", 0.0)
t_loud = A("vo03:loud.", 0.0)
t_pick = A("vo03:Each", -0.1)
t_deck4 = A("vo04:deck,", 0.0)
t_eight = A("vo04:eight", -0.1)
t_shufflew = A("vo04:Shuffle", -0.1)
t_fourteen = A("vo04:fourteen", -0.1)
t_univ = A("vo04:universe.", 0.0)
t_even = A("vo05:Even", 0.0)
t_cover = A("vo05:cover", -0.1)
t_trillion = A("vo05:trillion", 0.0)
t_orders5 = A("vo05:orders.", 0.0)
t_first = A("vo05:first", -0.1)
t_thousand = A("vo06:thousand", -0.1)
t_changes = A("vo06:changes.", 0.0)
t_big = A("vo06:big.", -0.5)
t_well = A("vo07:Shuffle", 0.0)
t_never = A("vo07:never", -0.1)
t_bet = A("vo07:bet.", -0.2)

# ── the camera ──
T = lambda x, y, z, d, el=5.0, az=0.0, fy=0.50: {"target": [x, y, z], "dist": d, "el": el, "az": az, "fov": 24, "fy": fy}
DECK = T(0.0, 0.0, 0.0, 26.0, 88.0, 0.0, 0.31)
DECK2 = T(0.0, 0.0, 0.0, 24.5, 84.0, 5.0, 0.31)
CROWD = T(0.0, 0.0, 0.0, 140.0, 52.0, 0.0, 0.30)
CROWD2 = T(0.0, 0.0, 0.0, 120.0, 50.0, 14.0, 0.30)
CAM = {
    "deck": [{"t": 0.0, **DECK}, {"t": round(t_why - 0.4, 4), **DECK2, "ease": "sine"}],
    "crowd": [{"t": round(t_why - 0.4, 4), **DECK2}, {"t": round(t_why + 3.4, 4), **CROWD, "ease": "inout2"}, {"t": t_whoa, **CROWD2, "ease": "sine"}],
    "bars": [{"t": t_whoa, **CROWD2}, {"t": t_home, **T(0.0, 0.0, 0.0, 105.0, 48.0, 30.0, 0.30), "ease": "sine"}],
    "back": [{"t": t_home, **T(0.0, 0.0, 0.0, 105.0, 48.0, 30.0, 0.30)}, {"t": round(t_home + 2.8, 4), **DECK2, "ease": "inout2"}, {"t": t_end, **DECK, "ease": "sine"}],
    "end": [{"t": t_end, **DECK}, {"t": B["tease"]["t1"], **DECK}],
}
SHOTS = [{"at": 0.0, "name": "deck"}, {"at": round(t_why - 0.4, 4), "name": "crowd"}, {"at": t_whoa, "name": "bars"}, {"at": t_home, "name": "back"}, {"at": t_end, "name": "end"}]
for shot, keys in CAM.items():
    for a, b in zip(keys, keys[1:]):
        dt = b["t"] - a["t"]
        assert dt > 0, (shot, a["t"], b["t"])
        for kk in ("az", "el"):
            assert abs(b[kk] - a[kk]) / dt <= 30.0 + 1e-9, f"{shot}: {kk} turns too fast between {a['t']:.2f} and {b['t']:.2f}"
for x, y in zip(SHOTS[:-1], SHOTS[1:]):
    p, q_ = CAM[x["name"]][-1], CAM[y["name"]][0]
    assert p["target"] == q_["target"] and p["dist"] == q_["dist"], (x, y, p, q_)

# ── the shuffles: a card order at each time (the scene builds them from seeds) ──
SHUF = [[round(t_shuffle, 3), 1.0, 1]]                    # the hook's shuffle: P0 → P1
tt = t_pick
k = 2
while tt < t_why - 0.7:
    SHUF.append([round(tt, 3), 0.42, k]); tt += 0.62; k += 1
SHUF.append([round(t_home + 0.5, 3), 1.1, 0])             # the takeaway: back to P0, frame 0's order

# ── the spine readout ──
sp_ = lambda t, label, terms, **kw: {"t": t, "label": label, "terms": terms, **kw}
SPINE = [
    sp_(t_nor + 0.4, "orders of a 52-card deck", [["in", "52 × 51 × 50 …"]]),
    sp_(t_multi, "52 × 51 × 50 × … × 1", [["ans", f"≈ {R['orders_m']} × 10{sup(R['orders_e'])}"]]),
    sp_(t_eight, "every shuffle ever made", [["ans", f"≈ {R['shuffles'][0]} × 10{sup(R['shuffles'][1])}"]]),
    sp_(t_orders5, "share of all the orders", [["ans", "< 1 in 10³⁶"]], box=True),
    sp_(t_work0, "share of all the orders", [["ans", "< 1 in 10³⁶"]], box=True, keep=True),
    sp_(t_home, "share of all the orders", [["ans", "< 1 in 10³⁶"]], box=True, keep=True),
]
SPINE_OUT = t_end
sc = R["sens_cov"]
fmt = lambda c: f"{c[0]} × 10{sup(c[1])}"
WORK = {
    "t0": t_work0, "t1": round(t_changes + 2.6, 4), "title": "Show your work",
    "rows": [
        {"t": t_work0 + 0.15, "k": "8.2 bn × 13.8 bn yr × 31.6 M s", "v": f"≈ {fmt(R['shuffles'])}", "lit": False},
        {"t": t_work0 + 0.55, "k": "÷ 52! (8.07 × 10⁶⁷)", "v": f"≈ {fmt(sc[0])}", "lit": False},
        {"t": t_thousand, "k": "1,000 × the people", "v": f"≈ {fmt(sc[1])}", "lit": True},
        {"t": t_changes, "k": "1,000,000 × the people", "v": f"≈ {fmt(sc[2])}", "lit": True},
    ],
    "assume": ["fair shuffles", "one a second each", "every person alive"],
}

# ── labels, badges, counters ──
LABELS = []
BADGES = [
    {"id": "b-thought", "text": "thought experiment", "t0": 0.3, "t1": t_title_out, "slot": "br"},
    {"id": "b-52", "text": "52 cards", "t0": t_nor + 0.2, "t1": t_digits0 - 0.1, "slot": "tl"},
    {"id": "b-fair", "text": "∵ a fair, thorough shuffle", "t0": t_digits0, "t1": t_why - 0.3, "slot": "tl"},
    {"id": "b-68", "text": "68 digits", "t0": t_digits0 + 1.0, "t1": t_pick, "slot": "tr"},
    {"id": "b-people", "text": "8.2 billion people", "t0": t_eight, "t1": t_whoa - 0.3, "slot": "tl"},
    {"id": "b-rate", "text": "∵ one shuffle a second each", "t0": t_shufflew, "t1": t_whoa - 0.3, "slot": "tr"},
    {"id": "b-bar", "text": "bars: not to scale", "t0": t_cover, "t1": t_work0 + 0.2, "slot": "tl"},
    {"id": "b-1000", "text": "1,000 × the people: still tiny", "t0": t_thousand + 0.3, "t1": t_home - 0.3, "slot": "tr"},
]
COUNTERS = [
    {"id": "c-choices", "label": "choices for the next card", "t0": t_p1 - 0.3, "t1": t_multi, "at": [0.66, 0.2], "keys": [[t_p1 - 0.2, 52.0], [t_p1, 52.0], [t_p2, 51.0], [t_p3, 50.0], [t_multi - 0.1, 50.0]], "end": 50.0, "unit": ""},
    {"id": "c-years", "label": "years of shuffling", "t0": t_fourteen - 0.2, "t1": t_whoa - 0.3, "at": [0.5, 0.33], "keys": [[t_fourteen, 0.0], [t_univ, 13.8]], "end": 13.8, "unit": "billion"},
]
CUTS = [sh["at"] for sh in SHOTS[1:]]
for b in BADGES:
    if any(abs(b["t1"] - c) < 1e-6 for c in CUTS):
        b["t1"] = round(b["t1"] - 0.3, 4)

TITLE = {"series": "Possibility Lab · Season 2 · Episode 4", "title": "Every shuffle is *new*", "t0": 0.3, "t1": t_title_out, "sig": A("line:vo01:end", 0.05)}
END = {"title": "Next envelope: *all the water, one ball*", "follow": "Possibility Lab · Season 2 · Episode 4",
       "next": "52! ≈ 8.07 × 10⁶⁷ (exact integer arithmetic)."}

CUE = {"fps": FPS, "shuf": SHUF, "picks": [t_p1, t_p2, t_p3], "multi": [t_multi, t_orders], "digits": [t_digits0 + 0.6, t_loud + 0.5, t_pick - 0.1], "why": t_why, "crowd": [t_why - 0.4, t_why + 3.4],
       "years": [t_fourteen, t_univ], "bars": [t_cover, t_trillion, t_orders5, t_first, t_work0 + 0.2], "work0": t_work0, "thousand": t_thousand, "home": t_home, "back": [t_home, t_home + 2.8, t_end],
       "seed": 7, "orders_m": R["orders_m"], "orders_e": R["orders_e"], "whoa": t_whoa, "bigbar": [t_whoa + 1.5, t_trillion]}
film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": round(t_first + 0.6, 4),
    "shots": SHOTS, "beats": BEATS,
    "world": {"digits": str(ORDERS)},
    "cam": CAM, "cue": CUE, "spine": SPINE, "spineOut": SPINE_OUT, "work": WORK,
    "labels": LABELS, "badges": BADGES, "counters": COUNTERS,
    "title": TITLE, "endCard": t_end, "end": END, "endAnswer": "< 1 in 10³⁶",
    "captions": f.captions(max_chars=24, balance=True, keep=("fifty-two", "sixty-eight digits", "eight billion", "fourteen billion", "a trillion trillion trillion", "almost certainly")),
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
ev += [{"t": t_digits0, "kind": "swell", "tag": "digits", "t1": t_loud}, {"t": t_shufflew, "kind": "swell", "tag": "crowd", "t1": t_univ}]
sheet = {"duration": f.duration, "fps": FPS, "preset": "envelope-working", "tail_s": 0.05,
         "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: e["t"]),
         "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}

(HERE / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
print(f"film.json: {f.duration:.2f} s, {len(SHOTS)} shots, {len(BADGES)} badges, {len(SPINE)} spine states, {len(SHUF)} shuffles, "
      f"{len(film['captions'])} caption pages, end card {t_end:.2f} s")
for b in BEATS:
    print(f"  {b['id']:<9} {b['t0']:6.2f}–{b['t1']:6.2f}")
