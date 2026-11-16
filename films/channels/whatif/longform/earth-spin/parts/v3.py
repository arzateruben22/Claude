"""Possibility Lab S3 v2 parts in the owner's regular voice (script-v4 lines; his Part A / B / C / D recordings, cleaned with clarity.py --style normal --rumble and debreath.py).
Only Parts 1 and 2 are built this way for now.

  python3 -I parts/v2.py N build      assemble partNv2/vo (his sentences and phrases), lines.json, script.md, items.json, takes-used.json
  (then)  kits/cinema/voice/align.py partNv2/vo ... ; python3 -I parts/v2.py N debreath ; python3 -I parts/v2.py N compile
"""
import hashlib, json, math, re, subprocess, sys
from pathlib import Path
import numpy as np, soundfile as sf
HERE = Path(__file__).resolve().parent; ES = HERE.parent; REPO = ES.parents[4]; WH = ES.parents[1]
SP = WH / "voice-owner-spoken"; N = int(sys.argv[1]); STEP = sys.argv[2]
D = HERE / f"part{N}v3"; (D / "vo").mkdir(parents=True, exist_ok=True)
FPS, BPM = 30, 50
A = {s["k"]: s for s in json.loads((SP / "cutA/lines.json").read_text())["sentence_files"]}
V = json.loads((SP / "cutV/phrases.json").read_text())
CONFIG = {
 1: dict(items=[("open", "V", "p1_open"), ("sent", "A", 71), ("sent", "A", 72), ("sent", "A", 4), ("sent", "A", 12), ("sent", "A", 13), ("cta", "V", "ask_follow", "ask_sub"), ("cliff", "V", "p1_cliff")], hook="How fast before you float off?"),
 3: dict(items=[("open", "V", "p3_open"), ("sent", "A", 23), ("sent", "S", "u_ground"), ("sent", "S", "u_gust"), ("sent", "A", 26), ("sent", "A", 27), ("cta", "V", "ask_follow", "ask_sub"), ("cliff", "V", "p3_cliff")], hook="The air can't keep up"),
 4: dict(items=[("open", "V", "p4_open"), ("sent", "A", 29), ("sent", "S", "u_sea"), ("sent", "S", "u_depth"), ("sent", "A", 32), ("sent", "A", 33), ("cliff", "V", "p4_cliff"), ("closer", "V", "c4")], hook="Then the oceans move"),
 5: dict(items=[("open", "V", "p5_open"), ("sent", "A", 34), ("sent", "A", 35), ("sent", "A", 36), ("sent", "A", 37), ("sent", "A", 38), ("sent", "S", "u_eq6"), ("sent", "A", 40), ("sent", "A", 41), ("cta", "V", "ask_follow", "ask_sub"), ("cliff", "V", "p5_cliff")], hook="Storms are steered by the spin"),
 6: dict(items=[("open", "V", "p6_open"), ("sent", "A", 43), ("sent", "A", 44), ("sent", "A", 45), ("sent", "A", 46), ("sent", "A", 47), ("sent", "A", 48), ("cliff", "V", "p6_cliff"), ("closer", "V", "c6")], hook="The calendar breaks"),
 7: dict(items=[("open", "V", "p7_open"), ("sent", "A", 49), ("sent", "S", "u_speed3"), ("sent", "S", "u_w3"), ("sent", "A", 52), ("sent", "S", "u_jump2"), ("sent", "A", 54), ("sent", "A", 55), ("cta", "V", "ask_follow", "ask_sub"), ("cliff", "V", "p7_cliff")], hook="Three hours, then two"),
 8: dict(items=[("open", "V", "p8_open"), ("sent", "S", "u_w15"), ("sent", "S", "u_jump15"), ("sent", "A", 58), ("cliff", "V", "p8_cliff"), ("closer", "V", "c8")], hook="Almost weightless"),
 2: dict(items=[("open", "V", "p2_open")] + [("sent", "A", k) for k in (17, 18, 20, 21)] + [("cliff", "V", "p2_cliff"), ("closer", "V", "c2")], hook="A 12-hour day"),
}[N]
TITLES = ["What If Earth Spun Faster?", "The day is shrinking fast", "The air can't keep up", "Then the oceans move", "Storms are steered by the spin", "The calendar breaks", "Three hours, then two", "Almost weightless"]
SI = json.loads((HERE / "standin/lines.json").read_text())
def src(kind, key):
    if kind == "S": return HERE / "standin" / SI[key]["file"], SI[key]["text"], f"standin.{key}"
    if kind == "A": s = A[key]; return SP / "cutA" / s["file"], s["text"], f"A.s{key:03d}"
    p = V[key]; return SP / "cutV" / p["file"], p["text"], f"V.{key}"
