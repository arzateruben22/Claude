"""Insert the like/follow moment (films/channels/CTA.md) into a built episode's voice, without renumbering its lines.
  $CINEMA_VOICE/venv/bin/python -I films/channels/skincare/set/cta_line.py ep08 vo05 "Quick thing: like and follow. Your skin has plenty more secrets." [speed]
Synthesises the line with the episode's narrator (Kokoro, tts.py's phonemes and trim), writes vo/<after>c.wav, and adds it to vo/lines.json
right after line <after> with beat "cta" (id "<after>c"). Then run kits/cinema/voice/align.py on the vo folder, and build_ep.py (times shift by itself)."""
import importlib.util, json, sys
from pathlib import Path
import numpy as np, soundfile as sf
R = Path(__file__).resolve().parent.parent; ep, after, text = sys.argv[1], sys.argv[2], sys.argv[3]; speed = float(sys.argv[4]) if len(sys.argv) > 4 else 0.9
VOICE = R.parents[2] / "kits/cinema/voice"; sys.path.insert(0, str(VOICE))
spec = importlib.util.spec_from_file_location("tts", VOICE / "tts.py"); tts = importlib.util.module_from_spec(spec); spec.loader.exec_module(tts)
from kokoro_onnx import Kokoro
from kokoro_onnx.tokenizer import Tokenizer
models = Path.home() / ".cache/cinema-voice/models"
k, tok = Kokoro(str(models / "kokoro-v1.0.onnx"), str(models / "voices-v1.0.bin")), Tokenizer()
lex = {w.lower(): p for w, p in json.loads((R / ep / "pron.json").read_text()).items()}
meta = json.loads((R / ep / "vo/lines.json").read_text())
ph = tts.phonemes(tok, text, lex, "en-gb")
audio, sr = k.create(ph, voice=meta["voice"], speed=speed, lang="en-gb", is_phonemes=True)
audio = tts.trim(np.asarray(audio, np.float32), sr)
lid = after + "c"; f = R / ep / "vo" / f"{after[2:]}c.wav"; sf.write(f, audio, sr, subtype="PCM_24")
meta["lines"] = [l for l in meta["lines"] if l["id"] != lid]
i = next(j for j, l in enumerate(meta["lines"]) if l["id"] == after) + 1
meta["lines"].insert(i, {"id": lid, "beat": "cta", "text": text, "stars": [], "phonemes": ph, "speed": speed, "file": f.name, "dur": round(len(audio) / sr, 3), "sha256": tts.sha256(f)})
(R / ep / "vo/lines.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False)); print(lid, round(len(audio) / sr, 2), "s")
