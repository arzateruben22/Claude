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
 "u_sea": "At a twelve hour day the sea wants to stand about twenty miles higher at the equator.", "u_depth": "The ocean is only about two point three miles deep.",
 "u_eq6": "The equator moves at about forty-one hundred and fifty miles an hour.", "u_speed3": "The ground moves at about eighty-three hundred miles an hour.",
 "u_w3": "You weigh twenty-two percent less: a hundred and fifty pounds feels like a hundred and seventeen.", "u_jump2": "The jump that lifts you a foot and a half now lifts you about three feet.",
 "u_w15": "At an hour and a half you are almost weightless, about one eighth of your weight: a hundred and fifty pounds becomes about eighteen.",
 "u_jump15": "A foot-and-a-half jump carries you about thirteen feet, higher than a basketball hoop, and a cup falling off a table takes about three times as long to land.",
 # long film only
 "u_l03": "Right now the ground carries you at about a thousand and forty miles an hour.", "u_l05": "The ground moves at about two thousand and eighty miles an hour, nearly three times the speed of sound.",
 "u_l15": "At a day of an hour and twenty-four minutes, the ground moves at about seventeen thousand seven hundred miles an hour, the speed of a satellite in low orbit.", "u_l18": "So the next time you stand still, remember you're already moving at a thousand miles an hour.",
}
from kokoro_onnx import Kokoro
from kokoro_onnx.tokenizer import Tokenizer
k, tok = Kokoro(str(MODELS / "kokoro-v1.0.onnx"), str(MODELS / "voices-v1.0.bin")), Tokenizer(); out = HERE / "standin"; meta = {}
for i, t in LINES.items():
    a, sr = k.create(tts.phonemes(tok, t, {}, "en-us"), voice="am_puck", speed=1.0, lang="en-us", is_phonemes=True)
    x = tts.trim(np.asarray(a, np.float32), sr); x = x * np.float32(10 ** (-1 / 20) / max(1e-9, float(np.max(np.abs(x))))); sf.write(out / f"{i}.wav", x, sr, subtype="PCM_24"); meta[i] = {"text": t, "file": f"{i}.wav", "dur": round(len(x) / sr, 3)}; print(i, meta[i]["dur"])
(out / "lines.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False))
