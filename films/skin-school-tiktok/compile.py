"""Compile the film: script + voice timings + this direction → film.json (the scene's clock:
shots, event table, camera and focus keys, captions, end card) and sheet.json (the studio's cue
sheet). Nothing here is a hand-typed time: every moment hangs on a beat or a spoken word.

  python3 -I films/skin-school-tiktok/compile.py

Anchors: "vo02:hair" is when "hair" starts in line vo02; "vo03:shut:end" its end; "#2" the second
match; "beat:clog" a beat's start. See kits/cinema/script/timeline.py.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent / "kits/cinema/script"))
from timeline import Film   # noqa: E402

FPS, BPM, DUR = 30, 90, 60.0
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
# pre: lead-in before the line; hold: picture-only time after it (the music comes forward)
BEATS = f.layout({
    "hook":    {"pre": 0.35, "hold": 0.6, "energy": 0.5},
    "healthy": {"pre": 0.3, "hold": 1.2, "energy": 0.45},
    "clog":    {"pre": 0.3, "hold": 2.8, "energy": 0.5},
    "inflame": {"pre": 0.3, "hold": 3.8, "energy": 0.55},
    "clear":   {"pre": 0.3, "hold": 4.4, "energy": 0.6},
    "time":    {"pre": 0.3, "hold": 0.5, "energy": 0.4},
}, end_hold=3.0, total=DUR)
A = f.at

# her scene has four shots; hook + healthy play in her first, clear + time in her last
SHOT_AT = [0.0, A("beat:clog"), A("beat:inflame"), A("beat:clear")]
SHOTS = [{"at": t, "name": n, "cap": ""} for t, n in zip(SHOT_AT, ["healthy", "clog", "inflame", "clear"])]


def loc(shot, t):
    """Film seconds → that shot's local seconds (her event table is per shot)."""
    return round(t - SHOT_AT[shot], 4)


mand_land, bp_land = A("vo05:Mandelic", -0.15), A("vo05:Benzoyl", -0.15)
CUE = {
    "oilOff": [0, 1.5],
    "fill": [loc(1, A("vo03:dead")), loc(1, A("vo03:shut:end", 0.3))],
    "oxidize": [loc(1, A("vo03:oxidizes")), loc(1, A("vo03:blackhead", 0.4))],
    # the whitehead: a skin cap slides over the mouth, the dark top fades pale, then it slides back off
    "cap": {"in": [loc(1, A("vo03:Closed")), loc(1, A("vo03:Closed", 0.7))],
            "pale": [loc(1, A("vo03:pale", -0.1)), loc(1, A("vo03:pale", 0.5))],
            "out": [loc(1, A("vo03:whitehead:end", 1.2)), loc(1, A("vo03:whitehead:end", 2.0))]},
    "bact": [loc(2, A("vo04:Bacteria")), loc(2, A("vo04:swells"))],
    "red": [loc(2, A("vo04:wall")), loc(2, A("vo04:pustule:end", 1.6))],
    "bactOut": [loc(3, A("vo05:clears")), loc(3, A("vo05:clears", 1.8))],
    "redOut": [loc(3, A("vo05:bacteria", -0.3)), loc(3, A("vo05:bacteria", 2.9))],
    "clear": [loc(3, A("vo05:keeps")), loc(3, A("vo05:Benzoyl", -0.4))],
    "mand": [loc(3, mand_land - 0.9), loc(3, mand_land), loc(3, mand_land + 2.8), loc(3, mand_land + 4.0)],
    "bp": [loc(3, bp_land - 0.8), loc(3, bp_land), loc(3, bp_land + 1.8), loc(3, bp_land + 2.8)],
    # weeks: 0 → 8 while "give it time … at", 8 → 12 between "eight" and "twelve"; 8–12 lit
    "weeks": [[loc(3, A("vo06:give")), 0], [loc(3, A("vo06:eight")), 8], [loc(3, A("vo06:twelve")), 12]],
    "labels": [
        [["l-hair", loc(0, A("vo02:hair"))], ["l-gland", loc(0, A("vo02:gland"))], ["l-oil", loc(0, A("vo02:oil#2"))]],
        [["l-plug", loc(1, A("vo03:cells"))], ["l-black", loc(1, A("vo03:blackhead"))], ["l-white", loc(1, A("vo03:whitehead"))]],
        [["l-bact", loc(2, A("vo04:Bacteria"))], ["l-red", loc(2, A("vo04:red"))]],
        [["l-mand", loc(3, A("vo05:Mandelic"))], ["l-bp", loc(3, A("vo05:Benzoyl"))], ["dayc", loc(3, A("vo06:Then"))]],
    ],
}

