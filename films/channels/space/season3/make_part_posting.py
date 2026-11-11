"""make_part_posting.py <n> "<title>" "<hook caption>" "<takeaway>" "<tags csv>": the posting pack for part n of the Moon film (posting.json + POSTING.md).
The part's title is the chapter title of the long film (Prism links by exact match); YouTube title = the winner title alone."""
import json, os, sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..', 'kits', 'cinema', 'film'))); from numerals import to_display
n, title, hook, take, tags = sys.argv[1:6]; n = int(n); hook, take = to_display(hook), to_display(take)
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".."))
O = f"{ROOT}/films/channels/space/long01/out"; claims = json.load(open(f"{ROOT}/films/channels/space/long01/claims.json"))
tl = json.load(open(f"{O}/part{n}.json")); used = sorted({c for cap in [x["text"] for x in tl["captions"]] for c in []})
lab = "Thought experiment: the Moon is not coming closer. Narration is a synthetic voice (AI); the pictures are AI-assisted paintings and code-rendered."
full = "How Close Can the Moon Get Before It Breaks?"
P = {"generated": "2026-11-11", "part": n, "of": 8,
     "youtube": {"title": title, "caption": f"{hook}\n\n{take}\n\nPart {n} of 8. Full video on YouTube: {full}\n\n{lab}", "hashtags": "#Shorts #space #moon #astronomy", "tags": ["One More Orbit", "space", "moon", "tides", "thought experiment"] + [t.strip() for t in tags.split(",")]},
     "tiktok": {"title": title, "caption": f"{hook} Part {n} of 8. Full video on YouTube. #space #moon #learnontiktok #science", "hashtags": "#space #moon #learnontiktok #science"},
     "instagram": {"title": title, "caption": f"{hook}\n\n{take}\n\nPart {n} of 8. Full video on YouTube (link in bio).\n\n{lab}", "hashtags": "#space #moon #astronomy #science"},
     "pinnedComment": f"Part {n} of 8. The full film, \"{full}\", is on YouTube. Every number's source is in its description. {lab}",
     "length_s": round(tl["dur"], 1), "cta_at": tl.get("cta_frac")}
json.dump(P, open(f"{O}/part{n}-posting.json", "w"), indent=1, ensure_ascii=False)
open(f"{O}/part{n}-POSTING.md", "w").write(f"# Posting sheet: One More Orbit S3, Part {n} of 8, \"{title}\"\n\n## YouTube Shorts\nTitle: {title}\n\n{P['youtube']['caption']}\n\n{P['youtube']['hashtags']}\n\n## TikTok\n{P['tiktok']['caption']}\n\n## Instagram\n{P['instagram']['caption']}\n\n## Pinned comment\n{P['pinnedComment']}\n\nPost the long film first, then one part a day.\n")
print("posting", n)
