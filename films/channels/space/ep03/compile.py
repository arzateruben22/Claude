"""Compile Light Minute No. 003, "Venus day": script + voice timings + this direction → film.json and sheet.json.
Every moment hangs on a beat or a spoken word; every physical number comes from claims.json.

  python3 -I films/channels/space/ep03/compile.py

Two scene clocks run Venus: "orbit" (where it is on its orbit, and Earth on its) and "spin" (how far it has
turned), so the why can pause the orbit and show one 243-day turn alone, and the whoa can run both and show the
Sun coming back every 117 days. A third, "guess", spins the Cassinis' 23-hour guess. The clocks are piecewise
constant (plus one linear stop), integrated here exactly as clock.js integrates them, so the sunrise ticks and the
conjunction at the readout are computed, not placed by eye.
"""
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[3] / "kits/cinema/script"))
from timeline import Film   # noqa: E402
sys.path.insert(0, str(HERE.parent / "set"))
from capglue import glue    # noqa: E402

FPS, BPM = 30, 56.25
ID = "lightminute-003"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}

# ── the physics (claims.json) ───────────────────────────────────────────────
DAY = 86400.0
P_ORB = 224.701 * DAY                     # c9: Venus's year
P_ROT = 243.0226 * DAY                    # c8: one turn (retrograde, c10)
P_EARTH = 365.256 * DAY                   # c1
SOLAR = 1.0 / (1.0 / (P_ROT / DAY) + 1.0 / (P_ORB / DAY))   # c11: 116.75 days
R_V, R_E = 10.821, 14.960                 # orbits, 1 unit = 10 million km (c15: 108.2 million km)
C_KM = 299792.458
LT_SUN = R_V * 1e7 / C_KM                 # c15: 361 s
LT_RADAR = 2 * 38.2e6 / C_KM              # c16: 255 s
assert abs(SOLAR - 116.75) < 0.1, SOLAR

# ── the clocks ──────────────────────────────────────────────────────────────
t_cut = B["normal"]["t0"]
t_g1, t_g2 = A("vo03:Cassinis"), A("vo03:Schiaparelli")
t_true = A("vo04:Venus")
t_w, t_tk, t_rd = B["whoa"]["t0"], B["takeaway"]["t0"], B["readout"]["t0"]
STOP = 1.2                                 # the takeaway's clocks slow to a stop over 1.2 s, ending as the readout starts
R1, R2, R4 = 1e6, 2e6, 4e6                 # 11.6, 23 and 46 days a second ("10⁶×", "2,000,000×", "4,000,000×")
CLK = {
    "orbit": [{"t": 0.0, "rate": 0.0}, {"t": t_cut, "rate": R1, "badge": "1,000,000× faster"}, {"t": B["change"]["t0"], "rate": 0.0, "badge": None},
              {"t": t_g2, "rate": R1, "badge": "1,000,000× faster"}, {"t": B["why"]["t0"], "rate": 0.0, "badge": None},
              {"t": t_w, "rate": R4}, {"t": round(t_rd - STOP, 4), "rate": 0.0, "ramp": STOP, "badge": None}],
    "spin": [{"t": 0.0, "rate": 0.0}, {"t": t_cut, "rate": R1, "badge": "1,000,000× faster"}, {"t": B["change"]["t0"], "rate": 0.0, "badge": None},
             {"t": t_true, "rate": R2}, {"t": t_w, "rate": R4}, {"t": round(t_rd - STOP, 4), "rate": 0.0, "ramp": STOP, "badge": None}],
    "guess": [{"t": 0.0, "rate": 0.0}, {"t": t_g1, "rate": 5e4}, {"t": t_g2, "rate": 0.0, "badge": None}],
}


def tau(keys, t):
    """τ at film time t: piecewise-constant rates, a linear ramp into a stop (clock.js's 'lin' for a freeze)."""
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


# ── phases: Venus and Earth line up (inferior conjunction) as the readout starts; the pin is just before
# sunrise on frame 0 (the hook's "watch": the night side, the Sun about to come up behind the limb) ──
TH_C = math.radians(-35.0)                 # where the conjunction happens on the diagram (lower right)
tau_c = tau(CLK["orbit"], t_rd)
TH_V0 = TH_C - 2 * math.pi * tau_c / P_ORB
TH_E0 = TH_C - 2 * math.pi * tau_c / P_EARTH
th_v = lambda t: TH_V0 + 2 * math.pi * tau(CLK["orbit"], t) / P_ORB
psi_true = lambda t, psi0: psi0 - 2 * math.pi * tau(CLK["spin"], t) / P_ROT       # retrograde: the pin's angle falls
HOUR0 = math.pi / 2 + 0.42                 # local hour angle on frame 0 (π/2 = sunrise; it falls toward it)
PSI0 = HOUR0 + TH_V0 + math.pi


