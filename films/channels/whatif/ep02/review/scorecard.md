# Scorecard: Back of the Envelope No. 002, "Everyone, one place" (final)

Measured on the delivered file `out/envelope-002-9x16.mp4` (rendered by the render worker from commit f9133c0) with
`kits/cinema/film/qa.py` (2 Nov), and on the soundtrack's own QA (`sound/qa.json`), unless noted.

| Gate | Target | Result |
|---|---|---|
| Format | 1080×1920, 30 fps, H.264, AAC | 1080×1920, 30 fps CFR, 2232 frames, H.264 High BT709, AAC 48 kHz stereo 271k, 4.73 Mbps video, 46.6 MB |
| Length | 60–75 s; picture = sound | 74.400 s / 74.400 s |
| Hook | Payoff image at frame 0; question by 2 s | Frame 0: one blue figure in its chalk half square metre on the graph-paper desk, the title "Everyone, one place", "a thought experiment", the chip "Back of the Envelope · No. 002". "Could we fit in one city?" is spoken 0.12–1.72 s |
| Loudness | −14 LUFS, ≤ −1 dBTP on the AAC | **−14.1 LUFS, −1.5 dBTP**, LRA 4.5 LU |
| Voice over music | ≥ 10 LU | 13.9 LU (dialogue −13.6, music −27.5 LUFS while speaking) |
| Phone speaker | mono-safe | Correlation 0.89; mono loss 0.12 dB (dialogue 0.08 dB) |
| Sound sync | transients within a frame | 6 kinds, 26 events, all PASS: worst 0 ms (against film.json's cue times; no DOM-measured picture sync was recorded) |
| Flashing | ≤ 3 flashes a second | 1 large-area luminance change (frame 1304, 43.47 s: the cut to the planet), 0 flash pairs, worst 0/s (largest changed area 25%) |
| Text in the safe box | x 90–900, y 250–1420 | The final's text audit is on the worker's box, not in this checkout, so `qa.py` had none to read. The reviewed draft's audit (`build/draft/9x16/audit.json`, 1116 frames at 15 fps) has 0 warnings. In the ten stills every caption, label, badge and the spine sit inside the box |
| Tower above cube | the 828 m tip reads above the ~800 m cube | The worker's tip check at 1080: the tower tip and the chalk rule sit 8–17 px above the cube top from 56.5 s on (8–9 px at 58.5–60.0 s, while the cube shows its 806 m bound). Not re-measured here |
| Render cost | ≤ 4 h | Not measured: the final was rendered on the worker's box and its log is not here |

The YouTube version (`out/envelope-002-9x16-youtube.mp4`) through the same `qa.py`: 1440×2560, 30 fps, 2232 frames,
74.400 s, 5.9 Mbps, 57.4 MB; the same loudness, phone and flashing figures. It "fails" only the 1080×1920 format
gate, which is expected for this version. Its sound is the same AAC packets as the final's and as
`sound/envelope-002-mix.m4a` (checked by stream md5).

## Review rounds

Seven lenses, a–g, scored 1–5 by independent draft reviews of `preview-ep02.mp4`.

1. **Round 1.** 10 findings (`PRODUCTION.md`): the cube read taller than the tower through perspective, a stale
   running sum, the work card over the cube, three pops, a flash cutting to the globe, a flat field, label
   collisions. All fixed. Scores were not recorded for this round.
2. **Round 2:** a3 b4 c3 d4 e5 f4 g4. 5 findings left plus a new one (the cube too small). Fixes included people
   gathering round you from frame 0, a textured crowd field, a short work card, and the cube's front face beside
   the tower.
3. **Round 3:** a4 b4 c3 d4 e5 f4 g4. For lens c, a slow orbit over the crowd from 21 to 43 s.
4. **Round 4:** a4 b4 c4 d4 e5 f4 g4, but blocked: the cube read as taller than the tower.
5. **Round 5: PASS**, a4 b4 c4 d4 e5 f4 g4. Fixes: a chalk 828 m rule from the tower's tip over the cube, a blunter
   needle tip (16 m), the work card clear of the tip, and the takeaway keeping the square's edges in view before
   one dive to the figure.
6. **Final:** QA PASS (above). Ten stills from the delivered file, looked at (`stills-ep02.jpg`).

## Noted, not fixed
- The tower's tip clears the cube by only 8–9 px at 1080 while the work card shows the 806 m bound (58.5–60.0 s);
  the chalk rule carries the comparison there.
- The badge "true sizes · tower drawn wider" appears from 43.43 s, over the planet shot, about 3 s before the tower
  and cube are on screen.
- Greater London is drawn as a square of its area (1,572 km²), not its outline.
- The spine's "≈ 2,100 km²" at 4 per m² is 2,050 rounded half up; it has no row of its own in `claims.json`.
- The script's end-card line and some beat notes describe an earlier version (see README and `HUMAN-REVIEW.md`).

## Not measured here
- Render cost and the final's text audit (not in this checkout).
- The tip clearance in pixels (the worker's figures, quoted above).
- Picture sync of sounds against the DOM's first visible frame (`picture_sync` is empty in `sound/qa.json`).
- A demographer's or physicist's sign-off: `CLAIMS-REVIEW.md`, `HUMAN-REVIEW.md`.
- A listen on a phone speaker and on headphones.
