"""Assemble the owner's narration for the Earth-spin film from his recorded sentences (voice-owner/cutA) and his add-on sentences
(voice-owner/cutAdd, when they exist): one wav per script line (pauses of GAP s between sentences) in vo-owner/, vo-owner/lines.json (tts-style, text matching
script-owner.md), and script-owner.md (script.md with the add-on sentences inserted where addons.json says). Nothing is re-voiced.

  python3 -I films/channels/whatif/longform/earth-spin/assemble_owner.py [--gap 0.8] [--no-addons]
then: $CINEMA_VOICE/venv/bin/python -I kits/cinema/voice/align.py films/channels/whatif/longform/earth-spin/vo-owner $CINEMA_VOICE/models
"""
import argparse, hashlib, json, re, sys
from pathlib import Path
import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
OWN = HERE.parents[1] / "voice-owner"
sys.path.insert(0, str(HERE.parents[4] / "kits/cinema/voice"))
from scriptfile import script_lines   # noqa: E402

def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--gap", type=float, default=0.8)
    ap.add_argument("--no-addons", action="store_true")
    a = ap.parse_args()
    A = json.loads((OWN / "cutA/lines.json").read_text())
    sents = {}                              # (line, si) -> wav path
    for s in A["sentence_files"]: sents[(s["line"] + 1, s["si"] + 1)] = OWN / "cutA" / s["file"]
    adds = json.loads((HERE / "addons.json").read_text())
    addw = {}
    addf = OWN / "cutAdd/lines.json"
    if not a.no_addons and addf.exists():
        AD = json.loads(addf.read_text())
        # each add-on is one or more sentences, in order; map by the add-on's own sentence count
        files = AD["sentence_files"]; q = 0
        for ad in adds:
            n = len([x for x in re.split(r"(?<=[.?!])\s+", ad["text"].strip()) if x])
            addw[ad["id"]] = [OWN / "cutAdd" / files[q + i]["file"] for i in range(n)]; q += n
    else:
        adds = []
    # the original script: split each vo line into sentences with their tags
    txt = (HERE / "script.md").read_text().split("\n")
    out_lines, vo_i = [], 0
    chain = {}                              # sentence key -> add-on ids placed after it
    for ad in adds: chain.setdefault(ad["after"], []).append(ad)
    gap = np.zeros(int(a.gap * 48000))
    meta_lines = []
    for ln in txt:
        m = re.match(r"^vo: (.*)$", ln)
        if not m:
            out_lines.append(ln); continue
        vo_i += 1
        body = m.group(1)
        parts = re.findall(r"(.+?[.?!])((?:\s*\{[^}]*\})*)\s*", body)
        items = []                          # (kind, text_with_tags, plain, wav)
        def add_after(key):
            for ad in chain.get(key, []):
                tg = "{" + ad["claims"].replace(" ", "") + "}" if ad["claims"] != "-" else "{-}"
                tg = tg.replace(",", "}{")
                ps = [x for x in re.split(r"(?<=[.?!])\s+", ad["text"].strip()) if x]
                for k, p in enumerate(ps):
                    items.append(("addon", p + (" " + tg if k == len(ps) - 1 else ""), p, addw[ad["id"]][k], ad["id"] + ("" if k == 0 else f".{k + 1}")))
                add_after(ad["id"])
        for si, (sent, tags) in enumerate(parts, 1):
            plain = re.sub(r"\s+", " ", re.sub(r"\{[^}]*\}", "", sent)).strip()
            items.append(("rec", sent + tags, plain.replace("*", ""), sents[(vo_i, si)], f"L{vo_i}.{si}"))
            add_after(f"L{vo_i}.{si}")
        out_lines.append("vo: " + " ".join(it[1] for it in items))
        # audio
        audio, t, sl = [], 0.0, []
        for k, (kind, tt, plain, wav, key) in enumerate(items):
            x, sr = sf.read(wav)
            if k: audio.append(gap[: int(a.gap * sr)] if sr == 48000 else np.zeros(int(a.gap * sr))); t += a.gap
            sl.append({"t0": round(t, 3), "t1": round(t + len(x) / sr, 3), "text": plain, "kind": kind, "key": key, "file": str(wav.relative_to(OWN))})
            audio.append(x); t += len(x) / sr
        y = np.concatenate(audio)
        (HERE / "vo-owner").mkdir(exist_ok=True)
        f = HERE / "vo-owner" / f"{vo_i:02d}.wav"
        sf.write(f, y, 48000, subtype="PCM_24")
        meta_lines.append({"id": f"vo{vo_i:02d}", "file": f.name, "dur": round(len(y) / 48000, 3), "sha256": sha(f), "sentences": sl})
    (HERE / "script-owner.md").write_text("\n".join(out_lines))
    # text/stars/beat from the assembled script, so the film's staleness check matches
    for (beat, text, stars), ml in zip(script_lines(HERE / "script-owner.md"), meta_lines):
        ml.update(beat=beat, text=text, stars=stars, phonemes=None)
    meta = {"voice": "recorded", "speaker": "owner", "speed": None, "lang": "en-us", "style": A.get("style", "normal"), "gap": a.gap,
            "source": A.get("source"), "made_by": "films/channels/whatif/longform/earth-spin/assemble_owner.py", "lines": meta_lines}
    (HERE / "vo-owner/lines.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False) + "\n")
    print(f"{len(meta_lines)} lines, {sum(l['dur'] for l in meta_lines):.1f} s of speech, add-ons: {sum(1 for l in meta_lines for s in l['sentences'] if s['kind'] == 'addon')} sentences")

if __name__ == "__main__":
    main()
