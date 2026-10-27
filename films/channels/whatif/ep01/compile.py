"""Compile Back of the Envelope No. 001, "Through the Earth": script + voice timings + this direction →
film.json (the scene's clock: shots, the fall clock, camera keys, the spine readout's states, the show-your-
work card, labels, badges, counters, captions, title and end card) and sheet.json (the studio's cue sheet).
Nothing here is a hand-typed time: every moment hangs on a beat or a spoken word (kits/cinema/script/
timeline.py anchors), and every number comes from calc.py, the same module claims.json was written from.

  python3 -I films/channels/whatif/ep01/compile.py

The world (scene.mjs, ../set): a half-cut Earth model, 1 unit = 1,000 km, its cut face to the camera and a
straight tunnel from pole to pole; it floats over the graph-paper desk, where a ruler as long as the tunnel
carries the human-scale anchor (a car). The faller is a small figure in anchor blue (not to scale, badged).
"""
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[3] / "kits/cinema/script"))
sys.path.insert(0, str(HERE))
from timeline import Film   # noqa: E402
from calc import V, RESULTS, picture   # noqa: E402

FPS, BPM = 30, 90                         # bible §3: D lydian at 90 BPM (a 16th = 5 frames)
ID = "envelope-001"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}
P = picture()
R = P["R"]                                # 6.371 units (1 unit = 1,000 km)
T_TRIP = V["t_prem_s"]                    # one way, surface to far surface (s)
assert RESULTS["t_prem_min"] == 38 and RESULTS["t_uniform_min"] == 42 and RESULTS["t_constg_min"] == 38


def nice(x):
    """A rate the badge can say: 1, 2, 2.5 or 5 × a power of ten, the first at or above x (so the trip
    never starts before its word)."""
    e = 10 ** math.floor(math.log10(x))
    return min(m * e for m in (1, 2, 2.5, 5, 10) if m * e >= x)


# ── shots: one world, the camera moves through it; a cut only to the card and back ──
t_title_out = B["normal"]["t0"] - 0.2
t_drive0, t_drive1 = A("vo02:Driving", -0.1), A("vo02:days:end", 0.3)
t_jump = None                             # set below from the fall clock
t_stop = A("vo03:stop")                   # the faller comes to rest at the far rim on "stop"
t_box = A("vo05:thirtyeight", -0.05)     # the box closes as "thirty-eight" starts
t_work0 = B["work"]["t0"]
t_core = A("vo07:core", -0.1)
t_end = A("vo08:Next", -0.25)
SHOTS = [
    {"at": 0.0, "name": "front"},                     # hook: the payoff world at frame 0 (and the loop point)
    {"at": B["normal"]["t0"], "name": "drive"},       # normal: down to the paper, the ruler and the car
    {"at": B["change"]["t0"], "name": "fall"},        # change: the fall
    {"at": B["why"]["t0"], "name": "layers"},         # why: the layers and the gravity profile
    {"at": B["whoa"]["t0"], "name": "answer"},        # whoa: the box, back and forth
    {"at": t_work0, "name": "work"},                  # show your work: the card over the world
    {"at": B["takeaway"]["t0"], "name": "core"},      # takeaway: the core lights
    {"at": t_end, "name": "end"},                     # the end card over the front view (the loop)
]

# ── the fall clock (τ = seconds of fall since the jump; the scene draws P's trajectory) ──
RATE_F = nice(T_TRIP / (t_stop - A("vo03:Gravity", -0.3)))       # the trip fits between "Gravity" and "stop"
t_jump = round(t_stop - T_TRIP / RATE_F, 4)
# the whoa: back and forth faster; it parks at the top rim (at rest: the loop's start) before the work card
RATE_W = nice(2 * T_TRIP / 4.8)                                   # a round trip in about 4.6 s of film
t_w0 = B["whoa"]["t0"]
k = math.floor((t_work0 - 0.4 - t_w0) * RATE_W / (2 * T_TRIP) + 0.5)   # round trips that fit (+ the first half)
tau_park = 2 * T_TRIP * max(1, k)        # at the top rim again: an even number of one-way trips
t_park = round(t_w0 + (tau_park - T_TRIP) / RATE_W, 4)
assert t_w0 < t_park <= t_work0, (t_w0, t_park)
CLK = {
    "fall": {"keys": [{"t": 0.0, "rate": RATE_F}], "anchor": [t_jump, 0.0], "rest": [[-1e9, 0.0], [t_stop, T_TRIP]]},
    "whoa": {"keys": [{"t": t_w0, "rate": RATE_W}, {"t": t_park, "rate": 0.0, "badge": None}], "anchor": [t_w0, T_TRIP]},
}
assert t_jump > B["change"]["t0"] - 0.2, (t_jump, B["change"]["t0"])


