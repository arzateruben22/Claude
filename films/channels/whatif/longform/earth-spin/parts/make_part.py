"""Assemble one vertical part of the Earth-spin film: opening, chosen sentences of the long narration, the like/follow line right after the sentence that ends
nearest 77 % of the runtime, the cliffhanger and the closer. Writes partN/vo/NN.wav (one wav per item), vo/lines.json, script.md and items.json.

  CINEMA_VOICE=/root/.cache/cinema-voice $CINEMA_VOICE/venv/bin/python -I films/channels/whatif/longform/earth-spin/parts/make_part.py N [--voice own|owner] [--partlines DIR]

  --voice own    the owner's cloned voice: sentences are cut from ../vo-own/NN.wav by the aligner's word times (../vo-own/words.json), text from ../script.md (v3)
  --voice owner  his real recording: sentences from ../vo-owner (the alternate set; needs script-owner.md)
  --partlines    where the opening/cliffhanger/closer/like-follow lines are (a lines.json with beats p1-open, p1-cliff, closer1, cta-hang-follow, ...); default: his real takes, voice-owner/cut
then align.py on partN/vo, then compile_part.py N."""
import json, re, sys, hashlib
from pathlib import Path
import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
ES = HERE.parent
OWN = ES.parents[1] / "voice-owner"
N = int(sys.argv[1])
arg = lambda k, d=None: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
VOICE = arg("--voice", "ai")
PL = Path(arg("--partlines", str(HERE / "lines/vo")))
CTA_KIND = "follow"                     # the picture is built once, with the "follow" line (and its captions); the -sub file only swaps the audio
# which sentences each part keeps: (line number, "all" or the sentence numbers of that line in the final script)
PLAN = {
 "own":   {1: [(1, [2]), (2, [2, 3, 4, 5]), (3, "all")], 2: [(4, "all"), (5, "all")], 3: [(6, [1, 2, 3, 4, 5, 6, 7, 8, 9])], 4: [(7, "all")], 5: [(8, [1, 2, 3, 4, 5]), (9, "all")],
           6: [(10, "all"), (11, "all")], 7: [(12, "all"), (13, "all")], 8: [(14, "all")]},
 "ai":    None,
 "owner": {1: [(1, [2]), (2, [1, 3, 4, 5]), (3, [1, 3, 4, 5, 6])], 2: [(4, "all"), (5, "all")], 3: [(6, "all")], 4: [(7, "all")], 5: [(8, "all"), (9, "all")],
           6: [(10, "all"), (11, "all")], 7: [(12, "all"), (13, "all")], 8: [(14, "all")]},
}
PLAN["ai"] = PLAN["own"]
PLAN = PLAN[VOICE][N]
VODIR = {"own": "vo-own", "ai": "vo"}.get(VOICE, "vo-owner")
cut = json.loads((PL / "lines.json").read_text())["lines"]
byname = {l["beat"]: PL / l["file"] for l in cut}
textof = {l["beat"]: l["text"] for l in cut}
cta_name = ("cta-hang" if N % 2 else "cta-break") + "-" + CTA_KIND
items = []
def clip(path, kind, text, beat, key, sl=None):
    items.append(dict(kind=kind, wav=str(path), text=text, beat=beat, key=key, **({"slice": sl} if sl else {})))
clip(byname[f"p{N}-open"], "open", textof[f"p{N}-open"], "open", "open")
first_beat = None
if VOICE in ("own", "ai"):
    LO = json.loads((ES / VODIR / "lines.json").read_text())["lines"]
    WD = {l["id"]: l["words"] for l in json.loads((ES / VODIR / "words.json").read_text())["lines"]}
    for ln, keep in PLAN:
        L = LO[ln - 1]
        ws = WD[L["id"]]
        sents, cur = [], []
        for w in ws:
            cur.append(w)
            if re.search(r"[.?!]$", w["w"]): sents.append(cur); cur = []
        if cur: sents.append(cur)
        for si, sw in enumerate(sents, 1):
            if keep != "all" and si not in keep: continue
            prev_end = sents[si - 2][-1]["end"] if si > 1 else 0.0
            nxt = sents[si][0]["start"] if si < len(sents) else L["dur"]
            a = max(prev_end + 0.02, sw[0]["start"] - 0.06)
            b = min(nxt - 0.02, sw[-1]["end"] + 0.12)
            first_beat = first_beat or L["beat"]
            clip(ES / VODIR / L["file"], "sent", " ".join(w["w"] for w in sw), L["beat"], f"L{ln}.{si}", [round(a, 3), round(b, 3)])
