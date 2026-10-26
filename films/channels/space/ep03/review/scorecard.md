# Scorecard: Light Minute No. 003, "Venus day" (final)

Measured on the delivered file `out/lightminute-003-9x16.mp4` by `kits/cinema/film/qa.py` and `scorecard.py`, unless noted.

| Gate | Target | Result |
|---|---|---|
| Format | 1080×1920, 30 fps, H.264, AAC | 1080×1920, 30 fps CFR, 2240 frames, H.264 High BT709, AAC 48 kHz stereo 262k, 1.06 Mbps video, 12.4 MB |
| Hook | Payoff image at frame 0; question by 2 s | Frame 0: Venus close, half lit, the teal pin ("you") at the dawn line, the spine asking "one turn on Venus: ? days". "Can one day outlast a year?" is spoken by 1.79 s |
| Length | 60–75 s; picture = sound | 74.667 s / 74.667 s |
| Loudness | −14 LUFS, ≤ −1 dBTP on the AAC | **−14.1 LUFS, −1.7 dBTP**, LRA 2.0 LU |
| Voice over music | ≥ 10 LU | 12.3 LU (dialogue −14.2, music −26.5 LUFS while speaking) |
| Phone speaker | mono-safe | Correlation 0.75; mono loss 0.49 dB (dialogue 0.08 dB) |
| Sound sync | transients within a frame | 7 kinds, 36 events, all PASS: transients worst 33 ms; slow swells (section) worst 58.1 ms |
| Labels vs picture | sound on the first visible frame | 10/10 exact (DOM-measured first visible frame) |
| Text in the safe box | x 90–900, y 250–1420 | Render audit: 0 warnings over 2240 frames (the first full render, 25 Oct); the re-rendered chunk 001: 0 warnings over its 300 frames |
| Flashing | ≤ 3 flashes a second | 0 large-area luminance changes (frames none), 0 flash pairs, worst 0/s |
| Determinism | resumable, byte-stable | 8 chunks, every frame's sha256 checked against its log before encoding |
| Render cost | ≤ 4 h | 0.5 h for 2240 frames (0.81 s/frame, K avg 3.7, max 12) |

Notes on the numbers:
- **Chunk 001 (10–20 s) was re-rendered** after the first assembly (`--force-mixed`, recorded in the render manifest).
  The contact sheet showed the camera dollying straight at the Sun for 2.4 s before its push into Venus (a white disc
  over a third of the frame at 14 s). The fix holds the diagram until the push starts (a camera key in `compile.py`).
  It changes `film.json`'s camera between 11.45 and 15.47 s only, so the other seven chunks are exactly what the new
  code renders; the sound was not re-made (only two labels' pans in that span move, by a few pixels).
- **Flashing:** the largest changed area is 3%.

## Review rounds
1. **Script:** an independent review (retention 6/10) found "blurry cloud markings" overstated (the old markings were
   mostly illusory), Schiaparelli's "said others" a single 1890 proposal, a takeaway that answered the hook "no", a
   tease that misled ("the Moon is falling toward us"; it recedes 3.8 cm a year) and a dead "nearly Earth's size" line.
   Fixed: "faint smudges in those clouds", the Cassinis and Schiaparelli named, "So yes: one turn outlasts a year. But
   the day you'd live by is the Sun coming back", "the Moon never stops falling toward us", "you see the Sun rise".
2. **Picture:** first stills: Venus cropped under the title, labels on the speed note, the readout on the tags, the
   Sun filling the close view's corner, the "backwards" arrow edge-on. All fixed (16 final-tier stills,
   `review/stills-ep03.jpg`). After the final: the Sun dolly at 14 s (above).
3. **Final:** rendered 22:52–23:23 UTC, 25 Oct; chunk 001 again 03:04–03:09 UTC, 26 Oct; QA PASS.

## Not measured here
- An astronomer's sign-off: `review/CLAIMS-REVIEW.md` and `HUMAN-REVIEW.md`. A listen on a phone and headphones.