def depth_at(tau):
    """Depth below the entry rim (units) after tau seconds of fall, from calc.picture (mirrored past the centre)."""
    half, n = P["half_s"], len(P["depth"]) - 1
    tau = tau % (2 * T_TRIP)
    back = tau > T_TRIP
    tau = 2 * T_TRIP - tau if back else tau
    u = min(tau, 2 * half) / half
    if u <= 1:
        x = u * n
        i = min(n - 1, int(x))
        d = P["depth"][i] + (P["depth"][i + 1] - P["depth"][i]) * (x - i)
    else:
        x = (2 - u) * n
        i = min(n - 1, int(x))
        d = 2 * R - (P["depth"][i] + (P["depth"][i + 1] - P["depth"][i]) * (x - i))
    return d


# ── the camera (rig.js keys: target, dist, el, az, fov, fx, fy; the model is 12.74 units across) ──
FRONT = {"target": [0, 0, 0], "dist": 83, "el": 7, "az": 24, "fov": 24, "fy": 0.43}   # hook and the last frame: the model under the title card
CAM = {
    "front": [{"t": 0.0, **FRONT}, {"t": B["normal"]["t0"], **FRONT, "dist": 82, "az": 25.5, "ease": "sine"}],
    "drive": [
        {"t": B["normal"]["t0"], **FRONT, "dist": 82, "az": 25.5},
        {"t": t_drive0 - 0.4, "target": [0, -5.6, 5.0], "dist": 66, "el": 19, "az": 27, "fov": 24, "fy": 0.47, "ease": "inout3"},
        {"t": B["change"]["t0"], "target": [0, -5.4, 4.8], "dist": 68, "el": 18, "az": 28, "fov": 24, "fy": 0.4, "ease": "sine"},
    ],
    "fall": [
        {"t": B["change"]["t0"], "target": [0, -5.4, 4.8], "dist": 68, "el": 18, "az": 28, "fov": 24, "fy": 0.47},
        {"t": t_jump + 2.6, "target": [0, 0, 0], "dist": 80, "el": 6, "az": 26, "fov": 24, "fy": 0.35, "ease": "inout3"},
        {"t": B["why"]["t0"], "target": [0, 0, 0], "dist": 78, "el": 5, "az": 24, "fov": 24, "fy": 0.35, "ease": "sine"},
    ],
    "layers": [
        {"t": B["why"]["t0"], "target": [0, 0, 0], "dist": 78, "el": 5, "az": 24, "fov": 24, "fy": 0.35},
        {"t": A("vo04:assumed"), "target": [4.6, 0, 0], "dist": 74, "el": 4, "az": 17, "fov": 24, "fy": 0.35, "ease": "inout3"},
        {"t": B["whoa"]["t0"], "target": [4.8, -0.3, 0], "dist": 70, "el": 4, "az": 16, "fov": 24, "fy": 0.35, "ease": "sine"},
    ],
    "answer": [
        {"t": B["whoa"]["t0"], "target": [4.8, -0.3, 0], "dist": 70, "el": 4, "az": 16, "fov": 24, "fy": 0.35},
        {"t": A("vo05:With", -0.2), "target": [0, 0, 0], "dist": 86, "el": 8, "az": 22, "fov": 24, "fy": 0.35, "ease": "inout3"},
        {"t": B["work"]["t0"], "target": [0, 0, 0], "dist": 88, "el": 9, "az": 24, "fov": 24, "fy": 0.35, "ease": "sine"},
    ],
    "work": [
        {"t": t_work0, "target": [0, 0, 0], "dist": 88, "el": 9, "az": 24, "fov": 24, "fy": 0.35},
        {"t": B["takeaway"]["t0"], "target": [0, 0, 0], "dist": 90, "el": 9, "az": 26, "fov": 24, "fy": 0.35, "ease": "sine"},
    ],
    "core": [
        {"t": B["takeaway"]["t0"], "target": [0, 0, 0], "dist": 90, "el": 9, "az": 26, "fov": 24, "fy": 0.35},
        {"t": t_core, "target": [0, -0.3, 0], "dist": 68, "el": 6, "az": 24.5, "fov": 24, "fy": 0.35, "ease": "inout3"},
        {"t": t_end, "target": [0, -0.2, 0], "dist": 72, "el": 6.5, "az": 24.2, "fov": 24, "fy": 0.35, "ease": "sine"},
    ],
    "end": [
        {"t": t_end, "target": [0, -0.2, 0], "dist": 72, "el": 6.5, "az": 24.2, "fov": 24, "fy": 0.35},
        {"t": B["tease"]["t1"], **FRONT, "ease": "inout2"},          # the last frame is frame 0's composition: the loop
    ],
}
for shot, keys in CAM.items():           # slow, telescope-like moves: ≤ 3° a second in azimuth and elevation
    for a, b in zip(keys, keys[1:]):
        dt = b["t"] - a["t"]
        assert dt > 0, (shot, a["t"], b["t"])
        for kk in ("az", "el"):
            assert abs(b[kk] - a[kk]) / dt <= 3.0 + 1e-9, f"{shot}: {kk} turns too fast between {a['t']:.2f} and {b['t']:.2f}"

