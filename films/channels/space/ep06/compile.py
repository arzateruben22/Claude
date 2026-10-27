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
sys.path.insert(0, str(HERE.parent / "set"))
from capglue import glue, hold, keep_units    # noqa: E402

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
t_e0 = A("vo04:Ptolemy")                                 # back in to Earth for the argument (the clouds ride along) ...
t_e1 = round(t_e0 + 1.8, 4)                              # ... the orbit clock stops there, so Earth holds still for the push
t_cab0, t_cab1 = A("vo04:cabin"), round(A("vo04:ride") + 0.9, 4)   # Galileo's cabin, drawn as an inset over Earth (an illustration)
t_jolt = A("vo04:jolt")
CLK = {
    # still on "Sitting perfectly still"; one turn in 86 s. The spin waits while Earth is a dot in the orbit view (t_p1 to t_e1)
    # and behind the cabin (t_cab0 to t_cab1), so "you" stay on the face toward the camera in both Earth views (about 55° left
    # of centre to 45° right) and come back from the cabin where they went in
    "spin": [{"t": 0.0, "rate": 0.0}, {"t": t_n, "rate": 1000.0}, {"t": t_p1, "rate": 0.0, "badge": None},
             {"t": t_e1, "rate": 1000.0}, {"t": t_cab0, "rate": 0.0, "badge": None}, {"t": t_cab1, "rate": 1000.0},
             {"t": t_zoom, "rate": 0.0, "badge": None}],
    # 11.6 days a second; the note is written out (a superscript 10⁶ is about 10 px tall on a phone)
    "orbit": [{"t": 0.0, "rate": 0.0}, {"t": t_p1, "rate": 1e6, "badge": "1,000,000× faster"}, {"t": t_e0, "rate": 0.0, "badge": None}],
    # one lap in 73 s, from the end of the jump (so the jump has one Sun), stopped for the readout ("so far")
    "gal": [{"t": 0.0, "rate": 0.0}, {"t": A("vo05:galaxy", 0.4), "rate": 1e14}, {"t": A("vo07:Light"), "rate": 0.0, "badge": None}],
}

# ── the ladder ─────────────────────────────────────────────────────────────
# km per scene unit in each view: Earth about 0.6 of the frame's width (above the spine); Earth's orbit about 0.75
# of it (so the orbit and Earth stay in frame); the galaxy's 100,000 light-years about 0.95 of it
S_E, S_S, S_G = 600.0, 1.1e7, 1e5 * LY / 30.0
t_j0, t_j1 = t_zoom, A("vo05:galaxy", 0.4)
# the jump slows on the Sun's neighbourhood seen from just outside it (the 60-light-year cloud about 28° across, 16° by
# the hold's end; inside it the 24° lens would see a few dim points). It drifts out a quarter decade on "the Sun" (sine:
# no step into or out of the hold), then on to the galaxy
t_jm, S_JM = A("vo05:Sun"), 10 ** 13.2
assert t_p1 - t_p0 <= 3.0 and 1.0 < t_j1 - t_j0 <= 3.0 and t_jm + 0.45 < t_j1, (t_p0, t_p1, t_j0, t_jm, t_j1)
LADDER = {
    "units": {"earth": 1000.0, "solar": 1e6, "local": LY, "galaxy": 1000 * LY},
    "keys": [{"t": t_p0, "scale": S_E, "focus": "earth"}, {"t": t_p1, "scale": S_S, "focus": "sun", "ease": "inout3"},
             {"t": t_e0, "scale": S_S, "focus": "sun"}, {"t": t_e1, "scale": S_E, "focus": "earthW", "ease": "inout3"},
             {"t": t_j0, "scale": S_E, "focus": "earthW"}, {"t": t_jm, "scale": S_JM, "focus": "sun", "ease": "inout2"},
             {"t": round(t_jm + 0.45, 4), "scale": 10 ** 13.45, "focus": "sun", "ease": "sine"},
             {"t": t_j1, "scale": S_G, "focus": "gc", "ease": "inout2"}],
    # the rungs overlap, so a pull-back never passes through an empty frame (the sphere hands off to Earth's marker);
    # the jump holds on the Sun's neighbourhood (1 unit = 1 light-year), fully shown through the hold and gone before
    # the ball shrinks into a bright knot on the Sun
    "show": {"earth": [1.5, 4.3], "solar": [4.0, 7.5], "local": [11.6, 13.6], "galaxy": [13.5, 17.0]},
    "fade": {"earth": 0.6, "solar": 0.7, "local": 0.8, "galaxy": 1.0},
}

