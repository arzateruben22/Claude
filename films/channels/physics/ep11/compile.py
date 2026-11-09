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
_v8 = [x for x in f.lines if x["id"] == "vo08"][0]
ENDSHOW = round(max(_v8["t"] + _v8["dur"] + 0.3, DUR - 2.0), 4)      # the end card comes up after the last sentence and holds to the end
RISE_T = round(A("vo04:As") - 0.05, 4)                              # "As the water rises...": back to the mug (a hard cut)
PIPE_W = [cut("why"), RISE_T]
FLUTE_T = [round(A("vo04:flute"), 4), round(A("vo04:pipe.") if False else A("vo04:length") + 0.3, 4)]   # the long pipe is shortened, as a flute player does
CHART_W = [cut("measure") + 0.2, cut("takeaway") + 2.0]
LABELS = [
    {"id": "no-water", "text": "water", "color": "force", "t0": A("vo02:Pour") + 0.3, "t1": A("vo02:higher") - 0.2, "at": "water", "side": -1},
    {"id": "no-air", "text": "empty space", "color": "motion", "t0": A("vo02:sound"), "t1": A("vo02:alone.") - 0.3, "at": "air", "side": 1},
    {"id": "ch-pipe", "text": "a pipe, closed at the water", "color": "ghost", "t0": cut("change") + 0.3, "t1": A("vo03:Sound") - 0.1, "at": "airtop", "side": 1},
    {"id": "ch-move", "text": "air moving", "color": "motion", "t0": A("vo03:Sound"), "t1": cut("why") - 0.3, "at": "air", "side": 1},
    {"id": "wy-long", "text": "long pipe: lower note", "color": "ghost", "t0": cut("why") + 0.5, "t1": A("vo04:flute") - 0.2, "at": "pipeL", "side": 1},
    {"id": "wy-short", "text": "short pipe: higher note", "color": "energy", "t0": cut("why") + 0.9, "t1": A("vo04:flute") - 0.2, "at": "pipeR", "side": -1},
    {"id": "wy-flute", "text": "shorter: higher", "color": "energy", "t0": A("vo04:flute") + 0.3, "t1": RISE_T - 0.2, "at": "pipeL", "side": 1},
]
for _lb in LABELS:
    _lb["t0"] = round((math.floor(_lb["t0"] * FPS) + 0.5) / FPS, 6)
BADGES = [
    {"id": "pour", "kind": "tag", "text": "Pour slowed down", "t0": cut("normal") + 0.3, "t1": round(cut("change") - 0.3, 4), "slot": "tr"},
    {"id": "slow", "kind": "tag", "text": "Air motion slowed 300×", "t0": cut("change"), "t1": round(cut("tease") - 0.3, 4), "slot": "tr"},
    {"id": "rep", "kind": "tag", "text": "Replay · formula numbers", "t0": cut("measure"), "t1": round(cut("takeaway") - 0.3, 4), "slot": "tr"},
    {"id": "frm", "kind": "tag", "text": "Numbers from a formula", "t0": cut("takeaway"), "t1": round(cut("tease") - 0.7, 4), "slot": "tr"},
    {"id": "icup", "kind": "tag", "text": "An illustrated cup", "t0": round(cut("whoa") + 0.2, 4), "t1": round(cut("tease") - 0.7, 4), "slot": "tl"},
    {"id": "ill", "kind": "tag", "text": "Illustration", "t0": cut("tease"), "t1": round(ENDSHOW - 0.3, 4), "slot": "tr"},
]
SPINE = [{"t0": round(cut("normal") + 0.2, 4), "t1": round(cut("why") - 0.35, 4), "label": "pitch of the filling cup", "unit": "Hz", "dp": 0, "kind": "mug"},
         {"t0": RISE_T, "t1": round(cut("measure") - 0.3, 4), "label": "pitch of the filling cup", "unit": "Hz", "dp": 0, "kind": "mug"},
         {"t0": cut("measure"), "t1": round(cut("tease") - 0.3, 4), "label": "pitch of the filling cup", "unit": "Hz", "dp": 0, "kind": "mug", "lit": [A("vo06:nearly"), cut("takeaway")]}]
SPINE_AT = [[-1e9, [0.5, 0.262]]]


def view(look, dist, pitch_=0.0, yaw=0.0, fov=32.0):
    return {"look": [round(v, 3) for v in look], "dist": round(dist, 2), "yaw": yaw, "pitch": pitch_, "fov": fov}


