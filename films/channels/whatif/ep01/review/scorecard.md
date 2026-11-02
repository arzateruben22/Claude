# Scorecard: Back of the Envelope No. 001, "Through the Earth" (final)

Measured on the delivered file `out/envelope-001-9x16.mp4` (rendered by the render worker from commit bf7edce) with
`kits/cinema/film/qa.py` (2 Nov), and on the soundtrack's own QA (`sound/qa.json`) through `scorecard.py`, unless noted.

| Gate | Target | Result |
|---|---|---|
| Format | 1080×1920, 30 fps, H.264, AAC | 1080×1920, 30 fps CFR, 2232 frames, H.264 High BT709, AAC 48 kHz stereo 271k, 2.43 Mbps video, 25.2 MB |
| Length | 60–75 s; picture = sound | 74.400 s / 74.400 s |
| Hook | Payoff image at frame 0; question by 2 s | Frame 0: the cutaway Earth with its tunnel, the figure labelled "you" at the rim, the title "Through the Earth", "thought experiment". "How long to fall through the Earth?" is spoken 0.1–1.69 s |
| Loudness | −14 LUFS, ≤ −1 dBTP on the AAC | **−14.1 LUFS, −1.6 dBTP**, LRA 4.1 LU |
| Voice over music | ≥ 10 LU | 13.1 LU (dialogue −13.6, music −26.7 LUFS while speaking) |
| Phone speaker | mono-safe | Correlation 0.88; mono loss 0.2 dB (dialogue 0.07 dB) |
| Sound sync | transients within a frame | 8 kinds, 33 events, all PASS: worst 1 ms (against film.json's cue times; no DOM-measured picture sync was recorded) |
| Flashing | ≤ 3 flashes a second | 0 large-area luminance changes, 0 flash pairs, worst 0/s (largest changed area 6%) |
| Text in the safe box | x 90–900, y 250–1420 | The render worker's text audit is not in this checkout, so `qa.py` had none to read. The worker's QA flagged one counter at 13.6 s (fixed, below) and passed the re-render. Spot check here: at 13.6 and 14.5 s the counters sit inside the box |
| Render cost | ≤ 4 h | Not measured: the final was rendered on the worker's box and its log is not here |

## Review rounds
1. **Draft review, round 1** (independent, 30 Oct; `REVIEW-ROUND1.md`): `preview-ep01.mp4` (540×960) in two lenses,
   text and layout, picture and story. 10 confirmed findings, all fixed: the globe cut off and the gravity graph
   outside the safe box; the jump hidden under the top bar; the spine label without a plate (1.3:1); "100 km/h" on
   the spine label; a one-frame camera pop at 13.8 s; one-word caption pages; picture behind or ahead of the voice;
   clipped source voice files (re-voiced, same timing); "on the way up" while the figure moves down; the "≈ core"
   label. The "No. 002" end-card chip was kept and noted for the human review. Numbers, badges, sound and loop passed.
2. **Delivery QA failure at 13.6 s.** The render worker's QA found a riding counter outside the safe box. Fixed by
   clamping the counters' ride so the widest plate stays inside (3074965); re-render job sent.
3. **Flicker fix.** `set/spine.js` passed `undefined` to `classList.toggle`, which toggled the lit class every
   frame: a 7.5/15 Hz colour flicker on running-sum states without a box. Found during the ep03 review; fixed in
   bf7edce (`motif.js` given the same guard), and the final was re-rendered from that commit. `qa.py`'s flash gate
   would not catch it (small area). Checked here: the running-sum band shows no frame-to-frame alternation over
   10–13, 28.5–31.5 and 36–39 s; only single changes where the sum changes.
4. **Final:** QA PASS (above). Ten stills from the delivered file, looked at (`stills-ep01.jpg`).

**Compelling pass:** not scored for this episode. The seven-lens compelling pass started after ep01's round 1, and
`REVIEW-ROUND1.md` has no scores. The coordinator's note (`PRODUCTION.md`) was that the middle stays on one
composition too long; that lesson went into No. 002 and later episodes.

## Noted, not fixed
- The middle (26–61 s) holds one composition, the cutaway Earth, through three beats.
- The end-card chip says "No. 002" (the next episode); the script's end-card line says "No. 001".
- The end-card footnote is small; read it on a phone.
- Some ledger notes quote earlier wordings or a label that is no longer on screen (c6, c7, c10, c13; see README).

## Not measured here
- Render cost and the worker's text audit (not in this checkout).
- Picture sync of sounds against the DOM's first visible frame (`picture_sync` is empty in `sound/qa.json`).
- The YouTube 1440 version beyond its probe (1440×2560, 2232 frames, 74.4 s, sound copied).
- A physicist's sign-off: `CLAIMS-REVIEW.md`, `HUMAN-REVIEW.md`.
- A listen on a phone speaker and on headphones.
