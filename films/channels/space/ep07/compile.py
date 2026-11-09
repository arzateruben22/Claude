"""Compile One More Orbit No. 007, "Trees or stars": script + voice timings + this direction → film.json and sheet.json.
Every moment hangs on a beat or a spoken word; every number on screen comes from claims.json.

  python3 -I films/channels/space/ep07/compile.py

S2E01 (season 2, episode 1; folder ep07). One camera moving between a few places, one flat TALLY drawn over them (canvas):
19 × 16 dots, each dot = ten billion, so 304 dots are Earth's trees (3.04 trillion, c3) and 40 of them are the galaxy's
stars at the top of the range (400 billion, c1: 10 solid for the low end, 30 hollow for the range). Shots: two equal clouds
("trees or stars?"), the galaxy with the Sun and a dark-matter halo, Earth with its forests and a crowd, the two methods
side by side (ground plots, satellite map), the tally overflowing, one tree, and a light ring across the galaxy and across
a city block.
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
ID = "one-more-orbit-s2e01"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}

# ── the numbers (claims.json) ────────────────────────────────────────────────
UNIT_B = 10                                              # billions per dot
TREES_B, STARS_LO_B, STARS_HI_B = 3040, 100, 400         # billions: c3 (3.04 trillion), c1 (100 to 400 billion)
COLS, ROWS = 19, 16
assert COLS * ROWS * UNIT_B == TREES_B
assert 7 < TREES_B / STARS_HI_B < 8 and 30 < TREES_B / STARS_LO_B < 31   # c7: roughly 8 to 30 times

t_n, t_c, t_why, t_w, t_tk, t_rd = (B[k]["t0"] for k in ("normal", "change", "why", "whoa", "takeaway", "readout"))
t_end = A("vo08:Next", -0.25)
CUE = {
    "fill0": A("vo03:Now"), "fill1": A("vo03:trillion"),            # trees fill the tally, on "three trillion"
    "plots0": A("vo04:ground"), "sat0": A("vo04:satellite"), "est0": A("vo04:Both"),   # plots flash, satellite lattice sweeps
    "flip0": A("vo05:every"), "flip1": A("vo05:tree"),                # each star turns into a tree
    "over": A("vo05:forests"), "ratio": A("vo05:Trees"),             # the trees keep going; the ratio
    "ring0": A("vo07:Light"), "ring1": A("vo07:Across#2"), "blk": A("vo07:millionth"),
    "n": t_n, "c": t_c, "why": t_why, "w": t_w, "tk": t_tk, "rd": t_rd, "end": t_end,
    "stars": A("vo02:hundreds"), "nobody": A("vo02:Nobody"), "guess": A("vo01:Guess"), "billions": A("vo02:billions"), "most": A("vo02:Most"),
    "trees": A("vo03:trees"), "alive": A("vo03:alive"), "per": A("vo03:hundreds"), "range": A("vo04:range"), "pass": A("vo06:more"), "big": A("vo06:Big"), "ordinary": A("vo06:ordinary"), "city": A("vo07:city"),
}
assert CUE["fill0"] < CUE["fill1"] <= t_why and CUE["flip0"] < CUE["flip1"] < CUE["over"] < CUE["ratio"] <= t_tk + 0.01, CUE

# ── camera: a telescope mount moving between a few places (galaxy, the Sun, Earth), cuts hidden under dips and panels ──
GALAXY, SUN_P, EARTH = [0, 0, 0], [6.9, 0, -10.0], [1000, 0, 0]         # SUN_P: 45% of the way to the Sun (27 units out at -0.97 rad): the core stays in frame
POSE = {"target": GALAXY, "el": 48.0, "fov": 24, "fx": 0.5, "fy": 0.36}
key = lambda t, **k: {"t": round(t, 4), **POSE, **k}
EPS = 0.03
t_cut1 = round(t_c - 0.12, 4)                       # galaxy → Earth, under a dip to black
t_cut2 = round(CUE["est0"] - 0.1, 4)                # Earth → galaxy, under the two panels
SPACE = [key(0.0, dist=230.0, az=0.0),
         key(t_n, dist=224.0, az=1.0, ease="sine"),
         key(CUE["billions"] - 0.3, dist=218.0, az=2.0, ease="sine"),
         key(CUE["billions"] + 1.4, target=SUN_P, dist=176.0, az=3.5, ease="sine"),          # lands on the Sun pin
         key(CUE["most"] - 0.2, target=SUN_P, dist=178.0, az=4.0, ease="sine"),
         key(CUE["most"] + 1.6, dist=232.0, az=4.0, ease="sine"),                              # pulls out for the dark-matter halo
         key(t_cut1, dist=236.0, az=4.5, ease="sine"),
         key(t_cut1 + EPS, target=EARTH, el=20.0, dist=76.0, az=0.0, fy=0.34),
         key(CUE["fill1"], target=EARTH, el=20.0, dist=70.0, az=3.0, fy=0.34, ease="sine"),
         key(CUE["per"] - 0.3, target=EARTH, el=20.0, dist=70.0, az=4.0, fy=0.34, ease="sine"),
         key(CUE["per"] + 1.0, target=EARTH, el=20.0, dist=106.0, az=5.0, fy=0.25, ease="sine"),      # Earth steps back for the crowd
         key(t_cut2, target=EARTH, el=20.0, dist=108.0, az=7.0, fy=0.25, ease="sine"),
         key(t_cut2 + EPS, dist=215.0, az=3.0),
         key(t_w, dist=210.0, az=4.0, ease="sine"),
         key(CUE["over"] + 1.5, dist=232.0, az=4.5, ease="sine"),
         key(t_tk, dist=240.0, az=5.0, ease="sine"),
         key(t_rd, dist=196.0, az=5.5, ease="sine"),
         key(t_end, dist=190.0, az=5.0, ease="sine"),
         key(f.duration, dist=230.0, az=0.0, ease="sine")]          # the last frame is frame 0's pose
CAM = {"space": SPACE, "end": SPACE}
for a, b in zip(SPACE, SPACE[1:]):
    if b["t"] - a["t"] > 0.1:
        for k in ("az", "el"):
            assert abs(b[k] - a[k]) / (b["t"] - a["t"]) <= 1.5 + 1e-9, (k, a["t"], b["t"])
SHOTS = [{"at": 0.0, "name": "space"}, {"at": t_end, "name": "end"}]
# push-ins on the starred words (the 2-D picture zooms about the frame centre; amplitude, in fractions of the frame)
STAR_T = [A("vo01:stars"), A("vo02:billions"), A("vo02:part"), A("vo03:trillion"), A("vo03:hundreds"), A("vo04:ground"), A("vo04:about"), A("vo04:range"),
          A("vo05:tree"), A("vo05:going"), A("vo05:thirty"), A("vo06:more"), A("vo07:Light"), A("vo07:millionth"), A("vo08:dark")]
CUE["pulses"] = [round(x, 3) for x in STAR_T]
CUE["cut1"], CUE["cut2"] = t_cut1, t_cut2

# ── overlay ──────────────────────────────────────────────────────────────────
SPINE = [0.5, 0.555]
LABELS = [
    {"id": "l-sun", "text": "the Sun", "kind": "star", "anchor": "sun", "t0": round(CUE["billions"] + 0.2, 4), "t1": round(t_c - 0.4, 4), "side": -1, "v": "above", "fixed": True},
    {"id": "l-sun2", "text": "the Sun", "kind": "star", "anchor": "sun", "t0": CUE["ring0"], "t1": round(t_end - 0.45, 4), "side": 1, "v": "below", "fixed": True},
]
PILLS = [
    {"id": "p-halo", "text": "dark matter (illustration)", "t0": round(CUE["most"] + 0.2, 4), "t1": round(t_c - 0.4, 4), "at": [90 / 1080, 0.47]},
    {"id": "p-dot", "text": "each dot = 10 billion", "t0": round(CUE["range"] - 0.2, 4), "t1": round(CUE["pass"] - 0.8, 4), "at": [90 / 1080, 0.16]},
    {"id": "p-plots", "text": "ground plots: trees counted by people", "t0": round(t_why, 4), "t1": round(CUE["est0"] - 0.1, 4), "at": [110 / 1080, 0.187]},
    {"id": "p-sat", "text": "satellite map: trees from space", "t0": CUE["sat0"], "t1": round(CUE["est0"] - 0.1, 4), "at": [110 / 1080, 0.385]},
    {"id": "p-one", "text": "one tree", "t0": round(CUE["pass"] - 0.3, 4), "t1": round(CUE["big"] - 0.2, 4), "at": [90 / 1080, 0.16]},
    {"id": "p-street", "text": "ordinary places", "t0": round(CUE["big"] + 0.6, 4), "t1": round(t_rd - 0.3, 4), "at": [90 / 1080, 0.16]},
    {"id": "p-blk", "text": "a city block", "t0": round(CUE["blk"] - 0.3, 4), "t1": round(t_end - 0.45, 4), "at": [90 / 1080, 0.385]},
]
BADGES = [
    {"id": "b-illus", "text": "galaxy: illustration", "t0": round(t_n - 0.3, 4), "t1": round(t_c - 0.4, 4), "slot": "tl"},
    {"id": "b-est1", "text": "estimate", "t0": CUE["stars"], "t1": round(t_c - 0.4, 4), "slot": "tr"},
    {"id": "b-est2", "text": "estimate", "t0": CUE["fill1"], "t1": round(CUE["plots0"] - 0.3, 4), "slot": "tr"},
    {"id": "b-nts", "text": "not to scale", "t0": t_c, "t1": round(CUE["plots0"] - 0.3, 4), "slot": "tl"},
    {"id": "b-nts2", "text": "not to scale", "t0": CUE["blk"], "t1": round(t_end - 0.45, 4), "slot": "tr"},
]
COUNTERS = [
    {"id": "c-hook", "label": "trees or stars", "text": "?", "t0": 0.0, "t1": t_n},
    {"id": "c-stars", "label": "stars in the Milky Way", "text": "100 to 400 billion", "t0": t_n, "t1": t_c},
    {"id": "c-trees", "label": "trees on Earth", "text": "about 3 trillion", "t0": t_c, "t1": CUE["per"] - 0.1},
    {"id": "c-per", "label": "trees for every person (2015)", "text": "about 420", "t0": CUE["per"], "t1": round(t_why - 0.6, 4)},
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

TITLE = {"series": "One More Orbit · S2E01", "title": "Trees or *stars*", "t1": t_n - 0.5, "sig": A("line:vo01:end", 0.05)}
END = {"title": "Next orbit: the *dark* sky", "follow": "One More Orbit · S2 · Episode 2",
       "next": "Our galaxy probably holds 100 to 400\u00a0billion stars (NASA)."}   # footnote (c1)
POSTER = A("vo05:thirty", 0.4)
glue(f, {"vo02": ["dark matter,"],
         "vo03": ["three trillion."],
         "vo05": ["keep going.", "eight to thirty times."],
         
         "vo07": ["a millionth of a second."]})

LOOP0 = round(f.duration - 0.6, 4)
film = {
    "loop0": LOOP0,
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": POSTER,
    "shots": SHOTS, "beats": BEATS, "cam": CAM, "cue": CUE,
    "tally": {"cols": COLS, "rows": ROWS, "unit_b": UNIT_B, "stars_lo": STARS_LO_B // UNIT_B, "stars_hi": STARS_HI_B // UNIT_B, "trees": TREES_B // UNIT_B},
    "labels": LABELS, "badges": BADGES, "counters": COUNTERS, "pills": PILLS,
    "title": TITLE, "endCard": t_end, "end": END,
    "captions": hold(f, keep_units(f.captions(max_chars=36, written=False))),   # words in captions, figures on the counters: one style
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
print(f"film.json: {f.duration:.2f} s, {len(LABELS)} labels, {len(COUNTERS)} counters; cuts {t_cut1:.2f}, {t_cut2:.2f}; flip {CUE['flip0']:.2f}–{CUE['flip1']:.2f}; end card {t_end:.2f}")
print(f"sheet.json: {len(sheet['events'])} events")
