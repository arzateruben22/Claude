"""pack.py <epdir> <spec.json> : writes <epdir>/out/packaging.json (films/channels/PACKAGING.md) from a spec.
spec keys: format, hook, titles[5 of [text, mechanism]], thumbnails[3 dicts], pairings[3 of [title_idx, thumb_id, scores(list of 8), note]],
winner{title,thumbnail,thumbnailText,why}, thumbnailFile, chatgptPrompt, shortsCover{frameSeconds,text}.  Scores are creative judgments, not CTR."""
import json, os, sys
ep, spec = sys.argv[1], json.load(open(sys.argv[2]))
AX = ["scroll", "curiosity", "clarity", "synergy", "originality", "accuracy", "mobile", "satisfaction"]
pk = {"version": 1, "format": spec["format"], "hook": spec["hook"],
      "titles": [{"text": t, "mechanism": m} for t, m in spec["titles"]], "thumbnails": spec["thumbnails"],
      "pairings": [{"title": i, "thumbnail": th, "scores": dict(zip(AX, sc)), "note": nt} for i, th, sc, nt in spec["pairings"]],
      "winner": spec["winner"], "testAndCompare": [t["id"] for t in spec["thumbnails"]],
      "checks": {k: True for k in ["halfSecond", "curiosity", "duplication", "competition", "truth", "satisfaction", "originality"]},
      "thumbnailFile": spec["thumbnailFile"], "chatgptPrompt": spec["chatgptPrompt"], "shortsCover": spec["shortsCover"],
      "scoresNote": "Scores are 1-100 creative judgments, not CTR predictions."}
assert len(pk["titles"]) == 5 and len(pk["thumbnails"]) == 3 and len(pk["pairings"]) == 3
assert 0 < len(spec["winner"]["title"]) <= 70 and len(spec["winner"].get("thumbnailText", "").split()) <= 4
os.makedirs(os.path.join(ep, "out"), exist_ok=True)
json.dump(pk, open(os.path.join(ep, "out", "packaging.json"), "w"), indent=1, ensure_ascii=False)
print("packaging.json written:", spec["winner"]["title"])
