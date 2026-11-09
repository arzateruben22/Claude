"""Compile Reality Rulebook Season 2 · Episode 5, "Listen to the cup fill" (folder ep11): script + voice timings + this direction -> film.json, sheet.json.

  python3 -I films/channels/physics/ep11/compile.py

The physics (Bagad et al., arXiv 2411.11222, Eq. 2): the air above the water is a pipe closed at one end, its lowest pitch is
f = c / (4 (l + 0.62 R)) with l the length of the empty space, R the radius, c = 343 m/s. The film's mug is R = 4 cm, 10 cm tall:
l = 10 cm gives 687 Hz, l = 2 cm gives 1,914 Hz. The air layers move at f / 300 (slowed 300x, badged). The pouring speed is an
illustration (a mug fills in seconds; the film takes longer).
"""
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
sys.path.insert(0, str(ROOT / "kits/cinema/script"))
sys.path.insert(0, str(HERE.parent / "set"))
from timeline import Film   # noqa: E402
from captions_py import phrase_captions   # noqa: E402

FPS, BPM = 30, 112.5
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
DUR = f.duration
EC = f.end_card
HALF = 0.5 / FPS


def cut(beat):
    return round([b for b in BEATS if b["id"] == beat][0]["t0"] - HALF, 6)


CUTS = {b["id"]: (0.0 if b["id"] == "hook" else cut(b["id"])) for b in BEATS}
C_CM, BETA, MUG_R, MUG_H = 34300.0, 0.62, 4.0, 10.0
SLOW = 300.0


def pitch(level, R=MUG_R, H=MUG_H):
    return C_CM / (4 * ((H - level) + BETA * R))


assert abs(pitch(0) - 687) < 1 and abs(pitch(8) - 1914) < 1, (pitch(0), pitch(8))


def take(*keys):
    return [[round(t, 4), round(v, 5)] for t, v in keys]


# the water level (cm above the mug's floor), keyed on words; it fills slowly (an illustration)
LEVEL = take((0.0, 0.0), (cut("normal"), 0.6), (A("vo02:higher"), 2.4), (cut("change"), 4.0), (cut("why"), 4.6),
             (cut("whoa"), 5.4), (A("vo05:two") + 0.2, 8.0), (cut("measure") - 0.05, 8.0), (cut("measure"), 0.0), (A("vo06:ten"), 0.0),
             (A("vo06:With#2") if False else A("vo06:two"), 7.6), (A("vo06:thousand.") if False else A("vo06:nearly"), 8.0), (cut("takeaway"), 8.0), (DUR, 8.0))
PIPES = {"left": {"x": -6.0, "R": 2.0, "H": 10.0, "level": 2.0}, "right": {"x": 6.0, "R": 2.0, "H": 10.0, "level": 7.0}}
PIPE_W = [cut("why") + 0.2, cut("whoa") - 0.15]
CHART_W = [cut("measure") + 0.3, cut("tease") - 0.2]
MUG_W = [0.0, cut("why") - 0.1]                      # the mug shown through the hook, the normal and the change
MUG_W2 = [cut("whoa") + 0.1, DUR]
LABELS = [
    {"id": "no-water", "text": "water", "color": "force", "t0": A("vo02:Pour") + 0.3, "t1": A("vo02:higher") - 0.2, "at": "water", "side": -1},
    {"id": "no-air", "text": "empty space", "color": "motion", "t0": A("vo02:sound") , "t1": A("vo02:alone.") - 0.3, "at": "air", "side": 1},
    {"id": "ch-pipe", "text": "a pipe, closed at the water", "color": "ghost", "t0": cut("change") + 0.3, "t1": A("vo03:Sound") - 0.1, "at": "airtop", "side": 1},
    {"id": "ch-move", "text": "air moving", "color": "motion", "t0": A("vo03:Sound"), "t1": cut("why") - 0.3, "at": "air", "side": 1},
    {"id": "wy-long", "text": "long pipe: lower note", "color": "ghost", "t0": A("vo04:short") + 0.3, "t1": A("vo04:A#2") if False else A("vo04:flute") - 0.2, "at": "pipeL", "side": -1},
    {"id": "wy-short", "text": "short pipe: higher note", "color": "energy", "t0": A("vo04:rings"), "t1": A("vo04:flute") - 0.2, "at": "pipeR", "side": 1},
    {"id": "me-ten", "text": "10 cm: about 690 Hz", "color": "ghost", "t0": A("vo06:ten"), "t1": A("vo06:With") - 0.2, "at": "chart0", "side": 1},
    {"id": "me-two", "text": "2 cm: nearly 1,900 Hz", "color": "energy", "t0": A("vo06:nearly"), "t1": cut("takeaway") + 0.5, "at": "chart1", "side": -1},
]
BADGES = [
    {"id": "slow", "kind": "tag", "text": "Air motion slowed 300×", "t0": cut("change"), "t1": cut("tease"), "slot": "tr"},
    {"id": "ill", "kind": "tag", "text": "Illustrated mug: numbers from a formula", "t0": cut("takeaway") + 0.5, "t1": cut("tease"), "slot": "tl"},
]
SPINE = [{"t0": 0.3, "t1": cut("why"), "label": "pitch of the filling mug", "unit": "Hz", "dp": 0, "kind": "mug"},
         {"t0": cut("whoa"), "t1": cut("tease") - 0.3, "label": "pitch of the filling mug", "unit": "Hz", "dp": 0, "kind": "mug", "lit": [A("vo06:nearly"), cut("takeaway")]}]
