"""Compile Possibility Lab Season 2, Episode 2 (S2E02, folder ep08), "Everyone holds hands": script + voice timings + this
direction → film.json (the scene's clock) and sheet.json (the studio's cue sheet). Every moment hangs on a beat or a spoken
word; every number comes from calc.py, the same module claims.json was written from.

  python3 -I films/channels/whatif/ep08/compile.py

The world (scene.mjs): a chain of people holding hands runs off along the graph paper (instanced figures: you in blue at its
head, kids and grown-ups of different heights, 1.5 m apart on average). A row of five shows the arm-span idea. The camera
cranes up as the chain grows, then pulls back to the planet (distance eased in log space, as in S2E01): the chain is a thread
that leaves the ground and runs off into space, 12.3 million km long. It is wrapped round the Earth, one great circle per lap
(307 of them, a ball of thread, each lap one Earth's circumference), and then laid out between the Earth and the Moon, 32
trips. The camera returns to frame 0 for the loop.
"""
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[3] / "kits/cinema/script"))
sys.path.insert(0, str(HERE))
from timeline import Film   # noqa: E402
from calc import V, RESULTS, SENS, EQUATOR_KM, MOON_KM, SPAN_M   # noqa: E402

FPS, BPM = 30, 50
ID = "envelope-s2e02"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}
R = RESULTS
assert R["laps"] == 310 and R["moon_trips"] == 32 and R["km_m"] == 12.3

R_E = 6.378e6                                            # m, the Earth's equatorial radius (same as S2E01)
LAPS, TRIPS = V["laps"], V["moon_trips"]                  # 307 and 32.0
LEN_M = V["km"] * 1000                                   # the chain's length, 1.31e10 m

# ── times ──
t_title_out = B["normal"]["t0"] - 0.2
t_row = A("vo02:Call", -0.25)                              # from you, arms out, to a row of kids and grown-ups
t_chain0 = B["change"]["t0"]                               # the chain grows; the camera cranes up
t_horizon = A("vo03:horizon", -0.2)                        # out past the horizon: the pull-back to the planet
t_km = A("vo03:twelve", 0.0)                             # the length is said: the thread stands out into space
t_wrap0 = A("vo04:wrap", -0.1)                             # "wrap the line around the Earth": the rings begin
t_pull = A("vo04:Pull", -0.1)
t_wrap1 = A("vo05:times", 0.0)                             # 327 laps, said as "times"
t_one = A("vo05:one", -0.05)                               # "one lap needs only one person in three hundred"
t_person = A("vo05:person", -0.15)                         # "one person in three hundred": 300 dots, one lit
t_short, t_tall = A("vo06:shorter", -0.1), A("vo06:taller", -0.1)
t_moon0 = A("vo07:reach", -0.2)                            # the thread laid out between the Earth and the Moon
t_moon1 = A("vo07:again.", 0.1)                            # 34 trips counted by "again and again"
t_small = A("vo07:small", -0.1)
t_work0, t_home, t_end = B["work"]["t0"], B["takeaway"]["t0"], A("vo08:Next", -0.25)
t_box = A("vo05:times", 0.0)

# how many people stand in the chain (the instanced figures), and how many laps are wound, as functions of time
N0, N_HOOK, N_MAX = 14, 44, 1500
def n_people(t):
    if t < t_chain0:
        return N0 + (N_HOOK - N0) * min(1.0, max(0.0, (t - 0.4) / 4.4)) ** 1.5
    return N_HOOK + (N_MAX - N_HOOK) * min(1.0, max(0.0, (t - t_chain0) / (t_horizon - t_chain0))) ** 2
LAP_KEYS = [[t_wrap0, 0.0], [t_wrap1, LAPS], [t_short - 0.3, LAPS], [t_short + 0.9, LAPS * 1.4 / 1.5], [t_tall - 0.3, LAPS * 1.4 / 1.5], [t_tall + 0.9, LAPS * 1.7 / 1.5], [t_moon0 - 0.5, LAPS * 1.7 / 1.5], [t_moon0 + 0.6, LAPS]]
TRIP_KEYS = [[t_moon0, 0.0], [t_moon1, TRIPS]]
THREAD = [[t_chain0 + 1.0, 0.0], [t_km, 1.0], [t_wrap0, 1.0], [t_wrap1, 0.0]]       # the straight thread's length, as a fraction of 12.3 million km

