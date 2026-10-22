"""Compile Light Minute No. 001: script + voice timings + this direction → film.json (the scene's
clock: shots, scene clocks, camera keys, labels, badges, counters, the ladder, captions, title and end
card) and sheet.json (the studio's cue sheet: sections, every overlay and scene event as a sound
event, the voice). Nothing here is a hand-typed time: every moment hangs on a beat or a spoken word
(kits/cinema/script/timeline.py anchors), and every physical number comes from claims.json.

  python3 -I films/channels/space/ep01/compile.py

If build/cues-lightminute-001-9x16.json exists (render.mjs --cues), each overlay event also gets the
picture's own screen position (pan) and its measured first frame ("shown", the studio's independent
sync check).
"""
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[3] / "kits/cinema/script"))
from timeline import Film   # noqa: E402

FPS, BPM = 30, 56.25                     # DECISIONS.md: Light Minute is E dorian at 56.25 BPM (a 16th = 8 frames)
ID = "lightminute-001"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()         # pre, picture-only holds and energy, from the script's headings
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}

# ── the physics (claims.json; "computed" notes there) ──────────────────────
C_KM = 299792.458                         # km/s
D_KM = 150e6                              # c1: "about 150 million km" (the Smithsonian's figure for 8 min 20 s)
T_ARR = D_KM / C_KM                       # 500.35 s: the light clock reads 8:20 when the news arrives (c3, c11)
V_KM = 29.78                              # c2: mean orbital speed, km/s
YEAR = 365.25 * 86400                     # s
EARTH_R = 6371.0                          # km (mean radius; 12,742 km across)
MOVE_KM = V_KM * T_ARR                    # c7: 14,900 km in 8 min 20 s (1.17 Earth widths)
TRUE_ARC = 360.0 * T_ARR / YEAR           # 0.0057°: how far round its orbit Earth gets in 8 min 20 s
ARC_TARGET = 28.5                         # the arc the diagram draws between the vanish and the news (degrees)
N_ORBIT = float(f"{ARC_TARGET / TRUE_ARC:.1g}")          # "orbit sped up ×N", rounded to one figure: ×5,000
ARC = N_ORBIT * TRUE_ARC                  # the arc actually drawn, from the rounded N (28.5°)
LY_KM = 9.4607e12
GC_LY = 27000                             # c12: the channel's one galactic-centre figure
RACE_LY = 130e6                           # c6: 40 Mpc ≈ 130 million light-years
RACE_S = RACE_LY * YEAR                   # light time across it, s (4.10e15)
R_D = 15.0                                # the diagram: 1 unit = 10 million km, so 1 AU-ish = 15 units
assert abs(MOVE_KM - 14900) < 50, MOVE_KM
assert N_ORBIT == 5000, N_ORBIT

# ── shots (the stage) ──────────────────────────────────────────────────────
t_rw0 = A("vo02:Rewind")                  # the rewind starts on the word
t_rw1 = round(t_rw0 + 0.7, 4)
t_off = A("vo03:off")                     # the Sun switches off: a one-frame pop on "off"
t_race = A("vo04:In#2", -0.15)
t_w2 = A("vo05:Then", -0.15)              # the cut from Earth scale to the diagram, just before "Then"
t_arr = A("vo05:arrives")                 # the news arrives at Earth
t_end = A("vo08:Next", -0.25)             # the end card arrives with the tease ("Next: ...")
t_j0 = A("vo07:seconds:end", 0.12)        # the scale jump: after "...twenty seconds."
t_j1 = A("vo07:twenty-seven", -0.12)      # ... and lands before "twenty-seven thousand years" (≤ 3 s)
assert 1.2 < t_j1 - t_j0 <= 3.0, (t_j0, t_j1)
SHOTS = [
    {"at": 0.0, "name": "diagram"},                   # hook, normal, change: one continuous diagram
    {"at": B["why"]["t0"], "name": "grid"},          # the gravity grid (analogy)
    {"at": t_race, "name": "race"},                   # GW170817: the two fronts across 130 million light-years
    {"at": B["whoa"]["t0"], "name": "earth"},        # Earth at Earth scale: its true 14,900 km
    {"at": t_w2, "name": "news"},                     # the diagram again: the news arrives, Earth leaves on its tangent
    {"at": B["takeaway"]["t0"], "name": "restore"},  # the thought experiment over: pull back to the light-time ring
    {"at": t_end, "name": "end"},                     # the end card (the readout's galaxy behind the scrim)
]

