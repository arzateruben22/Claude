"""package_part.py <n>: the part's own episode folder (ep13..ep20 = parts 1..8): script.md (its lines), claims.json (the claims it uses), film.json (title, series, timeline),
out/ (9:16 final, cover, packaging.json, posting pack) as Prism imports an episode. The picture/mix come from long01/out/part<n>.mp4."""
import json, os, re, shutil, sys
n = int(sys.argv[1]); ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".."))
L1 = f"{ROOT}/films/channels/space/long01"; O = L1 + "/out"; ep = f"{ROOT}/films/channels/space/ep{12 + n}"; out = ep + "/out"; os.makedirs(out, exist_ok=True)
T = json.load(open(L1 + "/part_titles.json")); title = T["parts"][str(n)]; tl = json.load(open(f"{O}/part{n}.json")); lines = {x["id"]: x for x in json.load(open(L1 + "/voice/lines.json"))["lines"]}
name = f"one-more-orbit-s3-part{n}"
shutil.copy(f"{O}/part{n}.mp4", f"{out}/{name}-9x16.mp4")
for a, b in ((f"part{n}-cover.jpg", f"{name}-cover.jpg"), (f"part{n}-cover-480.jpg", f"{name}-cover-480.jpg"), (f"part{n}-posting.json", "posting.json"), (f"part{n}-POSTING.md", "POSTING.md")):
    if os.path.exists(f"{O}/{a}"): shutil.copy(f"{O}/{a}", f"{out}/{b}")
sc = open(L1 + "/script.md").read(); ch = f"ch{n}"; sec = re.search(rf"## {ch} .*?(?=\n## |\Z)", sc, re.S).group(0)
g = lambda k: (re.search(rf"^{k}: (.*)$", sec, re.M) or [None, ""])[1]
body = (f"# One More Orbit · Season 3 · Part {n} of 8: \"{title}\"\n\nPart {n} of the Moon film \"{T['title']}\" (the long film is the whole story; the ending stays there). 9:16, {tl['dur']:.0f} s, synthetic AI voice (stand-in until the owner's recording).\n"
        f"Badge \"Thought experiment\" throughout. Lines come from long01/script.md; timing from long01/voice/lines.json.\n\n"
        f"## hook {{pre: 0.15 · the part's own 2 s opening}}\nvo: {g('hook')}\n\n## body {{the chapter · distance counter synced to the voice · one like/follow line at {tl['cta_frac']*100:.0f}% of the runtime (rotation line {(n - 1) % 4 + 1})}}\nvo: {g('vo')}\n\n"
        f"## tease {{the cliffhanger, then the closer}}\nvo: {g('loop')} Part {['one','two','three','four','five','six','seven','eight'][n-1]} of eight. Full video on YouTube. {{-}}\n")
open(ep + "/script.md", "w").write(body)
tags = set(re.findall(r"\{(c\d+)\}", sec)); cl = [c for c in json.load(open(L1 + "/claims.json")) if c["id"] in tags]; json.dump(cl, open(ep + "/claims.json", "w"), indent=1, ensure_ascii=False)
film = {"id": name, "title": {"title": title, "series": f"One More Orbit · Season 3 · Part {n} of 8"}, "disclosures": {"aiVoice": True, "aiVisuals": True}, "dur": tl["dur"], "fps": 30, "captions": tl["captions"], "km": tl["km"], "tracks": tl["tracks"], "clips": tl["clips"], "source": "season3/engine.js via long01/out/part%d.json" % n}
json.dump(film, open(ep + "/film.json", "w"), indent=1, ensure_ascii=False)
if os.path.exists(f"{O}/packaging.json"): os.replace(f"{O}/packaging.json", f"{out}/packaging.json")
print("packaged", ep, title)
import subprocess
if not os.environ.get("SKIP_YT"): subprocess.run(["python3", "-I", f"{ROOT}/kits/cinema/film/youtube1440.py", ep, "--force"], check=True, capture_output=True)
print("youtube 1440p:", [f for f in os.listdir(out) if f.endswith("youtube.mp4")])