else:
    LO = json.loads((ES / "vo-owner/lines.json").read_text())["lines"]
    for ln, keep in PLAN:
        L = LO[ln - 1]; keep_prev = False
        for s in L["sentences"]:
            if s["kind"] == "rec":
                si = int(s["key"].split(".")[1]); keep_prev = keep == "all" or si in keep
            if keep_prev:
                first_beat = first_beat or L["beat"]
                clip(ES / "vo-owner" / L["file"], "sent", s["text"], L["beat"], s["key"], [s["t0"], s["t1"]])
items[0]["beat"] = first_beat
dur = lambda it: (it["slice"][1] - it["slice"][0]) if "slice" in it else sf.info(it["wav"]).duration
sent_idx = [i for i, it in enumerate(items) if it["kind"] == "sent"]
tot = sum(dur(it) for it in items) + 4.0 + 0.55 * len(items) + (sf.info(byname[cta_name]).duration + 3.0)
run, best = dur(items[0]) + 0.5, None
for i in sent_idx:
    run += dur(items[i]) + 0.55
    if best is None or abs(run / tot - 0.77) < abs(best[1] / tot - 0.77): best = (i, run)
items.insert(best[0] + 1, dict(kind="cta", wav=str(byname[cta_name]), text=textof[cta_name], beat=items[best[0]]["beat"], key="cta"))
clip(byname[f"p{N}-cliff"], "cliff", textof[f"p{N}-cliff"], items[-1]["beat"], "cliff")
clip(byname[f"closer{N}"], "closer", textof[f"closer{N}"], "tease", "closer")
import os as _os
D = HERE / f"part{N}{_os.environ.get('PART_SUFFIX', '')}"
(D / "vo").mkdir(parents=True, exist_ok=True)
lines, out_items, beats_n = [], [], {}
for k, it in enumerate(items, 1):
    x, sr = sf.read(it["wav"])
    if "slice" in it:
        a, b = it["slice"]; x = x[int(a * sr): int(b * sr)]
    if it["kind"] == "cta":                         # both variants (follow / subscribe) padded to the longer, so the picture never changes between the two files
        other = byname[cta_name.replace(CTA_KIND, "subscribe")]
        y2, sr2 = sf.read(other)
        n = max(len(x), len(y2))
        pad = lambda v: np.concatenate([v, np.zeros(n - len(v))])
        sf.write(D / "vo" / f"{k:02d}-sub.wav", pad(y2), sr, subtype="PCM_24")
        x = pad(x)
        it["sub_file"] = f"vo/{k:02d}-sub.wav"
    f = D / "vo" / f"{k:02d}.wav"
    sf.write(f, x, sr, subtype="PCM_24")
    bid = {"open": "open", "cta": "cta", "cliff": "cliff", "closer": "tease"}.get(it["kind"], f"{it['beat']}")
    beats_n[bid] = beats_n.get(bid, 0) + 1
    uid = bid if bid in ("open", "cta", "cliff", "tease") else f"{bid}-{beats_n[bid]}"
    lines.append({"id": f"vo{k:02d}", "beat": uid, "text": it["text"], "stars": [], "phonemes": None, "file": f.name, "dur": round(len(x) / sr, 3), "sha256": hashlib.sha256(f.read_bytes()).hexdigest()})
    out_items.append(dict(it, uid=uid, vo=f"vo{k:02d}", dur=round(len(x) / sr, 3)))
(D / "vo/lines.json").write_text(json.dumps({"voice": "recorded" if VOICE == "owner" else "cloned", "speaker": "owner", "lang": "en-us", "made_by": "parts/make_part.py", "lines": lines}, indent=1, ensure_ascii=False))
(D / "items.json").write_text(json.dumps(out_items, indent=1, ensure_ascii=False))
sc = f"# Earth-spin Season 3, part {N} of 8 (generated by make_part.py, voice: {VOICE})\n\n"
for l in lines:
    sc += f"## {l['beat']} {{shot: see compile_part.py · energy: 0.6}} (__)\nvo: {l['text']} {{-}}\n\n"
(D / "script.md").write_text(sc)
print(f"part {N} ({VOICE}): {len(lines)} items, speech {sum(l['dur'] for l in lines):.1f} s; CTA {cta_name}")
