# Kit changes made for Rest Frame episodes 2–6

Every change to `kits/` made while building these episodes, with why and how it stays backward-compatible
(no change in output for existing episodes). Prefer the channel's `set/` or the episode folder.

| Date | File | Change | Backward-compatible because |
|---|---|---|---|
| — | — | Episodes 2–5 needed nothing new from the kit until the HD pass. Episode 2 needed nothing new from the kit: its new block (the pendulum) lives in `set/swing.js` and `set/pendulum.js`, and the spine readout, footnote and card width are done in the scene. | — |
| 2026-10-26 | `kits/cinema/film/render.mjs` | New optional `--crf N` flag for the delivery encode (`--assemble`, and the assemble step at the end of a full render). Lower is higher quality; with N < 19 the VBV cap rises from 12M/24M to 24M/48M so the lower CRF isn't throttled. Used at 16 for the Rest Frame deliveries: the films are flat paper and thin ink lines, which x264 at CRF 19 smears a little on the 1080×1920 delivery (chunks are already CRF 15). | Without the flag the arguments are exactly as before (`-crf 19 -maxrate 12M -bufsize 24M`), so every existing episode's encode is unchanged. |
