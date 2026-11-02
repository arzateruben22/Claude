"""Compile Back of the Envelope No. 002, "Everyone, one place": script + voice timings + this direction →
film.json and sheet.json. Every moment hangs on a beat or a spoken word (kits/cinema/script/timeline.py), and
every number comes from calc.py, the module claims.json was written from.

  python3 -I films/channels/whatif/ep02/compile.py

The world (scene.mjs, ../set): the graph-paper desk at true scale (1 unit = 1 m). One blue figure (you) stands
in a chalk square half a square metre across; the crowd (set/crowd.js, one dot a person at 2 per m²) grows out
from them until it is 64 km a side, while the camera rises on a log dolly. Then the same desk holds Greater
London-sized squares, then the planet (the episode's one cut, a scale jump to the globe model with everyone as
one marker dot), then a cube of everyone's bodies beside a 828 m tower, then back down to the one figure (the
loop). Ep01's lesson (the compelling pass): the picture changes scale or framing with every new idea.
"""
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[3] / "kits/cinema/script"))
sys.path.insert(0, str(HERE))
from timeline import Film   # noqa: E402
from calc import V, RESULTS, A_LONDON, H_BURJ   # noqa: E402

FPS, BPM = 30, 50                         # bible §3: A lydian at 50 BPM (a 16th = 9 frames)
ID = "envelope-002"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}

SIDE_ONE = math.sqrt(0.5)                 # m: half a square metre, as a square
SIDE_ALL = V["side_safe_km"] * 1000.0     # m: everyone at 2 per m² (64 km)
SIDE_TIGHT = SIDE_ALL / math.sqrt(2)      # m: twice as close (4 per m²)
SIDE_LON = math.sqrt(A_LONDON) * 1000.0   # m: a square with Greater London's area
CUBE = V["cube_m"]
R_EARTH = 6.371e6
assert RESULTS["side_safe_km"] == 64 and abs(CUBE - 798) < 2

# ── the story's moments ────────────────────────────────────────────────────
t_title_out = B["normal"]["t0"] - 0.2
t_full = A("vo02:full", -0.1)             # a glimpse of a packed street, then back to you
t_half = A("vo02:half", -0.05)            # the half-square-metre square is drawn round you
t_grow0 = A("vo03:bring", -0.1)           # the crowd starts to grow on "bring everyone in"
t_grow1 = A("vo03:hour", -0.1)            # it settles at 64 km on "hour"
t_squeeze = A("vo04:squeeze", -0.05)      # the square shrinks to twice as close
t_danger = A("vo04:dangerous", -0.05)     # hatching: too tight
t_room = A("vo04:keep", -0.1)             # back to the room
t_lon = A("vo04:Londons", -0.25)          # Greater London squares drawn beside the crowd
t_orbit = A("vo05:From", -0.15)           # the scale jump to the planet
t_water = A("vo05:packed", -0.15)         # match cut: the marker dot → the cube on the desk
t_tower = A("vo05:tallest", -0.1)         # the tower rises beside it
t_work0 = B["work"]["t0"]
t_full2 = A("vo07:full", -0.1)
t_city = A("vo07:city", -0.1)
t_end = A("vo08:Next", -0.25)
SHOTS = [
    {"at": 0.0, "name": "you"},                       # hook and normal: you, then the crowd begins
    {"at": t_grow0, "name": "grow"},                  # change and why: the crowd at true scale, the camera rising
    {"at": t_orbit, "name": "orbit"},                 # whoa: the planet, everyone one dot
    {"at": t_water, "name": "cube"},                  # whoa, work: the cube beside the tower
    {"at": B["takeaway"]["t0"], "name": "home"},      # takeaway: back down to you (the loop)
    {"at": t_end, "name": "end"},
]

