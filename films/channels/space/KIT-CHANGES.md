# Kit changes made for Light Minute episodes 2–6

Rule: in `kits/`, only new files or strictly backward-compatible changes (no change in output for existing
episodes). Prefer the channel's `set/` or the episode folder.

| Date | File | Change | Backward compatible because |
|---|---|---|---|
| 26 Oct | `kits/cinema/film/render.mjs` | New opt-in `--delivery-crf N` for `--assemble`: the x264 CRF of the delivery file | The default stays 19, the old hard-coded value, so any run without the flag encodes exactly as before. Not part of the code hash (the hash covers the scene and its imports), so no resume changes |

New set blocks (channel-local, not kit): `set/beacon.js`, `set/comets.js` (ep02), `set/venus.js` (ep03), `set/moon.js` (ep04).
