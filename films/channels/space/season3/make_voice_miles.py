"""make_voice_miles.py: the STAND-IN (AI, scratch Kokoro 'am_michael', not the owner's voice, not cloned) for the owner's 11 miles lines (long01/v4/lines-miles.txt) until he records them.
Each line is fitted to the duration of the kilometers line it replaces (same window, so his take drops in): the speech speed is set per line, then the wav is padded/trimmed at the end by at most 0.2 s.
Writes long01/voice6/{wav/<id>.wav, lines.json} (same json shape as voice5; file = voice6/wav/<id>.wav). usage: python3 -I make_voice_miles.py"""
import json, os, re, subprocess, sys, wave
import numpy as np, soundfile as sf
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".."))
L1 = f"{ROOT}/films/channels/space/long01"; V = L1 + "/voice6"; sys.path.insert(0, f"{ROOT}/kits/cinema/voice"); from scriptfile import spoken, SENTENCE_END
VOICE = os.path.expanduser("~/.cache/cinema-voice"); PY = VOICE + "/venv/bin/python"
src = [l.rstrip("\n").split("|", 1) for l in open(L1 + "/v4/lines-miles.txt") if "|" in l and not l.startswith("#")]
km = {x["id"]: x for x in json.load(open(L1 + "/voice5/lines.json"))["lines"]}; os.makedirs(V + "/wav", exist_ok=True); out = []
def tts(i, t, speed):
    d = f"{V}/tmp_{i}"; os.makedirs(d, exist_ok=True); open(f"{d}/s.md", "w").write(f"## {i}\nvo: {t}\n")
    subprocess.run([PY, "-I", f"{ROOT}/kits/cinema/voice/tts.py", f"{d}/s.md", d, "--voice", "am_michael", "--speed", f"{speed:.3f}"], check=True, capture_output=True)
    subprocess.run([PY, "-I", f"{ROOT}/kits/cinema/voice/align.py", d, VOICE + "/models"], check=True, capture_output=True)
    w = [f for f in sorted(os.listdir(d)) if f.endswith(".wav")][0]; return f"{d}/{w}", json.load(open(f"{d}/words.json"))["lines"][0]["words"]
for i, t in src:
    target = km[i]["dur"]; sp = 0.92
    for _ in range(3):
        f, ws = tts(i, t, sp); x, sr = sf.read(f, dtype="float32"); x = x if x.ndim == 1 else x.mean(1); d = len(x) / sr
        if abs(d - target) < 0.15: break
        sp = min(1.25, max(0.8, sp * d / target))
    n = int(target * sr); x = x[:n] if len(x) >= n else np.concatenate([x, np.zeros(n - len(x), np.float32)])
    sf.write(f"{V}/wav/{i}.wav", x, sr, subtype="PCM_24")
    sents, pos = [], 0
    for m in re.finditer(r".+?" + SENTENCE_END.pattern, t.strip()):
        sp_ = spoken(m.group(0)); k = len(sp_.split()); seg = ws[pos:pos + k]; pos += k
        if seg: sents.append({"text": sp_, "t0": round(min(seg[0]["start"], target - 0.1), 3), "t1": round(min(seg[-1]["end"], target), 3), "claims": []})
    out.append({"id": i, "text": spoken(t), "file": f"voice6/wav/{i}.wav", "dur": round(len(x) / sr, 3), "sentences": sents, "words": [{"w": q["w"], "start": q["start"], "end": q["end"]} for q in ws], "stand_in": True})
    print(i, "target", round(target, 2), "speech", round(d, 2), "speed", round(sp, 2))
json.dump({"voice": "am_michael (AI stand-in, scratch TTS; the owner's takes replace these)", "lines": out}, open(V + "/lines.json", "w"), indent=1, ensure_ascii=False)
