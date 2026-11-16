"""Scratch read of the Part 1 lines with the stock voice (Kokoro am_puck, speed 1.0, about the owner's pace). Used ONLY to set the beat windows
and to make the recording guide; it never ships.
  $CINEMA_VOICE/venv/bin/python -I films/channels/whatif/longform/gravity-doubles/voice_scratch.py"""
import json, os, re, sys, importlib.util
from pathlib import Path
import numpy as np, soundfile as sf
HERE = Path(__file__).resolve().parent
VOICE = HERE.parents[4] / "kits/cinema/voice"
sys.path.insert(0, str(VOICE))
spec = importlib.util.spec_from_file_location("tts", VOICE / "tts.py"); tts = importlib.util.module_from_spec(spec); spec.loader.exec_module(tts)
MODELS = Path(os.environ.get("CINEMA_VOICE", str(Path.home() / ".cache/cinema-voice"))) / "models"
SPEED, GAP = 1.0, 0.28
from kokoro_onnx import Kokoro
from kokoro_onnx.tokenizer import Tokenizer
k, tok = Kokoro(str(MODELS / "kokoro-v1.0.onnx"), str(MODELS / "voices-v1.0.bin")), Tokenizer()
out = HERE / "part1/vo-scratch"; out.mkdir(parents=True, exist_ok=True)
L = json.loads((HERE / "part1/lines.json").read_text()); res = []
for ln in L:
    sents = [s for s in re.split(r"(?<=[.?!…])\s+", ln["text"].strip()) if s]
    parts = []; sr = 24000
    for j, s in enumerate(sents):
        ph = tts.phonemes(tok, s.replace("…", "."), {}, "en-us")
        a, sr = k.create(ph, voice="am_puck", speed=SPEED, lang="en-us", is_phonemes=True)
        x = tts.trim(np.asarray(a, np.float32), sr); x = x * np.float32(10 ** (-1 / 20) / max(1e-9, float(np.max(np.abs(x)))))
        parts.append(x)
        if j < len(sents) - 1: parts.append(np.zeros(int(GAP * sr), np.float32))
    audio = np.concatenate(parts); f = out / (ln["id"] + ".wav"); sf.write(f, audio, sr, subtype="PCM_24")
    d = round(len(audio) / sr, 3); res.append({**ln, "dur": d, "file": f.name}); print(ln["id"], d, round(len(ln["text"].split()) / d, 2), "wps")
(out / "lines.json").write_text(json.dumps({"lines": res}, indent=1, ensure_ascii=False))
