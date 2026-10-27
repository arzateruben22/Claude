"""Compile Light Minute No. 004, "The falling Moon": script + voice timings + this direction → film.json and
sheet.json. Every moment hangs on a beat or a spoken word; every physical number comes from claims.json.

  python3 -I films/channels/space/ep04/compile.py

Units: 1 scene unit = 10,000 km, and Earth, the Moon and the orbit are drawn at true scale (Earth 1.27 units
across, the orbit 38.44 units out: "about thirty Earths away"). The only magnification is the Moon's fall below its
straight line, drawn a million times larger (badged), and the apple, a glyph of fixed size.
One clock, "moon" (τ in seconds of the Moon's motion): ×20,000 for the orbit diagrams, ×120,000 while gravity is
switched off (so the straight flight is seen leaving the orbit), and ×8 for the whoa's one minute, which plays in
seven and a half seconds.
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
ID = "lightminute-004"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}

# ── the physics (claims.json) ───────────────────────────────────────────────
U = 1e4                                    # km per scene unit
R_ORB = 384400 / U                         # c2: 38.44 units
R_EARTH, R_MOON = 6371 / U, 1737.4 / U     # mean radii (true scale)
V_KMS = 1.022                              # c3
P_ORB = 2 * math.pi * 384400 / V_KMS       # s: the circular orbit at that speed (27.3 days)
DROP_1S = (V_KMS * 1000) ** 2 / (2 * 384400e3)          # c12: 1.36 mm in one second (m)
DROP_1M = DROP_1S * 60 ** 2                              # c11: 4.9 m in one minute
MAG = 1e6                                                # the fall drawn a million times larger
assert abs(DROP_1S - 1.359e-3) < 2e-5 and abs(DROP_1M - 4.89) < 0.05, (DROP_1S, DROP_1M)

# ── the clock ───────────────────────────────────────────────────────────────
t_w, t_tk, t_rd = B["whoa"]["t0"], B["takeaway"]["t0"], B["readout"]["t0"]
t_min0 = A("vo05:one")                     # the whoa's minute starts on "in one *minute*" ...
RATE_W = 8.0                               # ... and plays at ×8, so it ends 7.5 s later, after "And it does."
t_min1 = round(t_min0 + 60 / RATE_W, 4)
assert t_min1 > A("vo05:does"), (t_min1, A("vo05:does"))
RATE_O = 2e4                               # the orbit diagrams: a day in 4.3 s (the Moon stays on one side of the frame)
RATE_OFF = 1.2e5                           # gravity off: the Moon flies about 40 units (an orbit's radius) along its straight line
# the gravity-off thought experiment (the first "gravity" is "switch gravity off"; "Gravity bends it back" is the second)
t_off, t_back = A("vo03:off"), A("vo03:Gravity#2")
assert t_back > t_off + 2.0, (t_off, t_back)
# the pull back after the whoa: the Moon goes back onto its orbit only once the camera is past dist 300 (0.49 units is
# then under 4 px: it doesn't "un-fall" in close-up), and the diagram settles after it
t_home0, t_home1, t_set = round(t_tk + 2.6, 4), round(t_tk + 3.1, 4), round(t_tk + 3.6, 4)
assert t_set < t_rd, (t_set, t_rd)          # the takeaway's run (below) ends before the readout
CLK = {"moon": [{"t": 0.0, "rate": 0.0}, {"t": B["normal"]["t0"], "rate": RATE_O},
                {"t": t_off, "rate": RATE_OFF}, {"t": t_back, "rate": RATE_O},
                {"t": B["why"]["t0"], "rate": 0.0, "badge": None},
                {"t": t_min0, "rate": RATE_W}, {"t": t_min1, "rate": 0.0, "badge": None},
                {"t": t_set, "rate": RATE_O}, {"t": t_rd, "rate": 0.0, "badge": None},
                ]}   # the takeaway's Moon runs on, falling round its orbit; the readout holds


def tau(keys, t):
    out, prev_t, prev_r = 0.0, 0.0, keys[0]["rate"]
    for k in keys[1:]:
        if t <= k["t"]:
            break
        out += prev_r * (k["t"] - prev_t)
        ramp = k.get("ramp", 0.0)
        if ramp:
            u = min(t, k["t"] + ramp) - k["t"]
            out += prev_r * u - (prev_r - k["rate"]) * u * u / (2 * ramp)
            if t <= k["t"] + ramp:
                return out
            prev_t, prev_r = k["t"] + ramp, k["rate"]
            continue
        prev_t, prev_r = k["t"], k["rate"]
    return out + prev_r * (t - prev_t)


# where the Moon is when the whoa's minute starts: the hook (frame 0) shows the same place, the minute already run
TH_W = math.radians(-50.0)                 # the Moon's angle on its orbit at the whoa (lower right in the diagram)
TH0 = TH_W - 2 * math.pi * tau(CLK["moon"], t_min0) / P_ORB

# gravity off: the Moon itself flies on along its straight line at the true speed (the clock above); back on, it is
# drawn back onto its orbit (an illustration of "bends it back", under the thought-experiment note)

# ── camera ──────────────────────────────────────────────────────────────────
TOP = {"target": [0, 0, 0], "dist": 540.0, "el": 70.0, "az": math.degrees(TH_W) - 90.0, "fov": 24, "fx": 0.5, "fy": 0.33}   # the orbit clears the notes and the spine
SIDE = {"target": [R_ORB / 2 * math.cos(TH_W), 0, -R_ORB / 2 * math.sin(TH_W)], "dist": 250.0, "el": 10.0, "az": math.degrees(TH_W), "fov": 24, "fx": 0.5, "fy": 0.40}
# the close view centres between the Moon's straight line and where the Moon is drawn after its minute (0.49 units
# toward Earth), and looks so that the straight line runs across the frame and the fall points down
GAP = DROP_1M * MAG / 1000 / U
mx, mz = (R_ORB - GAP / 2) * math.cos(TH_W), -(R_ORB - GAP / 2) * math.sin(TH_W)
CLOSE = {"target": [mx, 0, mz], "dist": 7.0, "el": 62.0, "az": math.degrees(TH_W) - 90.0, "fov": 24, "fx": 0.62, "fy": 0.36}   # right of centre: labels left
key = lambda t, P, **k: {"t": round(t, 4), **P, **k}
# the normal's diagram turns so the Moon passes over the top of the frame while it is talked about (away from the spine)
th_cut = TH0 + 2 * math.pi * tau(CLK["moon"], B["normal"]["t0"]) / P_ORB
# the Moon sweeps about 112° in the normal and the change (×20,000, then ×120,000 with gravity off): it enters 60°
# below the frame's right and leaves about 52° above it, on the side away from the spine and the notes
TOPN = dict(TOP, az=math.degrees(th_cut) + 60.0)
# the takeaway and the readout: turned so the Moon, where the readout holds it, sits 15° left of the top: its name and
# the light ring's arrival clear of the "real speed of light" note. The takeaway's run carries it 8.5° of that, so the
# pull back turns only 6.5° (at 30° it turned 21.5° in 1.6 s, a whip)
th_rd = TH0 + 2 * math.pi * tau(CLK["moon"], t_rd) / P_ORB
TOPT = dict(TOP, az=math.degrees(th_rd) - 90.0 - 15.0)
assert abs(TOPT["az"] - CLOSE["az"]) < 8.0, (TOPT["az"], CLOSE["az"])
t_end = A("vo08:Next", -0.25)
t_weak = A("vo04:weaker")
CAM = {
    # the hook (frame 0, the payoff), then a cut to the diagram: the Moon's place changes on the cut, not mid-move
    "hook": [key(0.0, CLOSE, dist=7.2), key(B["normal"]["t0"], CLOSE, dist=7.0, ease="sine")],
    "space": [
        key(B["normal"]["t0"], TOPN, dist=460.0), key(A("vo02:about", 0.4), TOPN, ease="sine"), key(B["why"]["t0"], TOPN, dist=534.0, ease="sine"),
        # the why: turn to the side so the apple and the Moon sit on one line from Earth's centre (a cut on the line's start)
        # then a slow push (about 0.5% a second) while Newton's test is drawn
        key(B["why"]["t0"] + 2.6, SIDE, ease="inout3"), key(t_weak + 0.6, SIDE, dist=SIDE["dist"] - 20.0, ease="sine"),
        # into the whoa over 2.8 s (not a whip), in two legs: onto the Moon, halfway round and still far, then a push in
        # on it (in one leg the distance, eased in log, ran ahead of the target and the Moon left the frame)
        key(t_weak + 2.0, dict(CLOSE, dist=60.0, **{k: (SIDE[k] + CLOSE[k]) / 2 for k in ("el", "az", "fx", "fy")}), ease="inout3"),
        # then the payoff held close before a two-stage pull back: out on the Moon (it holds in frame), then over to the
        # diagram (not a whip: Earth and the orbit's near arc sweep up past the caption more slowly)
        key(t_min0, CLOSE, dist=7.4, ease="inout3"), key(t_min1, CLOSE, dist=7.0, ease="sine"), key(t_tk - 0.1, CLOSE, dist=6.9, ease="sine"),
        key(t_tk + 2.0, dict(CLOSE, dist=200.0, el=70.0), ease="inout2"), key(t_set, TOPT, ease="inout2"), key(t_end, TOPT, dist=532.0, ease="sine"),
        key(t_end + 2.6, CLOSE, dist=7.0, ease="inout3"), key(B["tease"]["t1"], CLOSE, dist=7.2, ease="sine"),   # ends on frame 0's pose
    ],
}
SHOTS = [{"at": 0.0, "name": "hook"}, {"at": B["normal"]["t0"], "name": "space"}, {"at": t_end, "name": "end"}]
CAM["end"] = CAM["space"][-3:]

# ── the overlay ─────────────────────────────────────────────────────────────
SPINE = [0.5, 0.555]
LABELS = [
    # the hook's text is gone before the cut (the label carries the ×1,000,000: a note would sit on the title)
    # frame 0: the straight line and the fall (the Moon needs no name in the payoff; the spine says what fell)
    {"id": "l-line-h", "text": "its straight line", "kind": "light", "anchor": "ghost", "t0": 0.0, "t1": round(B["normal"]["t0"] - 0.5, 4), "side": -1},
    {"id": "l-fall-h", "text": "fall ×1,000,000", "kind": "gravity", "anchor": "gap", "t0": 0.0, "t1": round(B["normal"]["t0"] - 0.5, 4), "side": -1, "v": "middle", "fixed": True},
    {"id": "l-earth", "text": "Earth", "kind": "body", "anchor": "earth", "t0": A("vo02:Look"), "t1": B["change"]["t0"], "side": 1},
    # the Moon's name steps aside while the row of thirty Earths reaches it (each in one spot: no hops)
    {"id": "l-moon", "text": "Moon", "kind": "body", "anchor": "moon", "t0": A("vo02:Look", 0.3), "t1": round(A("vo02:thirty") - 0.4, 4), "side": -1, "fixed": True},
    {"id": "l-30", "text": "30 Earths", "kind": "body", "anchor": "row", "t0": A("vo02:thirty"), "t1": A("vo02:And"), "side": -1, "v": "below", "fixed": True},   # off the row (it runs up-left to Earth)
    {"id": "l-moon2", "text": "Moon", "kind": "body", "anchor": "moon", "t0": round(A("vo02:And") + 0.4, 4), "t1": t_off, "side": -1, "fixed": True},   # once "30 Earths" has gone
    # under the straight line, behind the flying Moon (it flies up and to the right, away from its name)
    {"id": "l-free", "text": "no gravity: a straight line", "kind": "light", "anchor": "free", "t0": round(t_off + 0.6, 4), "t1": round(t_back - 0.45, 4), "side": -1, "v": "below", "fixed": True},
    # left of the arrow's head: off the shaft it names
    {"id": "l-pull", "text": "gravity", "kind": "gravity", "anchor": "pull", "t0": t_back, "t1": B["why"]["t0"], "side": -1, "v": "middle", "fixed": True},
    # the side view names its two ends as soon as it settles; Earth hands its spot to the apple (no hop), which is named
    # until the ruler comes in (its pill would hide the pull curve's knee; the story note names it after that)
    {"id": "l-earth-w", "text": "Earth", "kind": "body", "anchor": "earth", "t0": round(B["why"]["t0"] + 2.6, 4), "t1": round(A("vo04:apple") - 0.45, 4), "side": 1},
    {"id": "l-moon-w", "text": "Moon", "kind": "body", "anchor": "moon", "t0": round(B["why"]["t0"] + 2.6, 4), "t1": A("vo04:weaker", 0.5), "side": -1, "v": "below", "fixed": True},
    {"id": "l-apple", "text": "apple", "kind": "body", "anchor": "apple", "t0": A("vo04:apple"), "t1": round(A("vo04:sixty") - 0.4, 4), "side": 1, "fixed": True},
    {"id": "l-60", "text": "60 Earth radii", "kind": "gravity", "anchor": "ruler", "t0": A("vo04:sixty"), "t1": A("vo04:weaker", 0.5), "side": 1},
    # the curve says what it is (a strength, not a path); below it, right of its knee
    {"id": "l-prof", "text": "pull: 1/distance²", "kind": "gravity", "anchor": "prof", "t0": A("vo04:fades"), "t1": A("vo04:weaker", 0.5), "side": 1, "v": "below", "fixed": True},
    {"id": "l-line", "text": "its straight line", "kind": "light", "anchor": "ghost", "t0": round(t_min0 + 0.6, 4), "t1": round(t_tk - 0.3, 4), "side": -1},
    # the two falls, side by side, each named under or beside its own end: the apple's second, the Moon's minute
    {"id": "l-drop", "text": "1 second", "kind": "body", "anchor": "apple2end", "t0": A("vo05:apple", 1.0), "t1": round(t_tk - 0.3, 4), "side": -1, "v": "below", "fixed": True},
    {"id": "l-fall", "text": "1 minute", "kind": "gravity", "anchor": "gap", "t0": round(t_min1 - 0.3, 4), "t1": round(t_tk - 0.3, 4), "side": -1, "v": "middle", "fixed": True},
    # the takeaway: the same two, the pull between them, the straight lines it bends all the way round
    {"id": "l-earth-t", "text": "Earth", "kind": "body", "anchor": "earth", "t0": round(t_set + 0.1, 4), "t1": round(t_end - 0.5, 4), "side": 1},   # once the pull-back has settled
    # up-left of the Moon, in one spot through the readout; that spot is the takeaway's speed note's corner, so the name
    # arrives as that note leaves
    {"id": "l-moon-t", "text": "Moon", "kind": "body", "anchor": "moon", "t0": round(t_rd + 0.3, 4), "t1": round(t_end - 0.5, 4), "side": -1, "fixed": True},
    {"id": "l-ring", "text": "light in 1.3 s", "kind": "light", "anchor": "ring", "t0": round(A("vo07:one") + 1.3, 4), "t1": round(t_end - 0.5, 4), "side": 1},   # once the ring is there
]
# Notes in one corner stack in this order, and each is pushed below any visible note of the other corner made before
# it: the speed note sat under the old wide scale tag and jumped up when it left. hud.js tests even a note that is off
# screen, so a wide one pushed below the speed note drags every later note in its corner down a row. So the normal's
# honesty note is two narrow tags (each clears the widest speed note, "120,000× faster", x 45–254 of 540 in the draft,
# plus the 6 px gap: "Markers enlarged" x 267–450, "True scale" x 331–450, the shorter one below, where the orbit's top
# arc passes), and the wide apple note comes last.
BADGES = [
    {"id": "b-marks", "text": "markers enlarged", "t0": B["normal"]["t0"], "t1": B["change"]["t0"], "slot": "tr"},   # the rings round Earth and the Moon
    {"id": "b-true", "text": "true scale", "t0": B["normal"]["t0"], "t1": B["change"]["t0"], "slot": "tr"},
    {"id": "b-time", "clock": "moon", "t0": B["normal"]["t0"], "t1": t_end, "slot": "tl"},
    {"id": "b-thought", "text": "thought experiment", "t0": t_off, "t1": round(t_back + 1.0, 4), "slot": "tr"},   # through the bend back
    {"id": "b-mag", "text": "falls ×1,000,000", "t0": t_min0, "t1": t_home1, "slot": "tr"},   # until the Moon is back on its orbit
    {"id": "b-real", "text": "real speed of light", "t0": A("vo07:one"), "t1": round(t_end - 0.5, 4), "slot": "tr"},
    {"id": "b-story", "text": "the apple: a story, not to scale", "t0": A("vo04:apple"), "t1": A("vo04:weaker", 0.7), "slot": "tr"},   # while the apple is drawn (it leaves with the glyph)
]
COUNTERS = [
    {"id": "c-fall-h", "label": "below its straight line · in one minute", "text": "4.9 m", "t0": 0.0, "t1": round(B["normal"]["t0"] - 0.5, 4)},   # the drawn gap, as in the whoa's last frame
    {"id": "c-earths", "label": "Earths from here to the Moon", "text": "30", "t0": A("vo02:thirty"), "t1": A("vo02:And")},
    {"id": "c-speed", "label": "the Moon's sideways speed", "text": "1 km/s", "t0": A("vo02:sideways"), "t1": A("vo02:That's")},
    {"id": "c-nyb", "label": "New York → Boston, at that speed", "text": "5 min", "t0": A("vo02:That's"), "t1": B["change"]["t0"]},
    # the thought experiment: with gravity off it falls nothing below its straight line; with gravity, 1.4 mm each second
    {"id": "c-off", "label": "below its straight line · each second", "text": "0 mm", "t0": t_off, "t1": t_back},
    {"id": "c-on", "label": "below its straight line · each second", "text": "1.4 mm", "t0": t_back, "t1": B["why"]["t0"]},
    {"id": "c-dist", "label": "from Earth's center · Earth radii", "text": "60", "t0": A("vo04:sixty"), "t1": A("vo04:thirty-six")},
    {"id": "c-pull", "label": "gravity at the Moon · vs. at the apple", "text": "1/3,600", "t0": A("vo04:thirty-six"), "t1": A("vo04:weaker", 0.6)},   # leaves with the diagram, before the swing into the whoa
    # one number, two falls: the value holds and only its label steps from the apple to the Moon, on "And it does"
    # (the Moon is most of the way down by then)
    {"id": "c-49", "label": [[0.0, "an apple · its first second"], [A("vo05:does"), "the Moon · one minute"]], "text": "4.9 m",
     "t0": A("vo05:apple"), "t1": round(t_tk + 1.0, 4)},   # holds, lit, through the payoff; gone before the pull-back's sweep
    {"id": "c-same", "label": "one pull · apple and Moon", "text": "gravity", "t0": A("vo06:same"), "t1": t_rd},
    {"id": "c-read", "label": "light time · Earth to Moon", "text": "1.3 s", "read": True, "t0": A("vo07:Light"), "t1": round(t_end - 0.5, 4)},
]
for c in COUNTERS:
    c.setdefault("at", SPINE)
# the spine: one value fades out before the next fades in (0.4 s apart), so two never overlap
spine = [c for c in COUNTERS if c["at"] == SPINE]
for a, b in zip(spine, spine[1:]):
    if b["t0"] - a["t1"] < 0.4:
        a["t1"] = round(b["t0"] - 0.4, 4)

TITLE = {"series": "Light Minute · No. 004", "title": "The falling *Moon*", "t1": B["normal"]["t0"] - 0.5, "sig": A("line:vo01:end", 0.05)}
END = {"title": "Next light: how\u00a0many Earths fill the *Sun*?", "follow": "Light Minute · No. 005",   # breaks after "Next light:"
       "next": "Each second the Moon falls about 1.4 mm below a straight line."}   # footnote (c17), two lines inside the ring

CUE = {"tk": t_tk, "home0": t_home0, "home1": t_home1, "settle": t_set, "speed0": A("vo02:sideways"), "speed1": B["change"]["t0"], "off": t_off, "back": t_back, "row": A("vo02:thirty"), "min0": t_min0, "min1": t_min1, "ring": A("vo07:one"),
       "apple": A("vo04:apple"), "reach": A("vo04:reaches"), "ruler": A("vo04:sixty"), "weak": A("vo04:weaker"), "drop": A("vo05:apple"), "same": A("vo06:same")}
POSTER = A("vo05:does", 0.4)
# captions: number phrases and fixed phrases stay on one line (after the last anchor lookup)
glue(f, {"vo02": ["thirty Earths away.", "every second.", "New York", "to Boston", "in five minutes."],
         "vo04": ["sixty times", "from Earth's center", "thirty-six hundred", "times weaker."],
         "vo05": ["one minute,", "the Moon", "as far as an apple", "falls in one second."], "vo06": ["drops an apple", "is the same pull", "keeps the Moon falling."],
         "vo07": ["Earth to Moon:", "one point three seconds.", "the Moon"]})

film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": POSTER,
    "shots": SHOTS, "beats": BEATS,
    "phys": {"u": U, "r_orb": R_ORB, "r_earth": R_EARTH, "r_moon": R_MOON, "v_kms": V_KMS, "p_orb": P_ORB, "th0": TH0, "th_w": TH_W,
             "mag": MAG, "drop_1s": DROP_1S, "drop_1m": DROP_1M},
    "clk": CLK, "cam": CAM, "cue": CUE,
    "labels": LABELS, "badges": BADGES, "counters": COUNTERS,
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
ev += [{"t": t_off, "kind": "body.vanish", "tag": "gravity-off", "t1": t_off + 1.0},
       {"t": t_back, "kind": "arrive", "tag": "gravity-back"},
       {"t": A("vo05:does"), "kind": "arrive", "tag": "it-does"}]
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
print(f"film.json: {f.duration:.2f} s, {len(LABELS)} labels, {len(COUNTERS)} counters; minute {t_min0:.2f}–{t_min1:.2f}; "
      f"drop {DROP_1S * 1000:.2f} mm/s, {DROP_1M:.2f} m/min; end card {t_end:.2f}")
print(f"sheet.json: {len(sheet['events'])} events" + (f", {len(shown)} shown" if shown else ""))