# ── camera: one pose (a telescope mount); the world moves under it ──────────
POSE = {"target": [0, 0, 0], "el": 28.0, "fov": 24, "fx": 0.5, "fy": 0.34}
key = lambda t, **k: {"t": round(t, 4), **POSE, **k}
t_end = A("vo08:Next", -0.25)
k_j1, k_out = key(t_j1, dist=150.0, az=14.0, el=48.0, ease="inout3"), key(t_end + 3, dist=156.0, az=18.0, el=50.0, ease="sine")
# the readout drifts in (it would otherwise hold still for 8 s) from where the galaxy's slow arc has got to at t_rd
# (rig.js poseAt: the later key's sine on u, dist in log space), so the whoa and takeaway keep their framing
u_rd = (1 - math.cos(math.pi * (t_rd - k_j1["t"]) / (k_out["t"] - k_j1["t"]))) / 2
p_rd = {"dist": round(k_j1["dist"] * (k_out["dist"] / k_j1["dist"]) ** u_rd, 2), **{k: round(k_j1[k] + (k_out[k] - k_j1[k]) * u_rd, 3) for k in ("az", "el")}}
# frame 0: Earth a little smaller and lower, clear of the title band; it eases in through the hook and the normal
CAM = {"space": [key(0.0, dist=176.0, az=0.0, fy=0.36), key(t_c, dist=146.0, az=4.0, ease="sine"),
                 key(t_why, dist=150.0, az=8.0, el=34.0, ease="sine"), key(t_w, dist=146.0, az=12.0, el=36.0, ease="sine"),
                 k_j1, key(t_rd, **p_rd, ease="sine"), key(t_end, dist=146.0, az=17.4, el=49.7, ease="sine"), k_out]}
CAM["end"] = CAM["space"]
for a, b in zip(CAM["space"], CAM["space"][1:]):
    for k in ("az", "el"):
        assert abs(b[k] - a[k]) / (b["t"] - a["t"]) <= 1.5 + 1e-9 or k == "el" and b["t"] == round(t_j1, 4), (k, a["t"], b["t"])
SHOTS = [{"at": 0.0, "name": "space"}, {"at": t_end, "name": "end"}]

# ── overlay ─────────────────────────────────────────────────────────────────
SPINE = [0.5, 0.555]
LABELS = [
    {"id": "l-you", "text": "you", "kind": "light", "anchor": "pin", "t0": 0.0, "t1": round(t_p0 - 0.45, 4), "side": 1},
    {"id": "l-earth", "text": "Earth", "kind": "body", "anchor": "earthS", "t0": round(t_p1 - 0.3, 4), "t1": t_e0, "side": 1, "fixed": True},   # rides with Earth
    {"id": "l-sun", "text": "Sun", "kind": "star", "anchor": "sun", "t0": t_p1, "t1": t_e0, "side": -1},
    # Ptolemy's objection over Earth with "you" on it; Galileo's answer as the cabin inset; then the clouds ride along.
    # Each "you" is gone before the inset fades in, and back only once it has gone (a label never reads through it)
    {"id": "l-you-w", "text": "you", "kind": "light", "anchor": "pin", "t0": round(t_e1 + 0.2, 4), "t1": round(t_cab0 - 0.45, 4), "side": 1, "v": "below", "fixed": True},
    {"id": "l-you-c", "text": "you, and the clouds", "kind": "light", "anchor": "pin", "t0": round(t_cab1 + 0.05, 4), "t1": round(t_j0 - 0.2, 4), "side": 1, "v": "below", "fixed": True},
    # the Sun travels the lap's near side: its pill hangs below it, clear of the bulge; the lap is named above its far side
    # (the ring's top on screen, so the pill covers only the outer arms, not the ring)
    {"id": "l-here", "text": "the Sun, and you", "kind": "star", "anchor": "sunG", "t0": A("vo05:drags"), "t1": round(t_end - 0.45, 4), "side": 1, "v": "below", "fixed": True},
    {"id": "l-lap", "text": "the Sun's lap", "kind": "gravity", "anchor": "lap", "t0": A("vo05:One"), "t1": t_tk, "side": -1, "v": "above", "fixed": True},
    {"id": "l-gc", "text": "galactic center", "kind": "star", "anchor": "gc", "t0": A("vo07:To"), "t1": round(t_end - 0.45, 4), "side": -1, "v": "middle", "fixed": True},
]
# the argument, as two notes under the captions (the picture stays on the orbit)
PILLS = [
    {"id": "p-pto", "text": "Ptolemy, Almagest", "t0": A("vo04:birds"), "t1": A("vo04:In", -0.2), "at": [90 / 1080, 0.705]},
    {"id": "p-gal", "text": "Galileo, 1632: a ship's cabin", "t0": A("vo04:Galileo"), "t1": round(t_cab1 - 0.3, 4), "at": [90 / 1080, 0.705]},   # leaves with the cabin
]
BADGES = [
    {"id": "b-spin", "clock": "spin", "t0": t_n, "t1": round(t_p0 + 0.5, 4), "slot": "tl"},
    {"id": "b-orbit", "clock": "orbit", "t0": t_p1, "t1": t_e0, "slot": "tl"},
    # the spin's note says nothing over the ship (the spin waits behind the cabin): it leaves as the inset comes and returns after
    {"id": "b-spin2", "clock": "spin", "t0": t_e1, "t1": t_cab0, "slot": "tl"},
    {"id": "b-spin3", "clock": "spin", "t0": t_cab1, "t1": t_zoom, "slot": "tl"},
    {"id": "b-gal", "clock": "gal", "t0": t_j1, "t1": t_rd, "slot": "tl"},
    {"id": "b-nts", "text": "not to scale", "t0": round(t_p0 + 0.9, 4), "t1": round(t_e0 + 0.5, 4), "slot": "tr"},   # while the enlarged Sun is in frame
    {"id": "b-cabin", "text": "illustration", "t0": t_cab0, "t1": round(t_cab1 - 0.3, 4), "slot": "tr"},   # its fade ends with the inset's
    # the cloud of nearby stars is drawn, not mapped: noted while the jump holds on it (it is gone by about t_jm + 1)
    {"id": "b-cloud", "text": "illustration", "t0": round(t_jm - 0.4, 4), "t1": round(t_jm + 0.8, 4), "slot": "tr"},
    {"id": "b-illus", "text": "galaxy: illustration", "t0": round(t_j1 - 0.4, 4), "t1": t_end, "slot": "tr"},   # as the galaxy arrives
]
COUNTERS = [
    {"id": "c-hook", "label": "your speed right now", "text": "?", "t0": 0.0, "t1": t_n},
    {"id": "c-eq", "label": "the ground at the equator · km/h", "text": "1,670", "t0": A("vo02:sixteen"), "t1": A("vo02:That")},
    {"id": "c-sound", "label": "the speed of sound · km/h", "text": "1,225", "t0": A("vo02:That"), "t1": A("vo03:And")},
    {"id": "c-orb", "label": "Earth around the Sun · km a second", "text": "30", "t0": A("vo03:thirty"), "t1": t_since},
    {"id": "c-since", "label": "km round the Sun since this began", "fmt": "since", "t0": t_since, "t1": t_zoom},   # gone with the orbit's rung
    {"id": "c-gal", "label": "Sun round the galaxy · km a second", "text": "230", "t0": A("vo05:two"), "t1": A("vo05:One")},
    {"id": "c-lap", "label": "one lap · years", "text": "230 million", "t0": A("vo05:two#2", -0.1), "t1": A("vo05:Last")},   # not "230" twice
    {"id": "c-dino", "label": "last time round", "text": "first dinosaurs", "t0": A("vo05:Last"), "t1": t_tk},
    {"id": "c-what", "label": [[0.0, "your speed"], [A("vo06:compared"), "your speed · compared to what"]], "text": "?", "t0": A("vo06:So"), "t1": t_rd},
    {"id": "c-read-trip", "label": "light time · your galactic trip", "text": "1/20 s", "read": True, "t0": t_rd, "t1": round(A("vo07:To") - 0.05, 4)},
    {"id": "c-read-gc", "label": "light time · galaxy's center", "text": "27,000 years", "read": True, "t0": A("vo07:To"), "t1": round(t_end - 0.45, 4)},
]
for c in COUNTERS:
    c.setdefault("at", SPINE)
