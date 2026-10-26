# Kit changes made for Light Minute episodes 2–6

Rule: in `kits/`, only new files or strictly backward-compatible changes (no change in output for existing
episodes). Prefer the channel's `set/` or the episode folder.

| Date | File | Change | Backward compatible because |
|---|---|---|---|
| 26 Oct | `kits/cinema/film/render.mjs` | New opt-in `--delivery-crf N` for `--assemble`: the x264 CRF of the delivery file | The default follows the kit's own delivery encode (15 with aq-mode 3 since the readability pass merged on 26 Oct; it was 19 before), so a run without the flag encodes exactly as the kit does. Not part of the code hash (the hash covers the scene and its imports), so no resume changes |
| 26 Oct | `kits/cinema/sci/hud.js` | Labels take `v: "below"` (the pill hangs under its anchor, 12 px down), beside "above" (default) and "middle" | A new value only: "above" and every other value behave exactly as before, and no existing episode uses "below" |

New set blocks (channel-local, not kit): `set/beacon.js`, `set/comets.js` (ep02), `set/venus.js` (ep03), `set/moon.js` (ep04).
