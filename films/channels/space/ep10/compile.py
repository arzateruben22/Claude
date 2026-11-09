"""Compile One More Orbit, Season 2 · Episode 4 (folder ep10), "Black-hole edge": script + voice timings + this direction → film.json and sheet.json.
Every moment hangs on a beat or a spoken word; every number on screen comes from claims.json. Nothing is claimed about the inside of a black hole.

  python3 -I films/channels/space/ep10/compile.py

One 3-D world (not to scale, badged): a black hole with a thin disk and a bright ring, a teal horizon ring, a probe that climbs and falls
back (c1, c2, c3), a far-away watcher ("you") and a falling friend, three clocks at three distances (c4, c20), the friend's clock as seen by the
watcher slowing (c6) while the friend sees everyone else speed up (c13), the gap growing (c21). A GPS inset (c5). Readout: a ring grows from the
black hole to "about 55 million years" (c7, c8). The last frame is frame 0's pose (a replay loops).
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
ID = "one-more-orbit-s2e04"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}
t_n, t_c, t_why, t_w, t_tk, t_rd = (B[k]["t0"] for k in ("normal", "change", "why", "whoa", "takeaway", "readout"))
t_end = A("vo08:Next", -0.25)
CUE = {
    "n": t_n, "c": t_c, "why": t_why, "w": t_w, "tk": t_tk, "rd": t_rd, "end": t_end,
    "horizon": A("vo02:horizon"), "escape": A("vo02:Escape"), "more": A("vo02:more"),
    "nothing": A("vo03:Nothing"), "gets": A("vo03:gets"), "friend": A("vo03:friend"), "falling": A("vo03:falling"), "watch": A("vo03:watch"),
    "gravity": A("vo04:Gravity"), "gps": A("vo04:GPS"), "closer": A("vo04:closer"), "slower": A("vo04:slower"), "compare": A("vo04:compare"),
    "toyou": A("vo05:you"), "tick": A("vo05:tick"), "them": A("vo05:them"), "speed": A("vo05:speed"), "gap": A("vo05:gap"),
    "true": A("vo06:true"), "where": A("vo06:where"),
    "photo": A("vo07:photographed"), "fifty": A("vo07:fifty-five"), "years": A("vo07:years"),
}
assert CUE["horizon"] < CUE["escape"] < CUE["more"] < t_c <= CUE["friend"] < CUE["watch"] < t_why, CUE
CUE["dip"] = [round(CUE["gps"] - 0.3, 4), round(CUE["closer"] - 0.35, 4), round(t_end - 0.15, 4)]    # dips: into the GPS inset, out of it, and the loop back to frame 0
# the camera: {t, p, l, fov}; eased between keys (the scene lerps). The black hole sits at the origin, radius 2.
CAMK = [
    (0.0, [2, 4.2, 25], [0, 0, 0], 40),
    (t_n - 0.2, [5, 4.0, 23], [0, 0, 0], 40),
    (CUE["horizon"] + 0.3, [16, 6, 17], [0, 0, 0], 38),                               # the horizon ring
    (CUE["escape"], [13, 3, 14], [0, 1, 0], 36),
    (CUE["more"], [-9, 5, 17], [0, 1, 0], 38),                                        # the light-speed probe
    (t_c - 0.2, [-12, 7, 22], [0, 0, 0], 40),
    (CUE["friend"], [-16, 2.5, 26], [-2, 0, 0], 40),                                  # you, far away, and the friend
    (CUE["falling"] + 1.6, [-18, 3, 28], [-4, 0, 0], 40),
    (t_why - 0.2, [-9, 4, 21], [0, 0, 0], 38),
    (CUE["dip"][0], [-9, 4, 21], [0, 0, 0], 38),
    (CUE["dip"][0] + 0.32, [400, 0, 8.5], [400, 0, 0], 34),                                 # Earth and a GPS satellite (cut under a dip)
    (CUE["dip"][1], [404, 2, 9.5], [400, 0, 0], 34),
    (CUE["dip"][1] + 0.34, [-4, 7, 30], [0, 0, 0], 40),                               # three clocks near the hole
    (CUE["slower"], [8, 5, 26], [0, 0, 0], 40),
    (CUE["compare"], [18, 5, 20], [0, 0, 0], 38),
    (CUE["toyou"] - 0.2, [-22, 4, 25], [-4, 0, 0], 40),                               # to you, far away
    (CUE["tick"] + 1.0, [-22, 3, 24], [-3, 0, 0], 38),
    (CUE["them"], [-1, 1.2, 8], [0, 0, 0], 52),                                       # to them: from the friend's side
    (CUE["gap"], [-3, 3, 13], [0, 0, 0], 46),
    (t_tk, [8, 7, 24], [0, 0, 0], 42),
    (CUE["where"], [12, 4, 28], [0, 0, 0], 42),
    (t_rd + 0.6, [0, 28, 62], [0, 0, 0], 38),                                         # out, to see the ring grow
    (t_end - 0.15, [0, 32, 68], [0, 0, 0], 38),
    (f.duration, [2, 4.2, 25], [0, 0, 0], 40),
]
CAMK = [{"t": round(t, 4), "p": p, "l": l, "fov": fv} for t, p, l, fv in CAMK]
assert all(b["t"] >= a["t"] for a, b in zip(CAMK, CAMK[1:])), [(k["t"]) for k in CAMK]
CAM = {"space": [{"t": 0, "target": [0, 0, 0], "dist": 10}], "end": [{"t": 0, "target": [0, 0, 0], "dist": 10}]}    # unused by the scene (own camera)
SHOTS = [{"at": 0.0, "name": "space"}, {"at": t_end, "name": "end"}]

SPINE = [0.5, 0.555]
LABELS = [
    {"id": "l-hz", "text": "event horizon", "kind": "light", "anchor": "hz", "t0": round(CUE["horizon"] + 0.2, 4), "t1": round(CUE["gets"], 4), "side": 1, "v": "above", "fixed": True},
    {"id": "l-probe", "text": "probe: falls back", "kind": "body", "anchor": "probe", "t0": round(CUE["escape"] + 0.8, 4), "t1": round(t_c - 0.1, 4), "side": -1, "v": "above", "fixed": True},
    {"id": "l-you", "text": "you, far away", "kind": "body", "anchor": "you", "t0": round(CUE["friend"] - 0.7, 4), "t1": round(CUE["dip"][0], 4), "side": 1, "v": "below", "fixed": True},
    {"id": "l-friend", "text": "your friend", "kind": "star", "anchor": "friend", "t0": round(CUE["friend"] + 0.5, 4), "t1": round(CUE["dip"][0], 4), "side": -1, "v": "above", "fixed": True},
    {"id": "l-gps", "text": "GPS satellite", "kind": "body", "anchor": "gps", "t0": round(CUE["dip"][0] + 0.5, 4), "t1": round(CUE["dip"][1] - 0.1, 4), "side": 1, "v": "above", "fixed": True},
    {"id": "l-far", "text": "far: fast", "kind": "body", "anchor": "clockFar", "t0": round(CUE["dip"][1] + 0.5, 4), "t1": round(CUE["compare"], 4), "side": 1, "v": "above", "fixed": True},
    {"id": "l-near", "text": "near: slow", "kind": "grav", "anchor": "clockNear", "t0": round(CUE["closer"] + 0.4, 4), "t1": round(CUE["compare"], 4), "side": -1, "v": "below", "fixed": True},
]
PILLS = [
    {"id": "p-probe", "text": "any speed: falls back", "t0": round(CUE["escape"] + 0.3, 4), "t1": round(t_c - 0.2, 4), "at": [90 / 1080, 0.175]},
    {"id": "p-gps", "text": "GPS clocks are corrected", "t0": round(CUE["dip"][0] + 0.4, 4), "t1": round(CUE["dip"][1], 4), "at": [90 / 1080, 0.175]},
    {"id": "p-gap", "text": "bar = tick rate you see", "t0": round(CUE["toyou"], 4), "t1": round(t_tk - 0.2, 4), "at": [90 / 1080, 0.175]},
]
BADGES = [
    {"id": "b-illus", "text": "illustration", "t0": round(t_n - 0.3, 4), "t1": round(t_rd - 0.2, 4), "slot": "tr"},
    {"id": "b-nts", "text": "not to scale", "t0": round(t_rd + 0.5, 4), "t1": round(t_end - 0.45, 4), "slot": "tr"},
]
COUNTERS = [
    {"id": "c-hook", "label": "the edge of a black hole", "text": "?", "t0": 0.0, "t1": t_n},
    {"id": "c-esc", "label": "past the edge, escape needs", "text": "more than light speed", "t0": CUE["more"] - 0.4, "t1": t_c},
    {"id": "c-two", "label": "two views of one fall", "text": "you · your friend", "t0": CUE["friend"], "t1": CUE["dip"][0]},
    {"id": "c-slow", "label": "close to a black hole", "text": "clocks tick slower", "t0": CUE["slower"] - 0.8, "t1": CUE["compare"] - 0.3},
    {"id": "c-gap", "label": "the closer they get", "text": "the bigger the gap", "t0": CUE["gap"], "t1": t_tk},
    {"id": "c-both", "label": "both views are", "text": "true", "t0": CUE["true"], "t1": t_rd},
    {"id": "c-read", "label": "light time · first photo", "text": "about 55 million years", "read": True, "t0": round(CUE["fifty"] - 0.6, 4), "t1": round(t_end - 0.45, 4)},
]
for c in COUNTERS:
    c.setdefault("at", SPINE)
spine = [c for c in COUNTERS if c["at"] == SPINE]
for a, b in zip(spine, spine[1:]):
    if b["t0"] - a["t1"] < 0.4:
        a["t1"] = round(b["t0"] - 0.4, 4)

TITLE = {"series": "One More Orbit · S2E04", "title": "Black-hole *edge*", "t1": t_n - 0.5, "sig": A("line:vo01:end", 0.05)}
END = {"title": "Next orbit: a planet that *floats*", "follow": "One More Orbit · S2 · Episode 5",
       "next": "In 2019 the Event Horizon Telescope imaged a black hole about 55 million light-years away."}
POSTER = A("vo05:gap", 0.5)
glue(f, {"vo02": ["event horizon."], "vo05": ["the bigger the gap."], "vo07": ["fifty-five million years."], "vo03": ["falling toward it,"]})
LOOP0 = round(f.duration - 0.6, 4)
film = {
    "loop0": LOOP0, "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": POSTER,
    "shots": SHOTS, "beats": BEATS, "cam": CAM, "camk": CAMK, "cue": CUE,
    "labels": LABELS, "badges": BADGES, "counters": COUNTERS, "pills": PILLS,
    "title": TITLE, "endCard": t_end, "end": END,
    "captions": hold(f, keep_units(f.captions(max_chars=30, written=False))),
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}
ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS]
ev.append({"t": TITLE["sig"], "kind": "signature", "tag": "title"})
ev.append({"t": t_end, "kind": "signature", "tag": "end"})
ev += [{"t": L["t0"], "kind": "label", "tag": L["id"]} for L in LABELS if L["t0"] > 0]
ev += [{"t": c["t0"], "kind": "counter.show", "tag": c["id"]} for c in COUNTERS if c["t0"] > 0]
ev += [{"t": b["t0"], "kind": "badge", "tag": b["id"]} for b in BADGES if b["t0"] > 0]
ev += [{"t": CUE["photo"] + 0.2, "kind": "light.front", "tag": "photo-ring"}]
sheet = {"duration": f.duration, "fps": FPS, "preset": "lightminute-vacuum",
         "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: e["t"]), "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}
(HERE / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
print(f"film.json: {f.duration:.2f} s; horizon {CUE['horizon']:.2f}, friend {CUE['friend']:.2f}, gap {CUE['gap']:.2f}; end card {t_end:.2f}")
print(f"sheet.json: {len(sheet['events'])} events")
