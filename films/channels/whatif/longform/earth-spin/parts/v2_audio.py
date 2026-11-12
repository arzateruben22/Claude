"""Audio for a v2 part: sfx.json (earth palette) -> the SFX stem (kits/cinema/sound/sfx.py), the studio mix (music bed + his voice, -14 LUFS), then the stem mixed in:
amix normalize=0, alimiter at -1.5 dB, loudness checked at -14 LUFS.   python3 -I parts/v2_audio.py N"""
import json, subprocess, sys, re
from pathlib import Path
HERE = Path(__file__).resolve().parent; ES = HERE.parent; REPO = ES.parents[4]; N = int(sys.argv[1]); D = HERE / f"part{N}v2"
film = json.loads((D / "film.json").read_text()); items = json.loads((D / "items.json").read_text())
T = {it["uid"]: next(v for v in film["voice"] if v["id"] == it["vo"]) for it in items}; t0 = lambda u, o=0.0: round(T[u]["t"] + o, 3); t1 = lambda u: round(T[u]["t"] + T[u]["dur"], 3)
cues, seed = [], [0]
def cue(at, kind, gain=0, **kw): seed[0] += 1; cues.append(dict(at=at, kind=kind, gain=gain, seed=seed[0], **kw))
cue(0.05, "riser", -3, dur=2.6); cue(t1("open") - 0.2, "boom", -6, dur=2.0)
if N == 1:
    cue(t0("s2"), "whoosh", -3, dur=2.4, pan=[-0.4, 0.4]); cue(t0("s5", 0.1), "tick", -3); cue(t0("s7", 0.1), "tick", -4)
    cue(t0("s11"), "rumble", -5, dur=4.5); cue(t0("s12", 0.2), "shimmer", -6, dur=2.6)
    cue(t0("s9"), "tick", -5)
else:
    cue(t0("s13"), "rumble", -6, dur=3.0); cue(t0("s14"), "whoosh", -2, dur=2.2, pan=[-0.5, 0.5]); cue(t0("s14", 0.5), "tick", -3)
    cue(t0("s15"), "whoosh", -2, dur=2.2, pan=[0.5, -0.5]); cue(t0("s15", 0.5), "tick", -3)
    cue(t0("s17"), "whoosh", -1, dur=2.4, pan=[-0.5, 0.5]); cue(t0("s17", 0.8), "boom", -5, dur=2.4); cue(t0("s17", 0.8), "tick", -3)
    cue(t0("s19"), "rumble", -4, dur=4.2); cue(t0("s20", 0.2), "shimmer", -6, dur=2.6)
    cue(t0("s23"), "wind", -4, dur=7.0, pan=[0.5, -0.5])
cue(t0("cta"), "whoosh", -4, dur=1.4); cue(t0("cliff", -0.1), "riser", -3, dur=T["cliff"]["dur"] + 0.6); cue(t1("cliff"), "boom", -4, dur=2.2)
cue(film["endCard"], "tick", -3)
(D / "sfx.json").write_text(json.dumps({"palette": "earth", "cues": cues}, indent=1))
subprocess.run([sys.executable, str(REPO / "kits/cinema/sound/sfx.py"), str(D / "film.json"), str(D / "sfx.json"), str(D / "sfx-stem.wav")], check=True)
for tag, sheet in (("audio", "sheet.json"), ("audio-sub", "sheet-sub.json")):
    subprocess.run([sys.executable, str(REPO / "kits/cinema/studio/render.py"), sheet, f"build/{tag}"], cwd=D, check=True, capture_output=True)
    mix = D / f"build/{tag}/mix.wav"; out = D / f"build/{tag}/mix-sfx.m4a"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(mix), "-i", str(D / "sfx-stem.wav"), "-filter_complex", "[0:a][1:a]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.84:level=disabled[a]", "-map", "[a]", "-c:a", "aac", "-b:a", "256k", "-ar", "48000", str(out)], check=True)
    r = subprocess.run(["ffmpeg", "-nostats", "-i", str(out), "-af", "loudnorm=I=-14:TP=-1.5:LRA=9:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
    m = json.loads(re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", r).group(0)); print(tag, "integrated", m["input_i"], "LUFS, true peak", m["input_tp"], "dBTP")