def hour(t):
    """the pin's local hour angle: 0 = noon, +π/2 = the moment of sunrise (it decreases with time on Venus)."""
    return psi_true(t, PSI0) - (th_v(t) + math.pi)


# the sunrises from the whoa to the readout: where hour(t) falls through π/2 (mod 2π)
SUNRISES = []
t, step = t_w, 1 / FPS
h0 = hour(t)
while t < t_rd:
    t1 = round(t + step, 6)
    h1 = hour(t1)
    k0, k1 = math.floor((h0 - math.pi / 2) / (2 * math.pi)), math.floor((h1 - math.pi / 2) / (2 * math.pi))
    if k1 < k0:                            # crossed: refine by bisection
        a, b = t, t1
        for _ in range(40):
            m = (a + b) / 2
            if math.floor((hour(m) - math.pi / 2) / (2 * math.pi)) < k0:
                b = m
            else:
                a = m
        SUNRISES.append({"t": round(b, 4), "th": round(th_v(b), 6)})
    t, h0 = t1, h1
assert len(SUNRISES) >= 3, SUNRISES

# ── the camera: one shot. A close view that follows Venus (the hook, the guesses, the radar and the true
# turn) and the diagram (the normal, the whoa, the takeaway, the readout); the end card pushes back in, so a
# replay loops to frame 0 ──
AZ = math.degrees(TH_V0)                   # the close view looks across the Sun's direction: Venus half lit on frame 0
CLOSE = {"target": [0, 0, 0], "dist": 24.0, "el": 10.0, "az": AZ, "fov": 24, "fx": 0.5, "fy": 0.38}
# the change and why close-ups look across the Sun's direction as it is then (the orbit has moved), on whichever side is nearer AZ
th_why = math.degrees(th_v(B["why"]["t0"]))
AZ2 = min((th_why + k * 180.0 for k in range(-8, 9)), key=lambda a: abs(a - AZ))
CLOSE2 = dict(CLOSE, az=AZ2, el=24.0)   # higher, so the "backwards" arrow round the equator reads as a ring
DIAG = {"target": [0, 0, 0], "dist": 205.0, "el": 70.0, "az": AZ, "fov": 24, "fx": 0.5, "fy": 0.34}   # Earth's orbit clears the notes and the spine
key = lambda t, P, **k: {"t": round(t, 4), **P, **k}
t_pull = A("vo02:On", 0.0)
t_push2, t_back, t_end = A("vo02:hides"), B["whoa"]["t0"], A("vo08:Next", -0.25)   # the push lands on the clouds on "lid of cloud"
CAM = {"space": [
    key(0.0, CLOSE, dist=23.4), key(t_cut, CLOSE, dist=24.0, ease="sine"),
    key(t_pull + 2.2, DIAG, ease="inout3"),
    key(t_push2, DIAG, dist=200.0, ease="sine"),   # hold the diagram until the push starts with the follow (else it dollies at the Sun)
    key(t_push2 + 1.6, CLOSE2, ease="inout3"), key(B["why"]["t0"], CLOSE2, dist=23.0, ease="sine"),
    key(t_w - 0.2, CLOSE2, dist=22.0, ease="sine"), key(t_w + 2.2, DIAG, ease="inout3"),
    # the whoa and the takeaway: a slow turn and push on the diagram (≤ 1.5° a second), so the sunrises don't sit still
    key(t_tk, DIAG, dist=188.0, el=64.0, az=AZ + 12.0, ease="sine"),
    key(t_end, DIAG, dist=184.0, el=66.0, az=AZ + 3.0, ease="sine"), key(t_end + 2.4, CLOSE, dist=23.4, ease="inout3"),
    key(B["tease"]["t1"], CLOSE, dist=24.0, ease="sine"),
]}
# how much the target follows Venus (1 in the close view, 0 on the diagram), eased with the same moves
FOLLOW = [[0.0, 1], [t_cut, 1], [t_pull + 2.2, 0], [t_push2, 0], [t_push2 + 1.6, 1], [t_w - 0.2, 1], [t_w + 2.2, 0],
          [t_end, 0], [t_end + 2.4, 1]]
