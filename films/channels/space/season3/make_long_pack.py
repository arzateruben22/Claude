"""make_long_pack.py: compilations/s3 text files for the Moon long film: chapters.txt (from the timeline's segment starts, titles = part_titles.json),
description.md, packaging.json (owner's draft with the final title), thumbnail.jpg (the owner's 'close' painting + 2 words)."""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
R = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
L1 = R + "/long01"; D = R + "/compilations/s3"; os.makedirs(D, exist_ok=True)
T = json.load(open(L1 + "/part_titles.json")); tl = json.load(open(L1 + "/out/long.json")); claims = json.load(open(L1 + "/claims.json"))
start = {c["id"].split("_")[0]: c["t"] for c in reversed(tl["clips"]) if c["id"].endswith("_vo")}
def ts(s): s = int(s); return f"{s // 60}:{s % 60:02d}"
rows = [(0.0, T["parts"]["1"])] + [(start[f"ch{n}"] - 0.2, T["parts"][str(n)]) for n in range(2, 9)]
open(D + "/chapters.txt", "w").write("\n".join(f"{ts(t)} {n}" for t, n in rows) + "\n")
if "--text-only" not in sys.argv:
    im = Image.open(L1 + "/art/plate-close.png").convert("RGB").resize((1920, 1080), Image.LANCZOS)
    g = Image.new("L", (1920, 1080), 0); gd = ImageDraw.Draw(g); gd.rectangle((1000, 800, 1920, 1080), fill=150); g = g.filter(ImageFilter.GaussianBlur(120))
    im = Image.composite(Image.new("RGB", im.size, (6, 8, 24)), im, g); d = ImageDraw.Draw(im)
    f = ImageFont.truetype(R + "/fonts/Lexend-VF.ttf", 150)
    try: f.set_variation_by_axes([800])
    except Exception: pass
    d.text((1860, 1000), "HOW CLOSE?", font=f, fill=(238, 240, 255), anchor="rs"); im.save(D + "/thumbnail.jpg", quality=90, optimize=True)
# description
secs = {}
for c in claims: secs.setdefault((c["source_title"], c["source_url"]), []).append(c["id"])
src = "\n".join(f"- {t}: {u}" for (t, u), ids in sorted(secs.items()))
desc = f"""A thought experiment: How Close Can the Moon Get Before It Breaks?

One More Orbit · Season 3. Bring the Moon in, step by step, and see what each distance does to the tides, the night sky, eclipses, the weather and the Moon itself, until it reaches the distance no Moon survives. A hypothetical, not a forecast: the real Moon is drifting away by about 3.8 cm a year.

Chapters
""" + "".join(f"{ts(t)} {n}\n" for t, n in rows) + f"""
The finale (the break-up and the ring) is in this full video only.

Sources (each number's source; figures are rounded and hedged in the film)
{src}

Made with Claude Code. The narration is a synthetic AI voice and the pictures are AI-generated paintings plus code-rendered animation; the distances and effects are scaled from standard physics (size with 1/d, tides with 1/d³, light with 1/d²). Part of the Season 3 shorts: Parts 1 to 8, each with its own hook; this is the whole story.
"""
open(D + "/description.md", "w").write(desc)
dr = json.load(open(L1 + "/moon-draft.packaging.json")) if os.path.exists(L1 + "/moon-draft.packaging.json") else {"version": 1, "format": "long"}
dr["video"] = "long01"; dr["winner"] = {"title": T["title"], "thumbnail": "thumbnail.jpg", "text": "HOW CLOSE?"}; dr["thumbnailFile"] = "thumbnail.jpg"
dr["hook"] = "Bring the Moon closer, one step at a time, until it breaks apart and leaves a ring."
json.dump(dr, open(D + "/packaging.json", "w"), indent=1)
print(open(D + "/chapters.txt").read())