# ── the spine readout: the running sum (set/spine.js). Each state replaces the last; new terms are lit
#    marker for a beat, assumptions carry a green ∵, and the answer is boxed on "thirty-eight" ──
D_KM = f"{RESULTS['diameter_km']:,.0f} km"
SPINE = [
    {"t": A("vo02:twelve", -0.05), "label": "the tunnel", "terms": [["in", D_KM]]},
    {"t": A("vo02:Driving"), "label": "driving it", "terms": [["in", D_KM], ["op", "÷"], ["in", "100 km/h"], ["op", "≈"], ["ans", f"{RESULTS['drive_days']} days"]]},
    {"t": A("vo02:falling", -0.05), "label": "falling it", "terms": [["in", D_KM], ["op", "falling"], ["op", "≈"], ["ans", "? min"]]},
    {"t": A("vo04:fortytwo", -0.05), "label": "the textbook answer", "terms": [["assume", "uniform Earth"], ["op", "→"], ["ans", f"{RESULTS['t_uniform_min']} min"]]},
    {"t": A("vo04:real", -0.05), "label": "with the real Earth", "terms": [["assume", "real Earth"], ["op", "→"], ["ans", "? min"]]},
    {"t": t_box, "label": "through the Earth", "terms": [["assume", "real Earth"], ["op", "→"], ["ans", f"≈ {RESULTS['t_prem_min']} min"]], "box": True},
    {"t": A("vo07:So", -0.05), "label": f"{RESULTS['t_uniform_min'] - RESULTS['t_prem_min']} min sooner: the core", "terms": [["assume", "real Earth"], ["op", "→"], ["ans", f"≈ {RESULTS['t_prem_min']} min"]], "box": True, "keep": True},
]
SPINE_OUT = t_end

# ── show your work (the segment): the whole sum and its sensitivity, one row per spoken line ──
WORK = {
    "t0": t_work0, "t1": B["takeaway"]["t0"] + 0.1,
    "title": "Show your work",
    "rows": [
        {"t": t_work0 + 0.15, "k": "real Earth (seismic density)", "v": f"≈ {RESULTS['t_prem_min']} min", "lit": False},
        {"t": A("vo06:Make", -0.05), "k": "core 10% lighter", "v": f"≈ {RESULTS['sens_core_minus10_min']} min", "lit": True},
        {"t": A("vo06:Make#2", -0.05), "k": "uniform Earth", "v": f"{RESULTS['t_uniform_min']} min", "lit": True},
    ],
    "assume": ["no air", "no heat", "no spin", "straight through the centre"],
}

