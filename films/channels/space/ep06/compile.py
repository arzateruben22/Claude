"""Compile Light Minute No. 006, "Your speed": script + voice timings + this direction → film.json and sheet.json.
Every moment hangs on a beat or a spoken word; every physical number comes from claims.json.

  python3 -I films/channels/space/ep06/compile.py

One world, three rungs of the scale ladder (kits/cinema/sci/ladder.js), all in km: "earth" (1 unit = 1,000 km: Earth
true size, a pin on the equator), "solar" (1 unit = 1 million km: Earth's orbit 149.6 units out, the Sun not to
scale), "galaxy" (1 unit = 1,000 light-years: the Sun's lap 27 units round the centre). A pull-back from Earth to its
orbit in the change, and the one scale jump (≤ 3 s) from the orbit to the galaxy on "Zoom out". Three clocks: Earth's
spin, its orbit, the Sun's lap. The spine counts the km Earth has carried you round the Sun since the film began, live.
"""
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[3] / "kits/cinema/script"))
from timeline import Film   # noqa: E402

FPS, BPM = 30, 56.25
ID = "lightminute-006"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}

# ── the physics (claims.json) ───────────────────────────────────────────────
C_KM, LY = 299792.458, 9.4607e12
V_EQ_KMH, V_SOUND_KMH = 1670.0, 1225.0     # c1, c2
V_ORB = 29.78                              # c3, km/s
V_GAL = 230.0                              # c8, km/s
LAP_Y = 230e6                              # c9
GC_LY = 27000.0                            # c12
YEAR = 365.25 * 86400
SIDEREAL = 86164.0
t_since = A("vo03:Since")
assert V_ORB * t_since > 306.0, (t_since, V_ORB * t_since)                 # c4: farther than New York to Boston (306 km)
t_rd = A("vo07:Light")
LT_TRIP = V_GAL * t_rd / C_KM
assert 0.04 < LT_TRIP < 0.055, LT_TRIP                                    # c11: "about a twentieth of a second"

# ── clocks ──────────────────────────────────────────────────────────────────
t_n, t_c, t_why, t_w, t_tk = B["normal"]["t0"], B["change"]["t0"], B["why"]["t0"], B["whoa"]["t0"], B["takeaway"]["t0"]
t_zoom = A("vo05:Zoom")
t_p0, t_p1 = A("vo03:And"), A("vo03:Sun", 0.6)          # the pull-back from Earth to its orbit
CLK = {
    "spin": [{"t": 0.0, "rate": 2000.0}, {"t": t_zoom, "rate": 0.0, "badge": None}],           # one turn in 43 s
    "orbit": [{"t": 0.0, "rate": 0.0}, {"t": t_p1, "rate": 1e6}, {"t": t_zoom, "rate": 0.0, "badge": None}],   # 11.6 days a second
    "gal": [{"t": 0.0, "rate": 0.0}, {"t": t_zoom, "rate": 1e14}],                              # one lap in 73 s
}

# ── the ladder ─────────────────────────────────────────────────────────────
S_E, S_S, S_G = 400.0, 2.4e6, GC_LY * LY / 70.0                         # km per scene unit in each view
t_j0, t_j1 = t_zoom, A("vo05:galaxy", 0.4)
assert t_p1 - t_p0 <= 3.0 and 1.0 < t_j1 - t_j0 <= 3.0, (t_p0, t_p1, t_j0, t_j1)
LADDER = {
    "units": {"earth": 1000.0, "solar": 1e6, "galaxy": 1000 * LY},
    "keys": [{"t": t_p0, "scale": S_E, "focus": "earth"}, {"t": t_p1, "scale": S_S, "focus": "sun", "ease": "inout3"},
             {"t": t_j0, "scale": S_S, "focus": "sun"}, {"t": t_j1, "scale": S_G, "focus": "gc", "ease": "inout3"}],
    "show": {"earth": [1.5, 3.4], "solar": [4.6, 7.5], "galaxy": [13.5, 17.0]},
    "fade": {"earth": 0.6, "solar": 0.7, "galaxy": 1.0},
}

# ── camera: one pose (a telescope mount); the world moves under it ──────────
POSE = {"target": [0, 0, 0], "el": 28.0, "fov": 24, "fx": 0.5, "fy": 0.34}
key = lambda t, **k: {"t": round(t, 4), **POSE, **k}
t_end = A("vo08:Next", -0.25)
CAM = {"space": [key(0.0, dist=150.0, az=0.0), key(t_c, dist=146.0, az=4.0, ease="sine"),
                 key(t_why, dist=150.0, az=8.0, el=34.0, ease="sine"), key(t_w, dist=146.0, az=12.0, el=36.0, ease="sine"),
                 key(t_j1, dist=150.0, az=14.0, el=48.0, ease="inout3"), key(t_end + 3, dist=156.0, az=18.0, el=50.0, ease="sine")]}
CAM["end"] = CAM["space"]
for a, b in zip(CAM["space"], CAM["space"][1:]):
    for k in ("az", "el"):
        assert abs(b[k] - a[k]) / (b["t"] - a["t"]) <= 1.5 + 1e-9 or k == "el" and b["t"] == round(t_j1, 4), (k, a["t"], b["t"])
SHOTS = [{"at": 0.0, "name": "space"}, {"at": t_end, "name": "end"}]

