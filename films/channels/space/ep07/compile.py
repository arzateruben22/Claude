"""Compile One More Orbit No. 007, "Trees or stars": script + voice timings + this direction → film.json and sheet.json.
Every moment hangs on a beat or a spoken word; every number on screen comes from claims.json.

  python3 -I films/channels/space/ep07/compile.py

One world, one camera: the Milky Way (illustration, 1 unit = 1,000 light-years) drifting behind a flat TALLY drawn over
it (canvas): 80 × 38 dots, each dot = one billion, so 3,040 dots are Earth's trees (3.04 trillion, c3) and the first 400
cells are the galaxy's stars (the 100 to 400 billion range, c1: 100 solid, 300 hollow for the range). No scale jump: the
comparison is the picture. The readout sends one light ring across the galaxy (100,000 light-years) and one tiny one
across "a city block".
"""
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[3] / "kits/cinema/script"))
from timeline import Film   # noqa: E402
sys.path.insert(0, str(HERE.parent / "set"))
from capglue import glue, hold, keep_units    # noqa: E402

FPS, BPM = 30, 56.25
ID = "lightminute-007"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}

# ── the numbers (claims.json) ────────────────────────────────────────────────
TREES_B, STARS_LO_B, STARS_HI_B = 3040, 100, 400       # billions: c3 (3.04 trillion), c1 (100 to 400 billion)
COLS, ROWS = 80, 38
assert COLS * ROWS == TREES_B
assert 7 < TREES_B / STARS_HI_B < 8 and 30 < TREES_B / STARS_LO_B < 31   # c7: roughly 8 to 30 times

t_n, t_c, t_why, t_w, t_tk, t_rd = (B[k]["t0"] for k in ("normal", "change", "why", "whoa", "takeaway", "readout"))
t_end = A("vo08:Next", -0.25)
CUE = {
    "fill0": A("vo03:Now"), "fill1": A("vo03:trillion"),            # trees fill the tally, on "three trillion"
    "plots0": A("vo04:ground"), "sat0": A("vo04:satellite"), "est0": A("vo04:Both"),   # plots flash, satellite lattice sweeps
    "flip0": A("vo05:every"), "flip1": A("vo05:tree"),               # each star turns into a tree
    "over": A("vo05:forests"), "ratio": A("vo05:Trees"),             # the trees keep going; the ratio
    "ring0": A("vo07:Light"), "ring1": A("vo07:Across#2"), "blk": A("vo07:millionth"),
    "n": t_n, "c": t_c, "why": t_why, "w": t_w, "tk": t_tk, "rd": t_rd, "end": t_end,
    "stars": A("vo02:hundreds"), "nobody": A("vo02:Nobody"), "guess": A("vo01:Guess"),
}
assert CUE["fill0"] < CUE["fill1"] <= t_why and CUE["flip0"] < CUE["flip1"] < CUE["over"] < CUE["ratio"] <= t_tk + 0.01, CUE

# ── camera: one pose (a telescope mount); the galaxy turns slowly ────────────
POSE = {"target": [0, 0, 0], "el": 48.0, "fov": 24, "fx": 0.5, "fy": 0.36}
key = lambda t, **k: {"t": round(t, 4), **POSE, **k}
CAM = {"space": [key(0.0, dist=215.0, az=0.0), key(t_c, dist=203.0, az=3.0, ease="sine"), key(t_why, dist=195.0, az=6.0, ease="sine"),
                 key(t_w, dist=200.0, az=8.0, ease="sine"), key(t_tk, dist=190.0, az=10.0, ease="sine"), key(t_rd, dist=178.0, az=12.0, ease="sine"),
                 key(t_end, dist=183.0, az=14.0, ease="sine"), key(t_end + 3, dist=188.0, az=15.0, ease="sine")]}
CAM["end"] = CAM["space"]
for a, b in zip(CAM["space"], CAM["space"][1:]):
    for k in ("az", "el"):
        assert abs(b[k] - a[k]) / (b["t"] - a["t"]) <= 1.5 + 1e-9, (k, a["t"], b["t"])
SHOTS = [{"at": 0.0, "name": "space"}, {"at": t_end, "name": "end"}]