if STEP == "build":
    lines, items, taken = [], [], []
    for k, it in enumerate(CONFIG["items"], 1):
        kind = it[0]; wav, text, tag = src(it[1], it[2]); x, sr = sf.read(wav)
        x = x if x.ndim == 1 else x.mean(1)
        if it[1] == "A" and it[2] == 47: x = x[int(70.9 * sr):]        # the owner paused 70 s before this sentence: keep only the speech
        rec = dict(kind=kind, text=text, take=tag)
        if kind == "cta":
            wav2, text2, tag2 = src(it[1], it[3]); y2, _ = sf.read(wav2); n = max(len(x), len(y2)); pad = lambda v: np.concatenate([v, np.zeros(n - len(v))])
            sf.write(D / "vo" / f"{k:02d}-sub.wav", pad(y2), sr, subtype="PCM_24"); x = pad(x); rec.update(sub_file=f"vo/{k:02d}-sub.wav", sub_text=text2, take_sub=tag2)
        f = D / "vo" / f"{k:02d}.wav"; sf.write(f, x, sr, subtype="PCM_24")
        uid = {"open": "open", "cta": "cta", "cliff": "cliff", "closer": "tease"}.get(kind, f"s{it[2]}" if it[1] == "A" else str(it[2]))
        lines.append({"id": f"vo{k:02d}", "beat": uid, "text": text, "stars": [], "phonemes": None, "file": f.name, "dur": round(len(x) / sr, 3), "sha256": hashlib.sha256(f.read_bytes()).hexdigest()})
        items.append(dict(rec, uid=uid, vo=f"vo{k:02d}", dur=round(len(x) / sr, 3)))
        taken.append(dict(line=f"vo{k:02d}", kind=kind, take=tag, sub_take=rec.get("take_sub"), text=text))
    (D / "vo/lines.json").write_text(json.dumps({"voice": "recorded", "speaker": "owner", "lang": "en-us", "made_by": "parts/v2.py", "lines": lines}, indent=1, ensure_ascii=False))
    (D / "items.json").write_text(json.dumps(items, indent=1, ensure_ascii=False))
    (D / "script.md").write_text(f"# Earth-spin Season 3 v2, part {N} of 8, the owner's regular voice (generated by parts/v2.py)\n\n" + "".join(f"## {l['beat']} {{shot: see v2.py · energy: 0.6}} (__)\nvo: {l['text']} {{-}}\n\n" for l in lines))
    (D / "takes-used.json").write_text(json.dumps({"sources": {"A": "voice-owner-spoken/Part A 1st half .m4a (cleaned, sentence-cut by word alignment, last take of each sentence kept)", "V": "voice-owner-spoken/Valerio St 3.m4a (cleaned; first take of each phrase)"}, "clean": "clarity.py --style normal --rumble, then debreath.py between aligned words", "takes": taken}, indent=1, ensure_ascii=False))
    print(f"part {N} v2: {len(lines)} lines, speech {sum(l['dur'] for l in lines):.1f} s"); sys.exit(0)
if STEP == "debreath":
    W = json.loads((D / "vo/words.json").read_text())["lines"]; ids = [l["id"] for l in W]
    for l in json.loads((D / "vo/lines.json").read_text())["lines"]:
        f = D / "vo" / l["file"]; raw = D / "vo" / "raw"; raw.mkdir(exist_ok=True)
        if not (raw / l["file"]).exists(): (raw / l["file"]).write_bytes(f.read_bytes())
        subprocess.run([sys.executable, str(REPO / "kits/cinema/voice/debreath.py"), str(raw / l["file"]), str(D / "vo/words.json"), str(f), "--line", l["id"]], check=True, capture_output=True)
    for sub in D.glob("vo/*-sub.wav"):                                    # the subscribe cta: its own alignment lives in words-sub.json (same id), see the build
        pass
    print("debreathed", len(ids), "lines"); sys.exit(0)
