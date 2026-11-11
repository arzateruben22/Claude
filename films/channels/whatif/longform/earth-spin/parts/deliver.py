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
PLAIN = {   # claims whose stored text is raw data or notation: the sentence a viewer reads
 "c2": "Speed of the ground at the equator: one trip around the equator (circumference) divided by the length of the day gives about 1,674 km/h (465 m/s), roughly 1/17 of the speed needed to orbit.",
 "c3": "The spin makes you about 0.35% lighter today: the outward push of the spin is 0.034 m/s² against gravity's 9.8 m/s².",
 "c8": "The day length at which the equator's speed matches orbital speed: about 84.5 minutes (1.41 h), where the ground moves at 7.9 km/s; today's 0.465 km/s is 1/17 of that.",
 "c15": "Storm steering (the Coriolis effect) grows in direct proportion to the spin rate: 23.93 h ÷ 6 h = 4.0 times today, and 23.93 h ÷ 1.4 h = about 17 times.",
 "c16": "Days in a year at a 1 h 24 min day: 365.25 × 23.93 h ÷ 1.41 h = about 6,200.",
 "c17": "At 45° north your speed is 71% of the equator's (cos 45°) and the outward push on you is 50% (cos² 45°).",
 "c20": "Days in a year at a 6 h day: 365.25 days × 24 h ÷ 6 h = 1,461.",
 "c22": "Days in a year: 365.25 × 24 h ÷ the day length gives 730 at 12 h, 1,461 at 6 h, 2,922 at 3 h, 4,383 at 2 h and 5,844 at 1.5 h.",
 "c23": "The wind relative to the ground at a 12 h day is 463 m/s, which is 1,667 km/h, about 4.1 times the strongest gust ever recorded (408 km/h).",
 "c28": "Storm steering compared with today: 23.934 h ÷ 12 h = 2×, ÷ 3 h = 8×, ÷ 2 h = 12×, ÷ 1.5 h = 16×.",
 "c4": "Speed of the ground at the equator: 1,674 km/h today, 3,340 km/h at a 12 h day, 6,679 km/h at 6 h, 13,358 km/h at 3 h, 20,038 km/h at 2 h, 26,717 km/h at 1.5 h; the Sun is up for half of each day.",
 "c5": "Your weight as a share of what it would be on a non-spinning Earth: 99.7% today, 98.6% at a 12 h day, 94.5% at 6 h, 78.0% at 3 h, 50.4% at 2 h, 11.9% at 1.5 h; a 70 kg person weighs 69 kg at 12 h and 55 kg at 3 h.",
}
def srcs():
    out = []
    for i, cid in enumerate(used, 1):
        c = claims_all[cid]; t = re.sub(r"\s+", " ", c["claim"]).strip()
        if c.get("source_url"): tail = f" — {c.get('source_title') or 'source'}: {c['source_url']}"
        elif c["kind"] == "derivation": tail = " (our calculation; the arithmetic is shown in the film)"
        elif c["kind"] == "assumption": tail = " (our assumption)"
        else: tail = " (source to be added)"
        out.append(f"{i}. {t}{tail}")
    return "Sources\n" + "\n".join(out)
hook = pk["hook"]
AI_ART = {1, 2, 3, 4, 5, 6, 7, 8}       # covers made from the owner's AI illustrations (art/owner)
ART_NOTE = " Thumbnail illustration made with AI." if N in AI_ART else ""
yt_cap = f"{hook}\n\nPart {N} of 8 of \"What If Earth Spun Faster and Couldn't Stop?\" — the full video is on this channel.\n\n{srcs()}\n\nNarration: synthetic voice (AI).{ART_NOTE} Animation: code-rendered, no stock footage. Every number is checked against the sources.\n\nPossibility Lab: Impossible questions, honest assumptions, real calculations.\n\n#Shorts #whatif #science"
tt_cap = f"{hook} Part {N} of 8. Full video on YouTube (link in bio). #whatif #science #physics"
posting = {"youtube": {"title": title, "caption": yt_cap, "hashtags": "#Shorts #whatif #science", "pinnedComment": f"Full video: What If Earth Spun Faster and Couldn't Stop? (link). Sources: see the description.\n\n{srcs()}"},
           "tiktok": {"caption": tt_cap, "pinnedComment": "Full video on YouTube: link in bio."}, "instagram": {"caption": tt_cap + " (link in bio)"},
           "disclosure": "Narration is a synthetic voice (AI): turn on each platform's AI / synthetic content label." + (" Cover illustration made with AI." if N in AI_ART else "")}
(EP / "out" / "posting.json").write_text(json.dumps(posting, indent=1, ensure_ascii=False))
(EP / "out" / "POSTING.md").write_text(f"# Posting sheet: Possibility Lab · Season 3 · Part {N} of 8, \"{title}\"\n\nPost the long video first (compilations/s3), then one part a day. Every claim is still OPEN. Turn on each platform's AI / synthetic content label. Captions are burned in: leave auto-captions off.\n\n**Files**: `{base}-9x16.mp4` (1080x1920, TikTok/Instagram: says \"follow\") · `{base}-9x16-youtube.mp4` (1440p, Shorts: says \"subscribe\") · `{base}-9x16.srt`\n\n## YouTube Shorts\n**Title**\n\n{title}\n\n**Description**\n\n```\n{yt_cap}\n```\n\n## TikTok\n\n```\n{tt_cap}\n```\n\n## Instagram Reels\n\n```\n{tt_cap} (link in bio)\n```\n\nTODO before posting: the link to the full video, the channel handle, and the platform AI labels.\n")
print(f"ep{12 + N}: delivered ({len(used)} claims)")
