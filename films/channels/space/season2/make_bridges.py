"""make_bridges.py <bridges.md> <outdir>: voice the long video's opening, bridges and finale (Kokoro am_michael, 0.95), align the words (Parakeet),
split each into timed sentences for the captions, and mix each with the channel's music through the studio (voice 0.4 s in, music ducked).
Writes <outdir>/bridges.json: [{id, kind, dur, mix (wav), sentences: [{text, t0, t1}]}]."""
import json, os, re, subprocess, sys, wave
md, out = sys.argv[1], sys.argv[2]
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".."))
VOICE = os.path.expanduser("~/.cache/cinema-voice"); PY = VOICE + "/venv/bin/python"
sys.path.insert(0, f"{ROOT}/kits/cinema/voice"); from scriptfile import spoken, SENTENCE_END
text = open(md).read(); blocks = []
for sec in re.split(r"\n## ", text)[1:]:
    head = sec.split("\n")[0]; vo = re.search(r"^vo: (.*)$", sec, re.M).group(1); vis = (re.search(r"^visual: (.*)$", sec, re.M) or [None, ""])[1]
    kind = "opening" if head.startswith("opening") else "finale" if head.startswith("finale") else "bridge" + re.search(r"bridge (\d)", head).group(1)
    blocks.append((kind, vo, vis))
os.makedirs(out, exist_ok=True); vod = os.path.join(out, "vo"); os.makedirs(vod, exist_ok=True)
scr = os.path.join(out, "bridges_script.md"); open(scr, "w").write("\n".join(f"## {k}\nvo: {vo}\n" for k, vo, _ in blocks))
subprocess.run([PY, "-I", f"{ROOT}/kits/cinema/voice/tts.py", scr, vod, "--voice", "am_michael", "--speed", "0.95"], check=True, capture_output=True)
subprocess.run([PY, "-I", f"{ROOT}/kits/cinema/voice/align.py", vod, VOICE + "/models"], check=True, capture_output=True)
words = json.load(open(os.path.join(vod, "words.json")))["lines"]
sheet0 = json.load(open(os.path.join(ROOT, "films/channels/space/ep12/sheet.json"))); res = []
for i, (kind, vo, vis) in enumerate(blocks, 1):
    wav = os.path.join(vod, f"{i:02d}.wav")
    with wave.open(wav) as w: vd = w.getnframes() / w.getframerate()
    ws = words[i - 1]["words"]; sents, pos = [], 0
    for m in re.finditer(r".+?" + SENTENCE_END.pattern, vo.strip()):
        s = m.group(0); n = len(spoken(s).split())
        seg = ws[pos:pos + n]; pos += n
        if seg: sents.append({"text": spoken(s), "t0": round(0.4 + seg[0]["start"], 3), "t1": round(0.4 + seg[-1]["end"], 3)})
    for a, b in zip(sents, sents[1:]): a["t1"] = round(max(a["t1"], min(b["t0"] - 0.05, a["t1"] + 0.6)), 3)
    dur = round(vd + 0.4 + 0.7, 3)
    sheet = {"duration": dur, "fps": 30, "preset": sheet0["preset"], "sections": [{"id": kind, "t0": 0, "t1": dur, "energy": 0.35}], "events": [], "voice": [{"id": "vo", "t": 0.4, "file": os.path.relpath(wav, out)}]}
    sp = os.path.join(out, f"{kind}-sheet.json"); json.dump(sheet, open(sp, "w"))
    ad = os.path.join(out, f"{kind}-audio"); r = subprocess.run(["python3", "-I", f"{ROOT}/kits/cinema/studio/render.py", "--root", out, sp, ad], capture_output=True, text=True)
    mix = os.path.join(ad, "mix.wav"); assert os.path.exists(mix), r.stdout[-500:] + r.stderr[-500:]
    res.append({"id": kind, "kind": kind, "dur": dur, "mix": os.path.abspath(mix), "visual": vis, "sentences": sents}); print(kind, dur, len(sents), "sentences")
json.dump(res, open(os.path.join(out, "bridges.json"), "w"), indent=1, ensure_ascii=False)
