# the Skin School page for a preview that carries the course (v4): the preview can't serve
# img/school/video/*, so each lesson's explainer plays from the artifact's asset store
# (<version>-school.json next to this script: lesson id to asset id). The poster and the
# diagrams stay ordinary files published next to the page (img/school/...).
import re, sys, os, json
src, out, version = sys.argv[1], sys.argv[2], sys.argv[3]
# "hub": the home page sits beside it as site.html (the hub page is the index)
hub = len(sys.argv) > 4 and sys.argv[4] == "hub"
s = open(src, encoding="utf-8").read()
vmap = os.path.join(os.path.dirname(os.path.abspath(__file__)), version + "-school.json")
ids = json.load(open(vmap)) if os.path.exists(vmap) else {}
old = """<source src="' + src + '.mp4" type="video/mp4"><source src="' + src + '.webm" type="video/webm">"""
assert s.count(old) == 1, s.count(old)
s = s.replace(old, """<source src="' + (BLOBS[ls.id] ? "/_blob/" + BLOBS[ls.id] : src + ".mp4") + '" type="video/mp4">""")
anchor = "var VIDEOS = window.SCHOOL_VIDEOS || {};"
assert s.count(anchor) == 1
s = s.replace(anchor, anchor + " var BLOBS = " + json.dumps(ids, separators=(",", ":")) + ";")
# a lesson whose clip isn't uploaded yet shows Evelyn's video placeholder, not a broken player
v_old = "var v = VIDEOS[ls.id];"
assert s.count(v_old) == 1
s = s.replace(v_old, "var v = BLOBS[ls.id] && VIDEOS[ls.id];")
if hub:
    s = s.replace('href="index.html', 'href="site.html')
open(out, "w", encoding="utf-8").write(s)
print(out, len(s), len(ids), "lesson clips from the asset store")