# ── the crowd's side over time (m), and the density (per m²) ───────────────
# grows log-linearly from your own square to everyone between "bring" and "hour"; the squeeze halves the area
CROWD = {"keys": [[0.0, SIDE_ONE], [1.8, 6.0], [t_half - 0.8, 6.0], [t_half, SIDE_ONE],   # people gather round you as the question is asked (motion from frame 0)
                   [t_half + 1.2, 3.2], [t_grow0, 3.2], [t_grow1, SIDE_ALL],
                  [t_squeeze, SIDE_ALL], [t_squeeze + 1.2, SIDE_TIGHT], [t_room, SIDE_TIGHT], [t_room + 1.0, SIDE_ALL],
                  [t_end + 0.6, SIDE_ALL], [B["tease"]["t1"] - 0.3, SIDE_ONE]],      # under the end card the crowd folds back to you: the loop
         "density": [[0.0, 2.0], [t_squeeze, 2.0], [t_squeeze + 1.2, 4.0], [t_room, 4.0], [t_room + 1.0, 2.0]],
         "hatch": [t_danger, t_room + 0.6], "full": [t_full, t_half]}

# ── the camera (rig.js keys; distances in metres, eased in log space) ───────
YOU = {"target": [0, 0.8, 0], "dist": 9.5, "el": 40, "az": 20, "fov": 30, "fy": 0.4}
YOU0 = {**YOU, "dist": 13, "az": 8}                 # frame 0 and the last frame: the push-in starts at once (review: first 2 s)
CAM = {
    "you": [
        {"t": 0.0, **YOU0},
        {"t": t_title_out, **YOU, "ease": "out2"},
        {"t": t_full, **YOU, "dist": 30, "el": 52, "az": 24, "ease": "inout3"},           # a glimpse of a crowded street
        {"t": t_half, **YOU, "dist": 7, "el": 50, "az": 22, "ease": "inout3"},           # in to your half a square metre
        {"t": t_grow0, **YOU, "dist": 9, "el": 55, "az": 24, "ease": "sine"},
    ],
    "grow": [
        {"t": t_grow0, **YOU, "dist": 9, "el": 55, "az": 24},
        {"t": t_grow1, "target": [0, 0, 0], "dist": SIDE_ALL * 3.6, "el": 60, "az": 30, "fov": 30, "fy": 0.36, "ease": "inout2"},
        {"t": t_lon, "target": [0, 0, 0], "dist": SIDE_ALL * 3.8, "el": 62, "az": 32, "fov": 30, "fy": 0.36, "ease": "inout3"},
        {"t": t_orbit, "target": [0, 0, 0], "dist": SIDE_ALL * 4.2, "el": 63, "az": 33, "fov": 30, "fy": 0.36, "ease": "sine"},
    ],
    "orbit": [
        {"t": t_orbit, "target": [0, R_EARTH * 0.4, 0], "dist": 3.0e7, "el": 62, "az": 30, "fov": 30, "fy": 0.42},
        {"t": t_water - 0.2, "target": [0, R_EARTH * 0.2, 0], "dist": 4.6e7, "el": 50, "az": 32, "fov": 30, "fy": 0.4, "ease": "inout3"},
    ],
    "cube": [
        {"t": t_water, "target": [-150, 420, 0], "dist": 7600, "el": 4, "az": 3, "fov": 30, "fy": 0.4},
        {"t": t_work0, "target": [-150, 420, 0], "dist": 8200, "el": 4, "az": 2, "fov": 30, "fy": 0.46, "ease": "inout2"},
        {"t": B["takeaway"]["t0"], "target": [-150, 420, 0], "dist": 8000, "el": 4, "az": 1, "fov": 30, "fy": 0.46, "ease": "sine"},
    ],
    "home": [
        {"t": B["takeaway"]["t0"], "target": [0, 0, 0], "dist": SIDE_ALL * 6, "el": 55, "az": 30, "fov": 30, "fy": 0.36},
        {"t": t_city, **YOU, "dist": 11, "el": 44, "az": 22, "ease": "in3"},
        {"t": t_end, **YOU, "dist": 10, "el": 40, "az": 21, "ease": "sine"},
    ],
    "end": [
        {"t": t_end, **YOU, "dist": 10, "el": 40, "az": 21},
        {"t": B["tease"]["t1"], **YOU0},                         # the last frame is frame 0: the loop
    ],
}
for shot, keys in CAM.items():
    for a, b in zip(keys, keys[1:]):
        assert b["t"] > a["t"], (shot, a["t"], b["t"])