# camera keys: her pilot's framings, re-timed to the words (portrait: the scene widens them itself)
CAM = [
    {"t": 0.0, "pos": [4.2, 17.4, 11.6], "look": [0.1, 14.4, 3.4], "fov": 30},                                       # frame 0: the pore mouth, oil glowing
    {"t": A("vo01:Let's", -0.1), "pos": [2.8, 16.4, 9.0], "look": [0.0, 14.0, 3.5], "fov": 29, "ease": "sine"},     # a slow push while it's named
    {"t": A("vo01:inside:end", 0.25), "pos": [0.5, 14.8, 7.4], "look": [0.0, 11.4, 3.5], "fov": 33, "ease": "p3"},  # the dive into the mouth
    {"t": A("vo02:hair"), "pos": [5.2, 13.2, 17.0], "look": [0.4, 11.4, 3.3], "fov": 32, "ease": "p3"},           # crane back into the section
    {"t": A("vo02:gland"), "pos": [7.4, 11.2, 21.8], "look": [0.8, 9.6, 3.2], "fov": 32, "ease": "sine"},
    {"t": A("vo02:moving"), "pos": [8.6, 12.2, 24.8], "look": [0.6, 10.6, 3.2], "fov": 32, "ease": "sine"},
    {"t": A("beat:clog", -0.1), "pos": [6.2, 11.4, 22.4], "look": [0.3, 11.0, 3.4], "fov": 32, "ease": "sine"},
    {"t": A("vo03:dead", 0.3), "pos": [1.8, 11.9, 12.6], "look": [0.0, 11.2, 3.5], "fov": 30, "ease": "p3"},       # push into the slot
    {"t": A("vo03:shut"), "pos": [-1.2, 12.2, 12.4], "look": [0.0, 11.4, 3.5], "fov": 30, "ease": "sine"},
    {"t": A("vo03:oxidizes"), "pos": [-1.4, 15.4, 10.6], "look": [0.0, 13.1, 3.5], "fov": 30, "ease": "p2"},       # tilt up to the top of the plug
    {"t": A("vo03:whitehead:end", 0.6), "pos": [-0.4, 15.9, 10.2], "look": [0.0, 13.3, 3.5], "fov": 30, "ease": "sine"},
    {"t": A("beat:inflame", 0.1), "pos": [0.2, 15.7, 10.4], "look": [0.0, 13.2, 3.5], "fov": 30, "ease": "sine"},
    {"t": A("vo04:Bacteria", 0.4), "pos": [7.8, 16.8, 18.6], "look": [0.0, 12.8, 3.0], "fov": 32, "ease": "p3"},   # pull back for the bacteria
    {"t": A("vo04:red"), "pos": [5.0, 15.8, 14.8], "look": [0.0, 12.8, 3.5], "fov": 30, "ease": "sine"},          # then a slow push
    {"t": A("beat:clear", -0.2), "pos": [3.6, 15.2, 12.6], "look": [-0.6, 13.0, 3.5], "fov": 30, "ease": "sine"},
    {"t": mand_land - 0.7, "pos": [3.6, 19.6, 17.6], "look": [0.0, 16.4, 3.5], "fov": 34, "ease": "p3"},           # crane over the first drop
    {"t": mand_land + 0.5, "pos": [2.4, 16.8, 10.8], "look": [0.0, 13.9, 3.2], "fov": 30, "ease": "p3"},           # in on its beads
    {"t": mand_land + 1.7, "pos": [1.6, 16.2, 10.2], "look": [0.0, 13.2, 3.4], "fov": 30, "ease": "sine"},
    {"t": bp_land - 0.7, "pos": [4.2, 18.8, 18.4], "look": [0.2, 15.8, 3.5], "fov": 34, "ease": "p2"},             # back out for the second
    {"t": bp_land + 0.5, "pos": [2.6, 16.9, 11.6], "look": [0.5, 13.9, 3.3], "fov": 31, "ease": "p3"},
    {"t": A("vo05:bacteria:end", 1.6), "pos": [2.2, 16.2, 11.2], "look": [0.3, 12.9, 3.4], "fov": 31, "ease": "sine"},
    {"t": A("vo06:Then", 0.2), "pos": [10.4, 14.6, 29.0], "look": [0.3, 10.4, 1.6], "pl": [0.3, 7.4, 1.6], "fov": 32, "ease": "p3"},   # the hero wide
    {"t": DUR, "pos": [9.8, 14.2, 27.8], "look": [0.3, 10.4, 1.6], "pl": [0.3, 7.4, 1.6], "fov": 32, "ease": "sine"},
]
FOC = [
    {"t": 0.0, "at": [0.1, 13.6, 3.5], "f": 0.55},
    {"t": A("vo01:inside"), "at": [0.0, 11.5, 3.5], "f": 0.4},
    {"t": A("vo02:hair", -0.2), "at": [0.4, 15.5, 3.5], "f": 0.4},
    {"t": A("vo02:gland", -0.2), "at": [2.5, 6.8, 4.0], "f": 0.32},
    {"t": A("vo02:oil#2", -0.2), "at": [0.0, 11.0, 3.5], "f": 0.36},
    {"t": A("vo03:dead"), "at": [0.5, 11.2, 3.6], "f": 0.48},
    {"t": A("vo03:oxidizes", -0.2), "at": [0.0, 13.2, 3.6], "f": 0.5},
    {"t": A("vo04:Bacteria", -0.3), "at": [0.3, 11.5, 3.5], "f": 0.38},
    {"t": A("vo04:red", -0.2), "at": [-2.4, 13.4, 3.6], "f": 0.38},
    {"t": mand_land - 1.0, "at": "mand", "f": 0.45},
    {"t": bp_land - 1.0, "at": "bp", "f": 0.45},
    {"t": A("vo06:Then"), "at": [0.3, 9.5, 3.0], "f": 0.22},
]

