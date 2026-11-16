"""Stand-in (stock voice, Kokoro am_puck, speed 1.0) for sentences the owner has not recorded yet (the US-unit re-records). Used only so the timing is swap-ready;
replace standin/<id>.wav with his take, rerun align.py on the part's vo and v3.py N compile (PRODUCTION.md swap steps).
  $CINEMA_VOICE/venv/bin/python -I parts/standin.py"""
import json, os, sys, importlib.util
from pathlib import Path
import numpy as np, soundfile as sf
HERE = Path(__file__).resolve().parent; VOICE = HERE.parents[5] / "kits/cinema/voice"; sys.path.insert(0, str(VOICE))
spec = importlib.util.spec_from_file_location("tts", VOICE / "tts.py"); tts = importlib.util.module_from_spec(spec); spec.loader.exec_module(tts)
MODELS = Path(os.environ.get("CINEMA_VOICE", str(Path.home() / ".cache/cinema-voice"))) / "models"
LINES = {  # id: text as it will be spoken (US units; the on-screen numbers match)
 "u_ground": "The ground moves through it at about a thousand and forty miles an hour.",
 "u_gust": "The strongest gust ever measured was about two hundred and fifty miles an hour.",
}
from kokoro_onnx import Kokoro
from kokoro_onnx.tokenizer import Tokenizer
k, tok = Kokoro(str(MODELS / "kokoro-v1.0.onnx"), str(MODELS / "voices-v1.0.bin")), Tokenizer(); out = HERE / "standin"; meta = {}
for i, t in LINES.items():
    a, sr = k.create(tts.phonemes(tok, t, {}, "en-us"), voice="am_puck", speed=1.0, lang="en-us", is_phonemes=True)
    x = tts.trim(np.asarray(a, np.float32), sr); x = x * np.float32(10 ** (-1 / 20) / max(1e-9, float(np.max(np.abs(x))))); sf.write(out / f"{i}.wav", x, sr, subtype="PCM_24"); meta[i] = {"text": t, "file": f"{i}.wav", "dur": round(len(x) / sr, 3)}; print(i, meta[i]["dur"])
(out / "lines.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False))
