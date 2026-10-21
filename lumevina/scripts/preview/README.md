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
