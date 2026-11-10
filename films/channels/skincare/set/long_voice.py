"""Season 2 long video: synthesise the narrated cards (opening, five bridges, finale, finale CTA) with the series narrator.
  ~/.cache/cinema-voice/venv/bin/python -I films/channels/skincare/set/long_voice.py
Writes compilations/vol02/voice/<id>.wav and narration.json (id, text, wav, dur)."""
import importlib.util, json, sys
from pathlib import Path
import numpy as np, soundfile as sf
R = Path(__file__).resolve().parent.parent; VOICE = R.parents[2] / "kits/cinema/voice"; sys.path.insert(0, str(VOICE))
spec = importlib.util.spec_from_file_location("tts", VOICE / "tts.py"); tts = importlib.util.module_from_spec(spec); spec.loader.exec_module(tts)
from kokoro_onnx import Kokoro
from kokoro_onnx.tokenizer import Tokenizer
models = Path.home() / ".cache/cinema-voice/models"
k, tok = Kokoro(str(models / "kokoro-v1.0.onnx"), str(models / "voices-v1.0.bin")), Tokenizer()
lex = {}
for e in ("ep07", "ep08", "ep09", "ep10", "ep11", "ep12"):
    try: lex.update({w.lower(): p for w, p in json.loads((R / e / "pron.json").read_text()).items()})
    except Exception: pass
LINES = [
 ("open", "Your skin does at least six jobs without asking you. It raises hairs, folds your fingertips, cools you down, answers the sun, holds water in, and drew a pattern on your fingers before you were born. Here is how each one works.", 0.86),
 ("bridge1", "That was a nerve telling a muscle what to do. Your nerves run another trick in your fingertips, and you have seen it in the bath.", 0.86),
 ("bridge2", "Wrinkled fingers, run by your nervous system. Now a job your skin does for the whole body: it cools you.", 0.86),
 ("bridge3", "Sweat handles heat. Sunlight is another story, and your skin answers it with pigment.", 0.86),
 ("bridge4", "That was pigment answering sunlight. Underneath it, a wall of cells and fats keeps water in.", 0.86),
 ("bridge5", "A wall built from cells and fats, layer by layer. And on the outside of it, a pattern you have carried since before you were born.", 0.86),
 ("finale", "So that is your skin, working without you. A muscle, a nerve and a hair, for goosebumps. Nerves that fold your fingertips. Sweat that cools you as it dries. Pigment that caps a cell's nucleus. A wall of bricks and fats. And a pattern drawn in waves before birth. None of it needs your permission, and most of it is going on in your skin right now.", 0.86),
 ("finale_cta", "If you just looked at your own arm, tap like and subscribe!", 0.9),
]
out = R / "compilations/vol02/voice"; out.mkdir(parents=True, exist_ok=True); meta = []
for lid, text, sp in LINES:
    ph = tts.phonemes(tok, text, lex, "en-gb")
    audio, sr = k.create(ph, voice="bf_isabella", speed=sp, lang="en-gb", is_phonemes=True)
    audio = tts.trim(np.asarray(audio, np.float32), sr); f = out / f"{lid}.wav"; sf.write(f, audio, sr, subtype="PCM_24")
    meta.append({"id": lid, "text": text, "speed": sp, "wav": f.name, "dur": round(len(audio) / sr, 3)}); print(lid, meta[-1]["dur"])
(out / "narration.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False))
