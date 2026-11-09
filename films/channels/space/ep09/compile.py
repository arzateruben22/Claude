"""Compile One More Orbit, Season 2 · Episode 3 (folder ep09), "Your gold": script + voice timings + this direction → film.json and sheet.json.
Every moment hangs on a beat or a spoken word; every number on screen comes from claims.json.

  python3 -I films/channels/space/ep09/compile.py

One 3-D world (not to scale, badged): two neutron stars, a jeweller's ring at (22, -4, 14), and the camera moving between them.
Hook: the stars in a tight orbit, gold beads streaming toward the ring (a teaser of the payoff). Normal: a flat 2-D explainer
(periodic table, a nucleus soaking up neutrons) over a dip to black. Change and why: the stars spiral together (lilac gravitational
ripples), merge on "A crash throws out hot matter" (c6), the ejecta cool (hot white to pale gold), beads of gold leave the cloud.
Whoa: the camera follows the beads to the ring and the ring takes them (c8). Readout: the ripples (lilac) leave first, the light
(teal) hours later (c13, c21). The last frame is frame 0's pose (a replay loops). Gold is drawn pale lemon: the channel has no gold.
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
ID = "one-more-orbit-s2e03"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}
t_n, t_c, t_why, t_w, t_tk, t_rd = (B[k]["t0"] for k in ("normal", "change", "why", "whoa", "takeaway", "readout"))
t_end = A("vo08:Next", -0.25)
CUE = {
    "n": t_n, "c": t_c, "why": t_why, "w": t_w, "tk": t_tk, "rd": t_rd, "end": t_end,
    "heavier": A("vo02:heavier"), "soak": A("vo02:soaking"), "neutrons": A("vo02:neutrons"), "fast": A("vo02:fast"), "packed": A("vo02:packed"),
    "crashing": A("vo03:crashing"), "y2017": A("vo03:seventeen"), "light": A("vo03:light"),
    "city": A("vo04:city"), "heavierS": A("vo04:heavier"), "crash": A("vo04:crash"), "throws": A("vo04:throws"), "debate": A("vo04:debated"),
    "zoom": A("vo05:Zoom"), "ring": A("vo05:ring"), "like": A("vo05:like"), "somewhere": A("vo05:somewhere"), "souv": A("vo05:souvenir"),
    "left": A("vo06:leftovers"), "chem": A("vo06:chemistry"),
    "rip": A("vo07:ripples"), "first": A("vo07:first"), "vis": A("vo07:flash"), "glow": A("vo07:glow"), "sec": A("vo07:seconds"), "hours": A("vo07:hours"),
}
CUE["spiral0"] = round(t_c + 0.4, 4)
CUE["tm"] = CUE["crash"]                          # the merger happens as the narration says "A crash throws out hot matter"
assert CUE["spiral0"] < CUE["crashing"] < CUE["y2017"] < CUE["tm"] < CUE["debate"] < CUE["zoom"], CUE
CUE["pulses"] = [round(x, 3) for x in (A("vo01:gold"), A("vo01:up"), A("vo02:neutrons"), A("vo03:crashing"), A("vo03:light"), A("vo04:city"), A("vo04:throws"),
                                       A("vo05:ring"), A("vo05:somewhere"), A("vo06:crash"), A("vo06:chemistry"), A("vo07:first"), A("vo07:hours"), A("vo08:black"))]

RING, ORIGIN, MID = [9, -3, 6], [0, 0, 0], [5.0, -2.2, 3.4]
POSE = {"target": ORIGIN, "el": 16.0, "fov": 24, "fx": 0.5, "fy": 0.40}
key = lambda t, **k: {"t": round(t, 4), **POSE, **k}
SPACE = [key(0.0, target=MID, dist=66.0, az=-28.0, el=16.0),
         key(t_n - 0.2, target=MID, dist=64.0, az=-24.0, ease="sine"),
         key(t_c, target=ORIGIN, dist=74.0, az=-22.0, el=18.0),
         key(CUE["crashing"], dist=56.0, az=-17.0, ease="sine"),
         key(CUE["y2017"] + 1.0, dist=72.0, az=-12.0, ease="sine"),
         key(t_why, dist=46.0, az=-8.0, el=14.0, ease="sine"),
         key(CUE["tm"] - 0.2, dist=36.0, az=-4.0, ease="sine"),
         key(CUE["tm"] + 2.0, dist=44.0, az=8.0, el=22.0, ease="sine"),
         key(CUE["debate"], target=[2, -0.6, 1.4], dist=48.0, az=16.0, el=24.0, ease="sine"),
         key(CUE["zoom"] - 0.1, target=[2, -0.6, 1.4], dist=48.0, az=18.0, el=24.0, ease="sine"),
         key(CUE["zoom"] + 2.9, target=RING, dist=22.0, az=36.0, el=20.0, ease="inout3"),
         key(CUE["ring"] + 1.8, target=RING, dist=19.0, az=52.0, el=18.0, ease="sine"),
         key(CUE["somewhere"], target=RING, dist=13.5, az=62.0, el=20.0, ease="sine"),            # push in: the beads arrive and the ring glints
         key(CUE["souv"], target=RING, dist=17.0, az=82.0, el=32.0, ease="sine"),                 # a higher angle for "souvenir"
         key(t_tk, target=RING, dist=21.0, az=94.0, el=24.0, ease="sine"),
         key(A("vo06:crash"), target=RING, dist=12.0, az=104.0, el=16.0, ease="sine"),            # close on the metal for "a star crash"
         key(CUE["chem"], target=RING, dist=26.0, az=116.0, el=8.0, ease="sine"),                 # pull back low for "chemistry"
         key(t_rd - 0.1, target=RING, dist=20.0, az=120.0, el=14.0, ease="sine"),
         key(t_rd + 2.2, target=[6, -5, 4], dist=50.0, az=40.0, el=28.0, ease="inout3"),
         key(t_end, target=[6, -5, 4], dist=54.0, az=44.0, el=28.0, ease="sine"),
         key(f.duration, target=MID, dist=66.0, az=-28.0, el=16.0)]
CAM = {"space": SPACE, "end": SPACE}
SHOTS = [{"at": 0.0, "name": "space"}, {"at": t_end, "name": "end"}]
CUE["dip"] = [round(t_n - 0.15, 4), round(t_c - 0.12, 4), round(t_end - 0.15, 4)]    # dips to black: hook → table, table → stars, and the loop back to frame 0

# ── overlay ──────────────────────────────────────────────────────────────────
SPINE = [0.5, 0.555]
LABELS = [
    {"id": "l-nsA", "text": "neutron star", "kind": "body", "anchor": "starA", "t0": round(CUE["spiral0"] + 0.5, 4), "t1": round(CUE["crashing"] + 1.5, 4), "side": -1, "v": "above", "fixed": True},
    {"id": "l-nsB", "text": "neutron star", "kind": "body", "anchor": "starB", "t0": round(CUE["spiral0"] + 0.5, 4), "t1": round(CUE["crashing"] + 1.5, 4), "side": 1, "v": "below", "fixed": True},
    {"id": "l-bead", "text": "a bead of gold", "kind": "star", "anchor": "bead", "t0": round(CUE["throws"] + 3.0, 4), "t1": round(CUE["debate"] - 0.3, 4), "side": -1, "v": "above", "fixed": True},
    {"id": "l-ring", "text": "your ring", "kind": "star", "anchor": "ring", "t0": round(CUE["ring"] - 0.2, 4), "t1": round(t_tk + 3.0, 4), "side": 1, "v": "above", "fixed": True},
]
PILLS = [
    {"id": "p-table", "text": "neutron capture (illustration)", "t0": round(t_n + 0.4, 4), "t1": round(t_c - 0.3, 4), "at": [90 / 1080, 0.165]},
    {"id": "p-city", "text": "Manhattan Island (length) = a neutron star (width)", "t0": round(CUE["city"] - 0.4, 4), "t1": round(CUE["tm"] - 0.3, 4), "at": [90 / 1080, 0.165]},
    {"id": "p-debate", "text": "how much from crashes? debated", "t0": round(CUE["debate"] - 0.3, 4), "t1": round(CUE["zoom"] - 0.2, 4), "at": [90 / 1080, 0.165]},
    {"id": "p-hours", "text": "times not to scale", "t0": round(CUE["rip"] - 0.2, 4), "t1": round(t_end - 0.45, 4), "at": [90 / 1080, 0.165]},
]
BADGES = [
    {"id": "b-nts", "text": "not to scale", "t0": round(CUE["spiral0"] + 0.3, 4), "t1": round(CUE["zoom"] - 0.2, 4), "slot": "tr"},
    {"id": "b-illus", "text": "illustration", "t0": round(CUE["zoom"], 4), "t1": round(t_rd - 0.2, 4), "slot": "tr"},
]
COUNTERS = [
    {"id": "c-hook", "label": "gold: from where?", "text": "?", "t0": 0.0, "t1": t_n},
    {"id": "c-heavy", "label": "gold is", "text": "heavier than iron", "t0": CUE["heavier"], "t1": CUE["fast"]},
    {"id": "c-fast", "label": "one way: the fast way", "text": "packed with neutrons", "t0": CUE["fast"], "t1": t_c},
    {"id": "c-2017", "label": "a neutron-star merger seen", "text": "2017", "t0": CUE["y2017"], "t1": t_why},
    {"id": "c-city", "label": "a neutron star's width", "text": "about a city", "t0": CUE["city"], "t1": CUE["tm"] - 0.4},
    {"id": "c-atoms", "label": "the crash makes", "text": "heavy atoms", "t0": CUE["tm"], "t1": CUE["debate"] - 0.4},
    {"id": "c-gold", "label": "some of your ring's gold", "text": "may be from a crash", "t0": CUE["like"], "t1": t_tk},
    {"id": "c-chem", "label": "stardust is", "text": "chemistry", "t0": CUE["chem"], "t1": t_rd},
    {"id": "c-read-gw", "label": "light time · the ripples", "text": "first", "read": True, "t0": CUE["rip"], "t1": round(CUE["vis"] - 0.05, 4)},
    {"id": "c-read-gr", "label": "light time · the gamma-ray flash", "text": "1.7 seconds later", "read": True, "t0": CUE["vis"], "t1": round(CUE["glow"] - 0.05, 4)},
    {"id": "c-read-li", "label": "light time · the glow, found by telescopes", "text": "hours later", "read": True, "t0": CUE["glow"], "t1": round(t_end - 0.45, 4)},
]
for c in COUNTERS:
    c.setdefault("at", SPINE)
spine = [c for c in COUNTERS if c["at"] == SPINE]
for a, b in zip(spine, spine[1:]):
    if b["t0"] - a["t1"] < 0.4:
        a["t1"] = round(b["t0"] - 0.4, 4)

TITLE = {"series": "One More Orbit · S2E03", "title": "Your *gold*", "t1": t_n - 0.5, "sig": A("line:vo01:end", 0.05)}
END = {"title": "Next orbit: the *black hole* edge", "follow": "One More Orbit · S2 · Episode 4",
       "next": "GW170817 (2017): the first merger seen in both ripples and light (NASA)."}
POSTER = A("vo05:ring", 1.0)
glue(f, {"vo02": ["soaking up neutrons."], "vo03": ["twenty seventeen,"], "vo04": ["about as wide as a city,", "still debated."], "vo06": ["a star crash."], "vo07": ["came first.", "seven seconds later.", "hours after."], "vo08": ["Next: what happens", "at the edge of", "a black hole?"]})
LOOP0 = round(f.duration - 0.6, 4)
film = {
    "loop0": LOOP0, "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": POSTER,
    "shots": SHOTS, "beats": BEATS, "cam": CAM, "cue": CUE, "ring": RING,
    "labels": LABELS, "badges": BADGES, "counters": COUNTERS, "pills": PILLS,
    "title": TITLE, "endCard": t_end, "end": END,
    "captions": hold(f, keep_units(f.captions(max_chars=26, written=False))),
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}
ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS]
ev.append({"t": TITLE["sig"], "kind": "signature", "tag": "title"})
ev.append({"t": t_end, "kind": "signature", "tag": "end"})
ev += [{"t": L["t0"], "kind": "label", "tag": L["id"]} for L in LABELS if L["t0"] > 0]
ev += [{"t": c["t0"], "kind": "counter.show", "tag": c["id"]} for c in COUNTERS if c["t0"] > 0]
ev += [{"t": b["t0"], "kind": "badge", "tag": b["id"]} for b in BADGES if b["t0"] > 0]
ev += [{"t": CUE["tm"], "kind": "merge", "tag": "merger"}, {"t": CUE["rip"], "kind": "light.front", "tag": "ripples"}, {"t": CUE["vis"], "kind": "light.front", "tag": "light"}]
sheet = {"duration": f.duration, "fps": FPS, "preset": "lightminute-vacuum",
         "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: e["t"]), "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}
(HERE / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
print(f"film.json: {f.duration:.2f} s; spiral {CUE['spiral0']:.2f}, merger {CUE['tm']:.2f}, ring {CUE['ring']:.2f}; end card {t_end:.2f}")
print(f"sheet.json: {len(sheet['events'])} events")
