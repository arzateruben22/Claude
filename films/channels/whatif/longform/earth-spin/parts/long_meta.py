"""Metadata for the long film in compilations/s3: chapters.txt (8 lines = the 8 parts' film.json titles, from 0:00), description.md, packaging.json, qa.json.
  python3 -I .../parts/long_meta.py [qa.json measured by hand]"""
import json, re, sys
from pathlib import Path
ES = Path(__file__).resolve().parent.parent; OUT = ES.parents[1] / "compilations/s3"; OUT.mkdir(parents=True, exist_ok=True)
TITLES = ["What If Earth Spun Faster?", "The day is shrinking fast", "The air can't keep up with the ground", "The oceans slide toward the equator", "Storms and the six hour day", "The year gets thousands of days", "A day as long as a movie", "The ninety minute day"]
BEATS = ["hook", "spinup", "wind", "oceans", "weather", "calendar", "three", "one-five"]       # the long film's beat that opens each part's story
film = json.loads((ES / "film.json").read_text()); t0 = {b["id"].rsplit("-", 1)[0] if b["id"][-1].isdigit() and "-" in b["id"] else b["id"]: b["t0"] for b in reversed(film["beats"])}
t0 = {k: min(b["t0"] for b in film["beats"] if (b["id"] == k or b["id"].startswith(k + "-"))) for k in BEATS}
ts = [0.0 if i == 0 else round(t0[k]) for i, k in enumerate(BEATS)]
fmt = lambda s: f"{int(s // 60)}:{int(s % 60):02d}"
chapters = [f"{fmt(t)} {n}" for t, n in zip(ts, TITLES)]
(OUT / "chapters.txt").write_text("\n".join(chapters) + "\n")
claims = json.loads((ES / "claims.json").read_text())
def src(c):
    if c.get("source_url"): return f"- {c['claim']} ({c.get('source_title') or 'source'}): {c['source_url']}"
    return f"- {c['claim']} ({c.get('source_title') or 'Our calculation (shown in the film)'})"
desc = f"""What If Earth Spun Faster and Couldn't Stop?

Shorten the day to about 1 hour 24 minutes and the ground at the equator moves at orbital speed: you weigh nothing. We follow one person standing on the equator as the day falls from 24 hours down to 1.4: the Sun races, the air is left behind, the oceans slide toward the equator, storms tighten, the year fills with thousands of days, you get lighter, and then the planet cannot hold on. The last minutes cover the float, where the push outward cancels gravity, the point where the equator breaks up, and what it would cost in energy.

Chapters
{chr(10).join(chapters)}

Sources (every number is a first-order estimate for a perfect ball; each claim is still OPEN until a person opens its source)
{chr(10).join(src(c) for c in claims)}

Narration: synthetic voice (AI). Animation: code-rendered, no stock footage. Thumbnail illustration made with AI.

Possibility Lab: Impossible questions, honest assumptions, real calculations.
"""
(OUT / "description.md").write_text(desc)
pk = json.loads((ES / "packaging.json").read_text()); pk["video"] = "compilations/s3"
pk["winner"] = {**pk["winner"], "thumbnail": "D", "thumbnailText": "90-MINUTE DAY", "why": "The owner's illustration of the figure under a streaking Sun, with our visor robot in awe, and the day length in big words; it shows the setup, not the answer."}
pk["thumbnailFile"] = "thumbnail.jpg"; pk["aiIllustration"] = True
(OUT / "packaging.json").write_text(json.dumps(pk, indent=1, ensure_ascii=False))
if len(sys.argv) > 1: (OUT / "qa.json").write_text(Path(sys.argv[1]).read_text())
print("\n".join(chapters))
