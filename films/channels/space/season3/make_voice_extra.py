"""make_voice_extra.py: the two 'subscribe' CTA lines (1 and 2) for the YouTube variants, voiced exactly like make_voice.py and appended to lines.json (files in voice/wav_extra)."""
import json, os, re, subprocess, sys, wave
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".."))
L1 = f"{ROOT}/films/channels/space/long01"; V = L1 + "/voice"; X = V + "/wav_extra"; SPEED = "0.92"
sys.path.insert(0, f"{ROOT}/kits/cinema/voice"); from scriptfile import spoken, SENTENCE_END
VOICE = os.path.expanduser("~/.cache/cinema-voice"); PY = VOICE + "/venv/bin/python"
beats = [("cta1_subscribe", "Quick thing: if that made the sky feel bigger, tap like and subscribe."), ("cta2_subscribe", "Still looking up? Tap like and subscribe. There's plenty more sky.")]
os.makedirs(X, exist_ok=True); open(X + "/script_extra.md", "w").write("\n".join(f"## {n}\nvo: {t}\n" for n, t in beats))
subprocess.run([PY, "-I", f"{ROOT}/kits/cinema/voice/tts.py", X + "/script_extra.md", X, "--voice", "am_michael", "--speed", SPEED], check=True, capture_output=True)
subprocess.run([PY, "-I", f"{ROOT}/kits/cinema/voice/align.py", X, VOICE + "/models"], check=True, capture_output=True)
words = json.load(open(X + "/words.json"))["lines"]; data = json.load(open(V + "/lines.json")); have = {l["id"] for l in data["lines"]}
for i, (n, t) in enumerate(beats, 1):
    if n in have: continue
    wav = f"voice/wav_extra/{i:02d}.wav"
    with wave.open(f"{L1}/{wav}") as w: dur = w.getnframes() / w.getframerate()
    ws = words[i - 1]["words"]; sents, pos = [], 0
    for m in re.finditer(r".+?" + SENTENCE_END.pattern, t.strip()):
        sp = spoken(m.group(0)); k = len(sp.split()); seg = ws[pos:pos + k]; pos += k
        if seg: sents.append({"text": sp, "t0": round(seg[0]["start"], 3), "t1": round(seg[-1]["end"], 3), "claims": []})
    data["lines"].append({"id": n, "text": spoken(t), "file": wav, "dur": round(dur, 3), "sentences": sents, "words": [{"w": x["w"], "start": x["start"], "end": x["end"]} for x in ws]})
json.dump(data, open(V + "/lines.json", "w"), indent=1, ensure_ascii=False); print([ (l["id"], l["dur"]) for l in data["lines"] if l["id"].startswith("cta")])