# ── scene clocks (clock.js keys; "anchor": [t, τ] pins τ at one film time) ──
RATE_D, RATE_W, RATE_G, RATE_R = 64.0, 90.0, 300.0, 1e15
CLK = {
    # the diagram before and after the vanish: τ = 0 on "off"; the hook is the frozen moment τ = 300 s
    "diagram": {"keys": [{"t": t_rw1, "rate": RATE_D}], "anchor": [t_off, 0.0], "hook": 300.0, "rewind": [t_rw0, t_rw1]},
    # the gravity grid replays the vanish on "changes"
    "grid": {"keys": [{"t": B["why"]["t0"], "rate": RATE_G}], "anchor": [A("vo04:changes"), 0.0]},
    # the race: the merger at τ = 0, the fronts reach Earth on "arrived"
    "race": {"keys": [{"t": t_race, "rate": RATE_R}], "anchor": [A("vo04:arrived"), RACE_S]},
    # the whoa (Earth scale, then the diagram): one clock, 8:20 exactly on "arrives"
    "whoa": {"keys": [{"t": B["whoa"]["t0"], "rate": RATE_W}], "anchor": [t_arr, T_ARR]},
    # the restored system: the Sun on (τ < 0 throughout)
    # (it stops for the readout: a still diagram needs no time badge, and the readout is read, not watched)
    "restore": {"keys": [{"t": B["takeaway"]["t0"], "rate": RATE_D}, {"t": B["readout"]["t0"], "rate": 0.0, "ramp": 0.6, "badge": None}],
                "anchor": [B["takeaway"]["t0"], -6000.0]},
}


def tau(name, t):
    """τ at film time t for a constant-rate clock (all of this film's clocks are)."""
    c = CLK[name]
    t0, tau0 = c["anchor"]
    return tau0 + c["keys"][0]["rate"] * (t - t0)


def t_of(name, tau_):
    c = CLK[name]
    t0, tau0 = c["anchor"]
    return t0 + (tau_ - tau0) / c["keys"][0]["rate"]


assert abs(tau("whoa", B["whoa"]["t0"]) - 2.2) < 0.6
# the light-ripple train: one front every PERIOD of τ, one of them emitted at τ = 0 (the last light), and
# one (the highlighted ray) that reaches Earth's distance on "eight" of "eight minutes and twenty seconds"
tau_hi_arr = tau("diagram", A("vo02:eight"))
tau_hi = tau_hi_arr - T_ARR
K_HI = round(-tau_hi / 100.0)
PERIOD = -tau_hi / K_HI
ripple = {"period": round(PERIOD, 4), "hi": round(tau_hi, 4), "rMax": 34.0}