# ───────── compile ─────────
sys.path.insert(0, str(REPO / "kits/cinema/script")); sys.path.insert(0, str(REPO / "kits/cinema/film")); sys.path.insert(0, str(ES))
from timeline import Film  # noqa: E402
import importlib.util as _iu
_sp = _iu.spec_from_file_location("numerals_units", str(REPO / "kits/cinema/film/numerals.py")); _nu = _iu.module_from_spec(_sp); _sp.loader.exec_module(_nu)
from calc import T_ORB, R as R_EQ, E_ORB, E_NOW  # noqa: E402
items = json.loads((D / "items.json").read_text())
f = Film(D / "script.md", D / "vo", fps=FPS, bpm=BPM, grid=0.125)
LINE = {it["vo"]: it for it in items}
GAP = 0.9                                                  # a pause between lines, up to 1.2 s (the voiceless-gap rule)
plan = {}
for it in items:
    pre, hold = 0.1, GAP - 0.1
    if it["kind"] == "open": pre, hold = 0.2, (2.0 if N == 2 else GAP)
    if it["kind"] == "closer": pre, hold = 0.0, 0.0
    if it["kind"] == "cta": pre, hold = 0.15, GAP - 0.1
    if N == 2 and it["uid"] in ("s17", "s20"): hold = 3.2        # picture beats carried by sound effects
    if N == 2 and it["uid"] == "s18": hold = 3.6                 # the ground-speed beat (no spoken unit): the mph readout counts up, the chip pops
    if N == 2 and it["uid"] == "s21": hold = 2.4
    if N == 3 and it["uid"] in ("u_ground", "u_gust"): hold = 2.2        # the speed count-up and the chip (carried by sound effects)
    if N == 3 and it["uid"] in ("s27", "open"): hold = 1.6
    if N in (4, 5, 6, 7, 8) and it["uid"] in ("u_sea", "u_depth", "u_eq6", "u_speed3", "u_w3", "u_jump2", "u_w15", "u_jump15"): hold = 1.8
    if N in (4, 6, 8) and it["uid"] in ("s33", "s48", "s58"): hold = 1.4
    if N == 1 and it["uid"] == "s4": hold = 3.2                  # the ground-speed beat
    if N == 1 and it["uid"] == "s71": hold = 1.6                 # hold the liftoff
    plan[it["uid"]] = {"pre": pre, "hold": hold, "energy": 0.6}
BEATS = f.layout(plan, end_hold=3.0)
At = f.at
vo = {it["uid"]: it["vo"] for it in items}
lines_by = {l["id"]: l for l in f.lines}
def t_of(uid, off=0.0): return lines_by[vo[uid]]["t"] + off
def t_end_of(uid): return lines_by[vo[uid]]["t"] + lines_by[vo[uid]]["dur"]
sent = [it for it in items if it["kind"] == "sent"]
_cl = [l for l in f.lines if LINE[l["id"]]["kind"] == "closer"]; t_end = At(f"{_cl[0]['id']}:Full", -0.2) if _cl else round(f.lines[-1]["t"] + f.lines[-1]["dur"] + 0.5, 3)      # odd parts: no closer, the end card follows the cliffhanger
WW = []; FLASH = None; FX = {}
def U(u): return t_of(u)
if N == 1:
    FL0 = round(At(f"{vo['s71']}:seventeen", -0.1), 3); FL1 = round(t_end_of("s71") + 1.3, 3); FLASH = {"t0": FL0, "t1": FL1}
    KEYS = [[0.0, 23.934], [round(U("s13"), 3), 23.934], [round(U("s13") + 1.4, 3), 19.9], [round(f.duration, 3), 19.0]]
    RP = {"open": ("armsOut", "happy"), "s71": ("float", "happy"), "s72": ("stand", "happy"), "s4": ("stand", "neutral"), "s12": ("stand", "wide"), "s13": ("lookUp", "awe"), "cta": ("armsOut", "happy"), "cliff": ("lookUp", "awe"), "tease": ("stand", "happy")}
    BS = round(t_end_of("s4") + 0.35, 3)      # the ground-speed beat starts here
    CAMS = [{"t0": 0.0, "mode": "push"}, {"t0": round(FL0 - 0.3, 3), "mode": "lift"}, {"t0": round(FL1 + 0.1, 3), "mode": "push"}, {"t0": round(BS - 0.2, 3), "mode": "ground"}, {"t0": round(U("cta") - 0.2, 3), "mode": "wide"}, {"t0": round(U("cliff") - 0.2, 3), "mode": "push"}]
    CHIPS = [{"t0": round(BS + 1.5, 3), "t1": round(BS + 3.3, 3), "text": "Already faster than sound (767 mph)"}, {"t0": round(U("s12") + 1.9, 3), "t1": round(t_end_of("s12") + 0.5, 3), "text": "\u2248 a phone lighter"}]
    HUD3 = {"bar_t0": round(FL1 + 0.1, 3), "weight_t0": round(U("s12") - 0.1, 3), "speed": {"t0": BS, "t1": round(t_end_of("s12") + 0.4, 3)}}