SPINE_AT = [[-1e9, [0.5, 0.235]]]


def view(look, dist, pitch_=0.0, yaw=0.0, fov=32.0):
    return {"look": [round(v, 3) for v in look], "dist": round(dist, 2), "yaw": yaw, "pitch": pitch_, "fov": fov}


def key(t, v, ease="p2"):
    return {"t": round(t, 4), **v, "ease": ease}


MUGV = view([0.0, 3.0, 0.0], 64.0)
CAM = {
    "hook": [key(0.0, view([0.0, 3.2, 0.0], 56.0)), key(cut("normal"), view([0.0, 3.0, 0.0], 62.0), "sine")],
    "normal": [key(cut("normal"), MUGV), key(cut("change"), {**MUGV, "dist": 66.0}, "sine")],
    "change": [key(cut("change"), {**MUGV, "dist": 66.0}), key(A("vo03:Sound"), view([0.0, 4.5, 0.0], 48.0), "p3"), key(cut("why"), view([0.0, 5.0, 0.0], 52.0), "sine")],
    "why": [key(cut("why"), view([0.0, 5.0, 0.0], 80.0)), key(cut("whoa"), view([0.0, 4.5, 0.0], 72.0), "sine")],
    "whoa": [key(cut("whoa"), MUGV), key(cut("measure"), {**MUGV, "dist": 70.0, "pitch": 4.0, "yaw": 6.0}, "sine")],
    "measure": [key(cut("measure"), view([0.5, 4.5, 0.0], 80.0)), key(cut("takeaway"), view([0.5, 5.0, 0.0], 76.0), "sine")],
    "takeaway": [key(cut("takeaway"), view([0.5, 5.0, 0.0], 76.0)), key(cut("tease"), view([0.5, 6.0, 0.0], 84.0, 6.0, -8.0), "sine")],
    "tease": [key(cut("tease"), view([0.5, 6.0, 0.0], 84.0, 6.0, -8.0)), key(DUR, view([0.0, 5.0, 0.0], 90.0), "sine")],
}
SHOTS = [{"at": CUTS[b["id"]], "name": b["id"]} for b in BEATS]
TITLE = {"series": "Reality Rulebook · Season 2 · Episode 5", "title": "Listen to the cup *fill*", "t1": round(cut("normal") - 0.45, 4), "y": 0.183, "sig": -0.7}
film = {
    "id": "reality-rulebook-s2e05", "fps": FPS, "bpm": BPM, "dur": DUR, "poster": 0.0,
    "_doc": "Compiled by compile.py from script.md, vo/ and the direction in compile.py. Do not edit by hand.",
    "shots": SHOTS, "beats": BEATS, "cue": {"cuts": CUTS, "pipes": PIPE_W, "chart": CHART_W, "mug": MUG_W, "mug2": MUG_W2}, "spine": SPINE, "spineAt": SPINE_AT,
    "mug": {"R": MUG_R, "H": MUG_H, "c": C_CM, "beta": BETA, "slow": SLOW}, "level": LEVEL, "pipes": PIPES,
    "labels": LABELS, "badges": BADGES, "cam": CAM, "captionY": 0.632, "title": TITLE,
    "captions": phrase_captions(f, max_chars=24, fix=[], until=EC - 0.3), "endCard": EC,
    "end": {"title": "Next drop: the slow raindrop", "follow": "Follow Reality Rulebook", "foot": "Bagad et al., arXiv 2411.11222 (2024)."},
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}
ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS]
ev.append({"t": round(A("vo02:Pour"), 4), "kind": "time.slow", "tag": "pour"})
ev.append({"t": round(A("vo03:Sound"), 4), "kind": "wave.on", "tag": "air"})
ev.append({"t": round(A("vo04:flute"), 4), "kind": "reveal", "tag": "flute"})
ev.append({"t": round(A("vo05:two"), 4), "kind": "swell", "tag": "two"})
ev.append({"t": round(A("vo06:nearly"), 4), "kind": "counter.end", "tag": "two-k"})
for lb in LABELS:
    ev.append({"t": lb["t0"], "kind": "label", "tag": lb["id"]})
for bd in BADGES:
    ev.append({"t": round(bd["t0"], 4), "kind": "badge", "tag": bd["id"], "text": bd.get("text", "")})
ev.append({"t": SPINE[0]["t0"], "kind": "counter.show", "tag": "spine"})
ev.append({"t": 0.0, "kind": "signature", "tag": "title", "gain": -4.0})
ev.append({"t": EC, "kind": "signature", "tag": "end"})
sheet = {"duration": DUR, "fps": FPS, "preset": "restframe-bench", "duck_db": -9.0,
         "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: (e["t"], e["kind"])),
         "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}
(HERE / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False, allow_nan=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
print(f"film.json: {len(SHOTS)} shots, {len(LABELS)} labels, {len(film['captions'])} caption pages, end card {EC} s, {DUR} s; pitch {pitch(0):.0f} -> {pitch(8):.0f} Hz")
for b in BEATS:
    print(f"  {b['id']:<9} {b['t0']:6.2f}–{b['t1']:6.2f}")
