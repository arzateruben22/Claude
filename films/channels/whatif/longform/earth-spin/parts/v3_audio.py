"""Audio for the v3 preview: sfx stem + the studio stems (music 3 dB softer), summed, brought to -14 LUFS, limited at -1.5 dB.   python3 -I parts/v3_audio.py N"""
import json, re, subprocess, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent; ES = HERE.parent; REPO = ES.parents[4]; N = int(sys.argv[1]); D = HERE / f"part{N}v3"
film = json.loads((D / "film.json").read_text()); items = json.loads((D / "items.json").read_text())
T = {it["uid"]: next(v for v in film["voice"] if v["id"] == it["vo"]) for it in items}; t0 = lambda u, o=0.0: round(T[u]["t"] + o, 3); t1 = lambda u: round(T[u]["t"] + T[u]["dur"], 3)
FL = film.get("flash"); cues, seed = [], [0]
def cue(at, kind, gain=0, **kw): seed[0] += 1; cues.append(dict(at=at, kind=kind, gain=gain, seed=seed[0], **kw))
cue(0.05, "riser", -3, dur=2.6); cue(t1("open") - 0.2, "boom", -6, dur=2.0)
if N == 1:
    cue(t0("s71"), "whoosh", -3, dur=2.4, pan=[-0.4, 0.4]); cue(FL["t0"] + 0.2, "riser", -3, dur=2.2); cue(FL["t0"] + 0.5, "shimmer", -5, dur=2.4); cue(FL["t0"] + 1.1, "whoosh", -3, dur=1.8, pan=[0.5, -0.5])
    cue(FL["t1"], "boom", -4, dur=1.8); cue(FL["t1"] + 0.1, "tick", -2); cue(t0("s4"), "tick", -4)
    cue(t1("s4") + 0.3, "rumble", -5, dur=3.2); cue(t1("s4") + 0.4, "tick", -3); cue(t1("s4") + 1.0, "tick", -3); cue(film["chips"][0]["t0"], "whoosh", -3, dur=1.0); cue(film["chips"][0]["t0"], "tick", -2); cue(t0("s12", 0.3), "shimmer", -6, dur=2.6); cue(film["chips"][1]["t0"], "tick", -2)
    for k in range(4): cue(t0("s13", 0.3 + 0.35 * k), "tick", -3); cue(t0("s13", 0.2 + 0.35 * k), "whoosh", -6, dur=0.7)
else:
    cue(t0("s17"), "whoosh", -2, dur=2.4, pan=[-0.5, 0.5]); cue(t0("s17", 0.4), "tick", -3); cue(t0("s18"), "whoosh", -2, dur=2.2, pan=[0.5, -0.5])
    cue(t1("s18") + 0.3, "rumble", -4, dur=3.2); cue(t1("s18") + 0.4, "tick", -3); cue(film["chips"][2]["t0"], "whoosh", -3, dur=1.0); cue(film["chips"][2]["t0"], "boom", -6, dur=2.0); cue(film["chips"][2]["t0"], "tick", -2); cue(t0("s20", 0.2), "shimmer", -6, dur=2.6); cue(t0("s21", 0.2), "tick", -3)
cue(t0("cta"), "whoosh", -4, dur=1.4); cue(t0("cliff", -0.1), "riser", -3, dur=T["cliff"]["dur"] + 0.6); cue(t1("cliff"), "boom", -4, dur=2.2); cue(film["endCard"], "tick", -3)
(D / "sfx.json").write_text(json.dumps({"palette": "earth", "cues": cues}, indent=1))
subprocess.run([sys.executable, str(REPO / "kits/cinema/sound/sfx.py"), str(D / "film.json"), str(D / "sfx.json"), str(D / "sfx-stem.wav")], check=True)
for SHEET, TAG in (('sheet.json', 'audio'), ('sheet-sub.json', 'audio-sub')):
    subprocess.run([sys.executable, str(REPO / "kits/cinema/studio/render.py"), SHEET, "build/" + TAG], cwd=D, check=True, capture_output=True)
    S = D / ("build/" + TAG + "/stems"); out = D / ("build/" + TAG + "/mix-sfx.m4a")
    g = "[0:a]volume=-3dB[m];[m][1:a][2:a][3:a]amix=inputs=4:normalize=0:duration=longest"
    def run(extra):
        return subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(S / "music.wav"), "-i", str(S / "dialog.wav"), "-i", str(S / "effects.wav"), "-i", str(D / "sfx-stem.wav"), "-filter_complex", g + extra + "[a]", "-map", "[a]", "-t", str(film["dur"]), "-ar", "48000", "-c:a", "pcm_f32le", "/tmp/v3sum.wav"], check=True)
    run(",alimiter=limit=0.95:level=disabled")
    r = subprocess.run(["ffmpeg", "-nostats", "-i", "/tmp/v3sum.wav", "-af", "loudnorm=I=-14:TP=-1.5:LRA=9:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
    m = json.loads(re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", r).group(0)); gain = -14.0 - float(m["input_i"])
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", "/tmp/v3sum.wav", "-af", f"volume={gain:.2f}dB,alimiter=limit=0.74:attack=3:release=60:level=disabled,alimiter=limit=0.74:level=disabled", "-c:a", "aac", "-b:a", "256k", str(out)], check=True)
    for _ in range(1):
        r = subprocess.run(["ffmpeg", "-nostats", "-i", str(out), "-af", "loudnorm=I=-14:TP=-1.5:LRA=9:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
        m = json.loads(re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", r).group(0)); d = -14.0 - float(m["input_i"])
        break
        gain += d; subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", "/tmp/v3sum.wav", "-af", f"volume={gain:.2f}dB,alimiter=limit=0.77:attack=3:release=60:level=disabled", "-c:a", "aac", "-b:a", "256k", str(out)], check=True)
    print(TAG, "integrated", m["input_i"], "LUFS, true peak", m["input_tp"], "dBTP, gain", round(gain, 2))
