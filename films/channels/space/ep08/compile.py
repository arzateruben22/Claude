"""Compile One More Orbit, Season 2 · Episode 2 (folder ep08), "Dark sky": script + voice timings + this direction → film.json and sheet.json.
Every moment hangs on a beat or a spoken word; every number on screen comes from claims.json.

  python3 -I films/channels/space/ep08/compile.py

One 3-D world, you at the origin in an endless field of stars (not to scale, badged): a lane of stars running away from you ramps to white
where they pile up (the hook); the camera drives through the field ("no edge or start"); a ray runs from you to a star in 36 directions
(c1); a forest of trunks is the comparison (hits a trunk); three shells (near, middle, far) show that fainter stars are more numerous
(c2) and the sky whitens (c3); a horizon sphere, the light-travel time of the universe's age (c6), grows round you, the stars beyond it have
not arrived (c5, c20), photons crawl in; the sky falls dark (c7, c22). Readout: a ring for 8 minutes (the Sun, c8) and a big one for
"billions of years" (c9), not to scale. The last frame is frame 0's pose (a replay loops).
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[3] / "kits/cinema/script"))
from timeline import Film   # noqa: E402
sys.path.insert(0, str(HERE.parent / "set"))
from capglue import glue, hold, keep_units    # noqa: E402

FPS, BPM = 30, 56.25
ID = "one-more-orbit-s2e02"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}
t_n, t_c, t_why, t_w, t_tk, t_rd = (B[k]["t0"] for k in ("normal", "change", "why", "whoa", "takeaway", "readout"))
t_end = A("vo08:Next", -0.25)
CUE = {
    "n": t_n, "c": t_c, "why": t_why, "w": t_w, "tk": t_tk, "rd": t_rd, "end": t_end,
    "spokes0": A("vo02:Then"), "forest0": A("vo02:forest"), "trunk": A("vo02:trunk"),
    "fainter": A("vo03:fainter"), "more": A("vo03:more"), "cancel": A("vo03:cancel"), "glow": A("vo03:glow"), "surface": A("vo03:surface"),
    "time": A("vo04:time"), "yet": A("vo04:yet"), "age0": A("vo04:thirteen"), "age1": A("vo04:years"),
    "way": A("vo05:way"), "far": A("vo05:far"), "begin": A("vo05:beginning"),
    "clue": A("vo06:clue"), "sun": A("vo07:Sun"), "farthest": A("vo07:farthest"),
}
assert CUE["spokes0"] < CUE["forest0"] < CUE["trunk"] < t_c and CUE["fainter"] < CUE["more"] < CUE["cancel"] < CUE["glow"] <= t_why, CUE
CUE["dip"] = [round(CUE["forest0"] - 0.3, 4), round(t_c - 0.2, 4), round(t_end - 0.15, 4)]   # dips: into the forest, out of it, and the loop back to frame 0
F = [600, 0, 0]
FP = lambda x, y, z: [F[0] + x, F[1] + y, F[2] + z]
# camera: {t, p (position), l (look-at), fov}; eased between keys (the scene lerps)
CAMK = [
    (0.0, [0, 0.5, 2], [0, 0.3, 70], 58),
    (t_n - 0.3, [0, 0.5, 6], [0, 0.3, 74], 56),
    (CUE["spokes0"] - 0.2, [0, 0.5, 46], [0, 0.3, 118], 56),                          # driving through an endless field
    (CUE["spokes0"] + 2.4, [0, 22, -62], [0, 0, 8], 38),                              # out to see you and the rays
    (CUE["dip"][0], [0, 26, -66], [0, 0, 8], 38),
    (CUE["dip"][0] + 0.32, FP(-9, 1.8, -24), FP(0, 3, 30), 54),                       # the forest (cut under a dip)
    (CUE["trunk"] + 0.5, FP(6, 1.8, -6), FP(0, 3, 36), 54),
    (CUE["dip"][1] + 0.0, FP(7, 1.8, -4), FP(0, 3, 36), 54),
    (CUE["dip"][1] + 0.34, [0, 52, -200], [0, 0, 0], 34),                             # three shells, from outside
    (CUE["more"], [-62, 40, -176], [0, 0, 0], 34),
    (CUE["cancel"], [-112, 48, -140], [0, 0, 0], 34),
    (CUE["cancel"] + 0.4, [-112, 48, -140], [0, 0, 0], 34),
    (CUE["glow"] - 0.1, [0, 0.4, 0.8], [0, 0.3, 70], 62),                             # inside: the whole sky should glow
    (t_why + 0.2, [0, 0.4, 0.8], [0, 0.3, 70], 62),
    (CUE["time"] + 1.8, [0, 70, -205], [0, 0, 0], 34),                                # out, to watch light-travel time
    (CUE["age0"], [-72, 46, -150], [0, 0, 0], 34),
    (CUE["age1"], [-88, 40, -112], [0, 0, 0], 36),
    (CUE["way"], [-62, 30, -84], [0, 0, 0], 40),
    (CUE["far"], [22, 18, -44], [0, 0, 30], 46),                                      # push in on "far"
    (CUE["begin"], [22, 18, -44], [0, 0, 30], 46),
    (CUE["begin"] + 2.6, [0, 0.5, 1], [0, 0.3, 70], 60),                              # inside: a dark sky with a few stars
    (CUE["clue"], [0, 0.5, 1.5], [5, 3, 70], 60),
    (t_rd - 0.2, [0, 0.5, 1.5], [-5, 2, 70], 60),
    (t_rd + 1.5, [0, 72, -120], [0, 0, 6], 36),                                       # the rings, from above
    (t_end - 0.15, [0, 76, -126], [0, 0, 6], 36),
    (f.duration, [0, 0.5, 2], [0, 0.3, 70], 58),
]
CAMK = [{"t": round(t, 4), "p": p, "l": l, "fov": fv} for t, p, l, fv in CAMK]
assert all(b["t"] >= a["t"] for a, b in zip(CAMK, CAMK[1:])), [k["t"] for k in CAMK]
CAM = {"space": [{"t": 0, "target": [0, 0, 0], "dist": 10}], "end": [{"t": 0, "target": [0, 0, 0], "dist": 10}]}    # unused by the scene (own camera); keeps the renderer's shot table valid
SHOTS = [{"at": 0.0, "name": "space"}, {"at": t_end, "name": "end"}]

SPINE = [0.5, 0.555]
LABELS = [
    {"id": "l-you", "text": "you", "kind": "light", "anchor": "you", "t0": round(CUE["spokes0"] + 0.9, 4), "t1": round(CUE["dip"][0], 4), "side": 1, "v": "below", "fixed": True},
    {"id": "l-near", "text": "near: few, bright", "kind": "star", "anchor": "near", "t0": CUE["fainter"], "t1": round(CUE["more"] + 1.2, 4), "side": -1, "v": "above", "fixed": True},
    {"id": "l-mid", "text": "middle: more, fainter", "kind": "body", "anchor": "mid", "t0": round(CUE["more"] + 0.6, 4), "t1": round(CUE["cancel"] - 0.2, 4), "side": 1, "v": "below", "fixed": True},
    {"id": "l-far", "text": "far: most, faintest", "kind": "grav", "anchor": "far", "t0": CUE["more"], "t1": round(CUE["cancel"] + 0.2, 4), "side": 1, "v": "above", "fixed": True},
    {"id": "l-hz", "text": "light-travel time (not to scale)", "kind": "light", "anchor": "hz", "t0": round(CUE["age0"] - 0.2, 4), "t1": round(CUE["way"] - 0.4, 4), "side": -1, "v": "above", "fixed": True},
]
PILLS = [
    {"id": "p-lane", "text": "each dot a star, far to near", "t0": 0.2, "t1": round(t_n - 0.4, 4), "at": [90 / 1080, 0.235]},
    {"id": "p-rays", "text": "a ray from you to a star", "t0": round(CUE["spokes0"] + 1.6, 4), "t1": round(CUE["dip"][0], 4), "at": [90 / 1080, 0.175]},
    {"id": "p-forest", "text": "every look hits a trunk", "t0": round(CUE["dip"][0] + 0.4, 4), "t1": round(CUE["dip"][1], 4), "at": [90 / 1080, 0.175]},
    {"id": "p-way", "text": "still on its way", "t0": CUE["way"], "t1": round(CUE["far"] + 2.0, 4), "at": [90 / 1080, 0.175]},
]
BADGES = [
    {"id": "b-illus", "text": "illustration", "t0": round(t_n - 0.3, 4), "t1": round(t_rd - 0.2, 4), "slot": "tr"},
    {"id": "b-nts", "text": "not to scale", "t0": CUE["sun"], "t1": round(t_end - 0.45, 4), "slot": "tr"},
]
COUNTERS = [
    {"id": "c-hook", "label": "the night sky", "text": "dark?", "t0": 0.0, "t1": t_n},
    {"id": "c-endless", "label": "an endless, eternal universe", "text": "a star every way", "t0": CUE["spokes0"], "t1": CUE["dip"][0]},
    {"id": "c-cancel", "label": "each shell adds the same light", "text": "the sky glows", "t0": CUE["cancel"], "t1": t_why},
    {"id": "c-dark", "label": "so the sky is", "text": "dark: a clue", "t0": CUE["begin"], "t1": t_rd},
    {"id": "c-read-sun", "label": "light time · the Sun", "text": "8 minutes", "read": True, "t0": t_rd, "t1": round(CUE["farthest"] - 0.05, 4)},
    {"id": "c-read-far", "label": "light time · far galaxies", "text": "billions of years", "read": True, "t0": CUE["farthest"], "t1": round(t_end - 0.45, 4)},
]
for c in COUNTERS:
    c.setdefault("at", SPINE)
spine = [c for c in COUNTERS if c["at"] == SPINE]
for a, b in zip(spine, spine[1:]):
    if b["t0"] - a["t1"] < 0.4:
        a["t1"] = round(b["t0"] - 0.4, 4)

TITLE = {"series": "One More Orbit · S2E02", "title": "Dark *sky*", "t1": t_n - 0.5, "sig": A("line:vo01:end", 0.05)}
END = {"title": "Next orbit: your *gold*", "follow": "One More Orbit · S2 · Episode 3",
       "next": "Planck (ESA): the universe is about 13.8 billion years old."}
POSTER = A("vo04:years", 0.6)
glue(f, {"vo03": ["a star's surface."], "vo02": ["no edge or start."], "vo07": ["about eight minutes."]})
LOOP0 = round(f.duration - 0.6, 4)
film = {
    "loop0": LOOP0, "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": POSTER,
    "shots": SHOTS, "beats": BEATS, "cam": CAM, "camk": CAMK, "cue": CUE, "forest": F,
    "labels": LABELS, "badges": BADGES, "counters": COUNTERS, "pills": PILLS,
    "title": TITLE, "endCard": t_end, "end": END,
    "captions": hold(f, keep_units(f.captions(max_chars=36, written=False))),
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}
ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS]
ev.append({"t": TITLE["sig"], "kind": "signature", "tag": "title"})
ev.append({"t": t_end, "kind": "signature", "tag": "end"})
ev += [{"t": L["t0"], "kind": "label", "tag": L["id"]} for L in LABELS if L["t0"] > 0]
ev += [{"t": c["t0"], "kind": "counter.show", "tag": c["id"]} for c in COUNTERS if c["t0"] > 0]
ev += [{"t": b["t0"], "kind": "badge", "tag": b["id"]} for b in BADGES if b["t0"] > 0]
ev += [{"t": CUE["sun"], "kind": "light.front", "tag": "sun-ring"}, {"t": CUE["farthest"], "kind": "light.front", "tag": "far-ring"}, {"t": CUE["way"], "kind": "light.front", "tag": "photons"}]
sheet = {"duration": f.duration, "fps": FPS, "preset": "lightminute-vacuum",
         "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: e["t"]), "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}
(HERE / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
print(f"film.json: {f.duration:.2f} s, {len(COUNTERS)} counters; rays {CUE['spokes0']:.2f}, forest {CUE['forest0']:.2f}, shells {CUE['fainter']:.2f}, glow {CUE['glow']:.2f}, horizon {CUE['age0']:.2f}–{CUE['age1']:.2f}; end card {t_end:.2f}")
print(f"sheet.json: {len(sheet['events'])} events")
