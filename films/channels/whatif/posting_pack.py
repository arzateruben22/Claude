"""Builds <ep>/out/posting.json and <ep>/out/POSTING.md for a Season 2 episode in Season 1's format, from its claims.json.

    python3 -I films/channels/whatif/posting_pack.py ep10

Nothing here is invented: the numbers are the ones calc.py and the film state, the sources come from claims.json. Claims without a
source_url (derivations and assumptions) are listed as such, never with a link.
"""
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

HERE = Path(__file__).resolve().parent
EP = {
    "ep09": dict(n=3, base="possibility-lab-s2e03", title="A rope round the Earth", slug=["rope", "Earth", "circle", "geometry"],
                 hook="How much more rope? Round the whole Earth, lifted one meter off the ground.",
                 body="A rope hugs the Earth, about 40,000 km long. Lift it one meter above the ground, everywhere. A circle's length is 2 × π × its radius, so lifting it a meter adds 2 × π × 1 m: about 6.3 meters of rope, about four of you lying head to toe. The planet's size cancels out: only the lift matters, and ten meters higher needs about 63 meters.",
                 short="The extra rope is only about 6.3 m, whatever the planet.", warn_extra="The 1.7 m person height is an assumption, not a sourced figure."),
    "ep10": dict(n=4, base="possibility-lab-s2e04", title="Every shuffle is new", slug=["cards", "shuffle", "factorial", "probability"],
                 hook="Has this ever happened? Shuffle a deck, and look at the order.",
                 body="Fifty-two cards can be ordered in 52! ways: about 8.07 × 10^67, a number with 68 digits. Give everyone alive a deck, a shuffle a second, for 13.8 billion years, and that is about 3.6 × 10^27 shuffles: less than one part in 10^36 of all the orders. Shuffle well (about seven riffle shuffles) and your order has almost certainly never existed before.",
                 short="52! is a 68-digit number: your shuffle is almost certainly new.", warn_extra="The UN population page (8.2 billion people) and the Bayer and Diaconis paper (seven shuffles) have not been opened by a person."),
    "ep11": dict(n=5, base="possibility-lab-s2e05", title="All the water in one ball", slug=["water", "Earth", "Moon", "volume"],
                 hook="How big is Earth's water? Gather every drop into one ball, and measure it.",
                 body="All of Earth's water, liquid, ice and vapor together, is about 1.386 billion cubic kilometers. Squeezed into one ball, it is about 1,400 km wide: 40% of the Moon's width and 11% of the Earth's. Only the fresh water makes a ball about 400 km wide. Its share of the Earth's volume is only about an eighth of one percent.",
                 short="All of Earth's water fits in a ball about 1,400 km wide.", warn_extra="The USGS page (1.386 billion km³, the 2.5 % fresh share) has not been opened by a person."),
    "ep12": dict(n=6, base="possibility-lab-s2e06", title="Catch all the lightning", slug=["lightning", "energy", "electricity", "estimate"],
                 hook="Could lightning power the world? Catch every bolt, for a whole year.",
                 body="About 44 flashes a second, over a billion a year, each carrying roughly a billion joules (a rough guess with a wide range). Together that is about 390 billion kilowatt-hours: about five days of the world's electricity, between half a day and about seven weeks if a flash holds ten times less or more.",
                 short="All the lightning on Earth would run the world for about 5 days.", warn_extra="The flash rate, the energy of a flash and the world electricity figure have not been opened by a person."),
}


def host(u):
    h = urlparse(u).netloc.replace("www.", "")
    return {"science.nasa.gov": "NASA", "nssdc.gsfc.nasa.gov": "NASA", "doi.org": "DOI"}.get(h, h)


