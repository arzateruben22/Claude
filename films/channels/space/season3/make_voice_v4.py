"""make_voice_v4.py [ids...]: the stand-in (AI) voice for the owner's v4 short script lines (long01/v4/lines.txt: `id|text`), aligned like make_voice.py, into long01/voice4/lines.json.
The owner's recording replaces these files later (same ids, same json shape)."""
import json, os, re, subprocess, sys, wave
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".."))
L1 = f"{ROOT}/films/channels/space/long01"; V = L1 + "/voice4"; SPEED = "0.92"
sys.path.insert(0, f"{ROOT}/kits/cinema/voice"); from scriptfile import spoken, SENTENCE_END
VOICE = os.path.expanduser("~/.cache/cinema-voice"); PY = VOICE + "/venv/bin/python"
src = [l.rstrip("\n").split("|", 1) for l in open(L1 + "/v4/lines.txt") if "|" in l and not l.startswith("#")]
want = sys.argv[1:]; beats = [(i, t) for i, t in src if not want or i in want]
os.makedirs(V + "/wav", exist_ok=True); open(V + "/script_voice.md", "w").write("\n".join(f"## {n}\nvo: {t}\n" for n, t in beats))
subprocess.run([PY, "-I", f"{ROOT}/kits/cinema/voice/tts.py", V + "/script_voice.md", V + "/wav", "--voice", "am_michael", "--speed", SPEED], check=True, capture_output=True)
subprocess.run([PY, "-I", f"{ROOT}/kits/cinema/voice/align.py", V + "/wav", VOICE + "/models"], check=True, capture_output=True)
words = json.load(open(V + "/wav/words.json"))["lines"]; out = []
for i, (n, t) in enumerate(beats, 1):
    wav = f"voice4/wav/{i:02d}.wav"
    with wave.open(f"{L1}/{wav}") as w: dur = w.getnframes() / w.getframerate()
    ws = words[i - 1]["words"]; sents, pos = [], 0
    for m in re.finditer(r".+?" + SENTENCE_END.pattern, t.strip()):
        sp = spoken(m.group(0)); k = len(sp.split()); seg = ws[pos:pos + k]; pos += k
        if seg: sents.append({"text": sp, "t0": round(seg[0]["start"], 3), "t1": round(seg[-1]["end"], 3), "claims": []})
    out.append({"id": n, "text": spoken(t), "file": wav, "dur": round(dur, 3), "sentences": sents, "words": [{"w": x["w"], "start": x["start"], "end": x["end"]} for x in ws]})
json.dump({"voice": "am_michael (AI stand-in)", "speed": float(SPEED), "lines": out}, open(V + "/lines.json", "w"), indent=1, ensure_ascii=False); print(len(out), "lines;", round(sum(x["dur"] for x in out)), "s")
