"""Write art/index.json (the pictures present) for an episode: the engine only tries files listed there.   python3 -I set/art_index.py ep04"""
import json, sys
from pathlib import Path
d = Path(__file__).resolve().parent.parent / sys.argv[1] / "art"
json.dump(sorted(p.name for p in d.iterdir() if p.suffix in (".png", ".webp", ".jpg") ), open(d / "index.json", "w"))
print(open(d / "index.json").read())