# ── shots ──
SHOTS = [
    {"at": 0.0, "name": "front"},                        # frame 0: you, the chain of people running off along the paper
    {"at": B["normal"]["t0"], "name": "arms"},           # you, arms out, one arm span beside a ruler
    {"at": t_row, "name": "row"},                        # a row of kids and grown-ups, hand in hand
    {"at": t_chain0, "name": "chain"},                   # the chain grows, the camera cranes up and pulls back to the planet
    {"at": t_wrap0, "name": "wrap"},                     # wrapping: an orbit round the ball of thread
    {"at": t_moon0, "name": "moon"},                     # the Earth and the Moon: 34 trips
    {"at": t_end, "name": "end"},                        # back down to frame 0
]
T = lambda x, y, z, d, el=5.0, az=0.0, fy=0.50: {"target": [x, y, z], "dist": d, "el": el, "az": az, "fov": 24, "fy": fy}
FRONT = T(0.0, 0.9, -3.0, 17.0, 5.0, 28.0, 0.80)
ARMS = T(0.0, 0.9, 0.0, 12.0, 4.0, -4.0, 0.80)
ARMS2 = T(0.0, 0.9, 0.0, 12.0, 4.0, 8.0, 0.80)
ROW0 = T(-1.2, 0.9, 0.0, 22.0, 4.0, 12.0, 0.80)
ROW1 = T(1.2, 0.9, 0.0, 22.0, 4.0, 12.0, 0.80)
PLANET = T(0.0, 6.0e6, 0.0, 6.5e7, 18.0, 0.0, 0.42)
E86 = lambda d, el, q=0.86: T(0.0, -6.4e6 + (q - 0.5) * 0.425 * d * math.cos(math.radians(el)), -(q - 0.5) * 0.425 * d * math.sin(math.radians(el)), d, el, 0.0, 0.50)   # a camera with the Earth at 86% of the frame height
FAR = E86(3.0e10, 72.0)          # looking down on the thread, 12.3 million km of it, from far above        # the Earth big in the upper half; the thread leaves the ground toward the camera's right and up
WRAP0 = T(0.0, -1.0e6, 0.0, 6.5e7, 18.0, 0.0, 0.42)
WRAP1 = T(0.0, -1.0e6, 0.0, 6.5e7, 14.0, 66.0, 0.42)
MOONW = T(0.0, 1.85e8, 0.0, 1.25e9, 4.0, 20.0, 0.42)
PERSON = T(0.0, 0.9e6, 0.0, 3.0e7, 6.0, 0.0, 0.79)         # a tiny person on the Earth: 13% of the frame, low, with the whole thread above     # the Earth at the bottom, the Moon at the top, one vertical line
CAM = {
    "front": [{"t": 0.0, **FRONT}, {"t": B["normal"]["t0"], **T(0.0, 0.9, -3.0, 19.0, 5.0, 22.0, 0.80), "ease": "sine"}],
    "arms": [{"t": B["normal"]["t0"], **T(0.0, 0.9, -3.0, 19.0, 5.0, 22.0, 0.80)}, {"t": B["normal"]["t0"] + 1.7, **ARMS, "ease": "inout2"}, {"t": t_row, **ARMS2, "ease": "sine"}],
    "row": [{"t": t_row, **ARMS2}, {"t": t_row + 1.2, **ROW0, "ease": "inout2"}, {"t": t_chain0, **ROW1, "ease": "sine"}],
    "chain": [{"t": t_chain0, **ROW1}, {"t": t_chain0 + 1.4, **T(0.0, 0.9, -4.0, 20.0, 6.0, 8.0, 0.80), "ease": "inout2"},
              {"t": round(t_chain0 + 3.1, 4), **T(0.0, 5.0, -14.0, 38.0, 9.0, -8.0, 0.60), "ease": "inout2"},
              {"t": t_horizon, **T(0.0, 12.0, -30.0, 75.0, 14.0, 0.0, 0.50), "ease": "sine"},
              {"t": t_horizon + (t_km - t_horizon) * 0.35, **T(0.0, 2.0e3, 0.0, 2.0e4, 14.0, 0.0, 0.50), "ease": "linear"},
              {"t": t_horizon + (t_km - t_horizon) * 0.7, **T(0.0, 5.0e5, 0.0, 6.0e6, 16.0, 0.0, 0.46), "ease": "linear"},
              {"t": t_km, **PLANET, "ease": "inout2"},
              {"t": round(t_km + 1.0, 4), **PLANET, "ease": "sine"},
              *[{"t": round(t_km + 1.0 + 2.6 * i / 6, 4), **E86(6.5e7 * 2.8 ** i, 18.0 + 9.0 * i), "ease": "linear"} for i in range(1, 6)],      # the Earth stays in the lower frame all the way out
              {"t": round(t_km + 3.6, 4), **FAR, "ease": "inout2"},                                     # "too big to picture": all of it, the Earth a ball at its foot
              {"t": round(t_wrap0 - 2.0, 4), **FAR, "ease": "sine"},
              *[{"t": round(t_wrap0 - 2.0 + 2.0 * i / 6, 4), **E86(3.0e10 / 2.8 ** i, 72.0 - 9.0 * i), "ease": "linear"} for i in range(1, 6)],     # and all the way back in
              {"t": t_wrap0, **WRAP0, "ease": "inout2"}],
    "wrap": [{"t": t_wrap0, **WRAP0}, {"t": round(t_wrap0 + 3.2, 4), **T(0.0, -1.0e6, 0.0, 6.5e7, 16.0, 22.0, 0.42), "ease": "sine"},
             {"t": round(t_pull + 0.3, 4), **T(0.0, -1.0e6, 0.0, 3.3e7, 16.0, 34.0, 0.42), "ease": "inout2"},          # in close as it is pulled tight
             {"t": round(t_pull + 2.6, 4), **T(0.0, -1.0e6, 0.0, 6.5e7, 16.0, 44.0, 0.42), "ease": "inout2"},
             {"t": t_wrap1, **T(0.0, -1.0e6, 0.0, 6.5e7, 16.0, 50.0, 0.42), "ease": "sine"},
             {"t": round(t_one + 0.2, 4), **T(0.0, -1.0e6, 0.0, 6.5e7, 18.0, 52.0, 0.42), "ease": "inout2"},
             {"t": round(t_one + 1.6, 4), **T(0.0, -1.0e6, 0.0, 2.6e7, 16.0, 60.0, 0.42), "ease": "inout2"},         # a close look at the rings
             {"t": round(t_person + 1.2, 4), **T(0.0, -1.0e6, 0.0, 6.5e7, 16.0, 64.0, 0.42), "ease": "inout2"},
             {"t": round(t_person + 3.0, 4), **T(0.0, -1.0e6, 0.0, 3.6e7, 28.0, 100.0, 0.42), "ease": "inout2"},      # a push-in and a tilt: the ball's other face
             {"t": round(t_person + 4.8, 4), **T(0.0, -1.0e6, 0.0, 7.0e7, 12.0, 135.0, 0.42), "ease": "inout2"},
             {"t": t_short + 0.6, **T(0.0, -1.0e6, 0.0, 5.0e7, 16.0, 66.0, 0.42), "ease": "inout2"},
             {"t": t_tall + 1.2, **T(0.0, -1.0e6, 0.0, 6.5e7, 14.0, 66.0, 0.42), "ease": "inout2"},
             {"t": round(t_tall + 3.0, 4), **T(0.0, -1.0e6, 0.0, 3.0e7, 16.0, 70.0, 0.42), "ease": "inout2"}, {"t": t_moon0, **WRAP1, "ease": "inout2"}],
    "moon": [{"t": t_moon0, **WRAP1}, {"t": t_moon0 + 1.4, **T(0.0, 2.0e7, 0.0, 3.0e8, 6.0, 43.0, 0.42), "ease": "inout2"},
             {"t": t_moon0 + 2.7, **MOONW, "ease": "inout2"}, {"t": round(t_small - 0.4, 4), **MOONW, "ease": "sine"},
             {"t": round(t_small + 0.5, 4), **T(0.0, 1.0e7, 0.0, 2.4e8, 5.0, 10.0, 0.60), "ease": "inout2"},
             {"t": round(t_small + 1.4, 4), **PERSON, "ease": "inout2"}, {"t": t_end, **PERSON, "ease": "sine"}],
    "end": [{"t": t_end, **PERSON}, {"t": t_end + 0.6, **T(0.0, 5.0e5, 0.0, 6.0e6, 8.0, 6.0, 0.56), "ease": "linear"},
            {"t": t_end + 1.1, **T(0.0, 2.0e3, 0.0, 2.0e4, 9.0, 16.0, 0.60), "ease": "linear"},
            {"t": t_end + 1.8, **FRONT, "ease": "inout2"}, {"t": B["tease"]["t1"], **FRONT}],
}
for shot, keys in CAM.items():
    for a, b in zip(keys, keys[1:]):
        dt = b["t"] - a["t"]
        assert dt > 0, (shot, a["t"], b["t"])
        for kk in ("az", "el"):
            assert abs(b[kk] - a[kk]) / dt <= 30.0 + 1e-9, f"{shot}: {kk} turns too fast between {a['t']:.2f} and {b['t']:.2f}"
