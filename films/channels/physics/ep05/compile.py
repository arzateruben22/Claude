"""Compile Rest Frame No. 005, "The spinning chair": script + voice timings + this direction → film.json and sheet.json,
as in episodes 1–4. Every moment hangs on a beat or a spoken word.

  python3 -I films/channels/physics/ep05/compile.py

The physics (set/spin.js, ported in set/bench_py.py): a seated person on a swivel chair, two 2 kg dumbbells, each arm a
3.5 kg rod from the shoulder (19 cm out) to the hand; the seated body and the chair's top without the arms 2.0 kg·m²
(an assumption, badged). One push gives 30 rpm with the arms out (hands 80 cm from the axis); angular momentum is
conserved (friction ignored, badged), so pulling the hands to 20 cm spins it at 30 × 2.68 = 80 rpm.
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
from bench_py import Clock, Spinner   # noqa: E402
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


MODEL = {"I0": 2.0, "m": 2.0, "mArm": 3.5, "rS": 0.19, "r0": 0.80, "w0": math.pi}   # w0: 30 rpm, one turn every 2 s
R_IN = 0.20
DT = 0.1

# ── the clock: real time on the chair; the hook and the loop at ×1/2; the measure frozen ────────
SLOW_H = 0.5
HOOK_MOVES = [(1.0, 1.6, R_IN)]                          # the hook's own spin: pulled in from τ 1.0 to 1.6
HOOK_TAU0 = 1.3                                          # frame 0 is mid-pull: the ghost spiral already curling in
T_PUSH = A("vo02:push.")                                 # the push lands on "push."
MOVES = [(A("vo03:pull") - T_PUSH, A("vo03:chest.") - T_PUSH, R_IN),            # in, from "pull" to "chest."
         (A("vo04:Weight") - T_PUSH, A("vo04:middle") - T_PUSH, MODEL["r0"]),   # out again: slower ("Weight near the middle…")
         (A("vo04:turns") - T_PUSH, A("vo04:faster.") - T_PUSH + 0.3, R_IN)]   # in again on "…turns you faster."
SP = Spinner(**MODEL, moves=MOVES)
SPH = Spinner(**MODEL, moves=HOOK_MOVES)
RATIO = SP.ratio(MODEL["r0"], R_IN)
RPM_OUT, RPM_IN = 30.0, 30.0 * RATIO                     # 30 → 80.3 rpm (c1)

KEYS = [
    {"t": 0.0, "rate": SLOW_H, "badge": None},          # the hook's speed note sits bottom-right (hookNote), clear of the title
    {"t": cut("normal"), "rate": 1.0},
    {"t": cut("measure"), "rate": 0.0, "badge": None},   # the record, seen from above: nothing moves
    {"t": cut("takeaway"), "rate": 1.0},
    {"t": cut("tease"), "rate": SLOW_H},
]
clk = Clock(KEYS)
R_t = clk.tOf(clk.tau(DUR) - HOOK_TAU0)                  # the loop: the last frame is frame 0's moment
assert cut("tease") + 0.05 < R_t < EC, (R_t,)
TAKES = {
    "hook": {"t0": -1e9, "t1": cut("normal"), "tauR": clk.tau(0.0) - HOOK_TAU0, "spin": "hook"},
    "chair": {"t0": cut("normal"), "t1": cut("tease"), "tauR": clk.tau(T_PUSH), "R": T_PUSH, "spin": "chair"},
    "loop": {"t0": cut("tease"), "t1": 1e9, "tauR": clk.tau(R_t), "R": R_t, "spin": "hook"},
}
assert abs(clk.tau(DUR) - TAKES["loop"]["tauR"] - HOOK_TAU0) < 1e-9

# ── the ghost ladders: both dumbbells every 1/10 s ───────────────────────────────────────────────
# the live ladders (normal, change): ten with the arms out from τ 0.2, seven with them in after the pull settles;
# the record (measure) shows the same ghosts at once
T_IN = MOVES[0][1]
LADDERS = {
    "out": {"tau0": 0.2, "n": 10, "t0": cut("normal"), "t1": cut("why")},
    "in": {"tau0": round(T_IN + 0.15, 4), "n": 7, "t0": cut("change"), "t1": cut("why")},
    "hook": {"tau0": 0.4, "n": 18, "t0": -1e9, "t1": cut("normal")},
    "loop": {"tau0": 0.4, "n": 18, "t0": cut("tease"), "t1": 1e9},
}
for k in ("out", "in"):
    L = LADDERS[k]
    L["stamps"] = [round(clk.tOf(TAKES["chair"]["tauR"] + L["tau0"] + i * DT), 6) for i in range(L["n"])]
    assert L["stamps"][-1] < L["t1"], (k, L["stamps"][-1], L["t1"])
for k, take in (("hook", "hook"), ("loop", "loop")):
    L = LADDERS[k]
    L["stamps"] = [round(clk.tOf(TAKES[take]["tauR"] + L["tau0"] + i * DT), 6) for i in range(L["n"])]
assert LADDERS["hook"]["stamps"][8] + 0.15 < 0 <= LADDERS["hook"]["stamps"][9] + 0.2, LADDERS["hook"]["stamps"][:10]
STEP_OUT = math.degrees(SP.omega(0.5) * DT)              # 18.0°
STEP_IN = math.degrees(SP.omega(T_IN + 0.5) * DT)        # 48.2°

# ── the spine: rpm on the chair, the skater's record, then degrees per 1/10 s ───────────────────
SPINE = [
    {"t0": cut("normal") + 0.3, "t1": cut("whoa"), "label": "spin rate", "unit": "rpm", "dp": 0, "kind": "rpm", "take": "chair"},
    {"t0": cut("whoa"), "t1": cut("measure"), "label": "fastest spin on ice skates", "unit": "rpm", "dp": 0, "kind": "ramp",
     "keys": [[A("vo05:three"), RPM_IN], [A("vo05:minute."), 342.0]], "lit": [A("vo05:minute."), cut("measure")]},
    {"t0": cut("measure"), "t1": A("vo06:Arms#2"), "label": "turn per 1/10 s, arms out", "unit": "°", "dp": 0, "kind": "const", "v": STEP_OUT},
    {"t0": A("vo06:Arms#2"), "t1": cut("takeaway"), "label": "turn per 1/10 s, arms in", "unit": "°", "dp": 0, "kind": "const", "v": STEP_IN,
     "lit": [A("vo06:fifty."), cut("takeaway")]},
    {"t0": cut("takeaway"), "t1": cut("tease") - 0.3, "label": "spin rate", "unit": "rpm", "dp": 0, "kind": "rpm", "take": "chair"},
]

CUTS = {b["id"]: (0.0 if b["id"] == "hook" else cut(b["id"])) for b in BEATS}
CUE = {"push": T_PUSH, "moves": [[T_PUSH + a, T_PUSH + b, r] for a, b, r in MOVES], "skater": [cut("whoa"), cut("measure")],
       "cuts": CUTS}
LABELS = [
    {"id": "hk-weights", "text": "2 kg each", "color": "ghost", "t0": A("vo01:Nobody"), "t1": cut("normal") - 0.4, "anchor": {"hand": ["hook", 1]}, "side": 1, "fixed": True},
    {"id": "nm-out", "text": "80 cm from the axis", "color": "ghost", "t0": A("vo02:wide."), "t1": A("vo02:You", -0.1), "anchor": {"hand": ["chair", 1]}, "side": 1, "fixed": True},
    {"id": "ch-in", "text": "20 cm", "color": "ghost", "t0": A("vo03:chest."), "t1": cut("why"), "anchor": {"hand": ["chair", 1]}, "side": 1, "fixed": True},
    {"id": "wy-easier", "text": "easier to turn", "color": "motion", "t0": A("vo04:easier"), "t1": A("vo04:Your", -0.1), "anchor": {"hand": ["chair", 0]}, "side": -1, "fixed": True},
    {"id": "wy-arms", "text": "your arms do the work", "color": "energy", "t0": A("vo04:arms"), "t1": cut("whoa"), "anchor": {"hand": ["chair", 1]}, "side": 1, "fixed": True},
    {"id": "wo-skater", "text": "a scratch spin", "color": "ghost", "t0": A("vo05:Skaters"), "t1": cut("measure") - 0.3, "anchor": {"skater": 1}, "side": -1, "fixed": True},
    {"id": "ms-18", "text": "18°", "color": "motion", "t0": A("vo06:eighteen"), "t1": cut("takeaway"), "anchor": {"gap": ["out", 3]}, "side": 1, "fixed": True},
    {"id": "ms-48", "text": "48°", "color": "motion", "t0": A("vo06:fifty."), "t1": cut("takeaway"), "anchor": {"gap": ["in", 2]}, "side": 1, "fixed": True},
]
BADGES = [
    {"id": "model", "title": "Model", "text": "Body 2.0 kg·m², assumed.", "t0": A("vo03:Suddenly,"), "t1": cut("why") + 0.5, "slot": "tr"},
    {"id": "friction", "text": "Friction ignored", "t0": cut("takeaway") + 0.6, "t1": cut("tease"), "slot": "tr"},
    {"id": "skater", "text": "Illustration", "t0": cut("whoa") + 0.5, "t1": cut("measure") - 0.3, "slot": "tr"},
]


def view(look, dist, pitch, yaw=0.0, fov=32.0):
    return {"look": [round(v, 3) for v in look], "dist": round(dist, 2), "yaw": yaw, "pitch": pitch, "fov": fov}


def key(t, v, ease="p2", **over):
    return {"t": round(t, 4), **v, **over, "ease": ease}


HOOK = view([0.0, 95.0, 16.0], 900.0, 85.0)              # from above: the chair's circle between the title and the captions
TOP = view([0.0, 95.0, 30.0], 740.0, 85.0)
SIDE = view([0.0, 72.0, 0.0], 470.0, 12.0)
WIDE = view([60.0, 80.0, -10.0], 760.0, 8.0)
CAM = {
    "hook": [key(0.0, HOOK), key(cut("normal"), {**HOOK, "dist": 880.0}, "sine")],
    "normal": [key(cut("normal"), {**HOOK, "dist": 880.0}), key(A("vo02:Sit"), TOP, "p3"), key(cut("change"), {**TOP, "dist": 730.0}, "sine")],
    "change": [key(cut("change"), {**TOP, "dist": 730.0}), key(cut("why"), {**TOP, "dist": 700.0}, "sine")],
    # the turn: from above down to the side as "With no twist from outside" is said
    "why": [key(cut("why"), {**TOP, "dist": 700.0}), key(A("vo04:With"), {**TOP, "dist": 690.0}, "sine"), key(A("vo04:change."), SIDE, "p3"),
            key(cut("whoa"), {**SIDE, "dist": 480.0}, "sine")],
    "whoa": [key(cut("whoa"), {**SIDE, "dist": 480.0}), key(A("vo05:In"), WIDE, "p3"), key(cut("measure"), {**WIDE, "dist": 770.0}, "sine")],
    "measure": [key(cut("measure"), TOP), key(cut("takeaway"), {**TOP, "dist": 750.0}, "sine")],
    "takeaway": [key(cut("takeaway"), {**TOP, "dist": 750.0}), key(cut("tease"), {**SIDE, "pitch": 30.0, "dist": 560.0}, "p3")],
    "tease": [key(cut("tease"), {**SIDE, "pitch": 30.0, "dist": 560.0}), key(EC, HOOK, "p3"), key(DUR, HOOK, "sine")],
}
SHOTS = [{"at": CUTS[b["id"]], "name": b["id"]} for b in BEATS]

TITLE = {"series": "Rest Frame · No. 005", "title": "The spinning *chair*", "t1": round(cut("normal") - 0.45, 4), "y": 0.183, "sig": 0.3}
# caption pages the phrase pager can't break well on its own (set/captions_py.py: ' / ' row, ' | ' page)
CAP_FIX = [
    'Measure it: | ghosts a tenth / of a second apart.',
]

film = {
    "id": "rest-frame-005", "fps": FPS, "bpm": BPM, "dur": DUR, "poster": 0.0,
    "_doc": "Compiled by compile.py from script.md, vo/ and the direction in compile.py. Do not edit by hand.",
    "shots": SHOTS, "beats": BEATS, "clock": KEYS, "takes": TAKES, "cue": CUE, "spine": SPINE,
    "model": MODEL, "moves": MOVES, "hookMoves": HOOK_MOVES, "dt": DT, "ladders": LADDERS,
    "skater": {"x": 115.0, "z": -25.0, "h": 162.0},
    "labels": LABELS, "badges": BADGES, "cam": CAM,
    "captionY": 0.632, "title": TITLE, "hookNote": {"text": "2× slower", "t1": cut("normal")},
    "captions": phrase_captions(f, max_chars=24, fix=CAP_FIX, until=EC - 0.3), "endCard": EC,
    "end": {"title": "Next drop: the ten-metre *straw*", "follow": "Follow Rest Frame",
            "foot": "Olivia Oliver, 342 rpm, Warsaw 2015: the Guinness record for the fastest spin on ice skates (as of 2026)."},
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}

ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS]
ev.append({"t": round(T_PUSH, 4), "kind": "contact", "tag": "push"})
for i, (a, b, r) in enumerate(CUE["moves"]):
    ev.append({"t": round(b, 4), "kind": "spring", "tag": f"move{i + 1}"})                  # a boing as the arms settle
    ev.append({"t": round(a, 4), "kind": "swell" if r < 0.5 else "energy.loss", "tag": f"move{i + 1}:start"})
ev.append({"t": round(cut("measure"), 4), "kind": "time.slow", "tag": "measure:freeze"})
ev.append({"t": A("vo05:minute."), "kind": "reveal", "tag": "342"})
for k in ("out", "in", "hook", "loop"):
    L = LADDERS[k]
    for i, t in enumerate(L["stamps"]):
        if math.isfinite(t) and 0.05 < t < L["t1"] and i % 3 == 0:                        # one shutter per three ghosts
            ev.append({"t": round(t, 4), "kind": "strobe", "tag": f"{k}:g{i}"})
for lb in LABELS:
    ev.append({"t": lb["t0"], "kind": "label", "tag": lb["id"]})
for bd in BADGES:
    ev.append({"t": round(bd["t0"], 4), "kind": "badge", "tag": bd["id"], "text": bd["text"]})
ev.append({"t": SPINE[0]["t0"], "kind": "counter.show", "tag": "spine"})
for s in SPINE[1:]:
    ev.append({"t": s["t0"], "kind": "counter.tick", "tag": f"spine:{s['label']}"})
ev.append({"t": A("vo06:fifty."), "kind": "counter.end", "tag": "spine:fifty"})
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
    if isinstance(x, tuple):
        return [finite(v) for v in x]
    return x


(HERE / "film.json").write_text(json.dumps(finite(film), indent=1, ensure_ascii=False, allow_nan=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
print(f"film.json: {len(SHOTS)} shots, {len(KEYS)} clock keys, {len(TAKES)} takes, {len(LABELS)} labels, {len(BADGES)} badges, end card {EC} s, {DUR} s")
print(f"sheet.json: {len(sheet['events'])} events ({'with' if shown else 'without'} the page's cue measurements)")
for b in BEATS:
    print(f"  {b['id']:<9} {b['t0']:6.2f}–{b['t1']:6.2f}  cut {CUTS[b['id']]:.4f}")
print(f"  ratio {RATIO:.3f}: {RPM_OUT:.0f} → {RPM_IN:.1f} rpm; steps {STEP_OUT:.1f}° → {STEP_IN:.1f}°; push {T_PUSH:.3f}; moves {[[round(a, 2), round(b, 2), r] for a, b, r in CUE['moves']]}; loop {R_t:.3f}")