elif N == 3:
    KEYS = [[0.0, 23.934], [round(f.duration, 3), 23.934]]; FX = {"wind": [round(U("s23") - 0.2, 3), round(t_end_of("s27") + 0.8, 3)]}
    RP = {"open": ("lean", "squint"), "s23": ("lean", "squint"), "u_ground": ("lean", "wide"), "u_gust": ("lean", "squint"), "s26": ("lean", "wide"), "s27": ("lean", "squint"), "cta": ("armsOut", "happy"), "cliff": ("lookUp", "awe")}
    CAMS = [{"t0": 0.0, "mode": "ground"}, {"t0": round(U("cta") - 0.2, 3), "mode": "wide"}, {"t0": round(U("cliff") - 0.2, 3), "mode": "push"}]
    CHIPS = [{"t0": round(U("u_ground") + 0.4, 3), "t1": round(t_end_of("u_ground") + 0.3, 3), "text": "Ground through the air: 1,040 mph"}, {"t0": round(U("u_gust") + 0.4, 3), "t1": round(t_end_of("u_gust") + 0.3, 3), "text": "Strongest gust ever: 250 mph"},
             {"t0": round(U("s26") + 0.5, 3), "t1": round(U("s26") + 3.6, 3), "text": "4\u00d7 faster"}]
    HUD3 = {"speed": {"mph": 1040, "t0": round(U("u_ground") - 0.1, 3), "t1": round(t_end_of("u_gust") + 0.4, 3)}}
elif N == 4:
    KEYS = [[0.0, 12.0], [round(f.duration, 3), 12.0]]; FX = {"ocean": [round(U("s29") + 2.0, 3), round(t_end_of("s33") + 0.5, 3)]}
    RP = {"open": ("lookUp", "wide"), "s29": ("armsOut", "wide"), "u_sea": ("lookUp", "awe"), "u_depth": ("stand", "neutral"), "s32": ("lean", "squint"), "s33": ("hips", "worried"), "cliff": ("lookUp", "wide"), "tease": ("stand", "happy")}
    CAMS = [{"t0": 0.0, "mode": "wide"}, {"t0": round(U("u_sea") - 0.3, 3), "mode": "wide"}, {"t0": round(U("cliff") - 0.2, 3), "mode": "push"}]
    CHIPS = [{"t0": round(U("u_sea") + 0.3, 3), "t1": round(t_end_of("u_sea") + 0.4, 3), "text": "Equator sea level: +20 miles"}, {"t0": round(U("u_depth") + 0.2, 3), "t1": round(t_end_of("u_depth") + 0.3, 3), "text": "Ocean depth: 2.3 miles"},
             {"t0": round(U("s32") + 0.6, 3), "t1": round(t_end_of("s32") + 0.3, 3), "text": "The poles dry out"}]
    HUD3 = {}
