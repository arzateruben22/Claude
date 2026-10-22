"""Voice a film's script with Kokoro-82M, one WAV per line, with a pronunciation list.

  $CINEMA_VOICE/venv/bin/python -I kits/cinema/voice/tts.py SCRIPT.md OUTDIR --voice af_heart [--speed 1.0] [--lexicon pron.json]

SCRIPT.md has one `vo:` line per beat (see films/skin-school-tiktok/script.md); `*stars*` and
`{direction}` are stripped before speaking. The lexicon maps a word to the phonemes Kokoro should
say ({"sebum": "sˈibəm"}); every other word goes through Kokoro's own phonemizer. Writes
OUTDIR/NN.wav (24 kHz, mono, trimmed to the voice) and OUTDIR/lines.json, which records the text,
the exact phonemes spoken, the voice, the model's SHA256 and the toolchain versions, so a line can
be checked and regenerated identically.
"""
import argparse
import hashlib
import json
import os
import re
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro
from kokoro_onnx.tokenizer import Tokenizer


def script_lines(path):
    """[(beat id, spoken text, starred words)] from a script.md."""
    out, beat = [], None
    text = Path(path).read_text()
    for m in re.finditer(r"^## (\S+)|^vo: (.*?)(?=\n\s*\n|\nend card|\n## |\Z)", text, re.S | re.M):
        if m.group(1):
            beat = m.group(1)
            continue
        raw = re.sub(r"\s+", " ", m.group(2)).strip()
        stars = re.findall(r"\*([^*]+)\*", raw)
        out.append((beat, re.sub(r"\{[^}]*\}", "", raw).replace("*", "").strip(), stars))
    return out


def phonemes(tok, text, lexicon, lang):
    """Kokoro's phonemes for text, with lexicon words swapped in (matched case-insensitively,
    punctuation kept with its neighbours so the phrasing doesn't change)."""
    if not lexicon:
        return tok.phonemize(text, lang)
    keys = sorted(lexicon, key=len, reverse=True)
    pat = re.compile(r"\b(" + "|".join(re.escape(k) for k in keys) + r")\b", re.I)
    parts, last = [], 0
    for m in pat.finditer(text):
        if text[last:m.start()].strip():
            parts.append(tok.phonemize(text[last:m.start()].strip(), lang))
        parts.append(lexicon[m.group(1).lower()])
        last = m.end()
    if text[last:].strip():
        parts.append(tok.phonemize(text[last:].strip(), lang))
    return " ".join(p.strip() for p in parts if p.strip())


def sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def trim(a, sr, db=-45.0, pad=0.02):
    """Trim silence at both ends (keeps pad seconds), so line starts are exact."""
    e = np.abs(a) > np.abs(a).max() * 10 ** (db / 20)
    i, j = int(np.argmax(e)), len(a) - int(np.argmax(e[::-1]))
    p = int(pad * sr)
    return a[max(0, i - p):min(len(a), j + p)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("script")
    ap.add_argument("out")
    ap.add_argument("--voice", default="af_heart")
    ap.add_argument("--speed", type=float, default=1.0)
    ap.add_argument("--lexicon")
    ap.add_argument("--models", default=os.environ.get("CINEMA_VOICE", str(Path.home() / ".cache/cinema-voice")) + "/models")
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    lang = "en-gb" if a.voice[0] == "b" else "en-us"
    model, voices = Path(a.models) / "kokoro-v1.0.onnx", Path(a.models) / "voices-v1.0.bin"
    k, tok = Kokoro(str(model), str(voices)), Tokenizer()
    lex = {w.lower(): p for w, p in json.loads(Path(a.lexicon).read_text()).items()} if a.lexicon else {}
    import kokoro_onnx
    import onnxruntime
    meta = {"voice": a.voice, "speed": a.speed, "lang": lang, "model_sha256": sha256(model), "voices_sha256": sha256(voices),
            "kokoro_onnx": kokoro_onnx.__version__ if hasattr(kokoro_onnx, "__version__") else "0.6.1",
            "onnxruntime": onnxruntime.__version__, "python": sys.version.split()[0], "lines": []}
    for i, (beat, text, stars) in enumerate(script_lines(a.script), 1):
        ph = phonemes(tok, text, lex, lang)
        audio, sr = k.create(ph, voice=a.voice, speed=a.speed, lang=lang, is_phonemes=True)
        audio = trim(np.asarray(audio, np.float32), sr)
        f = out / f"{i:02d}.wav"
        sf.write(f, audio, sr, subtype="PCM_24")
        meta["lines"].append({"id": f"vo{i:02d}", "beat": beat, "text": text, "stars": stars, "phonemes": ph,
                              "file": f.name, "dur": round(len(audio) / sr, 3), "sha256": sha256(f)})
        print(f"vo{i:02d} {beat:<8} {len(audio) / sr:5.2f} s  {text[:60]}")
    (out / "lines.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
