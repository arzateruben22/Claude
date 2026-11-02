# Reference maps: sources and licences (look-dev pass, 2 Nov)

Only public-domain or CC0 images. Fetched from the scikit-image sample-data mirrors (the library's registry
checksums match), because Wikimedia, CDC PHIL and NIH hosts are blocked by this environment's network policy:
**a person should confirm each licence on the original page before posting.**

| File | What | Original | Licence (as stated by the source) | sha256 |
|---|---|---|---|---|
| `skin-he-10x.jpg` | Normal epidermis and dermis (with a benign intradermal nevus), H&E, 10x | https://commons.wikimedia.org/wiki/File:Normal_Epidermis_and_Dermis_with_Intradermal_Nevus_10x.JPG (author Kilbad); mirrored at gitlab.com/scikit-image/data | public domain, released by the author (scikit-image `data.skin()` docs; the file's embedded comment names the Commons page) | 8759fe08…2075 |
| `cell-qpi.png` | A cell floating in saline, quantitative phase image | Müller, Schürmann, Girardo, Cojoc, Guck, Optics Express 2018; scikit-image `data.cell()` | CC0 (scikit-image docs) | 8d23a7fb…1515 |

`textures.js` embeds resized crops of both (no other edits). The films grade them only through lighting.
