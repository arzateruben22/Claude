"""make_voice.py: voice every line of long01 (the long film and its 8 parts) with the channel's AI stand-in (Kokoro am_michael, calm pace 0.92),
align the words (Parakeet), and write long01/voice/lines.json (id, text, file, dur, sentences[{text,t0,t1}], words[{w,start,end}]).
The timing data is the swap point: the owner's recording is cut into the same line ids, aligned the same way, and everything downstream
(captions, the distance counter, the parts) re-times from lines.json without touching the picture code."""
import json, os, re, subprocess, sys, wave
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".."))
L1 = f"{ROOT}/films/channels/space/long01"; V = L1 + "/voice"; SPEED = "0.92"
sys.path.insert(0, f"{ROOT}/kits/cinema/voice"); from scriptfile import spoken, SENTENCE_END
VOICE = os.path.expanduser("~/.cache/cinema-voice"); PY = VOICE + "/venv/bin/python"
s = open(L1 + "/script.md").read(); beats = []
for sec in re.split(r"\n## ", s)[1:]:
    name = sec.split("\n")[0].split()[0]
    for k in ("bridge", "hook", "vo", "loop"):
        m = re.search(rf"^{k}: (.*)$", sec, re.M)
        if m: beats.append((f"{name}_{k}", m.group(1)))
nums = ["one", "two", "three", "four", "five", "six", "seven", "eight"]
for i, w in enumerate(nums, 1): beats.append((f"closer{i}", f"Part {w} of eight. Full video on YouTube."))
CTA = ["Quick thing: if that made the sky feel bigger, tap like and {v}.", "Still looking up? Tap like and {v}. There's plenty more sky.",
       "Real quick: like and {v}, if space just got a little stranger for you.", "If you want one more orbit, tap like and {v}."]
for i, t in enumerate(CTA, 1): beats.append((f"cta{i}_follow", t.format(v="follow")))
for i in (3, 4): beats.append((f"cta{i}_subscribe", CTA[i - 1].format(v="subscribe")))
os.makedirs(V + "/wav", exist_ok=True)
open(V + "/script_voice.md", "w").write("\n".join(f"## {n}\nvo: {t}\n" for n, t in beats))
subprocess.run([PY, "-I", f"{ROOT}/kits/cinema/voice/tts.py", V + "/script_voice.md", V + "/wav", "--voice", "am_michael", "--speed", SPEED], check=True, capture_output=True)
subprocess.run([PY, "-I", f"{ROOT}/kits/cinema/voice/align.py", V + "/wav", VOICE + "/models"], check=True, capture_output=True)
words = json.load(open(V + "/wav/words.json"))["lines"]; out = []
for i, (n, t) in enumerate(beats, 1):
    wav = f"voice/wav/{i:02d}.wav"
    with wave.open(f"{L1}/{wav}") as w: dur = w.getnframes() / w.getframerate()
    ws = words[i - 1]["words"]; sents, pos = [], 0
    for m in re.finditer(r".+?" + SENTENCE_END.pattern, t.strip()):
        sp = spoken(m.group(0)); k = len(sp.split()); seg = ws[pos:pos + k]; pos += k
        if seg: sents.append({"text": sp, "t0": round(seg[0]["start"], 3), "t1": round(seg[-1]["end"], 3), "claims": re.findall(r"\{(c\d+)\}", m.group(0))})
    out.append({"id": n, "text": spoken(t), "file": wav, "dur": round(dur, 3), "sentences": sents, "words": [{"w": x["w"], "start": x["start"], "end": x["end"]} for x in ws]})
json.dump({"voice": "am_michael (AI stand-in)", "speed": float(SPEED), "lines": out}, open(V + "/lines.json", "w"), indent=1, ensure_ascii=False)
print(len(out), "lines;", round(sum(x["dur"] for x in out)), "s of speech")