# ── the camera: a telescope mount (set/rig.js). Arcs ≤ 1.5°/s (stars are points the probe can't see) ──
E0 = -math.radians(ARC)                    # Earth's angle at the vanish (it reaches angle 0, +x, when the news arrives)
earth_at = lambda tau_: (R_D * math.cos(E0 + 2 * math.pi * N_ORBIT * tau_ / YEAR), 0.0, -R_D * math.sin(E0 + 2 * math.pi * N_ORBIT * tau_ / YEAR))
eh = earth_at(CLK["diagram"]["hook"])
CAM = {
    "diagram": [
        {"t": 0.0, "target": [7.35, 0, 1.5], "dist": 111, "el": 60, "az": 31, "fov": 24, "fy": 0.43},
        {"t": t_rw0, "target": [7.1, 0, 1.4], "dist": 106, "el": 60, "az": 32, "fov": 24, "fy": 0.43, "ease": "sine"},
        {"t": t_rw1 + 0.5, "target": [0.4, 0, 0.0], "dist": 168, "el": 61, "az": 33, "fov": 24, "fy": 0.38, "ease": "inout3"},
        {"t": B["change"]["t0"], "target": [0.4, 0, 0.0], "dist": 160, "el": 62, "az": 47, "fov": 24, "fy": 0.38, "ease": "sine"},
        {"t": B["why"]["t0"], "target": [3.0, 0, -0.5], "dist": 146, "el": 63, "az": 58, "fov": 24, "fy": 0.38, "ease": "sine"},
    ],
    "grid": [
        {"t": B["why"]["t0"], "target": [0, -3.2, 0], "dist": 78, "el": 27, "az": 14, "fov": 30, "fy": 0.4},
        {"t": t_race, "target": [0, -2.4, 0], "dist": 74, "el": 29, "az": 20.5, "fov": 30, "fy": 0.4, "ease": "sine"},
    ],
    "race": [
        {"t": t_race, "target": [0, 0, -40], "dist": 30, "el": 40, "az": 0, "fov": 30, "fy": 0.42},
        {"t": A("vo04:colliding", 0.9), "target": [0, 0, -39], "dist": 34, "el": 40, "az": 1, "fov": 30, "fy": 0.42, "ease": "sine"},
        {"t": A("vo04:light-years"), "target": [0, 0, 1], "dist": 258, "el": 41, "az": 3, "fov": 30, "fy": 0.352, "ease": "inout3"},
        {"t": B["whoa"]["t0"], "target": [0, 0, 3], "dist": 246, "el": 42, "az": 5, "fov": 30, "fy": 0.352, "ease": "sine"},
    ],
    "earth": [
        {"t": B["whoa"]["t0"], "target": [0, -1.6, 0], "dist": 194, "el": 6, "az": -24, "fov": 19, "fy": 0.42, "fx": 0.46},
        {"t": t_w2, "target": [0.3, -1.6, 0], "dist": 190, "el": 6, "az": -21, "fov": 19, "fy": 0.42, "fx": 0.46, "ease": "sine"},
    ],
    "news": [
        {"t": t_w2, "target": [7.6, 0, -1.6], "dist": 122, "el": 64, "az": 12, "fov": 24, "fy": 0.4},
        {"t": B["takeaway"]["t0"], "target": [8.6, 0, -3.6], "dist": 126, "el": 64, "az": 14, "fov": 24, "fy": 0.4, "ease": "sine"},
    ],
    "restore": [
        {"t": B["takeaway"]["t0"], "target": [14.2, 0, 2.6], "dist": 40, "el": 58, "az": -6, "fov": 24, "fy": 0.42},
        {"t": A("vo06:Everything"), "target": [2.0, 0, 0.6], "dist": 186, "el": 62, "az": -3, "fov": 24, "fy": 0.38, "fx": 0.458, "ease": "inout3"},
        {"t": t_j0, "target": [0, 0, 0], "dist": 186, "el": 63, "az": 0, "fov": 24, "fy": 0.38, "fx": 0.458, "ease": "sine"},
        {"t": t_j1, "target": [0, 0, 0], "dist": 186, "el": 61, "az": 2.4, "fov": 24, "fy": 0.38, "fx": 0.458, "ease": "inout3"},
        {"t": t_end + 0.4, "target": [0, 0, 0], "dist": 186, "el": 59.6, "az": 4.5, "fov": 24, "fy": 0.38, "fx": 0.458, "ease": "sine"},
    ],
    "end": [
        {"t": t_end, "target": [0, 0, 0], "dist": 186, "el": 59.6, "az": 4.5, "fov": 24, "fy": 0.38, "fx": 0.458},
        {"t": B["tease"]["t1"], "target": [0, 0, 0], "dist": 198, "el": 58, "az": 7.5, "fov": 24, "fy": 0.38, "fx": 0.458, "ease": "sine"},
    ],
}
for shot, keys in CAM.items():           # the bible's arc limit: ≤ 1.5° a second, in azimuth and in elevation
    for a, b in zip(keys, keys[1:]):
        dt = b["t"] - a["t"]
        for k in ("az", "el"):
            rate = abs(b[k] - a[k]) / dt
            assert rate <= 1.5 + 1e-9, f"{shot}: {k} turns {rate:.2f}°/s between {a['t']:.2f} and {b['t']:.2f} s (keep ≤ 1.5°/s)"

