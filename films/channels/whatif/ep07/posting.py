"""Builds out/posting.json and out/POSTING.md for S2E01 (folder ep07) in Season 1's format, from claims.json and calc.py.

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
BASE = "possibility-lab-s2e01"
TITLE = "Walking to the Moon"
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

hook = "How long to walk to the Moon? Starting at your own front door."
body = (f"The Moon is about {R['earths']} Earths away. At an easy 5 km/h, never stopping, you would arrive in about {R['years_nonstop']} years. "
        f"Walk 8 hours a day and it is about {R['years_8h']} years. At 10,000 steps a day, the popular goal, it is about {R['years_steps']} years. "
        "Apollo 11's crew made the same trip in about three days: the distance never changed, only the speed.")
ai = "Narration: synthetic voice (AI). Animation: code-rendered, no stock footage. Every number is checked against the sources."
series = "Series: Season 2, episode 1 of 6."
tag = "Possibility Lab: Impossible questions, honest assumptions, real calculations."
yt_tags = "#Shorts #whatif #science"
yt_cap = f"{hook}\n\n{body}\n\n{series}\n\n{sources}\n\n{ai}\n\n{tag}\n\n{yt_tags}"
tt_tags = "#whatif #science #learnontiktok #thoughtexperiment #stem"
tt_cap = f"{hook} About {R['years_nonstop']} years nonstop, {R['years_8h']} at 8 hours a day, {R['years_steps']} at 10,000 steps. {tt_tags}"
tt_pin = f"Sources: {'; '.join(hosts)}. Synthetic (AI) voice; code-rendered animation."
ig_tags = "#whatif #science #thoughtexperiment #stem #sciencefacts #curiosity #learnsomethingnew #physics"
ig_cap = (f"{hook}\n\n{body}\n\nSeason 2, episode 1 of 6.\n\nSources in the first comment. Synthetic (AI) narration; code-rendered animation.\n\n{ig_tags}")
warn = ["Every claim is OPEN: a person must open each source link and confirm it before this posts (see review/claims-table.md). "
        "The 5 km/h pace and the 10,000-step goal come from search excerpts, and the 8 h a day and 0.75 m a step are labelled assumptions."]
pj = {"generated": "2026-11-09",
      "youtube": {"title": f"{TITLE} | Possibility Lab Season 2 · Episode 1", "caption": yt_cap, "hashtags": yt_tags,
                  "tags": ["Possibility Lab", "whatif", "science", "walking", "moon", "apollo", "explainer", "education"],
                  "pinnedComment": sources, "replies": [], "warnings": warn},
      "tiktok": {"title": f"{TITLE} (Possibility Lab Season 2 · Episode 1)", "caption": tt_cap, "hashtags": tt_tags, "tags": [], "pinnedComment": tt_pin, "replies": [], "warnings": warn},
      "instagram": {"title": f"{TITLE} (Possibility Lab Season 2 · Episode 1)", "caption": ig_cap, "hashtags": ig_tags, "tags": [], "pinnedComment": sources, "replies": [], "warnings": warn}}
(OUT / "posting.json").write_text(json.dumps(pj, indent=1, ensure_ascii=False))
md = f"""# Posting sheet: Possibility Lab · Season 2 · Episode 1, "{TITLE}"

Generated from the script and claims. Turn on each platform's AI / synthetic content label. Captions are burned in: leave auto-captions off. Post as a vertical video (Shorts / TikTok / Reel).

**Before posting:** every claim is still OPEN. A person has to open each source link and tick it in `review/claims-table.md` first. This is Season 2, episode 1 of 6 (folder ep07).

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
