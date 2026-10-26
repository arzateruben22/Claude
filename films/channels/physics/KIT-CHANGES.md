# Kit changes made for Rest Frame episodes 2–6

Every change to `kits/` made while building these episodes, with why and how it stays backward-compatible
(no change in output for existing episodes). Prefer the channel's `set/` or the episode folder.

| Date | File | Change | Backward-compatible because |
|---|---|---|---|
| — | — | Episodes 2–6 needed nothing new from the kit. Episode 2 needed nothing new from the kit: its new block (the pendulum) lives in `set/swing.js` and `set/pendulum.js`, and the spine readout, footnote and card width are done in the scene. | — |
| 2026-10-26 | `kits/cinema/film/render.mjs` | (Withdrawn the same morning.) An optional `--crf N` for the delivery encode was added, then dropped when the coordinating branch's readability pass (`767b57b`, merged here) made every delivery CRF 15 with aq-mode 3 and every chunk CRF 12; the merge took that file as it is upstream. | No change of ours remains in `kits/`. |