def key(t, v, ease="p2"):
    return {"t": round(t, 4), **v, "ease": ease}


MUGV = view([0.0, 4.1, 0.0], 59.0, 6.0)
CAM = {
    "hook": [key(0.0, {**MUGV, "yaw": -5.0}), key(cut("normal"), {**MUGV, "yaw": 3.0}, "sine")],
    "normal": [key(cut("normal"), {**MUGV, "yaw": 3.0}), key(cut("change"), {**MUGV, "yaw": -4.0}, "sine")],
    "change": [key(cut("change"), {**MUGV, "yaw": -4.0}), key(cut("why"), {**MUGV, "yaw": 4.0}, "sine")],
    "why": [key(cut("why"), {**MUGV, "yaw": -4.0}), key(RISE_T - 0.01, {**MUGV, "yaw": 4.0}, "sine")],
    "rise": [key(RISE_T, {**MUGV, "yaw": 4.0}), key(cut("whoa"), {**MUGV, "yaw": -3.0}, "sine")],
    "whoa": [key(cut("whoa"), {**MUGV, "yaw": -3.0}), key(cut("measure"), {**MUGV, "yaw": 4.0}, "sine")],
    "measure": [key(cut("measure"), {**MUGV, "yaw": 4.0}), key(cut("takeaway"), {**MUGV, "yaw": -4.0}, "sine")],
    "takeaway": [key(cut("takeaway"), {**MUGV, "yaw": -4.0}), key(cut("tease"), {**MUGV, "yaw": 5.0}, "sine")],
    "tease": [key(cut("tease"), {**MUGV, "look": [0.0, 3.0, 0.0], "yaw": 0.0, "pitch": 4.0}), key(DUR, {**MUGV, "look": [0.0, 3.0, 0.0], "yaw": 0.0, "pitch": 4.0, "dist": 62.0}, "sine")],
}
SHOTS = sorted([{"at": CUTS[b["id"]], "name": b["id"]} for b in BEATS] + [{"at": RISE_T, "name": "rise"}], key=lambda x: x["at"])
TITLE = {"series": "Reality Rulebook · Season 2 · Episode 5", "title": "Listen to the cup *fill*", "t1": round(cut("normal") - 0.45, 4), "y": 0.183, "sig": -0.7}
film = {
    "id": "reality-rulebook-s2e05", "fps": FPS, "bpm": BPM, "dur": DUR, "poster": 0.0,
    "_doc": "Compiled by compile.py from script.md, vo/ and the direction in compile.py. Do not edit by hand.",
    "shots": SHOTS, "beats": BEATS, "cue": {"cuts": CUTS, "pipes": PIPE_W, "chart": CHART_W}, "spine": SPINE, "spineAt": SPINE_AT,
    "mug": {"R": MUG_R, "H": MUG_H, "c": C_CM, "beta": BETA, "slow": SLOW}, "level": LEVEL, "pipes": PIPES,
    "labels": LABELS, "badges": BADGES, "cam": CAM, "captionY": 0.655, "title": TITLE,
    "captions": [pg for pg in phrase_captions(f, max_chars=24, fix=[], until=ENDSHOW - 0.3) if pg["t0"] < ENDSHOW - 0.35], "endShow": ENDSHOW, "tagT": [round(A("vo06:ten"), 4), round(A("vo06:nearly"), 4)], "riseT": RISE_T, "fluteT": FLUTE_T, "endCard": EC,
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
ev.append({"t": SPINE[1]["t0"], "kind": "counter.show", "tag": "spine2"})
ev.append({"t": SPINE[2]["t0"], "kind": "counter.show", "tag": "spine3"})
ev.append({"t": 0.0, "kind": "signature", "tag": "title", "gain": -4.0})
ev.append({"t": ENDSHOW, "kind": "signature", "tag": "end"})
sheet = {"duration": DUR, "fps": FPS, "preset": "restframe-bench", "duck_db": -9.0,
         "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: (e["t"], e["kind"])),
         "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}
(HERE / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False, allow_nan=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
print(f"film.json: {len(SHOTS)} shots, {len(LABELS)} labels, {len(film['captions'])} caption pages, end card {EC} s, {DUR} s; pitch {pitch(0):.0f} -> {pitch(8):.0f} Hz")
for b in BEATS:
    print(f"  {b['id']:<9} {b['t0']:6.2f}–{b['t1']:6.2f}")