# ── the running sum ─────────────────────────────────────────────────────────
POP = "8.2 billion"
SPINE = [
    {"t": A("vo01:city", -0.05), "label": "the question", "terms": [["in", "everyone"], ["op", "→"], ["ans", "one city?"]]},
    {"t": t_half, "label": "standing comfortably", "terms": [["in", POP], ["op", "×"], ["assume", "½ m² each"]]},
    {"t": A("vo03:square", -0.05), "label": "everyone, side by side", "terms": [["in", POP], ["op", "×"], ["assume", "½ m²"], ["op", "≈"], ["ans", f"{RESULTS['area_safe_km2']:,.0f} km²"]]},
    {"t": t_grow1, "label": f"a square {RESULTS['side_safe_km']} km across", "terms": [["in", f"{RESULTS['area_safe_km2']:,.0f} km²"], ["op", "="], ["ans", f"{RESULTS['side_safe_km']} km × {RESULTS['side_safe_km']} km"]]},
    {"t": t_squeeze, "label": "twice as close: unsafe", "terms": [["assume", "4 per m²"], ["op", "→"], ["ans", f"≈ {RESULTS['area_tight_km2']:,.0f} km²"]]},
    {"t": t_room, "label": "back to a calm crowd", "terms": [["assume", "2 per m²"], ["op", "→"], ["ans", f"{RESULTS['area_safe_km2']:,.0f} km²"]]},
    {"t": t_lon, "label": "everyone, in Greater Londons (1,572 km² each)", "terms": [["in", f"{RESULTS['area_safe_km2']:,.0f} km²"], ["op", "≈"], ["ans", f"{RESULTS['londons_safe']} Londons"]], "box": True},
    {"t": t_orbit, "label": "of all Earth's land", "terms": [["ans", f"≈ {RESULTS['land_pct']}%"]]},
    {"t": t_water, "label": "every body, packed like water", "terms": [["in", POP], ["op", "×"], ["assume", "62 kg"], ["op", "≈"], ["ans", f"{RESULTS['vol_km3']} km³"]]},
    {"t": t_tower, "label": f"a cube shorter than {int(H_BURJ)} m", "terms": [["in", f"{RESULTS['vol_km3']} km³"], ["op", "="], ["ans", f"≈ {RESULTS['cube_m']:.0f} m cube"]], "box": True},
    {"t": B["takeaway"]["t0"], "label": "everyone, standing comfortably", "terms": [["in", f"{RESULTS['area_safe_km2']:,.0f} km²"], ["op", "≈"], ["ans", f"{RESULTS['londons_safe']} Londons"]], "box": True, "keep": True},
]
WORK = {
    "t0": t_work0, "t1": B["takeaway"]["t0"] - 0.1, "title": "Show your work",
    "rows": [
        {"t": t_work0 + 0.15, "k": "8.2 bn × 62 kg (adult avg.) ÷ water", "v": f"≈ {RESULTS['cube_m']:.0f} m cube", "lit": False},
        {"t": A("vo06:either", -0.05), "k": "bodies at 0.97 g/cm³", "v": f"≈ {V['cube_hi_m']:.0f} m", "lit": True},
        {"t": A("vo06:size", -0.6), "k": "bodies at 1.06 g/cm³", "v": f"≈ {V['cube_lo_m']:.0f} m", "lit": True},
    ],
    "assume": [],                                   # the assumptions are notes (badges) here, so the card stays short and clear of the cube
}

# ── the overlay ─────────────────────────────────────────────────────────────
LABELS = [
    {"id": "l-you", "text": "you", "kind": "anchor", "anchor": "you", "t0": t_title_out, "t1": t_full - 0.2, "shot": "you", "side": 1},
    {"id": "l-half", "text": "½ m²", "kind": "assume", "anchor": "half", "t0": t_half + 0.3, "t1": t_grow0, "shot": "you", "side": -1, "v": "above"},
    {"id": "l-lon", "text": "Greater London, 1,572 km²", "kind": "part", "anchor": "london", "t0": t_lon + 0.3, "t1": t_orbit, "shot": "grow", "side": 1},
    {"id": "l-us", "text": "everyone", "kind": "anchor", "anchor": "dot", "t0": t_orbit + 1.0, "t1": t_water, "shot": "orbit", "side": 1},
    {"id": "l-tower", "text": f"tallest tower, {int(H_BURJ)} m", "kind": "part", "anchor": "tower", "t0": t_tower + 0.2, "t1": t_work0 - 0.1, "shot": "cube", "side": 1},
    {"id": "l-cube", "text": "every body alive", "kind": "anchor", "anchor": "cube", "t0": A("vo05:cube", 0.1), "t1": t_work0 - 0.1, "shot": "cube", "side": -1, "v": "above"},
]
BADGES = [
    {"id": "b-safe", "text": "∵ 2 people per m² (a calm crowd)", "t0": t_half, "t1": t_orbit, "slot": "tl"},
    {"id": "b-ill", "text": "true sizes · tower drawn wider", "t0": t_orbit, "t1": B["takeaway"]["t0"], "slot": "tr"},
    {"id": "b-water", "text": "∵ bodies about as dense as water", "t0": t_water, "t1": B["takeaway"]["t0"], "slot": "tl"},
]
PILLS = [
    {"id": "p-side", "text": f"{RESULTS['side_safe_km']} km · about {round(V['side_safe_km'] / 100 * 60)} min at 100 km/h", "t0": t_grow1, "t1": t_squeeze, "at": [90 / 1080, 0.205]},
]

