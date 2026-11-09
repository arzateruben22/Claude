"""Compile One More Orbit, Season 2 · Episode 6 (folder ep12), "Footprints": script + voice timings + this direction → film.json and sheet.json.
Every moment hangs on a beat or a spoken word; every number on screen comes from claims.json. Season finale.

  python3 -I films/channels/space/ep12/compile.py

One 3-D world (not to scale where badged): lunar dust (a real height-field with boot prints, a trail, a lander base and rover tracks) in low light
with Earth in the sky (hook); a beach where the same print washes out under rain and wind (c3 contrast, shown under a dip); grains striking the dust,
slowly (c4, c5); the camera pulling back from one print to the whole site (c21); the Moon rising over a street at night (c22); a ring from Earth to
the Moon for about 1.3 seconds (c6). The last frame is frame 0's pose (a replay loops).
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
ID = "one-more-orbit-s2e06"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}
t_n, t_c, t_why, t_w, t_tk, t_rd = (B[k]["t0"] for k in ("normal", "change", "why", "whoa", "takeaway", "readout"))
t_end = A("vo08:That's", -0.25)
CUE = {
    "n": t_n, "c": t_c, "why": t_why, "w": t_w, "tk": t_tk, "rd": t_rd, "end": t_end,
    "apollo": A("vo02:Apollo"), "dust": A("vo02:dust"), "orbiters": A("vo02:orbiter"), "tracks": A("vo02:tracks"), "still": A("vo02:still"),
    "earth": A("vo03:Earth"), "days": A("vo03:days"), "air": A("vo03:air"), "rain": A("vo03:rain#2"),
    "slow": A("vo04:slow"), "grains": A("vo04:grains"), "time": A("vo04:time"), "sand": A("vo04:sandblasting"), "mm": A("vo04:millimeter"),
    "pull": A("vo05:Pull"), "site": A("vo05:site"), "lander": A("vo05:lander's"), "left": A("vo05:left"),
    "beach": A("vo06:beach"), "tonight": A("vo06:tonight"),
    "light": A("vo07:Light"), "quarter": A("vo07:three"), "talk": A("vo07:talk"),
}
assert CUE["apollo"] < CUE["dust"] < CUE["orbiters"] < t_c < CUE["earth"] < CUE["days"] < CUE["air"] < CUE["rain"] < t_why < CUE["grains"] < CUE["mm"] < t_w < CUE["site"] < t_tk, CUE
CUE["dip"] = [round(t_c - 0.15, 4), round(CUE["air"] - 0.35, 4), round(t_tk - 0.25, 4), round(t_rd - 0.25, 4), round(t_end - 0.15, 4)]    # beach, back to the Moon, street, Earth and Moon, loop
BEACH, ST, EMP = [600, 0, 0], [-700, 0, 0], [0, 0, -700]
LAND = [-9, 0, -7]
# camera: {t, p (position), l (look-at), fov}, eased between keys (the scene lerps)
CAMK = [
    (0.0, [1.5, 0.75, 2.2], [0, 0.0, 0], 38),
    (t_n - 0.2, [1.2, 0.7, 1.9], [0, 0.0, 0], 38),
    (CUE["apollo"], [4.6, 0.8, 2.2], [3, 0, 0.4], 38),                             # along the trail
    (CUE["dust"], [9, 1.0, 3.6], [8, 0, 0.6], 38),
    (CUE["orbiters"] - 0.3, [5, 40, 24], [2, 0, 0], 42),                           # up: an orbiter's view
    (CUE["tracks"] + 0.5, [2, 64, 28], [-2, 0, -2], 46),
    (t_c - 0.2, [2, 64, 28], [-2, 0, -2], 46),
    (CUE["dip"][0] + 0.32, [BEACH[0] + 2.0, 0.55, 2.8], [BEACH[0], 0, 0], 38),     # the beach (cut under a dip)
    (CUE["days"], [BEACH[0] + 2.6, 0.9, 3.3], [BEACH[0] + 0.4, 0, 0], 38),
    (CUE["dip"][1], [BEACH[0] + 3.0, 1.2, 3.8], [BEACH[0] + 0.4, 0, 0], 38),
    (CUE["dip"][1] + 0.34, [2.2, 0.7, 2.6], [0, 0, 0], 36),                        # back on the Moon: the print stays
    (CUE["rain"] + 0.6, [1.6, 0.6, 2.1], [0, 0, 0], 36),
    (t_why, [1.2, 0.35, 1.6], [0, 0, 0], 34),                                       # low and close: grains strike the dust
    (CUE["grains"] + 1.0, [0.9, 0.3, 1.2], [0.1, 0, 0], 34),
    (CUE["mm"], [1.4, 0.5, 1.5], [0, 0, 0], 34),
    (t_w - 0.1, [1.4, 0.5, 1.5], [0, 0, 0], 34),
    (CUE["pull"], [2.2, 0.8, 2.2], [0, 0, 0], 38),                                  # pull back from one boot print
    (CUE["site"], [3, 22, 14], [0, 0, 0], 42),
    (CUE["lander"], [-1, 62, 36], [-4, 0, -4], 48),                                 # the whole site
    (CUE["left"] + 1.0, [-2, 70, 38], [-4, 0, -4], 48),
    (t_tk - 0.2, [-2, 70, 38], [-4, 0, -4], 48),
    (t_tk + 0.35, [ST[0], 1.7, 16], [ST[0], 15, -90], 48),                          # the Moon over a street (cut under a dip)
    (CUE["tonight"], [ST[0] + 1.5, 1.7, 15], [ST[0], 17, -90], 48),
    (t_rd - 0.3, [ST[0] + 2.0, 1.8, 14], [ST[0], 20, -90], 48),
    (t_rd + 0.3, [EMP[0] + 14, 70, EMP[2] + 120], [EMP[0] + 14, 0, EMP[2] + 50], 40),     # Earth and Moon, from above
    (t_end - 0.15, [EMP[0] + 16, 74, EMP[2] + 124], [EMP[0] + 14, 0, EMP[2] + 50], 40),
    (f.duration, [1.5, 0.75, 2.2], [0, 0.0, 0], 38),
]
CAMK = [{"t": round(t, 4), "p": p, "l": l, "fov": fv} for t, p, l, fv in CAMK]
assert all(b["t"] >= a["t"] for a, b in zip(CAMK, CAMK[1:])), [(k["t"]) for k in CAMK]
CAM = {"space": [{"t": 0, "target": [0, 0, 0], "dist": 10}], "end": [{"t": 0, "target": [0, 0, 0], "dist": 10}]}    # unused by the scene (own camera)
SHOTS = [{"at": 0.0, "name": "space"}, {"at": t_end, "name": "end"}]

SPINE = [0.5, 0.555]
LABELS = [
    {"id": "l-print", "text": "a boot print", "kind": "body", "anchor": "print", "t0": round(CUE["apollo"] - 0.2, 4), "t1": round(CUE["dust"] + 0.6, 4), "side": 1, "v": "above", "fixed": True},
    {"id": "l-trail", "text": "tracks seen from orbit", "kind": "star", "anchor": "trail", "t0": round(CUE["orbiters"] + 0.3, 4), "t1": round(t_c - 0.2, 4), "side": 1, "v": "above", "fixed": True},
    {"id": "l-beach", "text": "beach: gone in days", "kind": "light", "anchor": "beachP", "t0": round(CUE["dip"][0] + 0.5, 4), "t1": round(CUE["dip"][1] - 0.1, 4), "side": 1, "v": "above", "fixed": True},
    {"id": "l-moon", "text": "Moon: no wind, no rain", "kind": "body", "anchor": "print", "t0": round(CUE["dip"][1] + 0.5, 4), "t1": round(t_why - 0.3, 4), "side": 1, "v": "above", "fixed": True},
    {"id": "l-land", "text": "lander base", "kind": "star", "anchor": "lander", "t0": round(CUE["lander"] - 0.3, 4), "t1": round(t_tk - 0.4, 4), "side": -1, "v": "above", "fixed": True},
]
PILLS = [
    {"id": "p-grain", "text": "grains hit the dust, one at a time", "t0": round(CUE["grains"] - 0.3, 4), "t1": round(CUE["mm"] - 0.2, 4), "at": [90 / 1080, 0.175]},
    {"id": "p-orb", "text": "seen from orbit (illustration)", "t0": round(CUE["orbiters"], 4), "t1": round(t_c - 0.3, 4), "at": [90 / 1080, 0.175]},
]
BADGES = [
    {"id": "b-illus", "text": "illustration", "t0": round(t_n + 0.25, 4), "t1": round(t_rd - 0.2, 4), "slot": "tr"},
    {"id": "b-nts", "text": "not to scale", "t0": round(t_rd, 4), "t1": round(t_end - 0.45, 4), "slot": "tr"},
]
COUNTERS = [
    {"id": "c-hook", "label": "footprints on the Moon", "text": "still there?", "t0": 0.0, "t1": t_n},
    {"id": "c-1969", "label": "Apollo astronauts walked here", "text": "1969", "t0": CUE["apollo"], "t1": CUE["orbiters"] - 0.2},
    {"id": "c-still", "label": "the Apollo 11 site, from orbit", "text": "tracks still there", "t0": CUE["orbiters"], "t1": t_c},
    {"id": "c-days", "label": "a beach footprint", "text": "gone in days", "t0": CUE["earth"], "t1": CUE["air"] - 0.4},
    {"id": "c-air", "label": "the Moon has almost no air", "text": "no wind, no rain", "t0": CUE["air"], "t1": t_why - 0.2},
    {"id": "c-mm", "label": "sandblasting wears the Moon", "text": "1 mm per million years", "t0": CUE["grains"], "t1": t_w - 0.4},
    {"id": "c-left", "label": "the lander's base and the tracks", "text": "still where they were left", "t0": CUE["lander"], "t1": t_tk - 0.2},
    {"id": "c-up", "label": "look up tonight", "text": "some may still be there", "t0": CUE["tonight"] - 0.4, "t1": t_rd},
    {"id": "c-read", "label": "light time · Earth to the Moon", "text": "about 1.3 seconds", "read": True, "t0": CUE["quarter"] - 0.8, "t1": round(t_end - 0.45, 4)},
]
for c in COUNTERS:
    c.setdefault("at", SPINE)
spine = [c for c in COUNTERS if c["at"] == SPINE]
for a, b in zip(spine, spine[1:]):
    if b["t0"] - a["t1"] < 0.4:
        a["t1"] = round(b["t0"] - 0.4, 4)

TITLE = {"series": "One More Orbit · Season 2 · Episode 6", "title": "*Footprints*", "t1": t_n - 0.5, "sig": A("line:vo01:end", 0.05)}
END = {"title": "That's *season two*", "follow": "One More Orbit · Season 2 · Episode 6",
       "next": "NASA LRO has imaged the Apollo 11 site."}
POSTER = A("vo05:site", 0.6)
glue(f, {"vo02": ["Apollo astronauts", "the Moon's dust.", "Apollo 11 landing site.", "still there."], "vo03": ["no wind and no rain."], "vo04": ["a millimeter every", "million years."], "vo06": ["Look up tonight:", "may still be there."], "vo07": ["one point three seconds."], "vo08": ["another orbit,", "same sky."]})
LOOP0 = round(f.duration - 0.6, 4)
film = {
    "loop0": LOOP0, "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": POSTER,
    "shots": SHOTS, "beats": BEATS, "cam": CAM, "camk": CAMK, "cue": CUE, "beach": BEACH, "street": ST, "emp": EMP, "land": LAND,
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
ev += [{"t": CUE["quarter"] - 0.8, "kind": "light.front", "tag": "earth-moon"}]
sheet = {"duration": f.duration, "fps": FPS, "preset": "lightminute-vacuum",
         "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: e["t"]), "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}
(HERE / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
print(f"film.json: {f.duration:.2f} s; orbiters {CUE['orbiters']:.2f}, rain {CUE['rain']:.2f}, site {CUE['site']:.2f}; end card {t_end:.2f}")
print(f"sheet.json: {len(sheet['events'])} events")