# ── the overlay: labels, badges, counters ──────────────────────────────────
LABELS = [
    {"id": "l-you", "text": "you", "kind": "anchor", "anchor": "figure", "t0": 0.0, "t1": t_title_out + 0.1, "shot": "front", "side": 1},
    {"id": "l-tunnel", "text": "tunnel", "kind": "part", "anchor": "tunnel", "t0": A("vo02:tunnel"), "t1": t_drive0 - 0.3, "shot": "drive", "side": 1},
    {"id": "l-car", "text": "100 km/h", "kind": "anchor", "anchor": "car", "t0": A("vo02:highway"), "t1": B["change"]["t0"], "shot": "drive", "side": -1, "v": "above"},
    {"id": "l-mantle", "text": "mantle", "kind": "part", "anchor": "mantle", "t0": A("vo04:real"), "t1": B["whoa"]["t0"], "shot": "layers", "side": -1},
    {"id": "l-core", "text": "core", "kind": "part", "anchor": "core", "t0": A("vo04:core"), "t1": B["whoa"]["t0"], "shot": "layers", "side": -1},
    {"id": "l-uni", "text": "textbook gravity", "kind": "part", "anchor": "uni", "t0": A("vo04:fortytwo", 0.6), "t1": B["whoa"]["t0"], "shot": "layers", "side": 1},
    {"id": "l-peak", "text": "real gravity peaks here", "kind": "calc", "anchor": "peak", "t0": A("vo04:stronger"), "t1": B["whoa"]["t0"], "shot": "layers", "side": 1},
    {"id": "l-core-t", "text": "core", "kind": "calc", "anchor": "core", "t0": t_core, "t1": t_end, "shot": "core", "side": 1},
]
BADGES = [
    {"id": "b-thought", "text": "thought experiment", "t0": 0.0, "t1": t_title_out, "slot": "bl"},
    {"id": "b-nts-h", "text": "figure not to scale", "t0": 0.0, "t1": t_title_out, "slot": "bl"},
    {"id": "b-nts", "text": "figure not to scale", "t0": t_title_out, "t1": t_end, "slot": "tr"},
    {"id": "b-air", "text": "∵ no air · no heat · no spin", "t0": A("vo02:no"), "t1": B["why"]["t0"], "slot": "tl"},
    {"id": "b-time-f", "clock": "fall", "t0": t_jump - 0.3, "t1": B["why"]["t0"], "slot": "tl"},
    {"id": "b-prem", "text": "∵ density from earthquake data (PREM)", "t0": A("vo04:real"), "t1": B["whoa"]["t0"], "slot": "tl"},
    {"id": "b-time-w", "clock": "whoa", "t0": t_w0, "t1": t_park + 0.4, "slot": "tl"},
    {"id": "b-ideal", "text": "∵ frictionless", "t0": A("vo05:forever", -0.3), "t1": t_work0, "slot": "tl"},
]
CUTS = [sh["at"] for sh in SHOTS[1:]]
for b in BADGES:
    if any(abs(b["t1"] - c) < 1e-6 for c in CUTS):
        b["t1"] = round(b["t1"] - 0.3, 4)
COUNTERS = [
    # the days counter rides the car along the ruler (five days at 100 km/h)
    {"id": "c-days", "label": "driving nonstop", "fmt": "days", "t0": t_drive0, "t1": B["change"]["t0"] - 0.3,
     "at": [0.5, 0.6 - 0.08], "drive": [t_drive0, t_drive1], "end": RESULTS["drive_days"]},
    # the faller's speed (true, from the PREM trajectory): it peaks at about 10 km/s at the centre
    {"id": "c-speed", "label": "your speed", "fmt": "kms", "clock": "fall", "t0": t_jump + 0.2, "t1": round(t_stop + 0.8, 4), "at": [0.76, 0.37]},
    # the round trip, in true minutes, once the faller is back where they started
    {"id": "c-round", "label": "round trip", "fmt": "text", "text": f"{round(2 * T_TRIP / 60)} min", "t0": A("vo05:seventysix", -0.05), "t1": t_work0 - 0.3, "at": [0.76, 0.37]},
]