# ── the ladder: the readout's one scale jump, Sun → galaxy (≤ 3 s) ─────────
S0 = 1e7                                  # km per scene unit: the diagram (1 unit = 10 million km)
S1 = GC_LY / 1000 * 1000 * LY_KM / R_D    # the galaxy view: the 27,000-ly ring as wide as the 1 AU ring was
LADDER = {
    "units": {"solar": 1e7, "local": LY_KM, "galaxy": 1000 * LY_KM},
    "keys": [{"t": t_j0, "scale": S0, "focus": "sun"}, {"t": t_j1, "scale": S1, "focus": "center", "ease": "inout3"}],
    "show": {"solar": [0, 8.1], "local": [11.9, 13.5], "galaxy": [14.9, 30]},
    "fade": {"solar": 0.55, "local": 0.7, "galaxy": 0.8},
}

# ── the overlay: labels, badges, counters, pills (one table: the scene draws it, the studio hears it) ──
end_out = t_end                           # everything gives way to the end card
LABELS = [
    # hook: none (the title and the question carry it)
    {"id": "l-earth", "text": "Earth", "kind": "body", "anchor": "earth", "t0": A("vo02:Earth"), "t1": B["why"]["t0"], "shot": "diagram", "side": 1},
    {"id": "l-sun", "text": "Sun", "kind": "star", "anchor": "sun", "t0": A("vo02:Sun"), "t1": t_off, "shot": "diagram", "side": -1},
    {"id": "l-v", "text": "nearly 30 km/s", "kind": "gravity", "anchor": "earth-v", "t0": A("vo02:thirty"), "t1": A("vo02:Sunlight"), "shot": "diagram", "side": 1},
    {"id": "l-ring", "text": "8 min 20 s", "kind": "light", "anchor": "ring-au", "t0": A("vo02:eight"), "t1": B["why"]["t0"], "shot": "diagram", "side": 1},
    {"id": "l-last", "text": "last light", "kind": "light", "anchor": "front", "t0": A("vo03:last"), "t1": B["why"]["t0"], "shot": "diagram", "side": 1},
    # why: the grid, then the race
    {"id": "l-gravity", "text": "gravity", "kind": "gravity", "anchor": "well", "t0": A("vo04:Gravity"), "t1": t_race, "shot": "grid", "side": 1},
    {"id": "l-light-g", "text": "light", "kind": "light", "anchor": "grid-front", "t0": A("vo04:speed"), "t1": t_race, "shot": "grid", "side": -1},
    {"id": "l-ns", "text": "neutron stars", "kind": "star", "anchor": "merger", "t0": A("vo04:colliding"), "t1": A("vo04:hundred"), "shot": "race", "side": 1},
    {"id": "l-gw", "text": "gravitational waves", "kind": "gravity", "anchor": "race-gw", "t0": A("vo04:colliding", 1.2), "t1": A("vo04:arrived", 0.4), "shot": "race", "side": -1},
    {"id": "l-light-r", "text": "light", "kind": "light", "anchor": "race-light", "t0": A("vo04:colliding", 1.6), "t1": A("vo04:arrived", 0.4), "shot": "race", "side": 1},
    {"id": "l-earth-r", "text": "Earth", "kind": "body", "anchor": "race-earth", "t0": A("vo04:crossed"), "t1": B["whoa"]["t0"], "shot": "race", "side": 1},
    # whoa: Earth's true move, then the news
    {"id": "l-move", "text": "14,900 km in 8 min 20 s", "kind": "body", "anchor": "ruler", "t0": A("vo05:Earth"), "t1": t_w2, "shot": "earth", "side": 1, "v": "middle"},
    {"id": "l-earth-n", "text": "Earth", "kind": "body", "anchor": "earth", "t0": t_w2 + 0.15, "t1": B["takeaway"]["t0"], "shot": "news", "side": 1},
    {"id": "l-news", "text": "light + gravity", "kind": "light", "anchor": "front", "t0": t_w2 + 0.3, "t1": t_arr + 0.9, "shot": "news", "side": -1},
    # readout: a ping per ring, and where we are
    {"id": "l-ring-au", "text": "8 min 20 s", "kind": "light", "anchor": "ring-au", "t0": A("vo07:eight"), "t1": t_j0 + 0.3, "shot": "restore", "side": 1},
    {"id": "l-here", "text": "You are here", "kind": "body", "anchor": "here", "t0": A("vo07:From"), "t1": end_out, "shot": "restore", "side": 1},
    {"id": "l-gc", "text": "galactic center", "kind": "star", "anchor": "gc", "t0": t_j1 + 0.1, "t1": end_out, "shot": "restore", "side": -1},
    {"id": "l-ring-gc", "text": "27,000 years", "kind": "light", "anchor": "ring-gc", "t0": A("vo07:years"), "t1": end_out, "shot": "restore", "side": 1},
]
BADGES = [
    {"id": "b-thought", "text": "thought experiment", "t0": 0.0, "t1": t_rw0, "slot": "bl"},
    {"id": "b-nts", "text": "not to scale", "t0": 0.0, "t1": t_rw0, "slot": "bl"},
    {"id": "b-orbit", "text": f"orbit sped up ×{int(N_ORBIT):,}", "t0": t_rw1, "t1": B["why"]["t0"], "slot": "tl"},
    {"id": "b-time-d", "clock": "diagram", "t0": t_rw1, "t1": B["why"]["t0"], "slot": "tl"},
    {"id": "b-nts-d", "text": "not to scale", "t0": t_rw1, "t1": B["why"]["t0"], "slot": "tr"},
    {"id": "b-thought-c", "text": "thought experiment", "t0": t_off, "t1": B["why"]["t0"], "slot": "tr"},
    {"id": "b-analogy", "text": "analogy", "t0": B["why"]["t0"], "t1": t_race, "slot": "tr"},
    {"id": "b-time-g", "clock": "grid", "t0": B["why"]["t0"], "t1": t_race, "slot": "tl"},
    {"id": "b-thought-g", "text": "thought experiment", "t0": A("vo04:changes", -0.6), "t1": t_race, "slot": "tr"},
    {"id": "b-time-r", "clock": "race", "t0": t_race, "t1": B["whoa"]["t0"], "slot": "tl"},
    {"id": "b-nts-r", "text": "not to scale", "t0": t_race, "t1": B["whoa"]["t0"], "slot": "tr"},
    {"id": "b-orbit-n", "text": f"orbit sped up ×{int(N_ORBIT):,}", "t0": t_w2, "t1": B["takeaway"]["t0"], "slot": "tl"},
    {"id": "b-time-w", "clock": "whoa", "t0": B["whoa"]["t0"], "t1": B["takeaway"]["t0"], "slot": "tl"},
    {"id": "b-true", "text": "true scale", "t0": B["whoa"]["t0"], "t1": t_w2, "slot": "tr"},
    {"id": "b-nts-n", "text": "not to scale", "t0": t_w2, "t1": B["takeaway"]["t0"], "slot": "tr"},
    {"id": "b-thought-w", "text": "thought experiment", "t0": B["whoa"]["t0"], "t1": B["takeaway"]["t0"], "slot": "tr"},
    {"id": "b-time-t", "clock": "restore", "t0": B["takeaway"]["t0"], "t1": B["readout"]["t0"] + 0.3, "slot": "tl"},
    {"id": "b-orbit-t", "text": f"orbit sped up ×{int(N_ORBIT):,}", "t0": B["takeaway"]["t0"], "t1": B["readout"]["t0"] + 0.3, "slot": "tl"},
    {"id": "b-nts-t", "text": "not to scale", "t0": B["takeaway"]["t0"], "t1": t_j0, "slot": "tr"},
]
COUNTERS = [
    # the light clock: true time since the Sun vanished (the time badge says how fast it plays)
    {"id": "c-clock", "label": "since the Sun vanished", "clock": "diagram", "fmt": "clock", "t0": t_off, "t1": B["why"]["t0"], "at": [0.5, 0.245]},
    {"id": "c-clock-w", "label": "since the Sun vanished", "clock": "whoa", "fmt": "clock", "t0": B["whoa"]["t0"], "t1": t_arr + 1.6, "at": [0.5, 0.245], "lit": T_ARR, "stop": T_ARR},
    {"id": "c-gap", "label": "arrived apart by", "fmt": "lt2", "unit": "s", "t0": A("vo04:less"), "t1": B["whoa"]["t0"], "at": [0.5, 0.245]},
    # the readout (the channel's segment): light time for this episode's distance, then the galaxy's
    {"id": "c-read-au", "label": "light time · Sun to Earth", "fmt": "text", "text": "8 min 20 s", "t0": A("vo07:Light"), "t1": t_j0 + 0.2, "at": [0.5, 0.2]},
    {"id": "c-read-gc", "label": "light time · galactic center to Sun", "fmt": "text", "text": "27,000 years", "t0": A("vo07:twenty-seven"), "t1": end_out, "at": [0.5, 0.2]},
]
PILLS = [
    {"id": "p-au", "text": "150 million km", "bar": "sun-earth", "t0": A("vo02:million"), "t1": A("vo02:Sunlight", 0.5), "shot": "diagram", "at": [90 / 1080, 0.205]},
    {"id": "p-race", "text": "130 million light-years", "bar": None, "t0": A("vo04:hundred"), "t1": B["whoa"]["t0"], "shot": "race", "at": [90 / 1080, 0.205]},
]