for x, y in zip(SHOTS[:-1], SHOTS[1:]):
    p, q_ = CAM[x["name"]][-1], CAM[y["name"]][0]
    assert p["target"] == q_["target"] and p["dist"] == q_["dist"], (x, y, p, q_)

# ── the spine readout ──
sp_ = lambda t, label, terms, **kw: {"t": t, "label": label, "terms": terms, **kw}
SPINE = [
    sp_(A("vo02:Call", 0.0), "one person's arm span", [["in", "1.5 m"]]),
    sp_(A("vo03:billion", 0.0), "8.2 billion people × 1.5 m each", [["ans", "≈ ? km"]]),
    sp_(t_km, "8.2 billion people × 1.5 m each", [["ans", "≈ 12.3 million km"]]),
    sp_(t_wrap0, "÷ the equator, 40,075 km", [["ans", "≈ ? laps"]]),
    sp_(t_box, "laps round the equator", [["ans", f"≈ {R['laps']} laps"]], box=True),
    sp_(A("vo05:one", 0.0), "laps round the equator", [["ans", f"≈ {R['laps']} laps"]], box=True, keep=True),
    sp_(t_home, "laps round the equator", [["ans", f"≈ {R['laps']} laps"]], box=True, keep=True),
]
SPINE_OUT = t_end

