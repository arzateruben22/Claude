"""Compile Light Minute No. 005, "How big is the Sun": script + voice timings + this direction → film.json and
sheet.json. Every moment hangs on a beat or a spoken word; every physical number comes from claims.json.

  python3 -I films/channels/space/ep05/compile.py

Two places, one cut between them (on the change's section sound):
- "sky": the Moon and the Sun at their true size and distance ratios (Moon 1737 km at 384,400 km, Sun 696,000 km at
  149.6 million km), scaled down together, so from the camera at Earth they really look the same size. The camera then
  moves sideways and up, and the depth shows.
- "sun": the Sun 100 units in radius (1 unit = 6,963 km) at true scale with 109 Earths across its face, a big sunspot
  with an Earth in it, the Peloponnese as a dot, the Sun melted down into beads (1 dot = 200 Earths, badged), then
  the episode's one scale jump: the whole place shrinks ×2,000 until the Sun is a dot inside the outline of the
  largest known stars (over 1,000 times wider).
"""
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[3] / "kits/cinema/script"))
from timeline import Film   # noqa: E402

FPS, BPM = 30, 56.25
ID = "lightminute-005"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}

# ── the physics (claims.json) ───────────────────────────────────────────────
R_SUN_KM, R_EARTH_KM, R_MOON_KM = 696000.0, 6371.0, 1737.4
D_MOON_KM, D_SUN_KM = 384400.0, 149.6e6
U = R_SUN_KM / 100                         # "sun" place: km per unit (the Sun is 100 units in radius)
R_E = R_EARTH_KM / U                       # 0.915: 109 of them across (c3)
N_ACROSS = round(R_SUN_KM / R_EARTH_KM)    # 109
VOL = (R_SUN_KM / R_EARTH_KM) ** 3         # c7: 1.30 million
DOTS = 6500                                # the melted Sun drawn as 6,500 dots: 1 dot = 200 Earths
PER_DOT = round(VOL / DOTS, -1)
SPOT_DIR = [v / math.sqrt(0.42**2 + 0.35**2 + 0.84**2) for v in (0.42, 0.35, 0.84)]   # where the big sunspot sits on the face
SPOT_P = [100.0 * v for v in SPOT_DIR]
SPOT_R = 2.6 * R_E                         # a big sunspot, 2.6 Earth radii (about 33,000 km across; c14: up to 50,000 km)
PELO_KM = 2 * math.sqrt(21550 / math.pi)   # c15: 166 km
GIANT = 1000.0                             # c8: the largest known stars, over 1,000 × the Sun's radius
SKY_K = 1.0 / 150000.0                     # "sky" place: km → units (the Moon 2.56 units out, the Sun 997)
SEP = 0.0105                               # the pair's angular offset either side of the line of sight (rad)
assert N_ACROSS == 109 and abs(VOL - 1.30e6) < 0.02e6, (N_ACROSS, VOL)

t_cut = B["change"]["t0"]
t_row0, t_row1 = A("vo03:Line"), A("vo03:nine")
t_spot = A("vo03:sunspot")
t_pelo = A("vo04:Greece")
t_melt0, t_melt1 = A("vo05:Melt"), A("vo05:fill")
t_j0, t_j1 = A("vo05:Yet", -0.1), A("vo05:Some")
assert t_j1 - t_j0 <= 3.0, (t_j0, t_j1)
t_end = A("vo08:Next", -0.25)
SHRINK = 1.0 / 2400.0                      # the jump: the "sun" place shrinks ×2,400 (the 1,000× outline then 42 units)

