"""package_v4.py <n>: v4 Part n (1|2) -> ep<12+n>/ : the 1080 'follow' final, the 1440p 'subscribe' YouTube file, script.md, claims.json, film.json (realVoice true, aiVoice false, aiVisuals true),
sfx.json (the stem is already mixed into both finals), covers and posting pack. Reads long01/out/v4-part<n>.mp4, v4-part<n>-yt.mp4 and the timelines.
Part 1 keeps its cover/packaging (same title); Part 2 is the old part 3 ('half the distance') so it takes that part's cover/packaging with the numbers rewritten (TODO: the owner/coordinator may want a fresh pack)."""
import json, os, re, shutil, subprocess, sys, tempfile
n = int(sys.argv[1]); ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".."))
S = f"{ROOT}/films/channels/space"; L1 = f"{S}/long01"; O = L1 + "/out"; ep = f"{S}/ep{12 + n}"; out = ep + "/out"; os.makedirs(out, exist_ok=True)
name = f"one-more-orbit-s3-part{n}"; T = json.load(open(L1 + "/part_titles.json")); title = T["parts"]["1" if n == 1 else "3"]
src_ep = f"{S}/ep13" if n == 1 else f"{S}/ep15"; src_n = 1 if n == 1 else 3
tl = json.load(open(f"{O}/v4-part{n}.json")); lines = {x["id"]: x for x in json.load(open(L1 + "/voice5/lines.json"))["lines"]}
CLAIMS = {1: {"c1": "Right now it's about three hundred eighty-four thousand kilometers away", "c2": "drifting off three point eight centimeters a year", "c5": "Two hundred eighty-eight thousand. A third wider.", "c30": "more than twice the tidal pull"},
          2: {"c6": "Half the distance.", "c7": "Twice as wide.", "c10": "Eight times the tidal pull."}}[n]
BODY = {1: ["L1", "L2", "L3", "L4", "L5"], 2: ["L6", "L7", "L8"]}[n]; HOOK = {1: "B1", 2: "B3"}[n]; CL = f"C{n}"; CTA, CTA_YT = ("D1", "D2") if n % 2 == 1 else (None, None)   # a spoken ask only in odd parts (owner, 12 Nov 2026)
shutil.copy(f"{O}/v4-part{n}.mp4", f"{out}/{name}-9x16.mp4")
yt = f"{O}/v4-part{n}-yt.mp4"
if os.path.exists(yt) and not os.environ.get("SKIP_YT"):
    T_ = tempfile.mkdtemp(); os.makedirs(f"{T_}/ep/out"); shutil.copy(yt, f"{T_}/ep/out/{name}-9x16.mp4")
    subprocess.run(["flock", "-x", "/tmp/heavy.lock", "python3", "-I", f"{ROOT}/kits/cinema/film/youtube1440.py", f"{T_}/ep", "--force"], check=True, capture_output=True)
    shutil.copy(f"{T_}/ep/out/{name}-9x16-youtube.mp4", f"{out}/{name}-9x16-youtube.mp4"); shutil.rmtree(T_)
for suf in ("cover.jpg", "cover-480.jpg", "cover-grid-3x4.jpg"):
    s = f"{src_ep}/out/one-more-orbit-s3-part{src_n}-{suf}"
    if os.path.exists(s) and os.path.abspath(s) != os.path.abspath(f"{out}/{name}-{suf}"): shutil.copy(s, f"{out}/{name}-{suf}")
sp = lambda i: " ".join(x["text"] for x in lines[i]["sentences"])
body = (f"# One More Orbit · Season 3 · Part {n} of 8: \"{title}\"\n\nv4, in the creator's own voice (recorded 12 Nov 2026): picture-led, {tl['dur']:.0f} s, 9:16. The 'Thought experiment' tag shows for the first 5 s.\n"
        f"Voice lines: long01/voice5/lines.json (takes in voice-owner-spoken/takes-used.json); timing from long01/out/v4-part{n}.json.\n\n## opening\nvo: {sp(HOOK)}\n\n## body\n" + "\n".join(f"vo: {sp(i)}" for i in BODY[:-1]) +
        (f"\n\n## like/follow ({tl['cta_frac'] * 100:.0f}% of the runtime)\nvo: {sp(CTA)}  (YouTube file: {sp(CTA_YT)})" if CTA else
         f"\n\n## like/follow ({tl['cta_frac'] * 100:.0f}% of the runtime)\nno spoken ask in an even part (owner, 12 Nov 2026): the silent thumbs-up + bell pop-up only, in the pause before the cliffhanger") +
        f"\n\n## cliffhanger and closer\nvo: {sp(BODY[-1])}\nvo: {sp(CL)}\n")
open(ep + "/script.md", "w").write(body)
allc = {c["id"]: c for c in json.load(open(L1 + "/claims.json"))}; cl = []
for k, sent in CLAIMS.items(): c = dict(allc[k]); c["sentence"] = sent; cl.append(c)
json.dump(cl, open(ep + "/claims.json", "w"), indent=1, ensure_ascii=False)
film = {"id": name, "title": {"title": title, "series": f"One More Orbit · Season 3 · Part {n} of 8"}, "disclosures": {"realVoice": True, "aiVoice": False, "aiVisuals": True}, "dur": tl["dur"], "fps": 30, "captions": tl["captions"], "km": tl["km"], "tracks": tl["tracks"], "clips": tl["clips"], "badge": tl["badge"], "chips": tl["chips"], "source": f"season3/engine.js via long01/out/v4-part{n}.json"}
json.dump(film, open(ep + "/film.json", "w"), indent=1, ensure_ascii=False)
shutil.copy(f"{L1}/v4/part{n}.sfx.json", ep + "/sfx.json")
# packaging + posting: Part 1 keeps its own; Part 2 takes the old part 3's with 'Part 3 of 8' -> 'Part 2 of 8'
def fix(s):
    s = s.replace("Narration is a synthetic voice (AI)", "Narration is the creator's own voice").replace("synthetic AI voice", "the creator's own voice")
    if n == 2: s = s.replace("Part 3 of 8", "Part 2 of 8").replace("Part 3 of the Moon film", "Part 2 of the Moon film").replace("part3", "part2").replace('"part": 3', '"part": 2')
    return s
for f in ("packaging.json", "posting.json", "POSTING.md"):
    p = f"{src_ep}/out/{f}"
    if os.path.exists(p): txt = fix(open(p).read()); open(f"{out}/{f}", "w").write(txt)
if True:
    po = json.load(open(f"{out}/posting.json")); po["length_s"] = round(tl["dur"], 1); po["cta_at"] = tl["cta_frac"]; json.dump(po, open(f"{out}/posting.json", "w"), indent=1, ensure_ascii=False)
print("packaged", ep)
