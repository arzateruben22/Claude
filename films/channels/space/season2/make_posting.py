"""Posting pack for a Season 2 episode: out/posting.json + out/POSTING.md in Season 1's format.
usage: python3 -I make_posting.py <epdir> <n> "<title>" "<hook caption>" "<takeaway>" "<tags csv>" [poster_seconds]
Sources come from claims.json (any claim with a real page). Claims not yet opened by a person are flagged."""
import json, os, subprocess, sys
ep, n, title, hook, take, tags = sys.argv[1:7]
poster = float(sys.argv[7]) if len(sys.argv) > 7 else 1.0
n = int(n); out = os.path.join(ep, "out"); base = f"one-more-orbit-s2e{n:02d}"
claims = json.load(open(os.path.join(ep, "claims.json")))
src, seen = [], set()
for c in claims:
    u = c.get("source_url") or ""
    if "todo.invalid" in u or not u.startswith("http"): continue
    if c.get("status") not in ("ok", "SOURCE-READ"): continue
    host = u.split("/")[2].replace("www.", "")
    key = (u, c["claim"])
    if key in seen: continue
    seen.add(key); src.append(f"{len(src) + 1}. {c['claim']} — {host}: {u}")
S = "Sources\n" + "\n".join(src)
series = f"One More Orbit · Season 2 · Episode {n}"
hashtags_y, hashtags = "#Shorts #space #astronomy", "#space #astronomy #cosmos #science #universe #sciencefacts #stem #spacefacts"
ai = "Narration: synthetic voice (AI). Animation: code-rendered, no stock footage."
yt_cap = f"{hook}\n\n{take}\n\nSeries: {series}.\n\n{S}\n\n{ai} Sources are listed per claim; each page should be opened by a person before posting.\n\nOne More Orbit: One minute, one 'whoa' about the universe, every number sourced.\n\n{hashtags_y}"
hosts = "; ".join(dict.fromkeys(l.split(" — ")[1].split(": ")[0] for l in src))
P = {"generated": "2026-11-09",
     "youtube": {"title": f"{title}", "caption": yt_cap, "hashtags": hashtags_y, "tags": ["One More Orbit", "space", "astronomy", "science", "explainer", "education"] + [t.strip() for t in tags.split(",")], "pinnedComment": S, "replies": [], "warnings": ["Turn on the AI / synthetic content label."]},
     "tiktok": {"title": f"{title} (One More Orbit S2E{n:02d})", "caption": f"{hook} #space #astronomy #learnontiktok #science #cosmos", "hashtags": "#space #astronomy #learnontiktok #science #cosmos", "tags": [], "pinnedComment": f"Sources: {hosts}. Synthetic (AI) voice; code-rendered animation.", "replies": [], "warnings": ["Turn on the AI-generated content label."]},
     "instagram": {"title": f"{title} (One More Orbit S2E{n:02d})", "caption": f"{hook}\n\n{take}\n\n{series}.\n\nSources in the first comment. Synthetic (AI) narration; code-rendered animation.\n\n{hashtags}", "hashtags": hashtags, "tags": [], "pinnedComment": S, "replies": [], "warnings": ["Turn on the AI label."]}}
json.dump(P, open(os.path.join(out, "posting.json"), "w"), indent=1, ensure_ascii=False)
md = f"""# Posting sheet: {series}, "{title}"

Generated from the script and claims. Turn on each platform's AI / synthetic content label. Captions are burned in: leave auto-captions off. Post as a vertical video (Shorts / TikTok / Reel). **Before posting, a person opens every source link** (the builder read the pages; no claim is person-verified yet).

**Cover / thumbnail**: `{base}-cover.jpg` (9:16 cover) · `{base}-thumb.jpg` (16:9 YouTube thumbnail)

## YouTube Shorts
**Title**

{P['youtube']['title']}

**Description**

```
{yt_cap}
```

**Tags**: {', '.join(P['youtube']['tags'])}

**Pinned comment**

```
{S}
```

## TikTok
**Caption**

```
{P['tiktok']['caption']}
```

**Pinned comment** (150-character limit)

```
{P['tiktok']['pinnedComment']}
```

## Instagram Reel (shared account)
**Caption**

```
{P['instagram']['caption']}
```

**First comment** (2,200-character limit)

```
{S}
```
"""
open(os.path.join(out, "POSTING.md"), "w").write(md)
m = os.path.join(out, f"{base}-9x16.mp4")
if os.path.exists(m):
    cv, th = os.path.join(out, f"{base}-cover.jpg"), os.path.join(out, f"{base}-thumb.jpg")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(poster), "-i", m, "-frames:v", "1", "-q:v", "2", cv], check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", cv, "-vf", "scale=480:-2", "-q:v", "3", os.path.join(out, f"{base}-cover-480.jpg")], check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", cv, "-vf", "crop=1080:608:0:420,scale=1280:720", "-q:v", "3", th], check=True)
print("posting pack:", len(src), "sources")