# ── camera (rig.js keys; one per place) ─────────────────────────────────────
key = lambda t, **k: {"t": round(t, 4), "fx": 0.5, **{"fov": 24, **k}}
mz = D_MOON_KM * SKY_K
SKY0 = dict(target=[0, 0, -mz], dist=mz, el=0.0, az=0.0, fy=0.36, fov=2.6)   # at Earth, looking at the pair (a long lens)
SKY1 = dict(target=[0, 0, -D_SUN_KM * SKY_K * 0.5], dist=1150.0, el=16.0, az=58.0, fy=0.40, fov=24)
SUNF = dict(target=[0, 0, 0], dist=520.0, el=0.0, az=0.0, fy=0.33)
CAM = {
    "sky": [key(0.0, **SKY0), key(B["normal"]["t0"], **SKY0), key(A("vo02:But"), **SKY0, ease="sine"),
            key(A("vo02:away"), **SKY1, ease="inout3"), key(t_cut, **dict(SKY1, dist=1120.0), ease="sine"),
            key(t_end, **dict(SKY0, dist=mz * 1.02)), key(t_end + 2.6, **SKY0, ease="inout3")],
    "sun": [key(t_cut, **SUNF), key(t_spot - 0.3, **dict(SUNF, dist=505.0), ease="sine"),
            key(t_spot + 1.0, target=SPOT_P, dist=40.0, el=math.degrees(math.asin(SPOT_DIR[1])), az=math.degrees(math.atan2(SPOT_DIR[0], SPOT_DIR[2])), fy=0.33, ease="inout3"),
            key(B["why"]["t0"] + 1.2, target=SPOT_P, dist=38.0, el=math.degrees(math.asin(SPOT_DIR[1])), az=math.degrees(math.atan2(SPOT_DIR[0], SPOT_DIR[2])), fy=0.33, ease="sine"),
            key(t_pelo - 1.2, **dict(SUNF, dist=500.0), ease="inout3"),
            key(t_melt0, **dict(SUNF, dist=490.0, el=10.0, az=8.0), ease="sine"),
            key(t_j0, **dict(SUNF, dist=480.0, el=12.0, az=12.0), ease="sine"),
            key(t_end, **dict(SUNF, dist=470.0, el=14.0, az=15.0), ease="sine")],
}
SHOTS = [{"at": 0.0, "name": "sky"}, {"at": t_cut, "name": "sun"}, {"at": t_end, "name": "sky"}]

# ── the overlay ─────────────────────────────────────────────────────────────
SPINE = [0.5, 0.555]
LABELS = [
    {"id": "l-sun-h", "text": "Sun", "kind": "star", "anchor": "skysun", "t0": 0.0, "t1": B["normal"]["t0"], "side": 1, "shot": "sky"},
    {"id": "l-moon-h", "text": "Moon", "kind": "body", "anchor": "skymoon", "t0": 0.0, "t1": B["normal"]["t0"], "side": -1, "shot": "sky"},
    {"id": "l-sun-s", "text": "Sun", "kind": "star", "anchor": "skysun", "t0": A("vo02:Sun"), "t1": t_cut, "side": 1, "shot": "sky"},
    {"id": "l-moon-s", "text": "Moon", "kind": "body", "anchor": "skymoon", "t0": A("vo02:Moon"), "t1": t_cut, "side": -1, "shot": "sky"},
    {"id": "l-you", "text": "you, on Earth", "kind": "body", "anchor": "you", "t0": A("vo02:farther"), "t1": t_cut, "side": -1, "shot": "sky"},
    {"id": "l-row", "text": "109 Earths", "kind": "body", "anchor": "row", "t0": t_row1, "t1": A("vo03:Your"), "side": 1, "shot": "sun"},
    {"id": "l-earth", "text": "Earth", "kind": "body", "anchor": "spotearth", "t0": A("vo03:world"), "t1": B["why"]["t0"] + 1.0, "side": 1, "shot": "sun"},
    {"id": "l-spot", "text": "a big sunspot", "kind": "star", "anchor": "spot", "t0": t_spot, "t1": B["why"]["t0"] + 1.0, "side": -1, "shot": "sun"},
    {"id": "l-pelo", "text": "southern Greece, to scale", "kind": "light", "anchor": "pelo", "t0": t_pelo, "t1": t_melt0, "side": 1, "shot": "sun"},
    {"id": "l-sun-d", "text": "the Sun", "kind": "star", "anchor": "sundot", "t0": A("vo05:ordinary"), "t1": t_end, "side": -1, "shot": "sun"},
    {"id": "l-giant", "text": "the largest known stars", "kind": "star", "anchor": "giant", "t0": A("vo05:Some"), "t1": t_end, "side": 1, "shot": "sun"},
]
BADGES = [
    {"id": "b-sky", "text": "true sizes and distances, shrunk", "t0": A("vo02:But"), "t1": t_cut, "slot": "tr"},
    {"id": "b-true", "text": "true scale", "t0": t_cut, "t1": t_pelo, "slot": "tr"},
    {"id": "b-dot", "text": "dot enlarged", "t0": t_pelo, "t1": t_melt0, "slot": "tr"},
    {"id": "b-melt", "text": "1 dot = 200 Earths, by volume", "t0": t_melt0, "t1": t_j1, "slot": "tr"},
    {"id": "b-illus", "text": "illustration", "t0": t_j0, "t1": t_end, "slot": "tr"},
]
COUNTERS = [
    {"id": "c-hook", "label": "Earths inside", "text": "?", "t0": 0.0, "t1": B["normal"]["t0"]},
    {"id": "c-400", "label": "wider · farther", "text": "400× · 400×", "t0": A("vo02:four"), "t1": t_cut},
    {"id": "c-row", "label": "Earths across", "fmt": "count", "from": 1, "to": N_ACROSS, "c0": t_row0, "c1": t_row1, "t0": t_row0, "t1": A("vo04:Nearly")},
    {"id": "c-guess", "label": "Anaxagoras · the Sun is bigger than", "text": "southern Greece", "t0": A("vo04:bigger"), "t1": A("vo04:By")},
    {"id": "c-8000", "label": "he was right · by a factor of", "text": "8,000", "t0": A("vo04:By"), "t1": t_melt0},
    {"id": "c-melt", "label": "Earths inside, by volume", "fmt": "count", "from": 0, "to": round(VOL, -5), "c0": t_melt0, "c1": t_melt1, "t0": t_melt0, "t1": A("vo05:Some")},
    {"id": "c-giant", "label": "the largest known stars · wider than the Sun", "text": "1,000×+", "t0": A("vo05:Some"), "t1": B["takeaway"]["t0"]},
    {"id": "c-dwarf", "label": "the Sun's class", "text": "G2V · dwarf", "t0": A("vo06:dwarf"), "t1": B["readout"]["t0"]},
    {"id": "c-read-x", "label": "light time · across the Sun", "text": "5 s", "read": True, "t0": A("vo07:Light"), "t1": round(A("vo07:Sun#2") - 0.05, 4)},
    {"id": "c-read-e", "label": "light time · Sun to Earth", "text": "8 min 20 s", "read": True, "t0": A("vo07:Sun#2"), "t1": t_end},
]
for c in COUNTERS:
    c.setdefault("at", SPINE)

