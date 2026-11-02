"""Place two words the recognizer missed in vo05 ("SPF three", heard as "SPF3") from the line's energy envelope.
Run after kits/cinema/voice/align.py:  python3 -I films/channels/skincare/ep04/fixwords.py"""
import json
from pathlib import Path

p = Path(__file__).resolve().parent / "vo" / "words.json"
w = json.loads(p.read_text())
L = next(l for l in w["lines"] if l["id"] == "vo05")
for x in L["words"]:
    if x["w"] == "SPF":
        x.update(start=8.12, end=8.78, note="placed by hand from the line's energy (the recognizer heard 'SPF3')")
    if x["w"] == "three":
        x.update(start=8.8, end=9.1, note="placed by hand from the line's energy: θ onset 8.80 s, vowel 8.88 s")
p.write_text(json.dumps(w, indent=1, ensure_ascii=False))