# ── overlay ──────────────────────────────────────────────────────────────────
SPINE = [0.5, 0.555]
LABELS = [
    {"id": "l-sun", "text": "the Sun", "kind": "star", "anchor": "sun", "t0": A("vo02:galaxy"), "t1": round(t_c - 0.2, 4), "side": -1, "v": "above", "fixed": True},
    {"id": "l-sun2", "text": "the Sun", "kind": "star", "anchor": "sun", "t0": CUE["ring0"], "t1": round(t_end - 0.45, 4), "side": 1, "v": "below", "fixed": True},
]
PILLS = [
    {"id": "p-dot", "text": "each dot = 1 billion", "t0": CUE["stars"], "t1": round(t_rd - 0.3, 4), "at": [90 / 1080, 0.247]},
    {"id": "p-plots", "text": "ground plots", "t0": CUE["plots0"], "t1": round(CUE["sat0"] - 0.1, 4), "at": [90 / 1080, 0.705]},
    {"id": "p-sat", "text": "satellite maps", "t0": CUE["sat0"], "t1": round(CUE["est0"] - 0.1, 4), "at": [90 / 1080, 0.705]},
]
BADGES = [
    {"id": "b-illus", "text": "galaxy: illustration", "t0": round(t_n - 0.3, 4), "t1": round(t_c - 0.2, 4), "slot": "tl"},
    {"id": "b-est1", "text": "estimate", "t0": A("vo02:estimate"), "t1": round(t_c - 0.2, 4), "slot": "bl"},
    {"id": "b-est2", "text": "estimate", "t0": CUE["fill1"], "t1": round(t_w - 0.2, 4), "slot": "tl"},
    {"id": "b-nts", "text": "not to scale", "t0": CUE["blk"], "t1": round(t_end - 0.45, 4), "slot": "tr"},
]
COUNTERS = [
    {"id": "c-hook", "label": "trees or stars", "text": "?", "t0": 0.0, "t1": t_n},
    {"id": "c-stars", "label": "stars in the Milky Way", "text": "100 to 400 billion", "t0": t_n, "t1": t_c},
    {"id": "c-trees", "label": "trees on Earth", "text": "about 3 trillion", "t0": t_c, "t1": A("vo03:several") - 0.1},
    {"id": "c-per", "label": "trees for every person", "text": "about 420", "t0": A("vo03:several"), "t1": t_why},
    {"id": "c-est", "label": "both are", "text": "estimates", "t0": CUE["est0"], "t1": t_w},
    {"id": "c-ratio", "label": "trees ÷ stars", "text": "roughly 8 to 30", "t0": CUE["ratio"], "t1": t_rd},
    {"id": "c-read-gal", "label": "light time · across the galaxy", "text": "100,000 years", "read": True, "t0": t_rd, "t1": round(CUE["ring1"] - 0.05, 4)},
    {"id": "c-read-blk", "label": "light time · across a city block", "text": "1 millionth of a second", "read": True, "t0": CUE["ring1"], "t1": round(t_end - 0.45, 4)},
]
for c in COUNTERS:
    c.setdefault("at", SPINE)
spine = [c for c in COUNTERS if c["at"] == SPINE]
for a, b in zip(spine, spine[1:]):
    if b["t0"] - a["t1"] < 0.4:
        a["t1"] = round(b["t0"] - 0.4, 4)

TITLE = {"series": "One More Orbit · No. 007", "title": "Trees or *stars*", "t1": t_n - 0.5, "sig": A("line:vo01:end", 0.05)}
END = {"title": "Next orbit: the *dark* sky", "follow": "One More Orbit · No. 008",
       "next": "Our galaxy probably holds 100 to 400 billion stars (NASA)."}   # footnote (c1)
POSTER = A("vo05:thirty", 0.4)
glue(f, {"vo02": ["hundreds of billions", "dark matter,"],
         "vo03": ["twenty fifteen,", "three trillion.", "several hundred"],
         "vo05": ["eight to thirty times."]})

film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": POSTER,
    "shots": SHOTS, "beats": BEATS, "cam": CAM, "cue": CUE,
    "tally": {"cols": COLS, "rows": ROWS, "stars_lo": STARS_LO_B, "stars_hi": STARS_HI_B, "trees": TREES_B},
    "labels": LABELS, "badges": BADGES, "counters": COUNTERS, "pills": PILLS,
    "title": TITLE, "endCard": t_end, "end": END,
    "captions": hold(f, keep_units(f.captions(max_chars=24))),
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}
ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS]
ev.append({"t": TITLE["sig"], "kind": "signature", "tag": "title"})
ev.append({"t": t_end, "kind": "signature", "tag": "end"})
ev += [{"t": L["t0"], "kind": "label", "tag": L["id"]} for L in LABELS if L["t0"] > 0]
ev += [{"t": c["t0"], "kind": "counter.show", "tag": c["id"]} for c in COUNTERS if c["t0"] > 0]
ev += [{"t": b["t0"], "kind": "badge", "tag": b["id"]} for b in BADGES if b["t0"] > 0]
ev += [{"t": CUE["ring0"], "kind": "light.front", "tag": "galaxy-ring"}, {"t": CUE["blk"], "kind": "light.front", "tag": "block-ring"}]
cues_file = HERE / "build" / f"cues-{ID}-9x16.json"
shown = {}
if cues_file.exists():
    cj = json.loads(cues_file.read_text())
    pic = {e.get("tag"): e for e in cj.get("events", [])}
    for e in ev:
        p = pic.get(e.get("tag"))
        if p and p.get("pos") and e["kind"] in ("label", "counter.show"):
            e["pos"] = p["pos"]
    shown = {k: v for k, v in (cj.get("shown") or {}).items() if k.startswith("l-") and v > 0}
sheet = {"duration": f.duration, "fps": FPS, "preset": "lightminute-vacuum",
         "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: e["t"]), "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}
if shown:
    sheet["shown"] = shown
(HERE / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
print(f"film.json: {f.duration:.2f} s, {len(LABELS)} labels, {len(COUNTERS)} counters; fill {CUE['fill0']:.2f}–{CUE['fill1']:.2f}, flip {CUE['flip0']:.2f}–{CUE['flip1']:.2f}; end card {t_end:.2f}")
print(f"sheet.json: {len(sheet['events'])} events" + (f", {len(shown)} shown" if shown else ""))