SHOTS = [{"at": 0.0, "name": "space"}, {"at": t_end, "name": "end"}]
CAM["end"] = [key(t_end, DIAG, dist=184.0, el=66.0, az=AZ + 3.0), key(t_end + 2.4, CLOSE, dist=23.4, ease="inout3"), key(B["tease"]["t1"], CLOSE, dist=24.0, ease="sine")]
for shot, keys in CAM.items():                    # the bible's arc limit: ≤ 1.5° a second (the follow-pushes excepted: they cut across)
    for a, b in zip(keys, keys[1:]):
        if a.get("az") is not None and abs(a["az"] - b["az"]) < 30:
            assert abs(b["az"] - a["az"]) / (b["t"] - a["t"]) <= 1.5 + 1e-9, (shot, a["t"], b["t"])

# ── the overlay ─────────────────────────────────────────────────────────────
SPINE = [0.5, 0.555]
LABELS = [
    {"id": "l-earth", "text": "Earth", "kind": "body", "anchor": "earth", "t0": A("vo02:Earth"), "t1": t_push2, "side": 1},
    {"id": "l-venus", "text": "Venus", "kind": "body", "anchor": "venus", "t0": A("vo02:Venus"), "t1": t_push2, "side": -1},
    {"id": "l-sun", "text": "Sun", "kind": "star", "anchor": "sun", "t0": A("vo02:Sun"), "t1": A("vo02:Next"), "side": 1},
    # (the guesses are the spine's to say: "guess · one turn"; a label on Venus would cover the turning meridian)
    {"id": "l-radar", "text": "radar", "kind": "light", "anchor": "beam", "t0": A("vo04:radar"), "t1": A("vo04:Venus"), "side": 1, "v": "middle"},
    {"id": "l-back", "text": "turns backwards", "kind": "body", "anchor": "arrow", "t0": A("vo04:backwards"), "t1": t_w, "side": -1, "fixed": True},
    {"id": "l-you", "text": "you", "kind": "light", "anchor": "pin", "t0": A("vo05:Stand"), "t1": A("vo05:hundred"), "side": 1},
    {"id": "l-rise", "text": "a sunrise", "kind": "light", "anchor": "rise", "t0": SUNRISES[0]["t"], "t1": round(SUNRISES[0]["t"] + 3.5, 4), "side": 1},
    {"id": "l-ring", "text": "6 min", "kind": "light", "anchor": "ring", "t0": A("vo07:six"), "t1": round(A("vo07:round") - 0.3, 4), "side": -1},
    {"id": "l-echo", "text": "4 min round trip", "kind": "light", "anchor": "echo", "t0": A("vo07:round"), "t1": round(t_end - 0.3, 4), "side": -1, "fixed": True},
]
BADGES = [
    {"id": "b-nts", "text": "not to scale", "t0": t_cut, "t1": t_end, "slot": "tr"},
    {"id": "b-illus-h", "text": "clouds: illustration", "t0": 0.0, "t1": t_cut, "slot": "bl"},
    {"id": "b-illus", "text": "clouds: illustration", "t0": t_push2, "t1": round(t_w + 1.4, 4), "slot": "tr"},
    {"id": "b-orbit", "clock": "orbit", "t0": t_cut, "t1": t_rd, "slot": "tl"},
    {"id": "b-spin", "clock": "spin", "t0": t_true, "t1": t_w, "slot": "tl"},
    {"id": "b-guess", "clock": "guess", "t0": t_g1, "t1": t_g2, "slot": "tl"},
    {"id": "b-paused", "text": "orbit paused", "t0": t_true, "t1": t_w, "slot": "tl"},
]
COUNTERS = [
    {"id": "c-turn-h", "label": "one turn on Venus · days", "text": "?", "t0": 0.0, "t1": t_cut},
    {"id": "c-earth", "label": "sunrises a year · Earth", "text": "365", "t0": A("vo02:Sun"), "t1": A("vo02:Next", -0.2)},
    {"id": "c-g1", "label": "guess · one turn", "text": "23 hours", "t0": A("vo03:clocked"), "t1": t_g2},
    {"id": "c-g2", "label": "guess · one turn = one year", "text": "225 days", "t0": t_g2, "t1": A("vo04:nineteen")},
    {"id": "c-1962", "label": "radar sees through the clouds", "text": "1962", "t0": A("vo04:nineteen"), "t1": A("vo04:two")},
    {"id": "c-radar", "label": "radar · one turn, days", "text": "243", "t0": A("vo04:two"), "t1": A("vo04:longer")},
    {"id": "c-vs", "label": "one turn · one year (days)", "text": "243 > 225", "t0": A("vo04:longer"), "t1": t_w},
    {"id": "c-solar", "label": "sunrise to sunrise · days", "text": "117", "t0": A("vo05:hundred"), "t1": A("vo05:rising")},
    {"id": "c-west", "label": "where the Sun rises on Venus", "text": "west", "t0": A("vo05:rising"), "t1": t_tk},
    {"id": "c-vs2", "label": "one turn · one year (days)", "text": "243 > 225", "t0": t_tk, "t1": A("vo06:But")},   # the payoff holds, lit
    {"id": "c-live", "label": "the day you'd live by · days", "text": "117", "t0": A("vo06:But"), "t1": t_rd},
    {"id": "c-read-sun", "label": "light time · Sun to Venus", "text": "6 min", "read": True, "t0": A("vo07:Light"), "t1": A("vo07:The")},
    {"id": "c-read-echo", "label": "radar round trip, at its closest", "text": "4 min", "read": True, "t0": A("vo07:The"), "t1": round(t_end - 0.3, 4)},
]
for c in COUNTERS:
    c.setdefault("at", SPINE)