film = {"id": "skin-school-pore", "fps": FPS, "bpm": BPM, "dur": DUR, "poster": A("vo02:gland", 0.6),
        "shots": SHOTS, "beats": BEATS, "cue": CUE, "cam": CAM, "foc": FOC,
        "captions": f.captions(), "endCard": f.end_card,
        "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines]}

# ── the studio's cue sheet: the same moments as sound events ─────────────
ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS]
for k, row in enumerate(CUE["labels"]):
    for tag, t in row:
        ev.append({"t": SHOT_AT[k] + t, "kind": "counter.show" if tag == "dayc" else "label", "tag": tag})
n = 20
for k in range(n):
    f0, f1 = CUE["fill"]
    ev.append({"t": SHOT_AT[1] + f0 + (0.8 * k / n + 0.2) * (f1 - f0), "kind": "cell.land", "tag": f"cell{k}"})   # as scene.mjs lands them
ev.append({"t": SHOT_AT[1] + CUE["oxidize"][0], "kind": "oxidize", "t1": SHOT_AT[1] + CUE["oxidize"][1]})
for k in range(14):
    b0, b1 = CUE["bact"]
    ev.append({"t": SHOT_AT[2] + b0 + (b1 - b0) * k / 14, "kind": "bacteria.pop", "tag": f"b{k}"})
ev.append({"t": SHOT_AT[2] + CUE["red"][0], "kind": "swell", "t1": SHOT_AT[2] + CUE["red"][1]})
for tag in ("mand", "bp"):
    d = CUE[tag]
    ev.append({"t": SHOT_AT[3] + d[0], "kind": "drop.fall", "tag": tag, "t1": SHOT_AT[3] + d[1]})
    ev.append({"t": SHOT_AT[3] + d[1], "kind": "drop.land", "tag": tag})
ev.append({"t": SHOT_AT[3] + CUE["clear"][0], "kind": "dissolve", "t1": SHOT_AT[3] + CUE["clear"][1]})
ev.append({"t": SHOT_AT[3] + CUE["bactOut"][0], "kind": "bacteria.fade", "t1": SHOT_AT[3] + CUE["bactOut"][1]})
(w0, _), (w8, _), (w12, _) = CUE["weeks"]
for wk in range(1, 13):                      # each week number first shows when the count reaches it
    t = w0 + (w8 - w0) * (wk - 0.5) / 8 if wk <= 8 else w8 + (w12 - w8) * (wk - 8 - 0.5) / 4
    ev.append({"t": SHOT_AT[3] + max(t, w0), "kind": "counter.end" if wk == 12 else "counter.tick", "tag": f"w{wk}"})
sheet = {"duration": DUR, "fps": FPS, "preset": "lumevina-dew", "duck_db": -9.0,
         "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: e["t"]),
         "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}

(HERE / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
print(f"film.json: {len(SHOTS)} shots, {len(CAM)} camera keys, {len(FOC)} focus keys, {len(film['captions'])} caption pages, end card {f.end_card} s")
print(f"sheet.json: {len(sheet['events'])} events, {len(sheet['voice'])} voice lines, {DUR} s")
for b in BEATS:
    print(f"  {b['id']:<8} {b['t0']:6.2f}–{b['t1']:6.2f}  line {b['line']}")
