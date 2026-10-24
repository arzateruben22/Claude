"""Voice Light Minute No. 001 with one Kokoro speed per line (an episode-local wrapper around
kits/cinema/voice/tts.py, which takes one --speed for the whole script).

  $CINEMA_VOICE/venv/bin/python -I films/channels/space/ep01/voice.py --models $CINEMA_VOICE/models
  $CINEMA_VOICE/venv/bin/python -I kits/cinema/voice/align.py films/channels/space/ep01/vo $CINEMA_VOICE/models

Why: at one speed, am_michael read the short lines fast and the long ones slow (measured at 1.0:
hook 3.60, tease 3.78, change 3.09, whoa 3.14 words/s against normal 2.39 and why 2.41), so lint.py's
2.2–3.0 words/s gate failed on four lines, and slowing the whole script to fix them ran the film
past 75 s. One speed per line evens the pace (all lines 2.4–3.0 words/s) at the same total length.

Everything else is tts.py's own code, imported, not copied: the same phonemes() (pron.json swapped
in), the same trim(), the same 24-bit WAVs and the same lines.json fields, plus each line's "speed".
"""
import argparse
import importlib.util
import json
import os
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
VOICE = HERE.parents[3] / "kits/cinema/voice"
sys.path.insert(0, str(VOICE))
from scriptfile import script_lines   # noqa: E402

spec = importlib.util.spec_from_file_location("tts", VOICE / "tts.py")
tts = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tts)

NARRATOR = "am_michael"          # DECISIONS.md: Light Minute's narrator
# Kokoro speed per line, chosen from measured durations (README.md, "Voice"): the short questions
# slower so they land, the two long explanatory lines a little brisker so the film stays under 75 s.
SPEEDS = {"vo01": 0.82, "vo02": 1.08, "vo03": 0.95, "vo04": 1.1, "vo05": 0.97, "vo06": 1.0, "vo07": 1.02, "vo08": 0.95}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", default=os.environ.get("CINEMA_VOICE", str(Path.home() / ".cache/cinema-voice")) + "/models")
    ap.add_argument("--out", default=str(HERE / "vo"))
    a = ap.parse_args()
    from kokoro_onnx import Kokoro
    from kokoro_onnx.tokenizer import Tokenizer
    import onnxruntime
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    lang = "en-us"
    model, voices = Path(a.models) / "kokoro-v1.0.onnx", Path(a.models) / "voices-v1.0.bin"
    k, tok = Kokoro(str(model), str(voices)), Tokenizer()
    lex = {w.lower(): p for w, p in json.loads((HERE / "pron.json").read_text()).items()}
    meta = {"voice": NARRATOR, "speed": "per line", "lang": lang, "model_sha256": tts.sha256(model), "voices_sha256": tts.sha256(voices),
            "kokoro_onnx": "0.6.1", "onnxruntime": onnxruntime.__version__, "python": sys.version.split()[0],
            "made_by": "films/channels/space/ep01/voice.py (tts.py's phonemes and trim, one speed per line)", "lines": []}
    for i, (beat, text, stars) in enumerate(script_lines(HERE / "script.md"), 1):
        lid = f"vo{i:02d}"
        ph = tts.phonemes(tok, text, lex, lang)
        audio, sr = k.create(ph, voice=NARRATOR, speed=SPEEDS[lid], lang=lang, is_phonemes=True)
        audio = tts.trim(np.asarray(audio, np.float32), sr)
        f = out / f"{i:02d}.wav"
        sf.write(f, audio, sr, subtype="PCM_24")
        dur = round(len(audio) / sr, 3)
        meta["lines"].append({"id": lid, "beat": beat, "text": text, "stars": stars, "phonemes": ph, "speed": SPEEDS[lid],
                              "file": f.name, "dur": dur, "sha256": tts.sha256(f)})
        print(f"{lid} {beat:<8} speed {SPEEDS[lid]:.2f}  {dur:5.2f} s  {len(text.split()) / dur:.2f} words/s  {text[:50]}")
    (out / "lines.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
