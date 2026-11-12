"""owner_closers_v4.py: his closers ('Part one of eight. Full video on YouTube.' ...) from the Possibility Lab recording (whatif-s2 voice-owner-spoken/'Valerio St 3.m4a', Part C),
cut to the words with ~0.1 s of room tone, cleaned with clarity.py --style normal --rumble, debreathed at the defaults, level matched (+-1 dB) to his OO lines.
Appends C<n> entries to long01/voice5/lines.json (run after owner_voice_v4.py) and to voice-owner-spoken/takes-used.json.
usage: ~/.cache/cinema-voice/venv/bin/python -I owner_closers_v4.py"""
import json, subprocess, sys, re
from pathlib import Path
import numpy as np, soundfile as sf
ROOT = Path("/home/user/claude"); L1 = ROOT / "films/channels/space/long01"; V5 = L1 / "voice5"; SRC = "/tmp/pl/vs3.m4a"
sys.path.insert(0, str(ROOT / "kits/cinema/voice")); import align, debreath; from scriptfile import spoken
SPANS = {"C1": ("Part one of eight. Full video on YouTube.", 66.0, 68.6), "C2": ("Part two of eight. Full video on YouTube.", 69.8, 71.9)}
rec = align.recognizer(str(Path.home() / ".cache/cinema-voice/models")); J = json.load(open(V5 / "lines.json")); used = json.load(open(ROOT / "films/channels/space/voice-owner-spoken/takes-used.json"))
def env(x, h=240): n = len(x) // h; return 20 * np.log10(np.sqrt((x[: n * h].reshape(n, h) ** 2).mean(1)) + 1e-9)
def level(x): e = env(x); sp = e[e > e.max() - 25]; return float(np.mean(sp))
ref = float(np.median([level(sf.read(L1 / l["file"], dtype="float32")[0]) for l in J["lines"] if l["id"][0] in "LBD"]))
J["lines"] = [l for l in J["lines"] if not l["id"].startswith("C")]
for cid, (t, s, e) in SPANS.items():
    raw = f"/tmp/pl/{cid}.wav"; subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(s - 0.7), "-t", str(e - s + 0.9), "-i", SRC, "-ac", "1", "-ar", "48000", raw], check=True)
    cl = f"/tmp/pl/{cid}-clean.wav"; subprocess.run([sys.executable, "-I", str(ROOT / "kits/cinema/voice/clarity.py"), "--style", "normal", "--rumble", "--noise", "0.0-0.55", raw, cl], check=True, capture_output=True)
    x, sr = sf.read(cl, dtype="float32"); x = x if x.ndim == 1 else x.mean(1); x = x[int(0.6 * sr):]   # the 0.7 s lead was for the room-tone estimate; keep 0.1 s
    words, heard = align.line_words(rec, x, sr, t)
    x, found = debreath.debreath(x, sr, [{"w": w["w"], "start": w["start"], "end": w["end"]} for w in words])
    g = np.clip(ref - level(x), -6, 6); x = x * 10 ** (g / 20); pk = np.abs(x).max(); x = x * (0.89 / pk) if pk > 0.89 else x
    n = int(0.008 * sr); x[:n] *= np.linspace(0, 1, n); x[-n:] *= np.linspace(1, 0, n)
    words, heard = align.line_words(rec, x, sr, t); f = V5 / "wav" / f"{cid}.wav"; sf.write(f, x, sr, subtype="PCM_24")
    sents = [{"text": spoken(m), "t0": 0, "t1": 0, "claims": []} for m in re.findall(r"[^.]+\.", t)]; k = 0
    for sn in sents: ws = words[k:k + len(sn["text"].split())]; k += len(ws); sn["t0"], sn["t1"] = round(ws[0]["start"], 3), round(ws[-1]["end"], 3)
    J["lines"].append({"id": cid, "text": t, "file": f"voice5/wav/{cid}.wav", "dur": round(len(x) / sr, 3), "sentences": sents, "words": [{"w": w["w"], "start": w["start"], "end": w["end"]} for w in words]})
    used[cid] = {"segments": [[round(s - 0.1, 2), round(e + 0.1, 2)]], "source": "Possibility Lab recording 'Valerio St 3.m4a' (whatif-s2), Part C", "why": "his own closer, reused; clarity --style normal --rumble, debreath defaults, level matched", "heard": heard, "not_heard": [w["w"] for w in words if not w["heard"]], "breaths_lowered": [list(b) for b in found], "level_gain_db": round(float(g), 2)}
    print(cid, round(len(x) / sr, 2), "s; heard:", heard, "| not heard:", used[cid]["not_heard"], "| gain", round(float(g), 2), "dB")
json.dump(J, open(V5 / "lines.json", "w"), indent=1, ensure_ascii=False); json.dump(used, open(ROOT / "films/channels/space/voice-owner-spoken/takes-used.json", "w"), indent=1, ensure_ascii=False)