# ── overlay ─────────────────────────────────────────────────────────────────
SPINE = [0.5, 0.555]
LABELS = [
    {"id": "l-you-h", "text": "you, at the equator", "kind": "light", "anchor": "pin", "t0": 0.0, "t1": t_n, "side": 1},
    {"id": "l-you", "text": "you, at the equator", "kind": "light", "anchor": "pin", "t0": A("vo02:equator"), "t1": t_c, "side": 1},
    {"id": "l-earth", "text": "Earth", "kind": "body", "anchor": "earthS", "t0": A("vo03:Earth"), "t1": t_w, "side": 1},
    {"id": "l-sun", "text": "Sun", "kind": "star", "anchor": "sun", "t0": A("vo03:Sun"), "t1": t_why, "side": -1},
    {"id": "l-pto", "text": "Ptolemy: birds and clouds left behind?", "kind": "gravity", "anchor": "earthS", "t0": A("vo04:birds"), "t1": A("vo04:In"), "side": -1},
    {"id": "l-gal", "text": "Galileo, 1632: you can't feel a smooth ride", "kind": "light", "anchor": "earthS", "t0": A("vo04:Below"), "t1": t_w, "side": -1},
    {"id": "l-here", "text": "the Sun, and you", "kind": "star", "anchor": "sunG", "t0": A("vo05:drags"), "t1": t_end, "side": 1},
    {"id": "l-gc", "text": "galactic center", "kind": "star", "anchor": "gc", "t0": A("vo05:galaxy"), "t1": t_end, "side": -1},
    {"id": "l-lap", "text": "the Sun's lap", "kind": "gravity", "anchor": "lap", "t0": A("vo05:One"), "t1": t_tk, "side": -1},
    {"id": "l-27k", "text": "27,000 light-years", "kind": "light", "anchor": "lap", "t0": A("vo07:To"), "t1": t_end, "side": -1},
]
BADGES = [
    {"id": "b-spin", "clock": "spin", "t0": t_n, "t1": t_c, "slot": "tl"},
    {"id": "b-orbit", "clock": "orbit", "t0": t_p1, "t1": t_zoom, "slot": "tl"},
    {"id": "b-gal", "clock": "gal", "t0": t_j1, "t1": t_end, "slot": "tl"},
    {"id": "b-nts", "text": "not to scale", "t0": t_p1, "t1": t_zoom, "slot": "tr"},
    {"id": "b-illus", "text": "galaxy: illustration", "t0": t_j1, "t1": t_end, "slot": "tr"},
]
COUNTERS = [
    {"id": "c-hook", "label": "your speed right now", "text": "?", "t0": 0.0, "t1": t_n},
    {"id": "c-eq", "label": "the ground at the equator · km/h", "text": "1,670", "t0": A("vo02:sixteen"), "t1": A("vo02:That")},
    {"id": "c-sound", "label": "the speed of sound · km/h", "text": "1,225", "t0": A("vo02:That"), "t1": A("vo03:thirty")},
    {"id": "c-orb", "label": "Earth around the Sun · km a second", "text": "30", "t0": A("vo03:thirty"), "t1": t_since},
    {"id": "c-since", "label": "km round the Sun since this began", "fmt": "since", "t0": t_since, "t1": A("vo05:two")},
    {"id": "c-gal", "label": "the Sun round the galaxy · km a second", "text": "230", "t0": A("vo05:two"), "t1": A("vo05:One")},
    {"id": "c-lap", "label": "one lap · million years", "text": "230", "t0": A("vo05:One"), "t1": A("vo05:Last")},
    {"id": "c-dino", "label": "last time round", "text": "first dinosaurs", "t0": A("vo05:Last"), "t1": t_tk},
    {"id": "c-what", "label": "your speed · compared to what", "text": "?", "t0": A("vo06:So"), "t1": t_rd},
    {"id": "c-read-trip", "label": "light time · your galactic trip so far", "text": "1/20 s", "read": True, "t0": t_rd, "t1": round(A("vo07:To") - 0.05, 4)},
    {"id": "c-read-gc", "label": "light time · to the galaxy's center", "text": "27,000 years", "read": True, "t0": A("vo07:To"), "t1": t_end},
]
for c in COUNTERS:
    c.setdefault("at", SPINE)
spine = [c for c in COUNTERS if c["at"] == SPINE]
for a, b in zip(spine, spine[1:]):
    if b["t0"] - a["t1"] < 0.4:
        a["t1"] = round(b["t0"] - 0.4, 4)

TITLE = {"series": "Light Minute · No. 006", "title": "Your *speed*", "t1": t_n - 0.25, "sig": A("line:vo01:end", 0.05)}
END = {"title": "Next light: trees or *stars*", "follow": "Light Minute · No. 007",
       "next": "One lap of the galaxy takes the Sun about 230 million years."}   # footnote (c9)
CUE = {"zoom": t_zoom, "p0": t_p0, "p1": t_p1, "j0": t_j0, "j1": t_j1, "lap": A("vo05:One"), "gcring": A("vo07:To")}
film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": A("vo05:appeared", 0.4),
    "shots": SHOTS, "beats": BEATS,
    "phys": {"c_km": C_KM, "ly": LY, "v_orb": V_ORB, "v_gal": V_GAL, "gc_ly": GC_LY, "year": YEAR, "sidereal": SIDEREAL, "lap_y": LAP_Y},
    "clk": CLK, "ladder": LADDER, "cam": CAM, "cue": CUE,
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
ev += [{"t": t_p0, "kind": "scale.jump", "tag": "to-orbit", "t1": t_p1}, {"t": t_j0, "kind": "scale.jump", "tag": "to-galaxy", "t1": t_j1}]
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
print(f"film.json: {f.duration:.2f} s, {len(LABELS)} labels, {len(COUNTERS)} counters; pull {t_p0:.2f}–{t_p1:.2f}, jump {t_j0:.2f}–{t_j1:.2f}; "
      f"since-line at {t_since:.2f} s = {V_ORB * t_since:.0f} km; readout {LT_TRIP:.3f} s; end card {t_end:.2f}")
print(f"sheet.json: {len(sheet['events'])} events" + (f", {len(shown)} shown" if shown else ""))