TITLE = {"series": "Back of the Envelope · No. 002", "title": "Everyone, *one place*", "sub": "a thought experiment", "t1": t_title_out, "sig": A("line:vo01:end", 0.05)}
END = {"title": "Next envelope: *all the ants*", "follow": "Back of the Envelope · No. 003",
       "next": "UN World Population Prospects 2024: about 8.2 billion people in mid-2024."}

CUE = {"full": t_full, "half": t_half, "grow": [t_grow0, t_grow1], "squeeze": t_squeeze, "danger": t_danger, "room": t_room,
       "london": t_lon, "orbit": t_orbit, "water": t_water, "tower": t_tower, "city": t_city}

film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": round(t_lon + 1.5, 4),
    "shots": SHOTS, "beats": BEATS,
    "phys": {"side_one": SIDE_ONE, "side_all": SIDE_ALL, "side_tight": SIDE_TIGHT, "side_lon": SIDE_LON, "londons": V["londons_safe"],
             "cube": CUBE, "cube_lo": V["cube_lo_m"], "cube_hi": V["cube_hi_m"], "tower": H_BURJ, "r_earth": R_EARTH},
    "crowd": CROWD, "cam": CAM, "cue": CUE, "spine": SPINE, "spineOut": t_end, "work": WORK,
    "labels": LABELS, "badges": BADGES, "counters": [], "pills": PILLS,
    "title": TITLE, "endCard": t_end, "end": END,
    "captions": f.captions(max_chars=24, balance=True, keep=("eight billion", "square meter", "two or three Londons", "tallest tower")),
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}

ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS if b["id"] != "tease"]
ev.append({"t": TITLE["sig"], "kind": "signature", "tag": "title"})
ev.append({"t": t_end, "kind": "signature", "tag": "end"})
for L in LABELS:
    ev.append({"t": L["t0"], "kind": "label", "tag": L["id"]})
for b in BADGES:
    ev.append({"t": b["t0"], "kind": "badge", "tag": b["id"]})
for p in PILLS:
    ev.append({"t": p["t0"], "kind": "scale", "tag": p["id"]})
for i, s in enumerate(SPINE):
    if i and s.get("keep"):
        continue
    ev.append({"t": s["t"], "kind": "answer.box" if s.get("box") else "term.write", "tag": f"spine-{i}", **({"t1": round(s["t"] + 0.5, 4)} if s.get("box") else {})})
for r in WORK["rows"]:
    ev.append({"t": r["t"], "kind": "term.write", "tag": f"work-{r['k']}"})
ev += [
    {"t": t_grow0, "kind": "scale.jump", "tag": "crowd-grows", "t1": t_grow1},
    {"t": t_orbit, "kind": "scale.jump", "tag": "to-orbit", "t1": t_water - 0.2},
    {"t": t_water, "kind": "arrive", "tag": "cube"},
]
sheet = {"duration": f.duration, "fps": FPS, "preset": "envelope-working",
         "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: e["t"]),
         "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}

(HERE / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
print(f"film.json: {f.duration:.2f} s, {len(SHOTS)} shots, {len(LABELS)} labels, {len(BADGES)} badges, {len(SPINE)} spine states, "
      f"{len(film['captions'])} caption pages, end card {t_end:.2f} s")
for b in BEATS:
    print(f"  {b['id']:<9} {b['t0']:6.2f}–{b['t1']:6.2f}")
