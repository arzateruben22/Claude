# Scorecard: Light Minute No. 003, "Venus day" (final)

Measured on the delivered file `out/lightminute-003-9x16.mp4` by `kits/cinema/film/qa.py` and `scorecard.py`, unless noted.

| Gate | Target | Result |
|---|---|---|
| Format | 1080×1920, 30 fps, H.264, AAC | 1080×1920, 30 fps CFR, 2240 frames, H.264 High BT709, AAC 48 kHz stereo 263k, 2.53 Mbps video, 26.1 MB |
| Hook | Payoff image at frame 0; question by 2 s | Frame 0: Venus close, half lit, the teal meridian (where "you" stand) at the dawn line, the spine asking "one turn on Venus · days ?". "Can one day outlast a year?" is spoken by 1.79 s |
| Length | 60–75 s; picture = sound | 74.667 s / 74.667 s |
| Loudness | −14 LUFS, ≤ −1 dBTP on the AAC | **−14.1 LUFS, −1.8 dBTP**, LRA 2.0 LU |
| Voice over music | ≥ 10 LU | 12.3 LU (dialogue −14.2, music −26.5 LUFS while speaking) |
| Phone speaker | mono-safe | Correlation 0.75; mono loss 0.46 dB (dialogue 0.09 dB) |
| Sound sync | transients within a frame | 7 kinds, 39 events, all PASS: transients worst 1 ms; slow swells (section) worst 58.1 ms |
| Labels vs picture | sound on the first visible frame | 7/7 exact (DOM-measured first visible frame) |
| Text in the safe box | x 90–900, y 250–1420 | Render audit: 0 warnings in each of the 8 chunk runs (the whole film); every label, counter, note and caption page checked at its middle and ends (169 moments): none outside the box, none on other text |
| Flashing | ≤ 3 flashes a second | 0 large-area luminance changes (frames none), 0 flash pairs, worst 0/s |
| Determinism | resumable, byte-stable | 8 chunks, every frame's sha256 checked against its log before encoding |
| Render cost | ≤ 4 h | 0.6 h for 2240 frames (0.93 s/frame, K avg 3.0, max 12) |

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
4. **Recheck (26 Oct; the owner asked for every episode to be rechecked and re-rendered).** Two passes: my own stills
   at phone size, then an independent frame review of the delivered cut (27 findings, each checked against the frames
   and the code). Fixed: the Sun popped in and out as a flat white disc on every move (it now shrinks away at full
   brightness with the camera's follow); the "backwards" arrow was tied to the spinning pin and swung round behind
   Venus within a second (it now faces the camera, in ice: lilac is gravity's); the guess labels spun across Venus's
   face and repeated the spine (removed; the spine says "guess · one turn = one year"); the radar beat was a frozen
   frame (a ping now goes out, reaches Venus on "pierced" and its echo heads home); the push into the clouds now lands
   on "lid of cloud"; the diagram was framed so large that Earth sat on the spine (smaller, higher, and it turns slowly
   through the whoa); "rising in the west" had no picture (a "your sky on Venus" dial: the Sun rises at W); the readout's
   ring grows out from the Sun and the round trip runs as a ping; the spine holds "1962" and "243 > 225" where it was
   empty; speed notes in words ("1,000,000× faster", not a superscript 10⁶); Venus's clouds baked at 2,048 px; Earth
   labelled on "On Earth" and hidden under the end card; captions keep number phrases together. Fresh final 04:57–05:31
   UTC, 26 Oct; QA PASS.

## Not measured here
- An astronomer's sign-off: `review/CLAIMS-REVIEW.md` and `HUMAN-REVIEW.md`. A listen on a phone and headphones.
5. **Draft review, two rounds, and a fresh final (26 Oct):** an independent two-lens review of a draft cut (text/layout
   and picture), every finding verified by a second agent: 41 confirmed in round 1 (the "your sky" dial moved and
   flattened, "clouds: drawn", the radar framing, the readout push), 27 in round 2. A real bug fixed: the "you" label
   never showed (its end cue matched the first "the"). The orbit's clock now runs so that the dial's Sun is up in the
   west on "west" and on the poster frame; "a sunrise" clear of Earth and Venus; the 1962 radar ping noted "light sped
   up"; the readout's round trip is the brightest teal (the pin off); both guesses struck through on the spine; a drawn
   cloud marking turns with the planet (noted: the real cloud tops circle Venus in about four days).
   Stills at 1080 after each round; every label, counter, note and caption page checked at its
   middle and ends (169 moments): clean. Rendered in 10 s chunks, 20:54–21:21 UTC on 26 Oct and 01:58–02:18 UTC on 27 Oct
   (paused by the owner in between; the kept frames resumed); QA PASS.