for a, b in zip(COUNTERS, COUNTERS[1:]):          # two values never share the spot: 0.4 s between them
    if b["t0"] - a["t1"] < 0.4:
        a["t1"] = round(b["t0"] - 0.4, 4)

TITLE = {"series": "Light Minute · No. 003", "title": "Venus *day*", "t1": B["normal"]["t0"] - 0.5, "sig": A("line:vo01:end", 0.05)}
END = {"title": "Next light: the Moon that never *lands*", "follow": "Light Minute · No. 004",
       "next": "Radar first timed Venus's turn in 1962: about 243 days, backwards."}   # the true-fact footnote (c7)

CUE = {"g1": t_g1, "g2": t_g2, "true": t_true, "radar": A("vo04:radar"), "pierce": A("vo04:pierced"), "back": A("vo04:backwards"), "whoa": t_w, "tk": t_tk,
       "ring": A("vo07:six"), "echo": A("vo07:round"), "you": A("vo05:Stand"), "sun_lbl": A("vo02:Sun"),
       "dial0": A("vo05:Sun"), "dial1": t_tk}
POSTER = A("vo05:west", 0.5)
# captions: number phrases and fixed phrases stay on one line (after the last anchor lookup)
glue(f, {"vo02": ["three hundred sixty-five"], "vo03": ["one face", "faced the Sun."],
         "vo04": ["nineteen sixty-two,", "in California", "two hundred forty-three"],
         "vo05": ["Stand there,", "the spin", "and the orbit team up.", "hundred and seventeen", "rising in the west."],
         "vo06": ["live by", "the Sun coming back."]})

film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": POSTER,
    "shots": SHOTS, "beats": BEATS,
    "phys": {"p_orb": P_ORB, "p_rot": P_ROT, "p_earth": P_EARTH, "r_v": R_V, "r_e": R_E, "th_v0": TH_V0, "th_e0": TH_E0, "psi0": PSI0,
             "solar": SOLAR, "lt_sun": LT_SUN, "lt_radar": LT_RADAR},
    "clk": CLK, "cam": CAM, "follow": FOLLOW, "cue": CUE, "sunrises": SUNRISES,
    "labels": LABELS, "badges": BADGES, "counters": COUNTERS, "pills": [],
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
ev += [{"t": s["t"], "kind": "orbit.pass", "tag": f"sunrise-{i}"} for i, s in enumerate(SUNRISES)]   # a low ping per sunrise
ev += [{"t": CUE["radar"], "kind": "probe.ping", "tag": "radar"}, {"t": CUE["pierce"], "kind": "arrive", "tag": "radar-in"}]
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
print(f"film.json: {f.duration:.2f} s, {len(LABELS)} labels, {len(COUNTERS)} counters, {len(SUNRISES)} sunrises at "
      + ", ".join(f"{s['t']:.2f}" for s in SUNRISES) + f"; solar day {SOLAR:.2f} d; conjunction τ {tau_c / DAY:.1f} d; end card {t_end:.2f}")
print(f"sheet.json: {len(sheet['events'])} events" + (f", {len(shown)} shown" if shown else ""))
