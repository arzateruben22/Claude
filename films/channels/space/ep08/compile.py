"""Compile One More Orbit No. 008, "Dark sky": script + voice timings + this direction → film.json and sheet.json.
Every moment hangs on a beat or a spoken word; every number on screen comes from claims.json.

  python3 -I films/channels/space/ep08/compile.py

One flat picture (a canvas over the channel's night sky): a top-down DISTANCE MAP (you at the centre, stars scattered at
their distances, equal density) and a strip above it showing "the night sky" as you would see it. Far stars are fainter but
more numerous, so each ring of distance adds the same light: in an endless, eternal universe the strip climbs to white
(c1, c2, c3). Light needs time: a horizon (the universe's age, 13.8 billion years, c6) closes in, the stars beyond it have
not arrived (c5, c20), and the strip falls back to dark (c7, c22). The readout sends light 8 minutes (the Sun, c8) and then
"billions of years" (c9).
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
ID = "lightminute-008"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}
t_n, t_c, t_why, t_w, t_tk, t_rd = (B[k]["t0"] for k in ("normal", "change", "why", "whoa", "takeaway", "readout"))
t_end = A("vo08:Next", -0.25)
CUE = {
    "n": t_n, "c": t_c, "why": t_why, "w": t_w, "tk": t_tk, "rd": t_rd, "end": t_end,
    "spokes0": A("vo02:Then"), "spokes1": A("vo02:star"), "forest": A("vo02:Like"),
    "fainter": A("vo03:fainter"), "more": A("vo03:more"), "cancel": A("vo03:cancel"), "glow": A("vo03:glow"), "surface": A("vo03:surface"),
    "time": A("vo04:time"), "yet": A("vo04:yet"), "age0": A("vo04:thirteen"), "age1": A("vo04:years"),
    "way": A("vo05:way"), "far": A("vo05:far"), "begin": A("vo05:beginning"),
    "clue": A("vo06:clue"), "sun": A("vo07:Sun"), "farthest": A("vo07:farthest"),
}
assert CUE["fainter"] < CUE["more"] < CUE["cancel"] < CUE["glow"] <= t_why and CUE["age0"] < CUE["age1"] < t_w, CUE

POSE = {"target": [0, 0, 0], "el": 30.0, "fov": 24, "fx": 0.5, "fy": 0.36}
key = lambda t, **k: {"t": round(t, 4), **POSE, **k}
CAM = {"space": [key(0.0, dist=60.0, az=0.0), key(t_end + 3, dist=62.0, az=4.0, ease="sine")]}
CAM["end"] = CAM["space"]
SHOTS = [{"at": 0.0, "name": "space"}, {"at": t_end, "name": "end"}]

SPINE = [0.5, 0.555]
PILLS = [
    {"id": "p-sky", "text": "the night sky", "t0": round(t_n - 0.3, 4), "t1": round(t_rd - 0.3, 4), "at": [90 / 1080, 0.198]},
    {"id": "p-map", "text": "distance map: you in the middle", "t0": A("vo02:Then"), "t1": round(t_rd - 0.3, 4), "at": [90 / 1080, 0.74]},
    {"id": "p-way", "text": "still on its way", "t0": CUE["way"], "t1": round(t_tk, 4), "at": [340 / 1080, 0.532]},
]
BADGES = [
    {"id": "b-illus", "text": "illustration", "t0": round(t_n - 0.3, 4), "t1": round(t_rd - 0.3, 4), "slot": "tr"},
    {"id": "b-nts", "text": "not to scale", "t0": CUE["sun"], "t1": round(t_end - 0.45, 4), "slot": "tr"},
]
COUNTERS = [
    {"id": "c-hook", "label": "the night sky", "text": "dark?", "t0": 0.0, "t1": t_n},
    {"id": "c-endless", "label": "an endless, eternal universe", "text": "a star in every direction", "t0": CUE["spokes0"], "t1": CUE["fainter"]},
    {"id": "c-cancel", "label": "fainter, but more: they cancel", "text": "the sky glows", "t0": CUE["cancel"], "t1": t_why},
    {"id": "c-age", "label": "the universe's age", "text": "13.8 billion years", "t0": CUE["age0"], "t1": t_w},
    {"id": "c-dark", "label": "so the sky is", "text": "dark: a clue", "t0": CUE["begin"], "t1": t_rd},
    {"id": "c-read-sun", "label": "light time · the Sun", "text": "8 minutes", "read": True, "t0": t_rd, "t1": round(CUE["farthest"] - 0.05, 4)},
    {"id": "c-read-far", "label": "light time · the farthest galaxies", "text": "billions of years", "read": True, "t0": CUE["farthest"], "t1": round(t_end - 0.45, 4)},
]
for c in COUNTERS:
    c.setdefault("at", SPINE)
spine = [c for c in COUNTERS if c["at"] == SPINE]
for a, b in zip(spine, spine[1:]):
    if b["t0"] - a["t1"] < 0.4:
        a["t1"] = round(b["t0"] - 0.4, 4)

TITLE = {"series": "One More Orbit · No. 008", "title": "Dark *sky*", "t1": t_n - 0.5, "sig": A("line:vo01:end", 0.05)}
END = {"title": "Next orbit: your *gold*", "follow": "One More Orbit · No. 009",
       "next": "Planck (ESA): the universe is about 13.8 billion years old."}
POSTER = A("vo04:years", 0.6)
glue(f, {"vo04": ["thirteen point eight billion years."], "vo02": ["no edge or start."], "vo07": ["about eight minutes."]})

film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": POSTER,
    "shots": SHOTS, "beats": BEATS, "cam": CAM, "cue": CUE,
    "labels": [], "badges": BADGES, "counters": COUNTERS, "pills": PILLS,
    "title": TITLE, "endCard": t_end, "end": END,
    "captions": hold(f, keep_units(f.captions(max_chars=24))),
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}
ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS]
ev.append({"t": TITLE["sig"], "kind": "signature", "tag": "title"})
ev.append({"t": t_end, "kind": "signature", "tag": "end"})
ev += [{"t": c["t0"], "kind": "counter.show", "tag": c["id"]} for c in COUNTERS if c["t0"] > 0]
ev += [{"t": b["t0"], "kind": "badge", "tag": b["id"]} for b in BADGES if b["t0"] > 0]
ev += [{"t": CUE["sun"], "kind": "light.front", "tag": "sun-ring"}, {"t": CUE["farthest"], "kind": "light.front", "tag": "far-ring"}]
sheet = {"duration": f.duration, "fps": FPS, "preset": "lightminute-vacuum",
         "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: e["t"]), "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}
(HERE / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
print(f"film.json: {f.duration:.2f} s, {len(COUNTERS)} counters; spokes {CUE['spokes0']:.2f}, glow {CUE['glow']:.2f}, horizon {CUE['age0']:.2f}–{CUE['age1']:.2f}; end card {t_end:.2f}")
print(f"sheet.json: {len(sheet['events'])} events")
