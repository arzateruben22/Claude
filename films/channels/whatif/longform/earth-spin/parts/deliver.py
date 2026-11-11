"""Deliver one finished part into its episode folder (ep13..ep20) the way Season 2's episodes are laid out, so Prism imports it.

  python3 -I films/channels/whatif/longform/earth-spin/parts/deliver.py N

Needs parts/partN/out/<final>.mp4 (9:16, 1080x1920), parts/partN/out/<final>-youtube.mp4 (optional), the cover jpg, packaging.json.
Writes whatif/ep{12+N}/: script.md, claims.json, film.json (title = the part's title, disclosures.aiVoice), out/ (9:16 final, 1440p file, srt, cover, packaging.json, POSTING.md, posting.json)."""
import json, re, shutil, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
ES = HERE.parent
WH = ES.parents[1]
N = int(sys.argv[1])
EP = WH / f"ep{12 + N}"
D = HERE / f"part{N}"
film = json.loads((D / "film.json").read_text())
items = json.loads((D / "items.json").read_text())
pk = json.loads((HERE / f"part{N}" / "packaging.json").read_text())
claims_all = {c["id"]: c for c in json.loads((ES / "claims.json").read_text())}
# the part's sentences with their claim tags, from the long script
script = (ES / "script.md").read_text().split("\n")
vo = [m for m in (re.match(r"^vo: (.*)$", l) for l in script) if m]
def sentences(line_no):
    parts = re.findall(r"(.+?[.?!])((?:\s*\{[^}]*\})*)\s*", vo[line_no - 1].group(1))
    return [(re.sub(r"\s+", " ", re.sub(r"\{[^}]*\}", "", s)).strip(), re.findall(r"\{([^}]*)\}", t)) for s, t in parts]
used, hook_l, body_l, tease_l = [], [], [], []
for it in items:
    if it["kind"] == "sent":
        ln, si = it["key"][1:].split("."); ln, si = int(ln), int(si)
        s, tags = sentences(ln)[si - 1]
        body_l.append(f"{s} " + "".join("{%s}" % t for t in tags) if tags else f"{s} {{-}}")
        for t in tags:
            for cid in re.split(r"[,\s]+", t):
                if cid in claims_all and cid not in used: used.append(cid)
    elif it["kind"] == "open": hook_l.append(f"{it['text']} {{-}}")
    elif it["kind"] == "closer": tease_l.append(f"{it['text']} {{-}}")
    else: body_l.append(f"{it['text']} {{-}}")
title = film["title"]["title"]
(EP / "out").mkdir(parents=True, exist_ok=True)
(EP / "script.md").write_text(f"# Possibility Lab Season 3 · Part {N} of 8: \"{title}\" (cut from the long film \"What If Earth Spun Faster and Couldn't Stop?\")\n\nOne part of the long film: its own opening, the chapter's narration, one like/follow line, the cliffhanger, then the closer.\n\n"
    f"## hook {{shot: the figure on the equator · energy: 0.6}}\nvo: {' '.join(hook_l)}\n\n## body {{shot: the day-length readout and the chapter's scene · energy: 0.6}}\nvo: {' '.join(body_l)}\n\n## tease {{end card held · energy: 0.4}}\nvo: {' '.join(tease_l)}\n")
(EP / "claims.json").write_text(json.dumps([claims_all[c] for c in used], indent=1, ensure_ascii=False))
film["title"] = {**film["title"], "title": title}
film["disclosures"] = {"aiVoice": True}
(EP / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False))
(EP / "out" / "packaging.json").write_text(json.dumps(pk, indent=1, ensure_ascii=False))
base = f"possibility-lab-s3p{N}"
for src, dst in [(D / "out" / f"{base}-9x16.mp4", f"{base}-9x16.mp4"), (D / "out" / f"{base}-9x16-youtube.mp4", f"{base}-9x16-youtube.mp4"), (D / "out" / f"{base}-9x16.srt", f"{base}-9x16.srt"),
                 (D / "out" / f"{base}-cover.jpg", f"{base}-cover.jpg"), (D / "out" / f"{base}-cover-480.jpg", f"{base}-cover-480.jpg"), (D / "out" / f"{base}-9x16.jpg", f"{base}-9x16.jpg")]:
    if src.exists(): shutil.copy2(src, EP / "out" / dst)
# posting sheet
def srcs():
    out = []
    for i, cid in enumerate(used, 1):
        c = claims_all[cid]; t = re.sub(r"\s+", " ", c["claim"]).strip()
        out.append(f"{i}. {t} — " + (f"{c['source_url']}" if c.get("source_url") else ("Derivation (no outside page; arithmetic shown in the film)" if c["kind"] == "derivation" else "source to be found")))
    return "Sources\n" + "\n".join(out)
hook = pk["hook"]
AI_ART = {2, 4, 8}       # covers made from the owner's AI illustrations (art/owner)
ART_NOTE = " Thumbnail illustration made with AI." if N in AI_ART else ""
yt_cap = f"{hook}\n\nPart {N} of 8 of \"What If Earth Spun Faster and Couldn't Stop?\" — the full video is on this channel.\n\n{srcs()}\n\nNarration: synthetic voice (AI).{ART_NOTE} Animation: code-rendered, no stock footage. Every number is checked against the sources.\n\nPossibility Lab: Impossible questions, honest assumptions, real calculations.\n\n#Shorts #whatif #science"
tt_cap = f"{hook} Part {N} of 8. Full video on YouTube (link in bio). #whatif #science #physics"
posting = {"youtube": {"title": title, "caption": yt_cap, "hashtags": "#Shorts #whatif #science", "pinnedComment": f"Full video: What If Earth Spun Faster and Couldn't Stop? (link). Sources: see the description.\n\n{srcs()}"},
           "tiktok": {"caption": tt_cap, "pinnedComment": "Full video on YouTube: link in bio."}, "instagram": {"caption": tt_cap + " (link in bio)"},
           "disclosure": "Narration is a synthetic voice (AI): turn on each platform's AI / synthetic content label." + (" Cover illustration made with AI." if N in AI_ART else "")}
(EP / "out" / "posting.json").write_text(json.dumps(posting, indent=1, ensure_ascii=False))
(EP / "out" / "POSTING.md").write_text(f"# Posting sheet: Possibility Lab · Season 3 · Part {N} of 8, \"{title}\"\n\nPost the long video first (compilations/s3), then one part a day. Every claim is still OPEN. Turn on each platform's AI / synthetic content label. Captions are burned in: leave auto-captions off.\n\n**Files**: `{base}-9x16.mp4` (1080x1920, TikTok/Instagram: says \"follow\") · `{base}-9x16-youtube.mp4` (1440p, Shorts: says \"subscribe\") · `{base}-9x16.srt`\n\n## YouTube Shorts\n**Title**\n\n{title}\n\n**Description**\n\n```\n{yt_cap}\n```\n\n## TikTok\n\n```\n{tt_cap}\n```\n\n## Instagram Reels\n\n```\n{tt_cap} (link in bio)\n```\n\nTODO before posting: the link to the full video, the channel handle, and the platform AI labels.\n")
print(f"ep{12 + N}: delivered ({len(used)} claims)")
