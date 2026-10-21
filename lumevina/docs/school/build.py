"""Build the Lumevina Skin School: one self-contained page.

Run:  python3 build.py              (writes the site's school.html, linked from the Shop and the nav)
      python3 build.py out_dir      (writes out_dir/web.html instead, for a standalone preview)

Sources, all in this folder:
  page.html       the page, with __PLACEHOLDERS__
  style.css       its styles (the Inter font is inlined from ../blueprint)
  curriculum.js   the three levels, 40 lessons and the tiers
  notes.js        per lesson: Evelyn's answers, the general layer, her shelf (knowledge/scripts/build-course-notes.mjs)
  visuals.js      which lessons have a diagram in ../../img/school (visuals/build-visuals.mjs)
  hero.js         the opening animation (a living cross-section of skin)
  scenes.js       one animation per level
  app.js          quiz, lesson preview, checkout, course player
plus the site's payment engine, ../../js/payments.js.
"""
import base64, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.normpath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(sys.argv[1], "web.html") if len(sys.argv) > 1 else os.path.join(SITE, "school.html")


def read(*p):
    with open(os.path.join(*p), encoding="utf-8") as f:
        return f.read()


def script(src):
    # an inline script must never close its own tag early
    return src.replace("</script", "<\\/script")


font = base64.b64encode(open(os.path.join(HERE, "..", "blueprint", "inter-var.woff2"), "rb").read()).decode()
month = "".join('<i style="--i:%d"></i>' % i for i in range(30))

page = read(HERE, "page.html")
for key, val in [
    ("__CSS__", read(HERE, "style.css").replace("__FONT__", font)),
    ("__MONTH__", month),
    ("__CURRICULUM__", script(read(HERE, "curriculum.js"))),
    ("__NOTES__", script(read(HERE, "notes.js")) if os.path.exists(os.path.join(HERE, "notes.js")) else "window.SCHOOL_NOTES = {};"),
    ("__VISUALS__", script(read(HERE, "visuals.js")) if os.path.exists(os.path.join(HERE, "visuals.js")) else "window.SCHOOL_VISUALS = [];"),
    ("__VIDEOS__", script(read(HERE, "videos.js")) if os.path.exists(os.path.join(HERE, "videos.js")) else "window.SCHOOL_VIDEOS = {};"),
    ("__PAYMENTS__", script(read(SITE, "js", "payments.js"))),
    ("__SHIPPING__", script(read(SITE, "js", "shipping.js"))),
    ("__HERO__", script(read(HERE, "hero.js"))),
    ("__SCENES__", script(read(HERE, "scenes.js"))),
    ("__APP__", script(read(HERE, "app.js"))),
]:
    assert key in page, key
    page = page.replace(key, val)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    f.write(page)
print("%s %d KB" % (os.path.basename(OUT), len(page.encode()) // 1024))
