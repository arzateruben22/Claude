# fold the single-file build into an artifact page: our own <title>, no outer skeleton
import re, sys, os, json
src, out, title, version = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
s = open(src, encoding="utf-8").read()
if version != "v2":
    assert s.count('version: "v2",') == 1
    s = s.replace('version: "v2",', 'version: "%s",' % version)
i = s.index("</title>") + len("</title>")
s = "<title>" + title + "</title>" + s[i:]
s = re.sub(r"\s*</body>\s*</html>\s*$", "\n", s)
# the clip strip: the preview can't serve img/school/video/*, so each clip plays from the
# artifact's own asset store (ids in <version>-videos.json next to this script)
vmap = os.path.join(os.path.dirname(os.path.abspath(__file__)), version + "-videos.json")
if os.path.exists(vmap):
    ids = json.load(open(vmap))
    for vid, asset in ids.items():
        mp4 = '<source src="img/school/video/%s.mp4" type="video/mp4">' % vid
        assert s.count(mp4) == 1, (vid, s.count(mp4))
        s = s.replace(mp4, '<source src="/_blob/%s" type="video/mp4">' % asset)
        s = re.sub(r'\s*<source src="img/school/video/%s\.webm"[^>]*>' % re.escape(vid), "", s)
    left = re.findall(r'src="img/school/video/[^"]+"', s)
    assert not left, left
open(out, "w", encoding="utf-8").write(s)
print(out, len(s))