spine = [c for c in COUNTERS if c["at"] == SPINE]
for a, b in zip(spine, spine[1:]):
    if b["t0"] - a["t1"] < 0.4:
        a["t1"] = round(b["t0"] - 0.4, 4)

TITLE = {"series": "Light Minute · No. 006", "title": "Your *speed*", "t1": t_n - 0.5, "sig": A("line:vo01:end", 0.05)}
END = {"title": "Next light: trees or *stars*", "follow": "Light Minute · No. 007",
       "next": "One lap of the galaxy takes the Sun about\u00a0230 million years."}   # footnote (c9); "about" stays with its number
CUE = {"last": A("vo05:Last"), "cab0": t_cab0, "cab1": t_cab1, "jolt": t_jolt, "ride": A("vo04:ride"), "jm": t_jm, "rd": t_rd, "zoom": t_zoom, "p0": t_p0, "p1": t_p1, "e0": t_e0, "e1": t_e1, "j0": t_j0, "j1": t_j1, "lap": A("vo05:One"), "gcring": A("vo07:To"), "eq": A("vo02:equator")}
POSTER = A("vo05:appeared", 0.4)
# captions: number phrases and fixed phrases stay on one line (after the last anchor lookup)
glue(f, {"vo02": ["sixteen hundred seventy", "kilometers an hour.", "the speed of sound."],
         "vo03": ["the Sun", "about thirty", "New York", "to Boston."],
         "vo04": ["In sixteen thirty-two,", "a ship's cabin."],
         "vo05": ["the galaxy", "about two hundred thirty", "kilometers a second.", "about two hundred thirty", "million years.", "the first dinosaurs", "had just appeared."]})

film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": POSTER,
    "shots": SHOTS, "beats": BEATS,
    "phys": {"c_km": C_KM, "ly": LY, "v_orb": V_ORB, "v_gal": V_GAL, "gc_ly": GC_LY, "year": YEAR, "sidereal": SIDEREAL, "lap_y": LAP_Y},
    "clk": CLK, "ladder": LADDER, "cam": CAM, "cue": CUE,
    "labels": LABELS, "badges": BADGES, "counters": COUNTERS, "pills": PILLS,
    "title": TITLE, "endCard": t_end, "end": END,
    "captions": hold(f, keep_units(f.captions(max_chars=24))),   # each page stays until its last phrase has been spoken
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
