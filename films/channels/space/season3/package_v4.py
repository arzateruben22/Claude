"""package_v4.py <n>: v4 Part n (1|2) -> ep<12+n>/ : the 1080 'follow' final, the 1440p 'subscribe' YouTube file, script.md, claims.json, film.json (realVoice true, aiVoice false, aiVisuals true),
sfx.json (the stem is already mixed into both finals), covers and posting pack. Reads long01/out/v4-part<n>.mp4, v4-part<n>-yt.mp4 and the timelines.
Part 1 keeps its cover/packaging (same title); Part 2 is the old part 3 ('half the distance') so it takes that part's cover/packaging with the numbers rewritten (TODO: the owner/coordinator may want a fresh pack)."""
import json, os, re, shutil, subprocess, sys, tempfile
HERE_ = os.path.dirname(os.path.abspath(__file__)); n = int(sys.argv[1]); ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".."))
S = f"{ROOT}/films/channels/space"; L1 = f"{S}/long01"; O = L1 + "/out"; ep = f"{S}/ep{12 + n}"; out = ep + "/out"; os.makedirs(out, exist_ok=True)
name = f"one-more-orbit-s3-part{n}"; T = json.load(open(L1 + "/part_titles.json")); src_n = {1: 1, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: None}[n]      # v4 part n = the old (v3) part src_n; part 8 is new (the break-up)
title = T["parts"][str(src_n)] if src_n else "Then the Moon Comes Apart"; src_ep = f"{S}/ep{12 + src_n}" if src_n else None
tl = json.load(open(f"{O}/v4-part{n}.json")); lines = {x["id"]: x for x in json.load(open(L1 + "/voice5/lines.json"))["lines"]}
STAND_IN = {x["id"]: x for x in json.load(open(L1 + "/voice6/lines.json"))["lines"]}; lines.update(STAND_IN)
CLAIMS = {1: {"c1": "Right now it's about", "c2": "drifting off", "c5": "A third wider.", "c30": "more than twice the tidal pull"},
          2: {"c6": "Half the distance.", "c7": "Twice as wide.", "c10": "Eight times the tidal pull."},
          3: {"c31": "One hundred fifty thousand.", "c33": "Six and a half times the moonlight.", "c34": "One lap takes about seven days", "c15": "It's bigger than the Sun now."},
          4: {"c35": "One hundred thousand.", "c36": "Nearly four times wider.", "c15": "Its shadow on Earth is wider"},
          5: {"c37": "Seventy thousand.", "c39": "More than a hundred sixty times", "c18": "tens of centimeters a day"},
          6: {"c40": "Fifty thousand.", "c19": "Nearly eight times wider.", "c21": "One lap takes about a day and a quarter", "c22": "Forty-two thousand."},
          7: {"c24": "Around eighteen thousand kilometers", "c25": "A perfectly rigid Moon", "c26": "more than twenty times wider"},
          8: {"c27": "flatten into a ring", "c2": "still drifting away"}}[n]