# ── the title card and the end card ───────────────────────────────────────
TITLE = {"series": "Light Minute · No. 001", "title": "If the Sun *vanished*", "t1": B["normal"]["t0"] - 0.25,
         "sig": A("line:vo01:end", 0.05)}
END = {"title": "Next: the *nearest star*", "follow": "Light Minute · No. 002"}

CUE = {
    "off": t_off, "rewind": [t_rw0, t_rw1], "arrive": t_arr, "race": {"arrive": A("vo04:arrived"), "merge": t_of("race", 0.0)},
    "grid": {"off": A("vo04:changes")}, "jump": [t_j0, t_j1],
    "ring": A("vo02:eight"), "frontOn": A("vo03:last"),
}

film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": A("vo05:straight", 0.3),
    "shots": SHOTS, "beats": BEATS,
    "phys": {"c_km": C_KM, "d_km": D_KM, "t_arr": T_ARR, "v_km": V_KM, "year": YEAR, "earth_r": EARTH_R, "move_km": MOVE_KM,
             "n_orbit": N_ORBIT, "arc_deg": ARC, "true_arc_deg": TRUE_ARC, "ly_km": LY_KM, "gc_ly": GC_LY, "race_ly": RACE_LY, "race_s": RACE_S,
             "r_d": R_D, "e0": E0},
    "clk": CLK, "ripple": ripple, "cam": CAM, "ladder": LADDER, "cue": CUE,
    "labels": LABELS, "badges": BADGES, "counters": COUNTERS, "pills": PILLS,
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
    ev.append({"t": b["t0"], "kind": "badge", "tag": b["id"]})          # silent: the preset maps no badge sound (honesty badges stay quiet)
