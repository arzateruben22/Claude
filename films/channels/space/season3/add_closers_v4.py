"""add_closers_v4.py: the even parts' closers C4, C6, C8 ('Part four of eight. Full video on YouTube.' ...) from the Possibility Lab recording ('Valerio St 3.m4a'), made the way
recut_v4.py makes C1/C2: cut with room tone, clarity.py --style normal --rumble (room-tone span inside the silence before the line), end settled by voice_edges.settle_end, debreath
at its defaults, level matched to his OO lines (+-6 dB), 8 ms fades. Appends the entries to long01/voice5/lines.json and takes-used.json (does not touch the other lines).
usage: ~/.cache/cinema-voice/venv/bin/python -I add_closers_v4.py "Valerio St 3.m4a" """
import json, os, re, subprocess, sys, tempfile
from pathlib import Path
import numpy as np, soundfile as sf
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", "..")); S = f"{ROOT}/films/channels/space"; V5 = f"{S}/long01/voice5"; TU = f"{S}/voice-owner-spoken/takes-used.json"
sys.path.insert(0, HERE); sys.path.insert(0, f"{ROOT}/kits/cinema/voice"); import voice_edges as VE, debreath, align; from scriptfile import spoken
PL = sys.argv[1]; NUM = {4: "four", 6: "six", 8: "eight"}
SPANS = {"C4": (76.7, 78.9, "0.25-0.8"), "C6": (84.0, 86.2, "0.3-0.8"), "C8": (96.5, 98.8, "0.0-0.55")}     # speech from the file's own ASR (Parakeet): 76.8-78.5, 84.1-85.9, 96.6-98.6; the noise span is the silence before each
J = json.load(open(f"{V5}/lines.json")); used = json.load(open(TU)); sr = 48000; rec = align.recognizer(str(Path.home() / ".cache/cinema-voice/models"))
def env(x, h=240): n = len(x) // h; return 20 * np.log10(np.sqrt((x[: n * h].reshape(n, h) ** 2).mean(1)) + 1e-9)
def level(x): e = env(x); sp = e[e > e.max() - 25]; return float(np.mean(sp))
ref = float(np.median([level(sf.read(f"{V5}/wav/{l['id']}.wav", dtype="float32")[0]) for l in J["lines"] if l["id"][0] in "LBD"]))
J["lines"] = [l for l in J["lines"] if l["id"] not in SPANS]
with tempfile.TemporaryDirectory() as T:
    for cid, (s, e, noise) in SPANS.items():
        n = int(cid[1]); text = f"Part {NUM[n]} of eight. Full video on YouTube."; raw, cl = f"{T}/{cid}.wav", f"{T}/{cid}-clean.wav"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(s - 0.7), "-t", str(e - s + 1.5), "-i", PL, "-ac", "1", "-ar", str(sr), raw], check=True)
        subprocess.run([sys.executable, "-I", f"{ROOT}/kits/cinema/voice/clarity.py", "--style", "normal", "--rumble", "--noise", noise, raw, cl], check=True, capture_output=True)
        x, _ = sf.read(cl, dtype="float32"); x = x if x.ndim == 1 else x.mean(1); x = x[int(0.6 * sr):]
        Ec = VE.envelope(x, sr); e_new = VE.settle_end(Ec, e - s + 0.3, float(np.percentile(Ec, 8)), cap=0.6); x = x[: int(e_new * sr)]
        words, heard = align.line_words(rec, x, sr, text); x, found = debreath.debreath(x, sr, [{"w": w["w"], "start": w["start"], "end": w["end"]} for w in words])
        g = float(np.clip(ref - level(x), -6, 6)); x = x * 10 ** (g / 20); pk = np.abs(x).max(); x = x * (0.89 / pk) if pk > 0.89 else x
        k = int(0.008 * sr); x[:k] *= np.linspace(0, 1, k); x[-k:] *= np.linspace(1, 0, k); sf.write(f"{V5}/wav/{cid}.wav", x, sr, subtype="PCM_24")
        words, heard = align.line_words(rec, x, sr, text); sents = []; pos = 0
        for m in re.findall(r"[^.]+\.", text): ws = words[pos:pos + len(spoken(m).split())]; pos += len(ws); sents.append({"text": spoken(m), "t0": round(ws[0]["start"], 3), "t1": round(ws[-1]["end"], 3), "claims": []})
        J["lines"].append({"id": cid, "text": text, "file": f"voice5/wav/{cid}.wav", "dur": round(len(x) / sr, 3), "sentences": sents, "words": [{"w": w["w"], "start": w["start"], "end": w["end"]} for w in words]})
        used[cid] = {"segments": [[round(s - 0.1, 2), round(e + 0.2, 2)]], "source": "Possibility Lab recording 'Valerio St 3.m4a' (whatif-s2), Part C", "why": "his own closer, reused; clarity normal+rumble, end settled, debreath defaults, level matched", "heard": heard, "not_heard": [w["w"] for w in words if not w["heard"]], "breaths_lowered": [list(b) for b in found]}
        print(cid, round(len(x) / sr, 2), "s; heard:", heard, "| not heard:", used[cid]["not_heard"])
json.dump(J, open(f"{V5}/lines.json", "w"), indent=1, ensure_ascii=False); json.dump(used, open(TU, "w"), indent=1, ensure_ascii=False)
