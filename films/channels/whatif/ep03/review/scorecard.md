# Scorecard: Back of the Envelope No. 003, "All the ants" (final)

Measured on the delivered file `out/envelope-003-9x16.mp4` (rendered by the render worker from commit cdad9d3) with
`kits/cinema/film/qa.py` (2 Nov), and on the soundtrack's own QA (`sound/qa.json`), unless noted.

| Gate | Target | Result |
|---|---|---|
| Format | 1080×1920, 30 fps, H.264, AAC | 1080×1920, 30 fps CFR, 2214 frames, H.264 High BT709, AAC 48 kHz stereo 270k, 3.41 Mbps video, 34.1 MB |
| Length | 60–75 s; picture = sound | 73.800 s / 73.800 s |
| Hook | Payoff image at frame 0; question by 2 s | Frame 0: low behind one walking ant on the graph-paper desk, the balance level and almost empty 2.3 m beyond it, the title "All the ants", "a thought experiment", the chip "Back of the Envelope · No. 003". "Ants, or us: who weighs more?" is spoken 0.12–1.66 s |
| Loudness | −14 LUFS, ≤ −1 dBTP on the AAC | **−14.1 LUFS, −1.8 dBTP**, LRA 5.0 LU |
| Voice over music | ≥ 10 LU | 14.1 LU (dialogue −13.6, music −27.6 LUFS while speaking) |
| Phone speaker | mono-safe | Correlation 0.89; mono loss 0.12 dB on the final (0.11 dB in `sound/qa.json`; dialogue 0.07 dB) |
| Sound sync | transients within a frame | 6 kinds, 26 events, all PASS: worst 0 ms (against film.json's cue times; no DOM-measured picture sync was recorded) |
| Flashing | ≤ 3 flashes a second | 0 large-area luminance changes, 0 flashes, worst 0/s (largest changed area 16%) |
| Text in the safe box | x 90–900, y 250–1420 | The final's text audit is on the worker's box, not in this checkout, so `qa.py` had none to read. The last draft's audit (`build/draft/9x16/audit.json`, 1107 frames at 15 fps, rendered 02:38–02:52 just before cdad9d3) has 0 warnings. In the ten stills every caption, label, badge and the spine sit inside the box |
| Beam and subtitle | the beam never crosses the subtitle (round 4 blocker) | Passed in review round 5 on the draft; in the frame-0 and 0.5 s stills the beam sits well below "a thought experiment". Not measured in pixels here |
| Render cost | ≤ 4 h | Not measured: the final was rendered on the worker's box and its log is not here (the 15 fps draft took 14 min 10 s, K avg 2.5, max 6) |

The YouTube version (`out/envelope-003-9x16-youtube.mp4`) through the same `qa.py`: 1440×2560, 30 fps, 2214 frames,
73.800 s, 5.52 Mbps, 53.5 MB; the same loudness, phone and flashing figures. It "fails" only the 1080×1920 format
gate, which is expected for this version. Its sound is the same AAC packets as the final's and as
`sound/envelope-003-mix.m4a` (checked by stream md5).

## Review rounds

Seven lenses, a–g, scored 1–5 by independent draft reviews of `preview-ep03.mp4`. The ratchet: each episode scores
at least what the previous one did (No. 002 finished a4 b4 c4 d4 e5 f4 g4).

1. **Round 1:** a2 b4 c2 d3 e5 f4 g3. 11 findings, including a 7.5/15 Hz flicker in the running sum caused by a
   `spine.js` bug, fixed in the channel set for every episode.
2. **Round 2:** a2 b4 c2 d3 e5 f4 g3. The flicker was gone; the new hook and the "each" shot were unreadable.
3. **Round 3:** a3 b4 c3 d4 e5 f4 g4. A wide, low lens behind a larger ant; the fingertip side-on and labelled; the
   to-scale carpet of your 2.44 million ants.
4. **Round 4:** a4 b4 c4 d4 e5 f4 g4, but blocked twice: the beam crossed the subtitle, and the 49.0–50.2 s rise
   was empty or cropped.
5. **Round 5: PASS**, a4 b4 c4 d4 e5 f4 g4. Fixes: the hook rebuilt as a walking ant 2.3 m in front of a broadside
   balance; the "each" beat as top-down specks, rising until you appear from above, then down to the side view.
   Optional touches applied: a wider angle after the 5.4 s cut and an earlier dot fade.
6. **Final:** QA PASS (above). Ten stills from the delivered file, looked at (`stills-ep03.jpg`).

## Noted, not fixed
- About 0.4 s of motion-blur streaks around 48.9 s as the camera rises over the carpet: the 49.0 s still is the
  whole frame in diagonal streaks under the spine and caption (accepted in round 5).
- A brief top-down pass over the figure's head around 49.4–49.6 s (accepted).
- The loop seam: frame 0 is level and almost empty on purpose; the last frame is tipped, under the end card (accepted).
- The dive to the ant on "count" (64.47–65.77 s) is fast: the 65.2 s still has the balance blurred and the people's
  pan cut by the right edge.
- In the "fifth" shot and the poster the ants' pan is cut by the left edge, and the "∵ weighed as carbon (dry)" badge
  sits over the beam's end.
- The "Heaps not to scale" badge stays on through the fingertip macro (30.3–34.3 s), where nothing is a heap and
  the ant and fingertip are true size.
- The spine says "≈ 2.5 million ants" while the carpet holds 2,439,844 (c6 rounds to the nearest half million).
- The final (cdad9d3) was rendered with a one-seek lag on the camera's near and far planes: an edit had left the
  `updateProjectionMatrix()` after them inside a comment, so each seek used the previous seek's planes. No visible
  effect was found in the stills. Fixed in the code after delivery (the near/far planes now apply on the same seek);
  a re-render would differ only where the camera's distance changes fast.

## Not measured here
- Render cost and the final's text audit (not in this checkout).
- The beam's clearance from the subtitle in pixels.
- Picture sync of sounds against the DOM's first visible frame (`picture_sync` is empty in `sound/qa.json`).
- An entomologist's or ecologist's sign-off: `CLAIMS-REVIEW.md`, `HUMAN-REVIEW.md`.
- A listen on a phone speaker and on headphones.