elif N == 5:
    KEYS = [[0.0, 6.0], [round(f.duration, 3), 6.0]]; FX = {"wind": [round(U("s35"), 3), round(t_end_of("s37") + 0.5, 3)]}
    RP = {"open": ("lean", "squint"), "s34": ("lean", "wide"), "s35": ("lookUp", "wide"), "s36": ("lookUp", "awe"), "s37": ("lean", "squint"), "s38": ("stand", "neutral"), "u_eq6": ("stand", "wide"), "s40": ("float", "happy"), "s41": ("float", "happy"), "cta": ("armsOut", "happy"), "cliff": ("lookUp", "awe")}
    CAMS = [{"t0": 0.0, "mode": "ground"}, {"t0": round(U("s38") - 0.2, 3), "mode": "push"}, {"t0": round(U("cta") - 0.2, 3), "mode": "wide"}, {"t0": round(U("cliff") - 0.2, 3), "mode": "push"}]
    CHIPS = [{"t0": round(U("s35") + 0.2, 3), "t1": round(t_end_of("s35") + 0.4, 3), "text": "Storm steering: 4\u00d7 today"}, {"t0": round(U("s36") + 0.1, 3), "t1": round(t_end_of("s36") + 0.4, 3), "text": "At the edge of floating: 17\u00d7"},
             {"t0": round(U("u_eq6") + 0.4, 3), "t1": round(t_end_of("u_eq6") + 0.4, 3), "text": "Equator: 4,150 mph"}, {"t0": round(U("s40") + 0.1, 3), "t1": round(t_end_of("s40") + 0.5, 3), "text": "5.5% lighter than a still Earth"}]
    HUD3 = {"weight_t0": round(U("s38") - 0.2, 3), "speed": {"mph": 4150, "t0": round(U("u_eq6") - 0.1, 3), "t1": round(t_end_of("s40") + 0.3, 3)}}
elif N == 6:
    KEYS = [[0.0, 6.0], [round(f.duration, 3), 6.0]]; FX = {}
    RP = {"open": ("lookUp", "wide"), "s43": ("stand", "neutral"), "s44": ("lookUp", "awe"), "s45": ("hips", "happy"), "s46": ("stand", "neutral"), "s47": ("lean", "squint"), "s48": ("hips", "worried"), "cliff": ("lookUp", "wide"), "tease": ("stand", "happy")}
    CAMS = [{"t0": 0.0, "mode": "ground"}, {"t0": round(U("s45") - 0.3, 3), "mode": "wide"}, {"t0": round(U("s48") - 0.2, 3), "mode": "push"}]
    CHIPS = [{"t0": round(U("s43") + 0.5, 3), "t1": round(t_end_of("s43") + 0.3, 3), "text": "1,460 days in a year"}, {"t0": round(U("s44") + 0.8, 3), "t1": round(t_end_of("s44") + 0.3, 3), "text": "6,000+ days by the end"},
             {"t0": round(U("s46") + 0.6, 3), "t1": round(t_end_of("s46") + 0.3, 3), "text": "45\u00b0N: 70% of the speed"}]
    HUD3 = {"weight_t0": round(U("s45") - 0.2, 3)}
elif N == 7:
    KEYS = [[0.0, 3.0], [round(U("s52") - 0.3, 3), 3.0], [round(U("s52") + 1.2, 3), 2.0], [round(f.duration, 3), 2.0]]; FX = {}
    RP = {"open": ("lean", "wide"), "s49": ("lookUp", "wide"), "u_speed3": ("float", "wide"), "u_w3": ("float", "happy"), "s52": ("float", "awe"), "u_jump2": ("float", "happy"), "s54": ("float", "happy"), "s55": ("float", "wide"), "cta": ("armsOut", "happy"), "cliff": ("float", "awe")}
    CAMS = [{"t0": 0.0, "mode": "ground"}, {"t0": round(U("u_speed3") - 0.3, 3), "mode": "push"}, {"t0": round(U("s52") - 0.3, 3), "mode": "lift"}, {"t0": round(U("s54") - 0.3, 3), "mode": "wide"}, {"t0": round(U("cliff") - 0.2, 3), "mode": "push"}]
    CHIPS = [{"t0": round(U("u_speed3") + 0.4, 3), "t1": round(t_end_of("u_speed3") + 0.4, 3), "text": "Ground: 8,300 mph"}, {"t0": round(U("u_w3") + 1.2, 3), "t1": round(t_end_of("u_w3") + 0.3, 3), "text": "150 lb feels like 117 lb"},
             {"t0": round(U("u_jump2") + 0.3, 3), "t1": round(t_end_of("u_jump2") + 0.3, 3), "text": "A 1.5 ft jump becomes 3 ft"}, {"t0": round(U("s55") + 0.2, 3), "t1": round(t_end_of("s55") + 0.2, 3), "text": "Half the force"}]
    HUD3 = {"weight_t0": round(U("u_w3") - 0.2, 3), "speed": {"mph": 8300, "t0": round(U("u_speed3") - 0.1, 3), "t1": round(t_end_of("u_speed3") + 0.4, 3)}}