s = R["sens_laps"]
WORK = {
    "t0": t_work0, "t1": round(t_tall + 3.0, 4), "title": "Show your work",
    "rows": [
        {"t": t_work0 + 0.15, "k": "8.2 bn × 1.5 m ÷ 40,075 km", "v": f"≈ {R['laps']} laps", "lit": False},
        {"t": t_short, "k": "shorter: 1.4 m a person", "v": f"≈ {s[0]} laps", "lit": True},
        {"t": t_tall, "k": "taller: 1.7 m a person", "v": f"≈ {s[2]} laps", "lit": True},
    ],
    "assume": ["1.5 m a person", "straight, no gaps", "everyone joins"],
}

# ── labels, badges, counters ──
LABELS = [
    {"id": "l-you", "text": "you", "kind": "anchor", "anchor": "you", "t0": 0.3, "t1": B["normal"]["t0"] + 1.0, "side": 1, "v": "above"},
    {"id": "l-span", "text": "one arm span ≈ your height", "kind": "part", "anchor": "span", "t0": A("vo02:You", 0.0), "t1": t_row, "side": 1},
]
BADGES = [
    {"id": "b-thought", "text": "thought experiment", "t0": 0.3, "t1": t_title_out, "slot": "br"},
    {"id": "b-span", "text": "∵ 1.5 m a person", "t0": A("vo02:meter", 0.0), "t1": t_chain0 - 0.2, "slot": "tl"},
    {"id": "b-pop", "text": "8.2 billion people", "t0": A("vo03:billion", -0.1), "t1": t_horizon, "slot": "tl"},
    {"id": "b-km", "text": "≈ 12.3 million km of people", "t0": t_km, "t1": t_wrap0, "slot": "tr"},
    {"id": "b-wrap", "text": "∵ a straight chain, no gaps", "t0": t_wrap0, "t1": t_wrap1, "slot": "tl"},
    {"id": "b-lap1", "text": "one lap = 40,075 km", "t0": t_wrap0 + 0.5, "t1": t_wrap0 + 3.2, "slot": "tr"},
    {"id": "b-lap", "text": "1 lap = 27 million people", "t0": t_one, "t1": t_work0 - 0.2, "slot": "tr"},
    {"id": "b-1in", "text": "about 1 in 300 of us", "t0": t_person, "t1": t_work0 - 0.2, "slot": "tl"},
    {"id": "b-me", "text": "one of 8.2 billion", "t0": t_small, "t1": t_end - 0.3, "slot": "tr"},
    {"id": "b-rounded", "text": "rounded", "t0": t_box + 0.3, "t1": t_person - 0.25, "slot": "tl"},
    {"id": "b-trips", "text": "≈ 32 trips to the Moon", "t0": t_moon1, "t1": t_end - 0.3, "slot": "tr"},
    {"id": "b-sens", "text": "shorter or taller: 290 to 350 laps", "t0": t_short, "t1": t_home - 0.3, "slot": "tr"},
]
COUNTERS = [
    {"id": "c-laps", "label": "laps round the equator", "t0": t_wrap0 - 0.2, "t1": t_work0 - 0.3, "at": [0.66, 0.30], "keys": [[t, v] for t, v in LAP_KEYS if t < t_work0] + [[t_work0, LAPS]], "end": LAPS, "unit": "laps"},
    {"id": "c-trips", "label": "trips to the Moon", "t0": t_moon0, "t1": t_end - 0.3, "at": [0.66, 0.30], "keys": TRIP_KEYS, "end": TRIPS, "unit": "trips"},
]
CUTS = [sh["at"] for sh in SHOTS[1:]]
for b in BADGES:
    if any(abs(b["t1"] - c) < 1e-6 for c in CUTS):
        b["t1"] = round(b["t1"] - 0.3, 4)

