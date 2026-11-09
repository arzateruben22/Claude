"""Builds out/posting.json and out/POSTING.md for S2E02 (folder ep08) in Season 1's format, from claims.json and calc.py.

    python3 -I films/channels/whatif/ep08/posting.py

Nothing here is invented: the numbers come from calc.py's RESULTS, the sources from claims.json.
"""
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from calc import RESULTS as R  # noqa: E402

OUT = HERE / "out"
OUT.mkdir(exist_ok=True)
BASE = "possibility-lab-s2e02"
TITLE = "Everyone holds hands"
claims = json.loads((HERE / "claims.json").read_text())


def host(u):
    h = urlparse(u).netloc.replace("www.", "")
    return {"science.nasa.gov": "NASA", "nssdc.gsfc.nasa.gov": "NASA"}.get(h, h)


def clean(c):
    t = c["claim"].replace("ASSUMPTION: ", "Assumption, not a measurement: ")
    return re.sub(r"\s+", " ", t).strip()


src = [f"{i}. {clean(c)} — {host(c['source_url'])}: {c['source_url']}" for i, c in enumerate(claims, 1)]
sources = "Sources\n" + "\n".join(src)
hosts = []
for c in claims:
    h = host(c["source_url"])
    if h not in hosts:
        hosts.append(h)

hook = "How long is a chain of us? Everyone on Earth, holding hands."
body = (f"Stretch your arms out and you are about as wide as you are tall. Give everyone a meter and a half, kids included, and "
        f"8.2 billion of us joined hand to hand make a line about {R['km_m']:.0f} million kilometers long. Wrapped round the Earth, that is about "
        f"{R['laps']} laps, and one lap needs only about one person in 300 of us. The same line would reach the Moon about {R['moon_trips']} times.")
ai = "Narration: synthetic voice (AI). Animation: code-rendered, no stock footage. Every number is checked against the sources."
series = "Series: Season 2, episode 2 of 6."
tag = "Possibility Lab: Impossible questions, honest assumptions, real calculations."
yt_tags = "#Shorts #whatif #science"
yt_cap = f"{hook}\n\n{body}\n\n{series}\n\n{sources}\n\n{ai}\n\n{tag}\n\n{yt_tags}"
tt_tags = "#whatif #science #learnontiktok #thoughtexperiment #stem"
tt_cap = f"{hook} The line is {R['km_m']:.0f} million km: about {R['laps']} laps round the Earth. {tt_tags}"
tt_pin = f"Sources: {'; '.join(hosts)}. Synthetic (AI) voice; code-rendered animation."
ig_tags = "#whatif #science #thoughtexperiment #stem #sciencefacts #curiosity #learnsomethingnew #physics"
ig_cap = (f"{hook}\n\n{body}\n\nSeason 2, episode 2 of 6.\n\nSources in the first comment. Synthetic (AI) narration; code-rendered animation.\n\n{ig_tags}")
warn = ["Every claim is OPEN: a person must open each source link and confirm it before this posts (see review/claims-table.md). "
        "The UN population page and the average-span assumption (1.5 m, kids included) are not yet sourced from a page a person has opened."]
pj = {"generated": "2026-11-09",
      "youtube": {"title": f"{TITLE} | Possibility Lab Season 2 · Episode 2", "caption": yt_cap, "hashtags": yt_tags,
                  "tags": ["Possibility Lab", "whatif", "science", "everyone", "holds", "hands", "explainer", "education"],
                  "pinnedComment": sources, "replies": [], "warnings": warn},
      "tiktok": {"title": f"{TITLE} (Possibility Lab Season 2 · Episode 2)", "caption": tt_cap, "hashtags": tt_tags, "tags": [], "pinnedComment": tt_pin, "replies": [], "warnings": warn},
      "instagram": {"title": f"{TITLE} (Possibility Lab Season 2 · Episode 2)", "caption": ig_cap, "hashtags": ig_tags, "tags": [], "pinnedComment": sources, "replies": [], "warnings": warn}}
(OUT / "posting.json").write_text(json.dumps(pj, indent=1, ensure_ascii=False))
md = f"""# Posting sheet: Possibility Lab · Season 2 · Episode 2, "{TITLE}"

Generated from the script and claims. Turn on each platform's AI / synthetic content label. Captions are burned in: leave auto-captions off. Post as a vertical video (Shorts / TikTok / Reel).

**Before posting:** every claim is still OPEN. A person has to open each source link and tick it in `review/claims-table.md` first. This is Season 2, episode 2 of 6 (folder ep08).

**Cover / thumbnail**: `{BASE}-cover.jpg` (9:16 cover, 1080x1920: TikTok, Reels, Shorts; `{BASE}-cover-480.jpg` is the small copy) · `{BASE}-thumb.jpg` (16:9 YouTube thumbnail)

## YouTube Shorts
**Title**

{pj['youtube']['title']}

**Description**

```
{yt_cap}
```

**Tags**: {', '.join(pj['youtube']['tags'])}

**Captions**: upload the .srt (English).

**Pinned comment** (10,000-character limit)

```
{sources}
```


## TikTok
**Caption**

```
{tt_cap}
```

**Pinned comment** (150-character limit)

```
{tt_pin}
```


## Instagram Reel (shared account)
**Caption**

```
{ig_cap}
```

**Pinned comment**

```
{sources}
```
"""
(OUT / "POSTING.md").write_text(md)
print("wrote", OUT / "posting.json", OUT / "POSTING.md")
