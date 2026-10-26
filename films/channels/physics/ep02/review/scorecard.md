# Scorecard: Rest Frame No. 002, "The swing's secret" (final)

Measured on the delivered file `out/rest-frame-002-9x16.mp4` by `kits/cinema/film/qa.py` and `scorecard.py`, unless noted.

| Gate | Target | Result |
|---|---|---|
| Format | 1080×1920, 30 fps, H.264, AAC | 1080×1920, 30 fps CFR, 2152 frames, H.264 High BT709, AAC 48 kHz stereo 259k, 2.16 Mbps video, 21.7 MB |
| Length | 60–75 s; picture = sound | 71.733 s / 71.733 s |
| Hook | Payoff image at frame 0; question by 2 s | Frame 0: both swings just before the bottom, ghosts trailing, the title in the air. "Which swing gets back first?" is spoken by 1.8 s |
| Loudness | −14 LUFS, ≤ −1 dBTP on the AAC | **−14.1 LUFS, −1.9 dBTP**, LRA 3.9 LU |
| Voice over music | ≥ 10 LU | 21.3 LU (dialogue −13.8, music −35.1 LUFS while speaking) |
| Phone speaker | mono-safe | Correlation 0.96; mono loss −0.14 dB (dialogue 0.06 dB) |
| Sound sync | transients within a frame | 12 kinds, 86 events, all PASS: transients worst 0.7 ms; slow swells (reveal, section, swell, time.normal, time.slow) worst 0 ms |
| Labels vs picture | sound on the first visible frame | 15/15 exact (DOM-measured first visible frame) |
| Text in the safe box | x 90–900, y 250–1420 | Render audit: 0 warnings over 2152 frames |
| Flashing | ≤ 3 flashes a second | 0 large-area luminance changes (frames none), 0 flash pairs, worst 0/s |

## Review rounds
1. **Script review** (independent, before voicing): 7/10. Fixed: "nearly right" limited to small swings; the
   pull is *almost* three times stronger (2.88); "nearly the same time" (the why no longer argues for exact
   equality); "the big swing" for the 1/60; the takeaway reframed ("A wider swing just moves faster: almost fast
   enough"); the tease. The Fourth Day's 80° vs 5° passage was not used (search excerpts disagreed).
2. **Voiced lint**: af_bella at 1.0 ran short lines at 3.1–4 words a second; four lines were rewritten (full stops,
   longer words) until every line was at or under 3.0. 0 errors before and after voicing.
3. **Picture rules** (WRITING.md, merged mid-build): spine readout, grandfather-clock anchor, continuous camera moves,
   the loop to frame 0, the end-card footnote, the score's build and drop.
4. **Animatic rounds** (five): the back lane was inside the cyc wall (rig moved 30 cm forward); the hook's speed note
   moved bottom-right off the title; labels and cards kept off the spine (card max width, shorter tags); the bobs
   enlarged and the ghosts made beads so the spacing reads; "same moments" re-anchored to the second "same".
5. **Ten final-tier stills** (`stills-ep02.jpg`), each looked at: the spine's label crossed the beam line, fixed
   with a light plate behind the counter.
6. **Final**: one run, 41.5 min, no restarts.

## Noted, not fixed
- The tease's last caption page overlaps the end card's lower lines for 0.35 s while the card fades in
  (captions sit above the end card by design, as in episode 1).
- In the whoa's ×10 stretch each pendulum makes about one swing every 3 frames; with motion blur it reads as a
  shimmer of the wave pattern. It is badged "10× faster".

## Not measured here
- A physicist's sign-off on the claims and pictures: `CLAIMS-REVIEW.md`, `HUMAN-REVIEW.md`.
- A listen on a phone speaker and on headphones.