BODY = {1: ["L1", "L2", "L3", "L4", "L5"], 2: ["L6", "L7", "L8"], 3: ["L9", "L10", "L11"], 4: ["L12", "L13"], 5: ["L14", "L15"], 6: ["L16", "L17", "L18"], 7: ["L19", "L20", "L21", "L22"], 8: ["L24", "L25", "L26"]}[n]
HOOK = {1: "B1", 2: "B3", 3: "B4", 4: "B5", 5: "B6", 6: "B7", 7: "B8", 8: "L23"}[n]; CL = f"C{n}"; _dp = ((n - 1) // 2) % 2
CTA = ("D1" if _dp == 0 else "D3") if n % 2 == 1 else None; CTA_YT = ("D2" if _dp == 0 else "D4") if n % 2 == 1 else None
shutil.copy(f"{O}/v4-part{n}.mp4", f"{out}/{name}-9x16.mp4")
yt = f"{O}/v4-part{n}-yt.mp4"
if os.path.exists(yt) and not os.environ.get("SKIP_YT"):
    T_ = tempfile.mkdtemp(); os.makedirs(f"{T_}/ep/out"); shutil.copy(yt, f"{T_}/ep/out/{name}-9x16.mp4")
    subprocess.run(["flock", "-x", "/tmp/heavy.lock", "python3", "-I", f"{ROOT}/kits/cinema/film/youtube1440.py", f"{T_}/ep", "--force"], check=True, capture_output=True)
    shutil.copy(f"{T_}/ep/out/{name}-9x16-youtube.mp4", f"{out}/{name}-9x16-youtube.mp4"); shutil.rmtree(T_)
for suf in (("cover.jpg", "cover-480.jpg", "cover-grid-3x4.jpg") if src_ep and False else ()):   # covers: the coordinator makes the hook covers (16 Nov 2026); stills go to out/cover-stills/
    pass
for suf in ():
    s = f"{src_ep}/out/one-more-orbit-s3-part{src_n}-{suf}"
    if os.path.exists(s) and os.path.abspath(s) != os.path.abspath(f"{out}/{name}-{suf}"): shutil.copy(s, f"{out}/{name}-{suf}")
sp = lambda i: " ".join(x["text"] for x in lines[i]["sentences"])
body = (f"# One More Orbit · Season 3 · Part {n} of 8: \"{title}\"\n\nv4, in the creator's own voice (recorded 12 Nov 2026): picture-led, {tl['dur']:.0f} s, 9:16. The 'Thought experiment' tag shows for the first 5 s.\n"
        f"Voice lines: long01/voice5/lines.json (takes in voice-owner-spoken/takes-used.json); timing from long01/out/v4-part{n}.json.\n\n## opening\nvo: {sp(HOOK)}\n\n## body\n" + "\n".join(f"vo: {sp(i)}" for i in BODY[:-1]) +
        (f"\n\n## like/follow ({tl['cta_frac'] * 100:.0f}% of the runtime)\nvo: {sp(CTA)}  (YouTube file: {sp(CTA_YT)})" if CTA else
         f"\n\n## like/follow ({tl['cta_frac'] * 100:.0f}% of the runtime)\nno spoken ask in an even part (owner, 12-16 Nov 2026): the thumbs-up + bell pop-up only, in the pause before the cliffhanger") +
        f"\n\n## cliffhanger" + (f" and closer (even part)\nvo: {sp(BODY[-1])}\nvo: {sp(CL)}\n" if n % 2 == 0 else f" (odd part: no closer)\nvo: {sp(BODY[-1])}\n"))
open(ep + "/script.md", "w").write(body)
allc = {c["id"]: c for c in json.load(open(L1 + "/claims.json"))}; cl = []
for k, sent in CLAIMS.items(): c = dict(allc[k]); c["sentence"] = sent; cl.append(c)
json.dump(cl, open(ep + "/claims.json", "w"), indent=1, ensure_ascii=False)
_si = sorted({c["id"] for c in tl["clips"] if c["file"].startswith("voice6") and STAND_IN.get(c["id"], {}).get("stand_in")})   # miles lines still in the stand-in (AI) voice until the owner records them (16 Nov 2026)
film = {"id": name, "title": {"title": title, "series": f"One More Orbit · Season 3 · Part {n} of 8"}, "disclosures": {"realVoice": True, "aiVoice": bool(_si), "aiVisuals": True}, "standInLines": _si, "dur": tl["dur"], "fps": 30, "captions": tl["captions"], "km": tl["km"], "tracks": tl["tracks"], "clips": tl["clips"], "badge": tl["badge"], "chips": tl["chips"], "source": f"season3/engine.js via long01/out/v4-part{n}.json"}
json.dump(film, open(ep + "/film.json", "w"), indent=1, ensure_ascii=False)
shutil.copy(f"{L1}/v4/part{n}.sfx.json", ep + "/sfx.json")
# packaging + posting: part n reuses the old part src_n's pack with the numbers rewritten (part 8 is new: its posting is written here); the coordinator makes the hook covers
WORDS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight"]
def fix(s):
    s = s.replace("Narration is a synthetic voice (AI)", "Narration is the creator's own voice").replace("synthetic AI voice", "the creator's own voice")
    if src_n and src_n != n:
        s = s.replace(f"Part {src_n} of 8", f"Part {n} of 8").replace(f"Part {src_n} of the Moon film", f"Part {n} of the Moon film").replace(f"part{src_n}", f"part{n}").replace(f'"part": {src_n}', f'"part": {n}')
    return s
if src_n and not os.environ.get("KEEP_PACK"):
    for f in ("packaging.json", "posting.json", "POSTING.md"):
        p = f"{src_ep}/out/{f}"
        if os.path.exists(p): txt = fix(open(p).read()); open(f"{out}/{f}", "w").write(txt)
elif not src_n:
    full = "How Close Can the Moon Get Before It Breaks?"; lab = "Thought experiment: the Moon is not coming closer. Narration is the creator's own voice; the pictures are AI-assisted paintings and code-rendered."
    hook = "Inside about 18,000 km, tides can pull a Moon apart. The rock can spread into a ring."; take = "Part 8 of the Moon film: what happens at the Roche limit, and why tonight's Moon is fine."
    P = {"generated": "2026-11-16", "part": 8, "of": 8,
         "youtube": {"title": title, "caption": f"{hook}\n\n{take}\n\nPart 8 of 8. Full video on YouTube: {full}\n\n{lab}", "hashtags": "#Shorts #space #moon #astronomy", "tags": ["One More Orbit", "space", "moon", "Roche limit", "thought experiment"]},
         "tiktok": {"title": title, "caption": f"{hook} Part 8 of 8. Full video on YouTube. #space #moon #learnontiktok #science", "hashtags": "#space #moon #learnontiktok #science"},
         "instagram": {"title": title, "caption": f"{hook}\n\n{take}\n\nPart 8 of 8. Full video on YouTube (link in bio).\n\n{lab}", "hashtags": "#space #moon #astronomy #science"},
         "pinnedComment": f"Part 8 of 8. The full film, \"{full}\", is on YouTube. Every number's source is in its description. {lab}"}
    json.dump(P, open(f"{out}/posting.json", "w"), indent=1, ensure_ascii=False)
    open(f"{out}/POSTING.md", "w").write(f"# Posting sheet: One More Orbit S3, Part 8 of 8, \"{title}\"\n\n## YouTube Shorts\nTitle: {title}\n\n{P['youtube']['caption']}\n\n{P['youtube']['hashtags']}\n\n## TikTok\n{P['tiktok']['caption']}\n\n## Instagram\n{P['instagram']['caption']}\n\n## Pinned comment\n{P['pinnedComment']}\n\nTODO: packaging.json (titles, thumbnails) for this part is not written; the coordinator makes the hook cover.\n")
po = json.load(open(f"{out}/posting.json")); po["length_s"] = round(tl["dur"], 1); po["cta_at"] = tl["cta_frac"]; po["spoken_like_follow"] = bool(CTA); po["spoken_closer"] = n % 2 == 0; json.dump(po, open(f"{out}/posting.json", "w"), indent=1, ensure_ascii=False)
for f_ in os.listdir(out):   # GitHub refuses files over 100 MB
    if f_.endswith(".mp4"): subprocess.run([f"{HERE_}/shrink.sh", f"{out}/{f_}"], check=False)
print("packaged", ep)