# ── the title card and the end card ───────────────────────────────────────
TITLE = {"series": "Back of the Envelope · No. 001", "title": "Through the *Earth*", "t1": t_title_out, "sig": A("line:vo01:end", 0.05)}
END = {"title": "Next envelope: *everyone, one place*", "follow": "Back of the Envelope · No. 002",
       "next": "Klotz, Am. J. Phys. 83, 231 (2015): 38 min 11 s with the real Earth; 42 min 12 s uniform."}

CUE = {"jump": t_jump, "stop": t_stop, "box": t_box, "park": t_park, "core": t_core, "drive": [t_drive0, t_drive1],
       "layers": {"crust": A("vo04:assumed"), "mantle": A("vo04:dense", -0.1), "core": A("vo04:core"), "graph": A("vo04:stronger", -0.4)}}

film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": round(t_box + 1.2, 4),
    "shots": SHOTS, "beats": BEATS,
    "phys": {"R": R, "t_trip": T_TRIP, "half_s": P["half_s"], "depth": P["depth"], "speed_ms": P["speed_ms"],
             "g_r": P["g_r"], "g_prem": P["g_prem"], "g_uniform": P["g_uniform"], "layers_km": P["layers_km"],
             "rate_f": RATE_F, "rate_w": RATE_W},
    "clk": CLK, "cam": CAM, "cue": CUE, "spine": SPINE, "spineOut": SPINE_OUT, "work": WORK,
    "labels": LABELS, "badges": BADGES, "counters": COUNTERS,
    "title": TITLE, "endCard": t_end, "end": END,
    "captions": f.captions(max_chars=24),
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}

# ── the studio's cue sheet: the same moments as sound events ──────────────
ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS]
ev.append({"t": TITLE["sig"], "kind": "signature", "tag": "title"})
ev.append({"t": t_end, "kind": "signature", "tag": "end"})
for L in LABELS:
    ev.append({"t": L["t0"], "kind": "label", "tag": L["id"]})
for c in COUNTERS:
    ev.append({"t": c["t0"], "kind": "counter.show", "tag": c["id"]})
for b in BADGES:
    ev.append({"t": b["t0"], "kind": "badge", "tag": b["id"]})
for i, s in enumerate(SPINE):
    ev.append({"t": s["t"], "kind": "term.write", "tag": f"spine-{i}"})
for r in WORK["rows"]:
    ev.append({"t": r["t"], "kind": "term.write", "tag": f"work-{r['k']}"})
for d in range(1, RESULTS["drive_days"] + 1):                     # a tally tick per day the car drives
    ev.append({"t": round(t_drive0 + (t_drive1 - t_drive0) * d / RESULTS["drive_days"], 4), "kind": "counter.tick", "tag": f"day-{d}"})
ev += [
    {"t": t_jump, "kind": "fall", "tag": "jump", "t1": t_stop},
    {"t": t_stop, "kind": "arrive", "tag": "far-rim"},
    {"t": t_box, "kind": "answer.box", "tag": "box-38", "t1": round(t_box + 0.5, 4)},
]
sheet = {"duration": f.duration, "fps": FPS, "preset": "envelope-working",
         "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: e["t"]),
         "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}

(HERE / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
print(f"film.json: {f.duration:.2f} s, {len(SHOTS)} shots, {sum(len(k) for k in CAM.values())} camera keys, {len(LABELS)} labels, "
      f"{len(BADGES)} badges, {len(COUNTERS)} counters, {len(SPINE)} spine states, {len(film['captions'])} caption pages, end card {t_end:.2f} s")
print(f"  fall ×{RATE_F:g}: jump {t_jump:.2f} s, far rim {t_stop:.2f} s; whoa ×{RATE_W:g}, parks at the top rim {t_park:.2f} s "
      f"({tau_park / (2 * T_TRIP):.0f} round trips); box {t_box:.2f} s")
print(f"sheet.json: {len(sheet['events'])} events, {len(sheet['voice'])} voice lines")
for b in BEATS:
    print(f"  {b['id']:<9} {b['t0']:6.2f}–{b['t1']:6.2f}  line {b['line']}")
