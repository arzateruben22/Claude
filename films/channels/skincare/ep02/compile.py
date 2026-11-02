"""Compile Outer Layer No. 002, "Does SPF 100 beat SPF 50?": script + voice timings + this direction → film.json
(shots, ray shares, film thickness, camera keys, labels, badges, counters, captions, title and end card) and
sheet.json (the studio's cue sheet). Every moment hangs on a beat or a spoken word; every number on screen comes
from claims.json.

  python3 -I films/channels/skincare/ep02/compile.py

Units in the scene: 1 unit = 1 µm; the skin's surface is y = 0 and a sunscreen film sits on top of it (0 … thick).
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[3] / "kits/cinema/script"))
from timeline import Film   # noqa: E402
sys.path.insert(0, str(HERE.parent / "set"))
from capglue import glue, hold, keep_units    # noqa: E402

FPS, BPM = 30, 64.2857                   # bible §3
ID = "outerlayer-002"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}

# ── the numbers (claims.json) ──────────────────────────────────────────────
TEST_MG = 2.0                            # c5: SPF is tested at 2 mg/cm²
FILM_UM = TEST_MG * 10.0                 # c8 (computed): 2 mg/cm² at ≈ 1 g/cm³ ≈ 20 µm
REAL_MG = (0.39, 1.0)                    # c6: what people apply (Petersen & Wulf 2014)
THIN_UM = 0.5 * 10.0                     # the whoa's thin film: 0.5 mg/cm² ≈ 5 µm (inside c6's range)
PASS = {50: 1 / 50, 100: 1 / 100}        # c3: the idealised share let through, 1/SPF (badged "model")
# the thin film's share: the whoa shows the label falling "well below" without picking a side of the debate (c7):
# drawn at about a quarter of the label (the German multicenter study's figure at 0.5 mg/cm², per BASF), badged
# "illustration · debated", with no number on screen
PASS_THIN = 4 / 50
SC_UM, PAPER_UM = 17.0, 100.0            # c9 (No. 001's c12, c13)
assert abs(FILM_UM - 20.0) < 1e-9

# ── shots: variety in scale and framing (the owner's compelling pass) ──────────────────────────────────────────────
# hook: two blocks, two films, rays falling (the payoff) · ratio: one block close, half bare, half filmed · count:
# looking down on one film as a hundred rays land · inside: low, under the films, only what gets in lit · thin: one
# block, its film thinning as more gets through · gauge: the to-scale card · close: the hook again (the loop)
t_end = A("vo08:Next", -0.25)
SHOTS = [{"at": 0.0, "name": "hook"}, {"at": B["normal"]["t0"], "name": "ratio"}, {"at": A("vo03:Flip", -0.15), "name": "count"},
         {"at": A("vo04:look", -0.25), "name": "inside"}, {"at": B["whoa"]["t0"], "name": "thin"},
         {"at": B["toscale"]["t0"], "name": "gauge"}, {"at": B["takeaway"]["t0"], "name": "close"}]
TONE = {"hook": 0.62, "ratio": 0.62, "count": 0.3, "inside": 0.62, "thin": 0.92, "gauge": 0.92, "close": 0.62}   # three tones (bible §1)

# the count: SPF 50 first, then 100 as the voice says it
t_100 = A("vo03:hundred")
# the thin film: from the test layer down to the thin one while the voice says "a quarter to half"
t_thin0, t_thin1 = A("vo05:spread", -0.2), A("vo05:lab,", 0.2)
t_fall0, t_fall1 = A("vo05:protection"), A("vo05:label,", 0.3)

# ── the camera (the microscope stage) ──────────────────────────────────────────────────────────────────────────────
HOOK = {"target": [0, -4, 0], "el": 24, "fov": 30, "fx": 0.5, "fy": 0.46}
CAM = {
    "hook": [{"t": 0.0, **HOOK, "dist": 620, "az": -6}, {"t": B["normal"]["t0"], **HOOK, "dist": 560, "az": -2, "ease": "sine"}],
    # the ratio: close on one block; a push on "ratio" to the film's edge, where bare skin meets filmed skin
    "ratio": [{"t": B["normal"]["t0"], "target": [0, 0, 0], "el": 16, "fov": 30, "fx": 0.5, "fy": 0.44, "dist": 380, "az": -14},
              {"t": A("vo02:ratio:"), "target": [0, 2, 0], "el": 14, "fov": 30, "fx": 0.5, "fy": 0.44, "dist": 300, "az": -10, "ease": "inout2"},
              {"t": A("vo02:reddens."), "target": [0, 2, 0], "el": 13, "fov": 30, "fx": 0.5, "fy": 0.44, "dist": 270, "az": -6, "ease": "sine"},
              {"t": B["change"]["t0"] + 0.4, "target": [0, 2, 0], "el": 13, "fov": 30, "fx": 0.5, "fy": 0.44, "dist": 262, "az": -5, "ease": "sine"}],
    # the count: high and looking down (a new angle), drifting in as the hundred lands
    "count": [{"t": A("vo03:Flip", -0.15), "target": [0, 10, 0], "el": 58, "fov": 30, "fx": 0.5, "fy": 0.42, "dist": 520, "az": 0},
              {"t": t_100, "target": [0, 10, 0], "el": 62, "fov": 30, "fx": 0.5, "fy": 0.42, "dist": 470, "az": 4, "ease": "inout2"},
              {"t": A("vo04:look", -0.25), "target": [0, 10, 0], "el": 64, "fov": 30, "fx": 0.5, "fy": 0.42, "dist": 450, "az": 6, "ease": "sine"}],
    # inside: low, under the films, looking at what gets in
    "inside": [{"t": A("vo04:look", -0.25), "target": [0, -6, 0], "el": 4, "fov": 30, "fx": 0.5, "fy": 0.44, "dist": 600, "az": 0},
               {"t": A("vo04:half"), "target": [0, -6, 0], "el": 6, "fov": 30, "fx": 0.5, "fy": 0.44, "dist": 540, "az": 3, "ease": "inout2"},
               {"t": B["whoa"]["t0"], "target": [0, -4, 0], "el": 8, "fov": 30, "fx": 0.5, "fy": 0.44, "dist": 520, "az": 5, "ease": "sine"}],
    # thin: one block from the side, an orbit while the film thins, then a slow push as the rays pour through
    "thin": [{"t": B["whoa"]["t0"], "target": [0, 0, 0], "el": 12, "fov": 30, "fx": 0.5, "fy": 0.46, "dist": 380, "az": -22},
             {"t": t_thin1, "target": [0, 0, 0], "el": 12, "fov": 30, "fx": 0.5, "fy": 0.46, "dist": 340, "az": -6, "ease": "inout2"},
             {"t": B["toscale"]["t0"], "target": [0, -2, 0], "el": 10, "fov": 30, "fx": 0.5, "fy": 0.46, "dist": 290, "az": 2, "ease": "sine"}],
    "gauge": [{"t": B["toscale"]["t0"], "target": [0, -20, 0], "el": 10, "fov": 30, "fx": 0.62, "fy": 0.40, "dist": 600, "az": -6},
              {"t": B["takeaway"]["t0"], "target": [0, -20, 0], "el": 10, "fov": 30, "fx": 0.62, "fy": 0.40, "dist": 570, "az": -8, "ease": "sine"}],
    "close": [{"t": B["takeaway"]["t0"], **HOOK, "dist": 540, "az": 2},
              {"t": B["tease"]["t1"], **HOOK, "dist": 620, "az": -6, "ease": "sine"}],
}
for shot, keys in CAM.items():           # slow arcs (≤ 4° a second)
    for a, b in zip(keys, keys[1:]):
        rate = abs(b["az"] - a["az"]) / (b["t"] - a["t"])
        assert rate <= 4.0 + 1e-9, f"{shot}: az turns {rate:.2f}°/s"

# ── the overlay ─────────────────────────────────────────────────────────────
LABELS = [
    {"id": "l-50-h", "text": "SPF 50", "kind": "uv", "anchor": "film_l", "t0": 0.0, "t1": B["normal"]["t0"], "shot": "hook", "side": -1, "v": "above", "fixed": True},
    {"id": "l-100-h", "text": "SPF 100", "kind": "uv", "anchor": "film_r", "t0": 0.0, "t1": B["normal"]["t0"], "shot": "hook", "side": 1, "v": "above", "fixed": True},
    {"id": "l-bare", "text": "no film", "kind": "layer", "anchor": "bare", "t0": A("vo02:ratio:"), "t1": A("vo03:Flip", -0.15), "shot": "ratio", "side": -1, "v": "above", "fixed": True},
    {"id": "l-film", "text": "sunscreen film", "kind": "water", "anchor": "film", "t0": A("vo02:under"), "t1": A("vo03:Flip", -0.15), "shot": "ratio", "side": 1, "v": "above", "fixed": True},
    {"id": "l-50-i", "text": "SPF 50", "kind": "uv", "anchor": "film_l", "t0": A("vo04:look"), "t1": B["whoa"]["t0"], "shot": "inside", "side": -1, "v": "above", "fixed": True},
    {"id": "l-100-i", "text": "SPF 100", "kind": "uv", "anchor": "film_r", "t0": A("vo04:look"), "t1": B["whoa"]["t0"], "shot": "inside", "side": 1, "v": "above", "fixed": True},
    {"id": "l-thin", "text": "a thin film", "kind": "water", "anchor": "film", "t0": t_thin1, "t1": B["toscale"]["t0"], "shot": "thin", "side": 1, "v": "above", "fixed": True},
    {"id": "l-50-c", "text": "SPF 50", "kind": "uv", "anchor": "film_l", "t0": A("vo07:So", -0.1), "t1": t_end, "shot": "close", "side": -1, "v": "above", "fixed": True},
    {"id": "l-100-c", "text": "SPF 100", "kind": "uv", "anchor": "film_r", "t0": A("vo07:So", -0.1), "t1": t_end, "shot": "close", "side": 1, "v": "above", "fixed": True},
]
BADGES = [
    {"id": "b-model-h", "text": "model: one UVB band", "t0": 0.0, "t1": B["normal"]["t0"], "slot": "tr"},
    {"id": "b-model", "text": "model: one UVB band", "t0": B["normal"]["t0"], "t1": B["whoa"]["t0"], "slot": "tr"},
    {"id": "b-test", "text": "at the test layer, 2 mg/cm²", "t0": A("vo04:if"), "t1": B["whoa"]["t0"], "slot": "tl"},
    {"id": "b-debated", "text": "illustration · debated", "t0": A("vo05:protection"), "t1": B["toscale"]["t0"], "slot": "tr"},
    {"id": "b-studies", "text": "Petersen & Wulf, 2014", "t0": A("vo05:studies"), "t1": B["toscale"]["t0"], "slot": "tl"},
    {"id": "b-model-c", "text": "model: one UVB band", "t0": B["takeaway"]["t0"], "t1": t_end, "slot": "tr"},
]
SPINE = [0.30, 0.215]
COUNTERS = [
    {"id": "c-ratio", "label": "SPF = burn dose with ÷ without", "fmt": "text", "text": "ratio", "t0": A("vo02:ratio:"), "t1": A("vo03:Flip", -0.6), "at": SPINE},
    {"id": "c-50", "label": "SPF 50 · blocked", "fmt": "text", "text": "≈98%", "t0": A("vo03:fifty"), "t1": A("vo03:hundred", -0.4), "at": SPINE},
    {"id": "c-100", "label": "SPF 100 · blocked", "fmt": "text", "text": "≈99%", "t0": A("vo03:hundred"), "t1": A("vo04:look", -0.65), "at": SPINE},
    {"id": "c-in", "label": "gets in · SPF 50 vs 100", "fmt": "text", "text": "2% vs 1%", "t0": A("vo04:in:"), "t1": B["whoa"]["t0"], "at": SPINE},
    {"id": "c-real", "label": "applied in studies · mg/cm²", "fmt": "text", "text": "0.4–1", "t0": A("vo05:quarter"), "t1": B["toscale"]["t0"], "at": SPINE},
    {"id": "c-film", "label": "test film · ≈ 2 mg/cm²", "fmt": "text", "text": "≈20 µm", "t0": A("vo06:thick"), "t1": t_end, "at": SPINE},
]
CUTS = [sh["at"] for sh in SHOTS[1:]]


def before_cut(t1, lead=0.45):
    return round(t1 - lead, 4) if any(abs(t1 - c) < 1e-6 for c in CUTS) else t1


for row in BADGES + COUNTERS + LABELS:
    row["t1"] = before_cut(row["t1"])
for a, b in zip(COUNTERS, COUNTERS[1:]):
    if b["t0"] - a["t1"] < 0.4:
        a["t1"] = round(b["t0"] - 0.4, 4)

# the to-scale segment: the test film (≈20 µm) on top of the dead layer (17 µm), beside the paper (100 µm)
GAUGE = {"rise": [B["toscale"]["t0"], B["toscale"]["t0"] + 0.9], "sc": A("vo06:dead"), "film": A("vo06:thick"), "paper": A("vo06:sheet"),
         "back": [B["takeaway"]["t0"] - 0.5, B["takeaway"]["t0"] + 0.4], "sc_um": SC_UM, "film_um": FILM_UM, "paper_um": PAPER_UM}

TITLE = {"series": "Outer Layer · No. 002", "title": "SPF *100* or *50*?", "t1": B["normal"]["t0"] - 0.5, "sig": A("vo01:shield?", 0.35)}
END = {"title": "Next layer: why do fingers wrinkle in the *bath*?", "follow": "Outer Layer · No. 003",
       "next": "SPF is measured with 2 mg/cm² of product, a film about 20 µm thick (21 CFR 352.3; computed)."}

FILMS = {"hook": FILM_UM, "ratio": FILM_UM, "count": FILM_UM, "inside": FILM_UM, "gauge": FILM_UM, "close": FILM_UM}
CUE = {"ratio": A("vo02:ratio:"), "under": A("vo02:under"), "reddens": A("vo02:reddens."), "fifty": A("vo03:fifty"), "hundred": t_100,
       "blocked": A("vo03:blocked."), "in": A("vo04:in:"), "half": A("vo04:half"), "thin": [t_thin0, t_thin1], "fall": [t_fall0, t_fall1],
       "argued": A("vo05:argued"), "paper": A("vo06:paper."), "lets": A("vo07:lets")}
POSTER = A("vo04:half", 0.5)              # under the films: two rays of a hundred against one

glue(f, {"vo01": ["Bigger number,", "bigger shield?"], "vo02": ["isn't a percentage.", "burning light", "your skin", "under the film", "before it reddens."],
         "vo03": ["a fiftieth", "a hundredth,", "barely more blocked."],
         "vo04": ["half as much,", "the lab's."], "vo05": ["a quarter to half", "well below the label,"],
         "vo06": ["the dead layer", "a fifth", "of a sheet of paper."], "vo07": ["the bigger number", "twice as much.", "half as much in,", "enough of it."],
         "vo08": ["your arm?"]})
CAPS = hold(f, keep_units(f.captions(max_chars=24)))

film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": POSTER,
    "shots": SHOTS, "beats": BEATS, "tone": TONE,
    "uv": {"pass50": PASS[50], "pass100": PASS[100], "pass_thin": PASS_THIN, "film_um": FILM_UM, "thin_um": THIN_UM, "sc_um": SC_UM, "paper_um": PAPER_UM},
    "cam": CAM, "cue": CUE, "gauge": GAUGE, "films": FILMS,
    "labels": LABELS, "badges": BADGES, "counters": COUNTERS, "pills": [],
    "title": TITLE, "endCard": t_end, "end": END,
    "captions": CAPS,
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}

# ── the studio's cue sheet ─────────────────────────────────────────────────
ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS]
ev.append({"t": TITLE["sig"], "kind": "signature", "tag": "title"})
ev.append({"t": t_end, "kind": "signature", "tag": "end"})
for L in LABELS:
    if L["t0"] > 0:
        ev.append({"t": L["t0"], "kind": "label", "tag": L["id"]})
for c in COUNTERS:
    ev.append({"t": c["t0"], "kind": "counter.show", "tag": c["id"]})
for b in BADGES:
    if b["t0"] > 0:
        ev.append({"t": b["t0"], "kind": "badge", "tag": b["id"]})
ev += [
    {"t": CUE["reddens"], "kind": "swell", "tag": "redden", "t1": CUE["reddens"] + 1.2},
    {"t": CUE["in"], "kind": "reveal", "tag": "in"},
    {"t": t_thin0, "kind": "dissolve", "tag": "thin", "t1": t_thin1},
    {"t": B["whoa"]["t0"], "kind": "swell", "tag": "whoa", "t1": B["whoa"]["t1"]},
    {"t": GAUGE["film"], "kind": "scale", "tag": "g-film"},
    {"t": GAUGE["paper"], "kind": "reveal", "tag": "g-paper"},
]
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
sheet = {"duration": f.duration, "fps": FPS, "preset": "outerlayer-slide",
         "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: e["t"]),
         "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}
if shown:
    sheet["shown"] = shown

(HERE / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
print(f"film.json: {f.duration:.2f} s, {len(SHOTS)} shots, {sum(len(k) for k in CAM.values())} camera keys, {len(LABELS)} labels, "
      f"{len(BADGES)} badges, {len(COUNTERS)} counters, {len(CAPS)} caption pages, end card {t_end:.2f} s")
print(f"sheet.json: {len(sheet['events'])} events" + (f", {len(shown)} shown times from the picture" if shown else ""))
for pg in CAPS:
    print(f"  {pg['t0']:6.2f}–{pg['t1']:6.2f}  " + " / ".join(" ".join(w for w, _ in r).replace(" ", " ") for r in pg["lines"]))