elif N == 8:
    KEYS = [[0.0, 1.5], [round(f.duration, 3), 1.5]]; FX = {}
    RP = {"open": ("float", "awe"), "u_w15": ("float", "awe"), "u_jump15": ("float", "happy"), "s58": ("lookUp", "wide"), "cliff": ("float", "wide"), "tease": ("float", "happy")}
    CAMS = [{"t0": 0.0, "mode": "lift"}, {"t0": round(U("u_jump15") - 0.3, 3), "mode": "wide"}, {"t0": round(U("cliff") - 0.2, 3), "mode": "push"}]
    CHIPS = [{"t0": round(U("u_w15") + 1.6, 3), "t1": round(t_end_of("u_w15") + 0.4, 3), "text": "150 lb feels like 18 lb"}, {"t0": round(U("u_jump15") + 0.5, 3), "t1": round(t_end_of("u_jump15") + 0.3, 3), "text": "1.5 ft jump \u2192 13 ft"}]
    HUD3 = {"weight_t0": round(U("u_w15") - 0.3, 3)}
else:
    KEYS = [[0.0, 12.0], [round(f.duration, 3), 12.0]]
    RP = {"open": ("lookUp", "awe"), "s17": ("lookUp", "wide"), "s18": ("lookUp", "neutral"), "s20": ("float", "happy"), "s21": ("hips", "blink"), "cta": ("armsOut", "happy"), "cliff": ("lean", "squint"), "tease": ("stand", "happy")}
    CAMS = [{"t0": 0.0, "mode": "ground"}, {"t0": round(U("s18") - 0.2, 3), "mode": "wide"}, {"t0": round(t_end_of("s18") - 0.2, 3), "mode": "push"}, {"t0": round(U("s21") - 0.2, 3), "mode": "ground"}, {"t0": round(U("cliff") - 0.2, 3), "mode": "base"}]
    BS = round(t_end_of("s18") + 0.3, 3)
    CHIPS = [{"t0": round(U("s17") + 0.4, 3), "t1": round(t_end_of("s17") + 0.3, 3), "text": "6 h of daylight"}, {"t0": round(U("s18") + 0.3, 3), "t1": round(t_end_of("s18") + 0.3, 3), "text": "Sun at hour-hand speed"},
             {"t0": round(BS + 1.4, 3), "t1": round(BS + 3.3, 3), "text": "\u22482,080 mph \u00b7 nearly 3\u00d7 the speed of sound"}, {"t0": round(U("s21") + 0.2, 3), "t1": round(t_end_of("s21") + 0.4, 3), "text": "8 h of sleep won't fit"}]
    HUD3 = {"bar_t0": round(U("s17"), 3), "weight_t0": round(U("s20") - 0.2, 3), "speed": {"t0": BS, "t1": round(t_end_of("s20") + 0.2, 3)}}
ROBOT = []
for it in items:
    p, e = RP.get(it["uid"], ("stand", "neutral")); ROBOT.append({"t": round(max(0.0, t_of(it["uid"]) - 0.3), 3), "pose": p, "expr": e})
ROBOT[0]["t"] = 0.0
if FLASH: ROBOT.append({"t": round(FL1 + 0.05, 3), "pose": "stand", "expr": "neutral"})
ROBOT.sort(key=lambda r: r["t"])
def lead(pages, by=0.14):
    for i, pg in enumerate(pages):
        prev = pages[i - 1]["t1"] if i else -1.0
        if pg["t0"] - prev >= by + 0.05: pg["t0"] = round(max(0.0, pg["t0"] - by), 4)
    return pages
