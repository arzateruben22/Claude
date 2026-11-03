"""Compile Outer Layer No. 006, "Same list as cigarettes" (the reboot's look: UV camera + macro flight): script +
voice timings + this direction → film.json and sheet.json. Every moment hangs on a beat or a spoken word; every
number on screen comes from claims.json, hedged as the sources are.

  python3 -I films/channels/skincare/ep06/compile.py

Places (one scene, far apart): the skin under the bed (the macro terrain at x = 0, deep tone, with a canopy of UVA
tubes above it), the same skin through the 365 nm camera (x = +4000), and a cut-face section for the long rays
(../set/section.js, x = −4000, units µm). The list (IARC Group 1) is an overlay plate, typeset, never a photo.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[3] / "kits/cinema/script"))
from timeline import Film   # noqa: E402
sys.path.insert(0, str(HERE.parent / "set"))
from capglue import glue, hold, keep_units    # noqa: E402

FPS, BPM = 30, 64.2857
ID = "outerlayer-006"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}

# ── the numbers (claims.json) ───────────────────────────────────────────────
GROUP_YEAR = 2009                       # c1
UVA_X = (10, 15)                        # c4: "may be 10 to 15 times" the midday sun, large powerful units (AAP 2011)
RR = (1.59, 1.75)                       # c6: first use before 35 (Boniol 2012, corrected; IARC 2007)
BANS = [("Brazil", 2009), ("Australia", 2015)]   # c7, c8 (commercial beds; WA from 2016)
EPI_UM, PAPER_UM = 100.0, 100.0         # c10: the epidermis ≈ 0.1 mm (0.07–0.12) on most skin; paper ≈ 100 µm
assert min(RR) > 1.5, "raised by more than half"
SC_UM, ROWS, GRAN_UM, SPIN_UM, BASAL_UM = 17.0, 15, 10.0, 63.0, 10.0   # the section's epidermis drawn ≈ 100 µm (simplified)
assert abs(SC_UM + GRAN_UM + SPIN_UM + BASAL_UM - EPI_UM) < 1e-9
TONE = "deep"           # bible §1: 006 is drawn in the deep tone

# ── shots ─────────────────────────────────────────────────────────────────
t_end = A("vo08:Next", -0.25)
CUE = {
    "list": A("vo01:list"), "most": A("vo01:Most"), "cigs": A("vo01:cigarettes?"), "deadly": A("vo01:deadly."),
    "who": A("vo02:World"), "top": A("vo02:top"), "tobacco": A("vo02:tobacco"), "ranks": A("vo02:ranks"), "sure": A("vo02:sure"), "harm": A("vo02:harm."),
    "follow": A("vo03:Follow"), "bed": A("vo03:bed:"), "uva": A("vo03:UVA,"), "long": A("vo03:long"), "large": A("vo03:large,"), "ten": A("vo03:ten"), "midday": A("vo03:midday"),
    "weighed": A("vo04:Weighing"), "young": A("vo04:young."), "pooled": A("vo04:pooled"), "before": A("vo04:before"), "melanoma": A("vo04:melanoma"), "half": A("vo04:half."),
    "countries": A("vo05:countries"), "brazil": A("vo05:Brazil"), "same": A("vo05:same"), "australia": A("vo05:Australia"), "off": A("vo05:off."),
    "rays": A("vo06:rays"), "layer": A("vo06:layer,"), "paper": A("vo06:paper."),
    "same2": A("vo07:Same"), "harm2": A("vo07:harm,"), "certainty": A("vo07:certainty."),
}
SHOTS = [{"at": 0.0, "name": "uvhook"}, {"at": CUE["most"], "name": "list"}, {"at": B["change"]["t0"], "name": "bed"}, {"at": B["whoa"]["t0"], "name": "uv"},
         {"at": B["toscale"]["t0"], "name": "section"}, {"at": B["takeaway"]["t0"], "name": "list2"}]

UX, SX = 4000.0, -4000.0
FLY = {"el": 14, "fov": 34, "fx": 0.5, "fy": 0.5}
UVK = {"target": [UX, 0.1, 0], "el": 2, "az": 0, "fov": 30, "fx": 0.5, "fy": 0.4}
CAM = {
    # the list is an overlay: behind it, a slow, dim flight over the skin (the tubes off)
    # the hook opens mid-push inside the UV camera: skin glowing under a bed's light; the list lights its two lines over it.
    # On "Most", the signature switch to daylight: the same skin, the flight
    "uvhook": [{"t": 0.0, **UVK, "dist": 30}, {"t": CUE["most"], **UVK, "dist": 23, "ease": "linear"}],
    "list": [{"t": CUE["most"], "target": [0, -0.4, 14], "dist": 26, "az": -6, **FLY},
             {"t": CUE["top"], "target": [-3, -0.4, 10], "dist": 22, "az": -10, **FLY, "ease": "inout2"},
             {"t": CUE["sure"], "target": [3, -0.4, 6], "dist": 20, "az": -2, **{**FLY, "el": 24}, "ease": "inout2"},
             {"t": B["change"]["t0"], "target": [0, -0.6, 2], "dist": 12, "az": 0, **{**FLY, "el": 34}, "ease": "in2"}],   # dives toward the skin: into the bed
    # into the bed: the tubes light; the flight runs under them; the camera holds through the why
    "bed": [{"t": B["change"]["t0"], "target": [0, -0.4, 6], "dist": 18, "el": 18, "az": 0, "fov": 34, "fx": 0.5, "fy": 0.56},
            {"t": CUE["ten"], "target": [0, -0.4, 2], "dist": 16, "el": 14, "az": 4, "fov": 34, "fx": 0.5, "fy": 0.56, "ease": "inout2"},
            {"t": B["whoa"]["t0"], "target": [0, -0.4, -4], "dist": 20, "el": 22, "az": 10, "fov": 34, "fx": 0.5, "fy": 0.56, "ease": "sine"}],
    "uv": [{"t": B["whoa"]["t0"], **UVK, "dist": 25}, {"t": B["toscale"]["t0"], **UVK, "dist": 23, "ease": "sine"}],
    "section": [{"t": B["toscale"]["t0"], "target": [SX, -70, 0], "dist": 520, "el": 8, "az": -6, "fov": 30, "fx": 0.5, "fy": 0.62},
                {"t": B["takeaway"]["t0"], "target": [SX, -70, 0], "dist": 480, "el": 8, "az": 0, "fov": 30, "fx": 0.5, "fy": 0.62, "ease": "sine"}],
    "list2": [{"t": B["takeaway"]["t0"], "target": [0, -0.4, 16], "dist": 26, "az": -8, **FLY},
              {"t": B["tease"]["t1"], "target": [0, -0.4, 10], "dist": 24, "az": -4, **FLY, "ease": "sine"}],
}
for shot, keys in CAM.items():
    for a, b in zip(keys, keys[1:]):
        rate = abs(b["az"] - a["az"]) / max(1e-6, b["t"] - a["t"])
        assert rate <= 6.0 + 1e-9, f"{shot}: az turns {rate:.2f}°/s"

LABELS = [
    {"id": "l-uva", "text": "UVA, the long rays", "kind": "uv", "anchor": "tube", "t0": CUE["uva"] - 0.2, "t1": CUE["weighed"], "shot": "bed", "side": 1, "v": "below", "fixed": True},
    {"id": "l-epi", "text": "the top layer", "kind": "cell", "anchor": "epi", "t0": CUE["layer"] - 0.6, "t1": B["takeaway"]["t0"], "shot": "section", "side": -1},
    {"id": "l-deep", "text": "UVA reaches past it", "kind": "uv", "anchor": "derm", "t0": CUE["rays"], "t1": B["takeaway"]["t0"], "shot": "section", "side": 1, "v": "below"},
]
BADGES = [
    {"id": "b-iarc", "text": "IARC Monographs, Group 1", "t0": CUE["deadly"], "t1": B["change"]["t0"], "slot": "tr"},
    {"id": "b-units", "text": "model · large, powerful units", "t0": B["change"]["t0"] + 0.3, "t1": B["why"]["t0"], "slot": "tl"},
    {"id": "b-pooled", "text": "pooled studies (meta-analyses)", "t0": CUE["pooled"], "t1": B["whoa"]["t0"], "slot": "tl"},
    {"id": "b-model-uv", "text": "model, not a photo", "t0": B["whoa"]["t0"], "t1": B["toscale"]["t0"], "slot": "tl"},
    {"id": "b-simp", "text": "simplified", "t0": B["toscale"]["t0"] + 0.3, "t1": B["takeaway"]["t0"], "slot": "tl"},
]
SPINE = [0.62, 0.2]
COUNTERS = [
    {"id": "c-uva", "label": "UVA vs midday sun (may be)", "fmt": "text", "text": "×10–15", "t0": CUE["ten"] - 0.2, "t1": B["why"]["t0"], "at": SPINE},
    {"id": "c-rr", "label": "melanoma risk, first use < 35", "fmt": "text", "text": "×1.6–1.75", "t0": CUE["half"] - 0.3, "t1": B["whoa"]["t0"], "at": SPINE},
    {"id": "c-end", "label": "Group 1 ranks", "fmt": "text", "text": "certainty", "t0": CUE["certainty"] - 0.2, "t1": t_end - 0.7, "at": SPINE},
]
PLATES = {
    "vfhook": {"t0": 0.0, "t1": CUE["most"]},
    "list": {"t0": 0.2, "t1": B["change"]["t0"] - 0.3, "lit": CUE["cigs"] - 0.6, "lit2": CUE["tobacco"] - 0.2, "rank": CUE["sure"] - 0.2},
    "list2": {"t0": B["takeaway"]["t0"] + 0.2, "t1": t_end - 0.3, "rank": CUE["harm2"] - 0.2},
    "rr": {"t0": CUE["pooled"] - 0.3, "t1": B["whoa"]["t0"] - 0.3, "before": CUE["before"], "rr": list(RR)},
    "bans": {"t0": CUE["countries"] - 0.2, "t1": B["toscale"]["t0"] - 0.3, "brazil": CUE["brazil"], "australia": CUE["australia"], "off": CUE["off"], "bans": BANS},
    "viewfinder": {"t0": B["whoa"]["t0"], "t1": B["toscale"]["t0"]},
    # no daylight strip: tones under a tanning-bed risk story would pair tones with a risk (bible §1)
}
BED = {"on": [B["change"]["t0"] + 0.2, CUE["bed"] + 0.3], "glow": [CUE["ten"] - 0.3, CUE["ten"] + 0.9]}
UVD = {"brazil": [CUE["brazil"], CUE["brazil"] + 1.0], "off": [CUE["australia"], CUE["off"] + 0.5]}
CUTS = [sh["at"] for sh in SHOTS[1:]]


def before_cut(t1, lead=0.35):
    return round(t1 - lead, 4) if any(abs(t1 - c) < 1e-6 for c in CUTS) else t1


for row in BADGES + COUNTERS + LABELS:
    row["t1"] = before_cut(row["t1"])
for a, b in zip(COUNTERS, COUNTERS[1:]):
    if b["t0"] - a["t1"] < 0.4:
        a["t1"] = round(b["t0"] - 0.4, 4)

GAUGE = {"rise": [B["toscale"]["t0"] + 0.4, B["toscale"]["t0"] + 1.3], "sc": CUE["layer"] - 0.2, "paper": CUE["paper"],
         "back": [B["takeaway"]["t0"] - 0.5, B["takeaway"]["t0"] + 0.4], "sc_um": EPI_UM, "paper_um": PAPER_UM, "bar": "top layer", "sc_text": "≈ 100 µm"}
RAYS = {"on": [B["toscale"]["t0"] + 0.2, CUE["rays"]]}

TITLE = {"series": "Outer Layer · No. 006", "title": "Same list as *cigarettes*", "t1": B["normal"]["t0"] - 0.5, "sig": A("vo01:cigarettes?", 0.35)}
END = {"title": "Next season: why do bath fingers *wrinkle*?", "follow": "Outer Layer · season 2",
       "next": "IARC classified UV-emitting tanning devices as carcinogenic to humans (Group 1) in 2009. Narration: synthetic voice (AI)."}
POSTER = A("vo07:certainty.", 0.3)

glue(f, {"vo01": ["Same list", "as cigarettes?", "just as deadly."], "vo02": ["cancer agency,", "top group,", "tobacco smoke.", "how sure", "how big the harm."],
         "vo03": ["into the bed:", "mostly UVA,", "the long rays.", "ten to fifteen times", "the midday sun."], "vo04": ["started young.", "before thirty-five", "more than half."],
         "vo05": ["whole countries", "commercial tanning beds", "that same year,", "switched its own off."], "vo06": ["the long rays", "the top layer,", "as thin as paper."],
         "vo07": ["Same list", "as cigarettes,", "size of harm,", "same certainty."], "vo08": ["Next season:", "bath fingers", "your arm?"]})
CAPS = hold(f, keep_units(f.captions(max_chars=24)))

film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": POSTER,
    "shots": SHOTS, "beats": BEATS, "tone": TONE, "trans": [],
    "bio": {"ux": UX, "sx": SX, "paper_um": PAPER_UM, "epi_um": EPI_UM, "sc_um": SC_UM, "rows": ROWS, "gran_um": GRAN_UM, "spin_um": SPIN_UM, "basal_um": BASAL_UM},
    "cam": CAM, "cue": CUE, "gauge": GAUGE, "plates": PLATES, "bed": BED, "uvd": UVD, "rays": RAYS,
    "labels": LABELS, "badges": BADGES, "counters": COUNTERS, "pills": [],
    "title": TITLE, "endCard": t_end, "end": END,
    "captions": CAPS,
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}

ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS]
ev.append({"t": TITLE["sig"], "kind": "signature", "tag": "title"})
ev.append({"t": t_end, "kind": "signature", "tag": "end"})
for L in LABELS:
    ev.append({"t": L["t0"], "kind": "label", "tag": L["id"]})
for c in COUNTERS:
    ev.append({"t": c["t0"], "kind": "counter.show", "tag": c["id"]})
for b in BADGES:
    if b["t0"] > 0:
        ev.append({"t": b["t0"], "kind": "badge", "tag": b["id"]})
ev += [
    {"t": CUE["most"], "kind": "cell.land", "tag": "shutter-0"},
    {"t": PLATES["list"]["lit"], "kind": "reveal", "tag": "list-lit"},
    {"t": PLATES["list"]["rank"], "kind": "cell.land", "tag": "rank"},
    {"t": B["change"]["t0"], "kind": "scale.jump", "tag": "into-bed"},
    {"t": BED["on"][0], "kind": "zap", "tag": "tubes-on"},
    {"t": PLATES["rr"]["before"], "kind": "reveal", "tag": "rr"},
    {"t": B["whoa"]["t0"], "kind": "cell.land", "tag": "shutter"},
    {"t": B["whoa"]["t0"], "kind": "swell", "tag": "whoa", "t1": B["whoa"]["t1"]},
    {"t": UVD["brazil"][0], "kind": "cell.land", "tag": "brazil"},
    {"t": UVD["off"][1] - 0.4, "kind": "cell.land", "tag": "australia-off"},
    {"t": B["toscale"]["t0"], "kind": "scale.jump", "tag": "into-section"},
    {"t": GAUGE["sc"], "kind": "scale", "tag": "g-epi"},
    {"t": GAUGE["paper"], "kind": "reveal", "tag": "g-paper"},
    {"t": B["takeaway"]["t0"], "kind": "scale.jump", "tag": "back-to-list"},
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
print("  shots " + " · ".join(f"{s['name']} {s['at']:.2f}" for s in SHOTS))
print(f"sheet.json: {len(sheet['events'])} events" + (f", {len(shown)} shown times from the picture" if shown else ""))
