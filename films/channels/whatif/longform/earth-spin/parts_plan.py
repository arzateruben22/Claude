"""The 8 parts' plan for Season 3 "What If Earth Spun Faster and Couldn't Stop?" (one part per chapter of the long film).

Each part = its opening (owner, replaces the long film's bridge line) + chosen SENTENCES of the long film's narration (in film order)
+ the like/follow line right after the part's main payoff (about 70-85 % of the runtime) + its cliffhanger + the closer.
Durations here use the AI narration (vo/words.json) as a stand-in; they are re-measured from the owner's reading (voice-owner/cut/) when Part A lands.
Run: python3 parts_plan.py            prints the table; writes parts_plan.json
"""
import json, re
from pathlib import Path
HERE = Path(__file__).resolve().parent
OWN = HERE.parents[1] / "voice-owner/cut/lines.json"
W = json.loads((HERE / "vo/words.json").read_text())["lines"]
SENT = {}
for wl in W:
    sents, cur = [], []
    for w in wl["words"]:
        cur.append(w)
        if re.search(r"[.?!]$", w["w"]): sents.append(cur); cur = []
    if cur: sents.append(cur)
    SENT[wl["id"]] = [(round(s[0]["start"], 3), round(s[-1]["end"], 3), " ".join(x["w"] for x in s)) for s in sents]
own = {l["beat"]: l["dur"] for l in json.loads(OWN.read_text())["lines"]}
GAP = 0.4
# part: [(line id, [sentence numbers])]; payoff = the (line, sentence) after which the like/follow line goes
PLAN = {
 1: dict(pick=[("vo01", [2]), ("vo02", [1, 2, 3, 4, 5]), ("vo03", [1, 3, 4, 5, 6])], payoff=("vo03", 3)),
 2: dict(pick=[("vo04", [1, 2, 3, 4, 5]), ("vo05", [1, 2, 3, 4])], payoff=("vo05", 2)),
 3: dict(pick=[("vo06", [1, 2, 3, 4, 5])], payoff=("vo06", 4)),
 4: dict(pick=[("vo07", [1, 2, 3, 4, 5, 6, 7, 8, 9])], payoff=("vo07", 5)),
 5: dict(pick=[("vo08", [1, 2, 3, 4, 5, 6]), ("vo09", [1, 2, 3, 4])], payoff=("vo09", 1)),
 6: dict(pick=[("vo10", [1, 2, 3, 4, 5]), ("vo11", [1, 2, 3, 4, 5, 6])], payoff=("vo10", 5)),
 7: dict(pick=[("vo12", [1, 2, 3, 4]), ("vo13", [1, 2, 3, 4])], payoff=("vo13", 1)),
 8: dict(pick=[("vo14", [1, 2, 3, 4])], payoff=("vo14", 3)),
}
CTA = [("cta-hang-subscribe", "cta-hang-follow"), ("cta-break-subscribe", "cta-break-follow")]
out = {}
print("part  content  total   (opening + content + CTA + cliffhanger + closer + gaps)   payoff at")
for n, p in PLAN.items():
    items = []
    for lid, nums in p["pick"]:
        for k in nums:
            a, b, t = SENT[lid][k - 1]
            items.append(dict(line=lid, sentence=k, dur=round(b - a, 2), text=t))
    content = sum(i["dur"] for i in items) + GAP * (len(items) - 1)
    cta = CTA[(n - 1) % 2]
    o, c, cl, ct = own[f"p{n}-open"], own[f"p{n}-cliff"], own[f"closer{n}"], own[cta[1]]
    # payoff position
    run = 0.0
    for i in items:
        run += i["dur"] + GAP
        if (i["line"], i["sentence"]) == p["payoff"]: break
    total = o + GAP + content + GAP + ct + GAP + c + GAP + cl
    at = (o + GAP + run) / total
    out[n] = dict(opening=f"p{n}-open", cliffhanger=f"p{n}-cliff", closer=f"closer{n}", cta=cta, sentences=items,
                  est_content_s=round(content, 1), est_total_s=round(total, 1), cta_at_fraction=round(at, 2))
    flag = "" if 61 <= total <= 74 else "   <-- OUT OF RANGE"
    print(f"{n}     {content:6.1f}  {total:6.1f}   payoff after {p['payoff']}  CTA at ~{at:.0%}{flag}")
(HERE / "parts_plan.json").write_text(json.dumps(out, indent=1, ensure_ascii=False))