def numerals_pass(pages):
    for pg in pages:
        flat = [(w, t, li) for li, ln in enumerate(pg["lines"]) for w, t in ln]
        disp = _nu.display_tokens([(w, t) for w, t, _ in flat]); out = [[] for _ in pg["lines"]]; k = 0
        for tok, times in disp:
            out[flat[k][2]].append([tok, times[0] if isinstance(times, list) and times else times]); k += len(times) if isinstance(times, list) and times else 1
        pg["lines"] = [ln for ln in out if ln]
    return pages
captions = [p for p in numerals_pass(lead(f.captions(max_chars=26, balance=True))) if p["t0"] < t_end - 0.3]
BADGES = [{"id": "b-thought", "text": "Thought experiment", "t0": 0.3, "t1": 5.0, "slot": "bl"}]
TITLE = {"series": "Possibility Lab", "title": TITLES[N - 1], "t0": -20.0, "t1": -19.0, "sig": -18.0}
END = {"title": "Full video on YouTube: *What If Earth Spun Faster…*", "follow": f"Possibility Lab · Part {N} of 8", "next": "Every number's source is in the description."}
dummy = [999.0, 1000.0]; CUE = {"fps": FPS, "float": dummy, "break": dummy, "cost": dummy, "weather": dummy, "wind": dummy, "oceans": dummy, "poles": dummy, "end": t_end, "seed": 3}
SHOTS = [{"at": 0.0, "name": "eye", "beat": "open"}, {"at": t_end, "name": "end", "beat": BEATS[-1]["id"]}]
film = {"id": f"possibility-lab-earth-spin-part{N}-v3", "theme": "../../../../theme.json", "scene": "../../scene.mjs", "fps": FPS, "bpm": BPM, "dur": f.duration, "v2": True,
        "poster": round(min(f.duration - 6, BEATS[len(BEATS) // 2]["t0"]), 4), "shots": SHOTS, "beats": BEATS,
        "world": {"cycleS": 16.0, "keys": KEYS, "dry": [[0.0, 90.0], [round(f.duration, 3), 90.0]], "tOrbH": T_ORB / 3600, "t0H": 23.934, "rEq": R_EQ / 1000, "gm": 3.986004418e14, "eNow": E_NOW, "eOrb": E_ORB, "weightWins": WW},
        "disclosures": {"aiVoice": (N == 3), "realVoice": True, "aiIllustration": True}, "cue": CUE, "badges": BADGES, "title": TITLE, "endCard": t_end, "end": END, "endAnswer": "", "spineHide": [], "spine": [], "spineOut": 0, "labels": [], "counters": [], "work": None, "cam": {},
        "cams": CAMS, "fx": (FX if N == 3 else {}), "robot": ROBOT, "hook": {"text": CONFIG["hook"], "t0": 0.1, "t1": 2.9}, "hud3": HUD3, "chips": CHIPS, "flash": FLASH,
        "captions": captions, "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines]}
ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS if b["id"] != "tease"]; ev.append({"t": t_end, "kind": "signature", "tag": "end"})
sheet = {"duration": f.duration, "fps": FPS, "preset": "envelope-working", "tail_s": 0.05, "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: e["t"]), "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}
(D / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False)); (D / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
sub = json.loads(json.dumps(sheet))
for v in sub["voice"]:
    it = LINE[v["id"]]
    if it.get("sub_file"): v["file"] = it["sub_file"]
(D / "sheet-sub.json").write_text(json.dumps(sub, indent=1, ensure_ascii=False))
vg = [round(b["t"] - a["t"] - a["dur"], 2) for a, b in zip(f.lines, f.lines[1:])]; 
print(f"part {N} v2: {f.duration:.1f} s, end card {t_end:.1f} s, max voiceless {max(vg)} s, CTA at {(lambda c: f'{c[0]["t"] / f.duration:.0%}' if c else "none (even part)")([l for l in f.lines if LINE[l['id']]['kind']=='cta'])}, speech {sum(l['dur'] for l in f.lines):.1f} s")
print("  keys:", KEYS); print("  cams:", CAMS)