for p in PILLS:
    ev.append({"t": p["t0"], "kind": "scale", "tag": p["id"]})          # silent for the same reason
# the light clock's minutes tick (counter.tick) while it runs on screen
for cid, clk, t0, t1 in (("c-clock", "diagram", t_off, B["why"]["t0"]), ("c-clock-w", "whoa", B["whoa"]["t0"], t_arr)):
    for m in range(1, 9):
        tm = t_of(clk, 60.0 * m)
        if t0 < tm < t1:
            ev.append({"t": round(tm, 4), "kind": "counter.tick", "tag": f"{cid}-m{m}"})
# the story
ev += [
    {"t": t_off, "kind": "body.vanish", "tag": "sun", "t1": t_off + 1.2},
    {"t": t_off, "kind": "light.front", "tag": "last-light", "t1": B["why"]["t0"]},
    {"t": A("vo04:changes"), "kind": "body.vanish", "tag": "sun-grid", "t1": A("vo04:changes", 1.2)},
    {"t": A("vo04:changes"), "kind": "light.front", "tag": "grid-front", "t1": t_race},
    {"t": CUE["race"]["merge"], "kind": "merge", "tag": "kilonova", "t1": CUE["race"]["merge"] + 0.6},
    {"t": CUE["race"]["merge"], "kind": "light.front", "tag": "race-fronts", "t1": CUE["race"]["arrive"]},
    {"t": CUE["race"]["arrive"], "kind": "arrive", "tag": "race-earth"},
    {"t": t_arr, "kind": "arrive", "tag": "news"},
    {"t": t_j0, "kind": "scale.jump", "tag": "sun-to-galaxy", "t1": t_j1},
]
# the picture's own measurement, when render.mjs --cues has run: screen position (pan) and first frame shown
cues_file = HERE / "build" / f"cues-{ID}-9x16.json"
if cues_file.exists():
    pic = {e.get("tag"): e for e in json.loads(cues_file.read_text()).get("events", [])}
    for e in ev:
        p = pic.get(e.get("tag"))
        if p and p.get("pos") and e["kind"] in ("label", "counter.show"):
            e["pos"] = p["pos"]
    shown = {k: v for k, v in (json.loads(cues_file.read_text()).get("shown") or {}).items() if k.startswith("l-")}
else:
    shown = {}
sheet = {"duration": f.duration, "fps": FPS, "preset": "lightminute-vacuum",
         "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: e["t"]),
         "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}
if shown:
    sheet["shown"] = shown

(HERE / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
print(f"film.json: {f.duration:.2f} s, {len(SHOTS)} shots, {sum(len(k) for k in CAM.values())} camera keys, {len(LABELS)} labels, "
      f"{len(BADGES)} badges, {len(COUNTERS)} counters, {len(film['captions'])} caption pages, end card {t_end:.2f} s")
print(f"  orbit sped up ×{N_ORBIT:,.0f} (arc {ARC:.2f}° for a true {TRUE_ARC:.4f}°), light time {T_ARR:.2f} s, Earth's move {MOVE_KM:,.0f} km, "
      f"ripple period {PERIOD:.1f} s, jump {t_j0:.2f}–{t_j1:.2f} s ({t_j1 - t_j0:.2f} s)")
print(f"sheet.json: {len(sheet['events'])} events, {len(sheet['voice'])} voice lines" + (f", {len(shown)} shown times from the picture" if shown else ""))
for b in BEATS:
    print(f"  {b['id']:<9} {b['t0']:6.2f}–{b['t1']:6.2f}  line {b['line']}")