TITLE = {"series": "Light Minute · No. 005", "title": "How big is the *Sun*", "t1": B["normal"]["t0"] - 0.25, "sig": A("line:vo01:end", 0.05)}
END = {"title": "Next light: how fast are you *moving*", "follow": "Light Minute · No. 006",
       "next": "The Sun holds about 99.8% of all the mass in the solar system."}   # footnote (c8 note; NASA)

CUE = {"cut": t_cut, "row0": t_row0, "row1": t_row1, "spot": t_spot, "pelo": t_pelo, "melt0": t_melt0, "melt1": t_melt1, "j0": t_j0, "j1": t_j1, "giant": A("vo05:Some")}
film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": A("vo05:wider", 0.8),
    "shots": SHOTS, "beats": BEATS,
    "phys": {"u": U, "r_e": R_E, "n_across": N_ACROSS, "vol": VOL, "dots": DOTS, "per_dot": PER_DOT, "spot_r": SPOT_R, "spot_dir": SPOT_DIR, "pelo_km": PELO_KM,
             "giant": GIANT, "sky_k": SKY_K, "sep": SEP, "r_sun_km": R_SUN_KM, "r_moon_km": R_MOON_KM, "d_moon_km": D_MOON_KM, "d_sun_km": D_SUN_KM, "shrink": SHRINK},
    "cam": CAM, "cue": CUE,
    "labels": LABELS, "badges": BADGES, "counters": COUNTERS,
    "title": TITLE, "endCard": t_end, "end": END,
    "captions": f.captions(max_chars=24),
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}
ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS]
ev.append({"t": TITLE["sig"], "kind": "signature", "tag": "title"})
ev.append({"t": t_end, "kind": "signature", "tag": "end"})
ev += [{"t": L["t0"], "kind": "label", "tag": L["id"]} for L in LABELS if L["t0"] > 0]
ev += [{"t": c["t0"], "kind": "counter.show", "tag": c["id"]} for c in COUNTERS if c["t0"] > 0]
ev += [{"t": b["t0"], "kind": "badge", "tag": b["id"]} for b in BADGES if b["t0"] > 0]
ev += [{"t": t_row1, "kind": "counter.end", "tag": "c-row-end"} if False else {"t": t_row1, "kind": "arrive", "tag": "row-full"},
       {"t": t_melt1, "kind": "arrive", "tag": "sun-full"},
       {"t": t_j0, "kind": "scale.jump", "tag": "to-giants", "t1": t_j1}]
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
print(f"film.json: {f.duration:.2f} s, {len(LABELS)} labels, {len(COUNTERS)} counters; {N_ACROSS} across, {VOL:,.0f} by volume "
      f"({DOTS} dots × {PER_DOT:.0f}); jump {t_j0:.2f}–{t_j1:.2f}; end card {t_end:.2f}")
print(f"sheet.json: {len(sheet['events'])} events" + (f", {len(shown)} shown" if shown else ""))