TITLE = {"series": "Possibility Lab · Season 2 · Episode 2", "title": "Everyone holds *hands*", "t0": 0.3, "t1": t_title_out, "sig": A("line:vo01:end", 0.05)}
END = {"title": "Next envelope: *a rope round the Earth*", "follow": "Possibility Lab · Season 2 · Episode 2",
       "next": "United Nations, World Population Prospects 2024: about 8.2 billion people."}

CUE = {"fps": FPS, "row": t_row, "chain": [t_chain0, t_horizon, t_km], "wrap": [t_wrap0, t_wrap1, t_pull], "one": t_one, "short": t_short, "tall": t_tall,
       "moon": [t_moon0, t_moon1], "small": t_small, "home": t_home, "box": t_box, "lapKeys": LAP_KEYS, "tripKeys": TRIP_KEYS, "thread": THREAD,
       "lapDraw": [t_wrap0 + 0.5, t_wrap0 + 2.7], "person": t_person, "small": t_small, "nPeople": [[round(t * 0.5, 2), round(n_people(t * 0.5), 2)] for t in range(0, int(f.duration * 2) + 2)]}
film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": round(t_box + 1.0, 4),
    "shots": SHOTS, "beats": BEATS,
    "world": {"rE": R_E, "laps": LAPS, "trips": TRIPS, "len": LEN_M, "moonD": MOON_KM * 1e3, "span": SPAN_M, "n0": N0, "nmax": N_MAX},
    "cam": CAM, "cue": CUE, "spine": SPINE, "spineOut": SPINE_OUT, "work": WORK,
    "labels": LABELS, "badges": BADGES, "counters": COUNTERS,
    "title": TITLE, "endCard": t_end, "end": END,
    "captions": f.captions(max_chars=24, balance=True, keep=("eight billion", "twelve million kilometers", "three hundred and ten", "one person in three hundred", "a meter and a half", "the Moon again", "hand in hand")),
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}

ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS if b["id"] not in ("tease", "normal")]
ev.append({"t": TITLE["sig"], "kind": "signature", "tag": "title"})
ev.append({"t": t_end, "kind": "signature", "tag": "end"})
for L in LABELS:
    ev.append({"t": L["t0"], "kind": "label", "tag": L["id"]})
for c in COUNTERS:
    ev.append({"t": c["t0"], "kind": "counter.show", "tag": c["id"]})
for i, sp in enumerate(SPINE):
    first_box = sp.get("box") and not (i and SPINE[i - 1].get("box"))
    ev.append({"t": sp["t"], "kind": "answer.box" if first_box else "term.write", "tag": f"spine-{i}", **({"t1": round(sp["t"] + 0.5, 4)} if first_box else {})})
for r in WORK["rows"]:
    ev.append({"t": r["t"], "kind": "term.write", "tag": f"work-{r['k']}"})
ev += [{"t": t_wrap0, "kind": "swell", "tag": "wrap", "t1": t_wrap1}, {"t": t_moon0, "kind": "swell", "tag": "moon", "t1": t_moon1}]
sheet = {"duration": f.duration, "fps": FPS, "preset": "envelope-working",
         "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: e["t"]),
         "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}

(HERE / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
print(f"film.json: {f.duration:.2f} s, {len(SHOTS)} shots, {len(LABELS)} labels, {len(BADGES)} badges, {len(SPINE)} spine states, "
      f"{len(film['captions'])} caption pages, end card {t_end:.2f} s; box {t_box:.2f} s")
for b in BEATS:
    print(f"  {b['id']:<9} {b['t0']:6.2f}–{b['t1']:6.2f}")
