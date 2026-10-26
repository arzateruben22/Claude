#!/bin/bash
# Everything Lumevina: the hub page and every page it opens, built fresh into one folder for the
# claude.ai preview (published with index.html as the page and the rest as files beside it):
#   index.html      the hub (docs/hub/index.html)
#   site.html       the home page, v4 (booking here, membership, Glow Points, Skin School switched on)
#   site-simple.html  the same site as v2 (booking on GlossGenius, no membership or points), so Evelyn can compare
#   school.html     Skin School; each lesson's video plays from the preview's asset store
#   dashboard.html  Evelyn's dashboard      app.html       the iPhone app sample
#   blueprint.html  the Growth Blueprint    plan.html      the first 90 days
#   shipping.html   the shipping kit        privacy.html   the privacy policy
#   guide.html      the product guide, with Lumevina-Product-Guide.pdf beside it
#   img/            each card's picture of the page it opens (docs/hub/img, from hub-shots.mjs)
# Run from anywhere:  scripts/preview/build-hub.sh <out dir>
set -e
OUT=${1:?usage: build-hub.sh <out dir>}
cd "$(dirname "$0")/../.."
mkdir -p "$OUT/img" "$OUT/.bp" "$OUT/.plan"
node scripts/build-single-file.mjs
node scripts/build-single-file.mjs dashboard.html dist/dashboard.html
node scripts/build-single-file.mjs shipping-kit.html dist/shipping.html
node scripts/build-single-file.mjs privacy.html dist/privacy.html
python3 scripts/preview/fold.py dist/lumevina.html "$OUT/site.html" "Lumevina" v4 file
python3 scripts/preview/fold.py dist/lumevina.html "$OUT/site-simple.html" "Lumevina" v2 file v4
python3 scripts/preview/fold-school.py school.html "$OUT/school.html" v4 hub
cp dist/dashboard.html "$OUT/dashboard.html"; cp dist/privacy.html "$OUT/privacy.html"
python3 docs/blueprint/build.py "$OUT/.bp" >/dev/null && cp "$OUT/.bp/web.html" "$OUT/blueprint.html"
python3 docs/launch-plan/build.py "$OUT/.plan" >/dev/null && cp "$OUT/.plan/web.html" "$OUT/plan.html"
# these two were written as artifact pages (the viewer added the document around them); beside the hub they need their own
for p in "docs/app-sample/index.html:app.html" "dist/shipping.html:shipping.html"; do
  python3 - "${p%%:*}" "$OUT/${p##*:}" <<'PY'
import sys
s = open(sys.argv[1], encoding="utf-8").read()
if not s.lstrip().lower().startswith("<!doctype"):
    head = '<!doctype html>\n<style>body{margin:0}img{max-width:100%}</style>\n'
    if 'name="viewport"' not in s[:4000]: head += '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
    s = head + s
open(sys.argv[2], "w", encoding="utf-8").write(s)
PY
done
python3 scripts/preview/fold-guide.py docs/product-guide/index.html "$OUT/guide.html" && cp docs/Lumevina-Product-Guide.pdf "$OUT/"
cp docs/hub/index.html "$OUT/index.html"
# each card's picture of the page it opens (docs/hub/img; refresh with scripts/preview/hub-shots.mjs "$OUT")
cp docs/hub/img/*.jpg "$OUT/img/"
echo "built $OUT: $(ls "$OUT" | tr '\n' ' ')"
