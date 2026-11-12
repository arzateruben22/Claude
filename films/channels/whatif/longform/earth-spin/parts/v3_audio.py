"""Audio for the v3 preview: sfx stem + the studio stems (music 3 dB softer), summed, brought to -14 LUFS, limited at -1.5 dB.   python3 -I parts/v3_audio.py N"""
import json, re, subprocess, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent; ES = HERE.parent; REPO = ES.parents[4]; N = int(sys.argv[1]); D = HERE / f"part{N}v3"
film = json.loads((D / "film.json").read_text()); items = json.loads((D / "items.json").read_text())
T = {it["uid"]: next(v for v in film["voice"] if v["id"] == it["vo"]) for it in items}; t0 = lambda u, o=0.0: round(T[u]["t"] + o, 3); t1 = lambda u: round(T[u]["t"] + T[u]["dur"], 3)
FL = film["flash"]; cues, seed = [], [0]
def cue(at, kind, gain=0, **kw): seed[0] += 1; cues.append(dict(at=at, kind=kind, gain=gain, seed=seed[0], **kw))
cue(0.05, "riser", -3, dur=2.6); cue(t1("open") - 0.2, "boom", -6, dur=2.0)
cue(t0("s71"), "whoosh", -3, dur=2.4, pan=[-0.4, 0.4]); cue(FL["t0"] + 0.2, "riser", -3, dur=2.2); cue(FL["t0"] + 0.4, "shimmer", -5, dur=2.4)
cue(FL["t1"], "boom", -4, dur=1.8); cue(FL["t1"] + 0.1, "tick", -2); cue(t0("s4"), "tick", -4)
cue(t0("s11"), "rumble", -5, dur=4.5); cue(film["chips"][1]["t0"], "tick", -2)
(D / "sfx.json").write_text(json.dumps({"palette": "earth", "cues": cues}, indent=1))
subprocess.run([sys.executable, str(REPO / "kits/cinema/sound/sfx.py"), str(D / "film.json"), str(D / "sfx.json"), str(D / "sfx-stem.wav")], check=True)
subprocess.run([sys.executable, str(REPO / "kits/cinema/studio/render.py"), "sheet.json", "build/audio"], cwd=D, check=True, capture_output=True)
S = D / "build/audio/stems"; out = D / "build/audio/mix-sfx.m4a"
g = "[0:a]volume=-3dB[m];[m][1:a][2:a][3:a]amix=inputs=4:normalize=0:duration=longest"
def run(extra):
    return subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(S / "music.wav"), "-i", str(S / "dialog.wav"), "-i", str(S / "effects.wav"), "-i", str(D / "sfx-stem.wav"), "-filter_complex", g + extra + "[a]", "-map", "[a]", "-t", str(film["dur"]), "-ar", "48000", "-c:a", "pcm_f32le", "/tmp/v3sum.wav"], check=True)
run(",alimiter=limit=0.95:level=disabled")
r = subprocess.run(["ffmpeg", "-nostats", "-i", "/tmp/v3sum.wav", "-af", "loudnorm=I=-14:TP=-1.5:LRA=9:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
m = json.loads(re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", r).group(0)); gain = -14.0 - float(m["input_i"])
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", "/tmp/v3sum.wav", "-af", f"volume={gain:.2f}dB,alimiter=limit=0.78:level=disabled", "-c:a", "aac", "-b:a", "256k", str(out)], check=True)
r = subprocess.run(["ffmpeg", "-nostats", "-i", str(out), "-af", "loudnorm=I=-14:TP=-1.5:LRA=9:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
m = json.loads(re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", r).group(0)); print("integrated", m["input_i"], "LUFS, true peak", m["input_tp"], "dBTP, gain", round(gain, 2))
