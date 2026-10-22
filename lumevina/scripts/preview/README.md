# The claude.ai previews of the home page

`node scripts/build-single-file.mjs` writes `dist/lumevina.html`; `fold.py` turns it into the
page published at the two preview links (v2 and v3):

    python3 scripts/preview/fold.py dist/lumevina.html <out>/index.html "Lumevina v2" v2
    python3 scripts/preview/fold.py dist/lumevina.html <out>/index.html "Lumevina v3" v3

The preview can't serve `img/school/video/*.mp4`, so the six clips in the Skin science strip are
uploaded to each preview's own asset store, and `fold.py` points each `<source>` at its asset
(`v2-videos.json`, `v3-videos.json`: lesson id to asset id). A new clip in the strip needs an
upload to both previews and a line in both files; `fold.py` stops if a clip has no asset.
The real site serves the files from `img/school/video/` and needs none of this.

## v4: everything connected (the home page, membership, Glow Points and Skin School)

    python3 scripts/preview/fold.py dist/lumevina.html <out>/index.html "Lumevina" v4
    python3 scripts/preview/fold-school.py school.html <out>/school.html v4

The v4 preview is published with `school.html` beside the page, plus `img/school/*.jpg` (the
diagrams) and `img/school/video/*.jpg` (the posters) as files. Every lesson's explainer plays
from the preview's asset store: `v4-school.json` maps lesson id to asset id, and `v4-videos.json`
is the same for the Skin science strip on the home page. A lesson whose clip isn't uploaded yet
shows Evelyn's video placeholder instead of a broken player. When a clip is re-rendered, upload
the new mp4, update both maps and fold again.

## Everything Lumevina (the hub)

`scripts/preview/build-hub.sh <out>` builds the hub (`docs/hub/index.html`) and every page it
opens into one folder: the v4 site as `site.html`, Skin School, the dashboard, the iPhone app
sample, the Growth Blueprint, the first 90 days, the shipping kit and the privacy page. It is
published to the same artifact as v4: the hub is the page, the rest are files beside it, and
Skin School's videos come from that artifact's asset store (`v4-school.json`).
