"""Compile Rest Frame No. 004, "The hammer and the feather": script + voice timings + this direction → film.json and
sheet.json, as in episodes 1–3. Every moment hangs on a beat or a spoken word; every landing is solved back through
the closed-form fall and the clock.

  python3 -I films/channels/physics/ep04/compile.py

The physics: a hammer and a feather released from rest with their lowest points 160 cm up (Apollo 15's "approximately
1.6 m"). On the Moon (g = 162 cm/s², NASA's fact sheet) both fall the 160 cm in √(2·160/162) = 1.405 s, together.
On Earth (981 cm/s²) the hammer lands in 0.571 s (no air for the hammer: its drag over 1.6 m is far under a frame);
the feather's drift is an illustration (badged): it falls freely to 160 cm/s, then sinks at that speed, swaying.
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
from bench_py import Clock   # noqa: E402
from captions_py import phrase_captions   # noqa: E402

FPS, BPM = 30, 112.5
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}
DUR = f.duration
EC = f.end_card
HALF = 0.5 / FPS


def cut(beat):
    return round(B[beat]["t0"] - HALF, 6)


G_E, G_M, H0 = 981.0, 162.0, 160.0
T_E = math.sqrt(2 * H0 / G_E)                            # 0.571 s (c1)
T_M = math.sqrt(2 * H0 / G_M)                            # 1.405 s (c11)
VT = 160.0                                               # the feather's illustrated sinking speed on Earth (cm/s)
XH, XF = 16.0, -16.0                                     # the hammer right, the feather left
DT, NG = 0.1, 15                                         # Moon ghosts every 1/10 s: k 0 … 14 (τ 1.4)
DT_E, NG_E = 0.05, 12                                    # Earth ghosts every 1/20 s: the hammer's 0.55 s

# ── the clock ──────────────────────────────────────────────────────────────────────────────────
SLOW_H, FREEZE = 0.1, 0.4
F_h = A("vo01:feather?") - FREEZE                        # the hook (Moon, ×1/10) freezes as the question ends
HOOK_END = 0.95                                          # … 0.95 s into the 1.405 s fall: two thirds down, rows level
HOOK_TAU0 = HOOK_END - FREEZE * SLOW_H / 2 - SLOW_H * F_h
SLOW_N = 0.25                                            # Earth at ×1/4: the hammer lands on "second."
R_n = A("vo02:second.") - T_E / SLOW_N
assert A("vo02:From") < R_n < A("vo02:the"), (R_n,)
F_n = A("vo02:second.") + 0.12                           # frozen just after the hammer lands: the feather barely halfway
R_c = A("vo03:together.") - T_M                          # the Moon in real time: both land on "together."
assert A("vo03:dropped") - 0.1 < R_c < A("vo03:both."), (R_c,)
SLOW_W = 0.5
R_w = A("vo04:tie.") - T_M / SLOW_W                      # the why: re-dropped at ×1/2, tying on "tie."
assert A("vo04:speed") < R_w < A("vo04:So"), (R_w,)
R_m = A("vo06:seconds.") - T_M                           # the measure: real time, landing on "seconds."
assert A("vo06:drop") - 0.2 < R_m < A("vo06:about"), (R_m,)

KEYS = [
    {"t": 0.0, "rate": SLOW_H},
    {"t": F_h, "rate": 0.0, "ramp": FREEZE},
    {"t": cut("normal"), "rate": SLOW_N},
    {"t": F_n, "rate": 0.0, "ramp": 0.25},
    {"t": cut("change"), "rate": 1.0},
    {"t": cut("why"), "rate": 0.0, "badge": None},
    {"t": A("vo04:speed", -0.3), "rate": SLOW_W, "ramp": 0.3},
    {"t": cut("whoa"), "rate": 1.0},
    {"t": cut("takeaway"), "rate": 0.0, "badge": None},
    {"t": cut("tease"), "rate": SLOW_H, "ramp": 0.4},
]
clk = Clock(KEYS)
R_t = clk.tOf(clk.tau(DUR) - HOOK_TAU0)                  # the loop: released so the last frame is frame 0's moment
assert cut("tease") + 0.05 < R_t < EC, (R_t,)

TAKES = {
    "hook": {"t0": -1e9, "t1": cut("normal"), "tauR": clk.tau(0.0) - HOOK_TAU0, "world": "moon"},
    "earth": {"t0": cut("normal"), "t1": cut("change"), "tauR": clk.tau(R_n), "R": R_n, "world": "earth"},
    "moon": {"t0": cut("change"), "t1": cut("why"), "tauR": clk.tau(R_c), "R": R_c, "world": "moon"},
    "why": {"t0": cut("why"), "t1": cut("whoa"), "tauR": clk.tau(R_w), "R": R_w, "world": "moon"},
    "space": {"t0": cut("whoa"), "t1": cut("measure"), "tauR": 0.0, "world": "space"},
    "measure": {"t0": cut("measure"), "t1": cut("tease"), "tauR": clk.tau(R_m), "R": R_m, "world": "moon"},
    "loop": {"t0": cut("tease"), "t1": 1e9, "tauR": clk.tau(R_t), "R": R_t, "world": "moon"},
}
for name, tk in TAKES.items():
    if tk["world"] == "moon":
        tk["stamps"] = [round(clk.tOf(tk["tauR"] + k * DT), 6) for k in range(NG)]
    elif tk["world"] == "earth":
        tk["stamps"] = [round(clk.tOf(tk["tauR"] + k * DT_E), 6) for k in range(NG_E)]
assert abs(clk.tau(DUR) - TAKES["loop"]["tauR"] - HOOK_TAU0) < 1e-9
assert TAKES["hook"]["stamps"][5] + 0.2 < 0, TAKES["hook"]["stamps"][:8]
LAND = {k: clk.tOf(TAKES[k]["tauR"] + (T_E if TAKES[k]["world"] == "earth" else T_M)) for k in ("earth", "moon", "why", "measure")}
assert abs(LAND["moon"] - A("vo03:together.")) < 1e-6 and abs(LAND["measure"] - A("vo06:seconds.")) < 1e-6


def feather_drop_earth(tau):
    """cm fallen by the feather on Earth (illustration): free fall to VT, then a steady sink."""
    tc = VT / G_E
    if tau <= 0:
        return 0.0
    if tau < tc:
        return 0.5 * G_E * tau * tau
    return 0.5 * G_E * tc * tc + VT * (tau - tc)


FEATHER_AT_HAMMER_LANDING = feather_drop_earth(T_E)      # 79 cm of 160: "barely halfway"

# ── the spine ──────────────────────────────────────────────────────────────────────────────────
SPINE = [
    {"t0": cut("normal") + 0.3, "t1": cut("change"), "label": "the hammer's fall, Earth", "unit": "s", "dp": 2, "kind": "watch", "take": "earth", "cap": T_E},
    {"t0": cut("change"), "t1": cut("why"), "label": "both, on the Moon", "unit": "s", "dp": 2, "kind": "watch", "take": "moon", "cap": T_M},
    {"t0": cut("why"), "t1": cut("whoa"), "label": "each one's acceleration", "unit": "m/s²", "dp": 2, "kind": "const", "v": 1.62},
    {"t0": cut("whoa"), "t1": cut("measure"), "label": "difference: parts in a million billion", "unit": "", "kind": "text", "text": "< 3"},
    {"t0": cut("measure"), "t1": A("vo06:On#2"), "label": "the drop, Moon", "unit": "s", "dp": 2, "kind": "watch", "take": "measure", "cap": T_M,
     "lit": [A("vo06:seconds."), A("vo06:On#2")]},
    {"t0": A("vo06:On#2"), "t1": cut("tease") - 0.3, "label": "the same drop, Earth", "unit": "s", "dp": 2, "kind": "const", "v": T_E},
]

CUTS = {b["id"]: (0.0 if b["id"] == "hook" else cut(b["id"])) for b in BEATS}
CUE = {
    "hook": {"freeze": [F_h, F_h + FREEZE]},
    "earth": {"R": R_n, "land": LAND["earth"]},
    "moon": {"R": R_c, "land": LAND["moon"], "fade": [A("vo03:Now"), A("vo03:away.", 0.3)]},
    "why": {"pull": A("vo04:Gravity"), "inertia": A("vo04:harder#2"), "R": R_w, "land": LAND["why"]},
    "whoa": {"orbit": cut("whoa")},
    "measure": {"R": R_m, "land": LAND["measure"]},
    "cuts": CUTS,
}
LABELS = [
    {"id": "hk-hammer", "text": "hammer", "color": "ghost", "t0": A("vo01:hammer,"), "t1": cut("normal") - 0.4, "anchor": {"obj": ["hook", "hammer"]}, "side": 1, "fixed": True},
    {"id": "hk-feather", "text": "feather", "color": "ghost", "t0": A("vo01:feather?"), "t1": cut("normal") - 0.4, "anchor": {"obj": ["hook", "feather"]}, "side": -1, "fixed": True},
    {"id": "nm-land", "text": "0.57 s", "color": "motion", "t0": A("vo02:second."), "t1": cut("change"), "anchor": {"obj": ["earth", "hammer"]}, "side": 1, "fixed": True},
    {"id": "nm-half", "text": "barely halfway", "color": "ghost", "t0": A("vo02:halfway."), "t1": cut("change"), "anchor": {"obj": ["earth", "feather"]}, "side": -1, "fixed": True},
    {"id": "ch-together", "text": "together", "color": "motion", "t0": A("vo03:together."), "t1": cut("why"), "anchor": {"point": [0.0, 4.0, 0.0]}, "side": 1, "fixed": True},
    {"id": "wy-pull", "text": "gravity: far stronger on the hammer", "color": "force", "t0": A("vo04:Gravity"), "t1": A("vo04:But", -0.1), "anchor": {"arrow": "pull-h"}, "side": 1, "fixed": True, "v": "middle"},
    {"id": "wy-acc", "text": "same acceleration", "color": "motion", "t0": A("vo04:exactly"), "t1": R_w + 0.3, "anchor": {"arrow": "acc-h"}, "side": 1, "fixed": True, "v": "middle"},
    {"id": "wy-tie", "text": "tie", "color": "motion", "t0": A("vo04:tie."), "t1": cut("whoa"), "anchor": {"point": [0.0, 4.0, 0.0]}, "side": 1, "fixed": True},
    {"id": "wo-earth", "text": "Earth", "color": "ghost", "t0": A("vo05:Starting", 0.4), "t1": cut("measure") - 0.3, "anchor": {"point": [0.0, 190.0, -20.0]}, "side": 1, "v": "middle", "fixed": True},
]
BADGES = [
    {"id": "moon", "title": "The Moon", "text": "Gravity 1.62 m/s², a sixth of Earth's. No air.", "t0": A("vo03:away."), "t1": cut("why") - 0.2, "slot": "tr"},
    {"id": "drift", "text": "Illustration", "t0": cut("normal") + 0.6, "t1": cut("change") - 0.2, "slot": "tr"},
    {"id": "scott", "title": "David Scott, Apollo 15", "text": "\"Mr Galileo was correct in his findings.\"", "t0": A("vo03:\"Mister"), "t1": cut("why") - 0.2, "slot": "tr"},
    {"id": "notscale", "text": "Not to scale", "t0": A("vo04:Gravity"), "t1": cut("whoa") - 0.3, "slot": "tr"},
    {"id": "orbit", "text": "Illustration", "t0": cut("whoa") + 0.5, "t1": cut("measure") - 0.3, "slot": "tr"},
    {"id": "microscope", "title": "MICROSCOPE", "text": "Satellite test, 2016–2018.", "t0": A("vo05:satellite"), "t1": cut("measure") - 0.3, "slot": "tr"},
]

# ── camera ─────────────────────────────────────────────────────────────────────────────────────
def view(cx, top_px=330.0, floor_px=1140.0, top=200.0, fov=32.0, pitch=0.0, z=0.0):
    fpx = 960 / math.tan(math.radians(fov / 2))
    ppc = (floor_px - top_px) / top
    return {"look": [round(cx, 3), round(top - (960 - top_px) / ppc, 3), z], "dist": round(fpx / ppc, 2), "yaw": 0.0, "pitch": pitch, "fov": fov}


def key(t, v, ease="p2", **over):
    return {"t": round(t, 4), **v, **over, "ease": ease}


BENCH = {"look": [0.0, 59.0, 0.0], "dist": 1020.0, "yaw": 0.0, "pitch": 9.0, "fov": 32.0}   # looking down a little (the regolith reads as ground); the hand at 0.27 H, under the spine readout, the floor at 0.6 H
HOOK = view(0.0, top_px=650.0, floor_px=1150.0, top=175.0, pitch=9.0)   # under the title
SPACE = {"look": [0.0, 175.0, -20.0], "dist": 560.0, "yaw": 0.0, "pitch": 0.0, "fov": 32.0}
CAM = {
    "hook": [key(0.0, HOOK), key(cut("normal"), {**HOOK, "dist": HOOK["dist"] + 10}, "sine")],
    "normal": [key(cut("normal"), {**HOOK, "dist": HOOK["dist"] + 10}), key(A("vo02:From"), BENCH, "p3"), key(cut("change"), {**BENCH, "dist": BENCH["dist"] - 8}, "sine")],
    "change": [key(cut("change"), {**BENCH, "dist": BENCH["dist"] - 8}), key(A("vo03:away."), {**BENCH, "pitch": 6.0}, "sine"), key(cut("why"), {**BENCH, "pitch": 6.0, "dist": BENCH["dist"] - 14}, "sine")],
    "why": [key(cut("why"), {**BENCH, "pitch": 6.0, "dist": BENCH["dist"] - 14}), key(cut("whoa"), {**BENCH, "pitch": 4.0, "dist": BENCH["dist"] - 4}, "sine")],
    "whoa": [key(cut("whoa"), {**BENCH, "pitch": 4.0, "dist": BENCH["dist"] - 4}), key(A("vo05:Starting"), SPACE, "p3"), key(cut("measure"), {**SPACE, "dist": 590.0}, "sine")],
    "measure": [key(cut("measure"), BENCH), key(cut("takeaway"), {**BENCH, "dist": BENCH["dist"] + 10}, "sine")],
    "takeaway": [key(cut("takeaway"), {**BENCH, "dist": BENCH["dist"] + 10}), key(cut("tease"), {**BENCH, "dist": BENCH["dist"] + 18}, "sine")],
    "tease": [key(cut("tease"), {**BENCH, "dist": BENCH["dist"] + 18}), key(EC, HOOK, "p3"), key(DUR, HOOK, "sine")],
}
SHOTS = [{"at": CUTS[b["id"]], "name": b["id"]} for b in BEATS]

TITLE = {"series": "Rest Frame · No. 004", "title": "The hammer and the *feather*", "t1": round(cut("normal") - 0.45, 4), "y": 0.183, "sig": 0.3}
# caption pages the phrase pager can't break well on its own (set/captions_py.py: ' / ' row, ' | ' page)
CAP_FIX = [
    'On the Moon, / in nineteen seventy-one, | astronaut David Scott / dropped both.',
    'For nearly / two thousand years, | most scholars / followed Aristotle: | heavier things fall faster.',
    'Starting in / twenty sixteen, | a satellite let / two metals fall | around Earth for months.',
    'They matched / to within | a few parts / in a million billion.',
    'Measure it: on the Moon, | that drop takes about / one point four seconds.',
    'Next: / a spinning office chair.',
]

film = {
    "id": "rest-frame-004", "fps": FPS, "bpm": BPM, "dur": DUR, "poster": 0.0,
    "_doc": "Compiled by compile.py from script.md, vo/ and the direction in compile.py. Do not edit by hand.",
    "shots": SHOTS, "beats": BEATS, "clock": KEYS, "takes": TAKES, "cue": CUE, "spine": SPINE,
    "drop": {"gE": G_E, "gM": G_M, "h0": H0, "tE": T_E, "tM": T_M, "vt": VT, "xh": XH, "xf": XF, "dt": DT, "n": NG, "dtE": DT_E, "nE": NG_E},
    "labels": LABELS, "badges": BADGES, "cam": CAM,
    "captionY": 0.632, "title": TITLE,
    "captions": phrase_captions(f, max_chars=24, fix=CAP_FIX, until=EC - 0.3), "endCard": EC,
    "end": {"title": "Next drop: the spinning *chair*", "follow": "Follow Rest Frame",
            "foot": "The feather was a falcon's. Apollo 15's lunar module was named Falcon."},
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}

ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS]
ev.append({"t": round(F_h + FREEZE, 4), "kind": "time.slow", "tag": "hook:freeze"})
ev.append({"t": round(F_n + 0.25, 4), "kind": "time.slow", "tag": "earth:freeze"})
for k, R in (("earth", R_n), ("moon", R_c), ("why", R_w), ("measure", R_m), ("loop", R_t)):
    ev.append({"t": round(R, 4), "kind": "contact", "tag": f"{k}:release"})
ev.append({"t": round(LAND["earth"], 4), "kind": "impact", "tag": "earth:hammer"})
for k in ("moon", "why", "measure"):
    ev.append({"t": round(LAND[k], 4), "kind": "bounce", "tag": f"{k}:both"})
ev.append({"t": round(CUE["moon"]["fade"][0], 4), "kind": "swell", "tag": "moon:arrive"})
ev.append({"t": A("vo03:together."), "kind": "reveal", "tag": "together"})
ev.append({"t": A("vo05:billion."), "kind": "reveal", "tag": "billion"})
for take, tk in TAKES.items():
    for k, t in enumerate(tk.get("stamps", [])):
        if math.isfinite(t) and 0.05 < t < tk["t1"] and (k % 3 == 0 if take == "moon" or take == "measure" else k % 2 == 0):
            ev.append({"t": round(t, 4), "kind": "strobe", "tag": f"{take}:g{k}"})
for lb in LABELS:
    ev.append({"t": lb["t0"], "kind": "label", "tag": lb["id"]})
for bd in BADGES:
    ev.append({"t": round(bd["t0"], 4), "kind": "badge", "tag": bd["id"], "text": bd["text"]})
ev.append({"t": SPINE[0]["t0"], "kind": "counter.show", "tag": "spine"})
for s in SPINE[1:]:
    ev.append({"t": s["t0"], "kind": "counter.tick", "tag": f"spine:{s['label']}"})
ev.append({"t": A("vo06:seconds."), "kind": "counter.end", "tag": "spine:moon"})
ev.append({"t": TITLE["sig"], "kind": "signature", "tag": "title", "gain": -4.0})
ev.append({"t": EC, "kind": "signature", "tag": "end"})

cues_file = HERE / "build" / f"cues-{film['id']}-9x16.json"
shown = {}
if cues_file.exists():
    cues = json.loads(cues_file.read_text())
    by_tag = {c.get("tag"): c for c in cues.get("events", [])}
    for e in ev:
        c = by_tag.get(e.get("tag"))
        if c and e["kind"] in ("label", "counter.show") and c.get("pos"):
            e["pos"] = c["pos"]
        if c and e["kind"] in ("label", "counter.show") and cues.get("shown", {}).get(e["tag"]) is not None:
            shown[e["tag"]] = cues["shown"][e["tag"]]
sheet = {"duration": DUR, "fps": FPS, "preset": "restframe-bench", "duck_db": -9.0,
         "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: (e["t"], e["kind"])),
         "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}
if shown:
    sheet["shown"] = shown


def finite(x):
    if isinstance(x, float) and not math.isfinite(x):
        return None
    if isinstance(x, dict):
        return {k: finite(v) for k, v in x.items()}
    if isinstance(x, list):
        return [finite(v) for v in x]
    return x


(HERE / "film.json").write_text(json.dumps(finite(film), indent=1, ensure_ascii=False, allow_nan=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
print(f"film.json: {len(SHOTS)} shots, {len(KEYS)} clock keys, {len(TAKES)} takes, {len(LABELS)} labels, {len(BADGES)} badges, end card {EC} s, {DUR} s")
print(f"sheet.json: {len(sheet['events'])} events ({'with' if shown else 'without'} the page's cue measurements)")
for b in BEATS:
    print(f"  {b['id']:<9} {b['t0']:6.2f}–{b['t1']:6.2f}  cut {CUTS[b['id']]:.4f}")
print(f"  Earth: hammer {T_E:.3f} s, the feather {FEATHER_AT_HAMMER_LANDING:.1f} cm down then; Moon {T_M:.3f} s; lands {[(k, round(v, 3)) for k, v in LAND.items()]}; loop {R_t:.3f}")