def build(ep):
    cfg = EP[ep]
    d = HERE / ep
    out = d / "out"
    out.mkdir(exist_ok=True)
    claims = json.loads((d / "claims.json").read_text())
    base, title, n = cfg["base"], cfg["title"], cfg["n"]
    lines, hosts = [], []
    for i, c in enumerate(claims, 1):
        t = re.sub(r"\s+", " ", c["claim"].replace("ASSUMPTION: ", "Assumption, not a measurement: ")).strip()
        if c.get("source_url"):
            lines.append(f"{i}. {t} — {host(c['source_url'])}: {c['source_url']}")
            if host(c["source_url"]) not in hosts:
                hosts.append(host(c["source_url"]))
        else:
            lines.append(f"{i}. {t} — {'Assumption' if c['kind'] == 'assumption' else 'Derivation'} (no outside page; arithmetic shown in the film)")
    sources = "Sources\n" + "\n".join(lines)
    ai = "Narration: synthetic voice (AI). Animation: code-rendered, no stock footage. Every number is checked against the sources."
    series = f"Series: Season 2, episode {n} of 6."
    tag = "Possibility Lab: Impossible questions, honest assumptions, real calculations."
    yt_tags = "#Shorts #whatif #science"
    yt_cap = f"{cfg['hook']}\n\n{cfg['body']}\n\n{series}\n\n{sources}\n\n{ai}\n\n{tag}\n\n{yt_tags}"
    tt_tags = "#whatif #science #learnontiktok #thoughtexperiment #stem"
    tt_cap = f"{cfg['hook']} {cfg['short']} {tt_tags}"
    tt_pin = f"Sources: {'; '.join(hosts) or 'arithmetic shown in the film'}. Synthetic (AI) voice; code-rendered animation."
    ig_tags = "#whatif #science #thoughtexperiment #stem #sciencefacts #curiosity #learnsomethingnew #physics"
    ig_cap = f"{cfg['hook']}\n\n{cfg['body']}\n\nSeason 2, episode {n} of 6.\n\nSources in the first comment. Synthetic (AI) narration; code-rendered animation.\n\n{ig_tags}"
    warn = ["Every claim is OPEN: a person must open each source link and confirm it before this posts (see review/claims-table.md). " + cfg["warn_extra"]]
    pj = {"generated": "2026-11-09",
          "youtube": {"title": f"{title} | Possibility Lab Season 2 · Episode {n}", "caption": yt_cap, "hashtags": yt_tags, "tags": ["Possibility Lab", "whatif", "science", "explainer", "education"] + cfg["slug"],
                      "pinnedComment": sources, "replies": [], "warnings": warn},
          "tiktok": {"title": f"{title} (Possibility Lab Season 2 · Episode {n})", "caption": tt_cap, "hashtags": tt_tags, "tags": [], "pinnedComment": tt_pin, "replies": [], "warnings": warn},
          "instagram": {"title": f"{title} (Possibility Lab Season 2 · Episode {n})", "caption": ig_cap, "hashtags": ig_tags, "tags": [], "pinnedComment": sources, "replies": [], "warnings": warn}}
    (out / "posting.json").write_text(json.dumps(pj, indent=1, ensure_ascii=False))
    md = f"""# Posting sheet: Possibility Lab · Season 2 · Episode {n}, "{title}"

Generated from the script and claims. Turn on each platform's AI / synthetic content label. Captions are burned in: leave auto-captions off. Post as a vertical video (Shorts / TikTok / Reel).

**Before posting:** every claim is still OPEN. A person has to open each source link and tick it in `review/claims-table.md` first. This is Season 2, episode {n} of 6 (folder {ep}).

**Files**: `{base}-9x16.mp4` (1080x1920, 30 fps) · `{base}-9x16-youtube.mp4` (1440p) · `{base}-9x16.srt` (English captions)

**Cover / thumbnail**: `{base}-cover.jpg` (9:16 cover, 1080x1920: TikTok, Reels, Shorts; `{base}-cover-480.jpg` is the small copy) · `{base}-thumb.jpg` (16:9 YouTube thumbnail)

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
    (out / "POSTING.md").write_text(md)
    print("wrote", out / "posting.json", out / "POSTING.md")


if __name__ == "__main__":
    build(sys.argv[1])
