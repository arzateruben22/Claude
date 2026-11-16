"""Audio for the Part 1 picture: a music stem and an sfx stem (kept separate, no voice) and the guide mix (music + sfx + the scratch voice, -14 LUFS).
  python3 -I films/channels/whatif/longform/gravity-doubles/part1_audio.py
Outputs in part1/audio/: part1-music.wav, part1-sfx.wav, guide-mix.wav (guide only). sfx timing follows film.json; the ball's bounce ticks follow the same physics the picture integrates."""
import json, re, subprocess, sys, shutil
from pathlib import Path
HERE = Path(__file__).resolve().parent; D = HERE / "part1"; REPO = HERE.parents[4]
film = json.loads((D / "film.json").read_text()); W = {l["id"]: l for l in json.loads((D / "windows.json").read_text())["lines"]}; G = film["grav"]
w = lambda k: W[k]["t0"]; S = lambda k: W[k]["speech_t0"]
# ── the sheet(s) for the studio render: sections per line, music only (and the scratch voice for the guide) ──
secs = [{"id": k, "t0": v["t0"], "t1": v["t1"], "energy": 0.85 if k in ("l09", "l11") else 0.6} for k, v in W.items()]
sheet = {"duration": film["dur"], "fps": 30, "preset": "envelope-working", "tail_s": 0.05, "sections": secs, "events": [{"t": s["t0"], "kind": "section", "id": s["id"], "t1": s["t1"]} for s in secs], "voice": []}
(D / "sheet.json").write_text(json.dumps(sheet, indent=1))
(D / "sheet-guide.json").write_text(json.dumps({**sheet, "voice": [{"id": k, "t": S[k] if False else W[k]["speech_t0"], "file": f"vo-scratch/{k}.wav"} for k in W]}, indent=1))
# ── sfx cues ──
cues, seed = [], [0]
def cue(at, kind, gain=0, **kw): seed[0] += 1; cues.append(dict(at=round(at, 3), kind=kind, gain=gain, seed=seed[0], **kw))
cue(0.05, "riser", -3, dur=2.6); cue(2.9, "boom", -6, dur=1.6)
for r in G["rings"]: cue(r, "shimmer", -5, dur=1.8); cue(r, "whoosh", -4, dur=1.4, pan=[-0.3, 0.3])
# the ball's bounces: the same integration as the scene (e = 1, same launch speed)
BN = 480; ball = G["ball"]; T0 = ball["T0"]; g0 = 8 * ball["h0"] / T0 ** 2; v0 = 4 * ball["h0"] / T0
hk = G["hours"]
def hour(t):
    if t <= hk[0][0]: return hk[0][1]
    for i in range(len(hk) - 1):
        a, ha = hk[i][0], hk[i][1]; b, hb = hk[i + 1][0], hk[i + 1][1]
        if t <= b:
            if b - a < 1e-9: return hb
            u = (t - a) / (b - a); mode = hk[i + 1][2] if len(hk[i + 1]) > 2 else "e"
            u = u if mode == "lin" else (u * u * (3 - 2 * u))  # the scene's inout2 is a smooth ease; close enough for the tick times
            return ha + (hb - ha) * u
    return hk[-1][1]
y, v, bounces = 0.0, v0, []
for i in range(int(film["dur"] * BN)):
    t = i / BN; gg = g0 * 2 ** min(hour(t), 3); v -= gg / BN; y += v / BN
    if y <= 0: y, v = 0.0, v0; bounces.append(t)
def vis(t): return any(a + 0.4 <= t <= b - 0.3 for a, b in ball["wins"])
for t in bounces:
    if vis(t): cue(t, "tick", -9)
cue(w("l04") + 0.5, "riser", -4, dur=1.0); cue(w("l04") + 1.45, "boom", -3, dur=1.8); cue(w("l04") + 1.45, "tick", -2)
for k, dt in enumerate((0.6, 1.3, 2.0, 2.7, 3.4)): cue(w("l05") + dt + 0.1, "boom", -10, dur=0.5)
cue(G["ghost"]["t0"], "shimmer", -6, dur=1.4); cue(G["tree"]["sag0"], "rumble", -9, dur=1.2); cue(G["tree"]["sag0"] + 0.1, "whoosh", -9, dur=1.0)
cue(w("l08") + 0.2, "rumble", -7, dur=2.4)
r0, r1, p1 = G["race"]["t0"], G["race"]["t1"], G["pin"]["t1"]
cue(r0 - 0.2, "riser", -2, dur=r1 - r0 + 0.5)
for n in range(2, 21): cue(r0 + (n - 1) / 19 * (r1 - r0), "tick", -6)
cue(r1, "boom", -2, dur=2.0); cue(r1 + 0.1, "rumble", -4, dur=1.2); cue(p1, "boom", -2, dur=1.6); cue(p1, "whoosh", -4, dur=1.0, pan=[0.5, -0.5]); cue(p1, "tick", -2)
cue(w("l10"), "whoosh", -4, dur=1.2); cue(S("l11") + 0.05, "riser", -3, dur=1.2); cue(S("l11") + 0.95, "boom", -2, dur=1.8); cue(S("l11") + 0.95, "tick", -2)
cue(G["buckle"]["t0"], "rumble", -4, dur=2.2); cue(G["buckle"]["t0"] + 0.3, "debris", -8, dur=1.0); cue(film["endCard"], "boom", -4, dur=2.0); cue(film["endCard"], "tick", -3)
(D / "sfx.json").write_text(json.dumps({"palette": "earth", "cues": cues}, indent=1))
A = D / "audio"; A.mkdir(exist_ok=True)
subprocess.run([sys.executable, str(REPO / "kits/cinema/sound/sfx.py"), str(D / "film.json"), str(D / "sfx.json"), str(A / "part1-sfx.wav")], check=True)
for sh, tag in (("sheet.json", "music"), ("sheet-guide.json", "guide")):
    subprocess.run([sys.executable, str(REPO / "kits/cinema/studio/render.py"), sh, "build/" + tag], cwd=D, check=True, capture_output=True)
shutil.copy(D / "build/music/stems/music.wav", A / "part1-music.wav")
S_ = D / "build/guide/stems"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(S_ / "music.wav"), "-i", str(S_ / "dialog.wav"), "-i", str(A / "part1-sfx.wav"), "-filter_complex", "[0:a]volume=-3dB[m];[m][1:a][2:a]amix=inputs=3:normalize=0:duration=longest,alimiter=limit=0.95:level=disabled[o]", "-map", "[o]", str(A / "_sum.wav")], check=True)
r = subprocess.run(["ffmpeg", "-nostats", "-i", str(A / "_sum.wav"), "-af", "loudnorm=I=-14:TP=-1.5:LRA=9:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
m = json.loads(re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", r).group(0)); gain = -14.0 - float(m["input_i"])
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(A / "_sum.wav"), "-af", f"volume={gain:.2f}dB,alimiter=limit=0.74:attack=3:release=60:level=disabled,alimiter=limit=0.74:level=disabled", str(A / "guide-mix.wav")], check=True)
(A / "_sum.wav").unlink()
print("bounces", len(bounces), "guide gain", round(gain, 2))
