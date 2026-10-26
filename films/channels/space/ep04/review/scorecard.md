# Scorecard: Light Minute No. 004, "The falling Moon" (final)

Measured on the delivered file `out/lightminute-004-9x16.mp4` by `kits/cinema/film/qa.py` and `scorecard.py`, unless noted.

| Gate | Target | Result |
|---|---|---|
| Format | 1080×1920, 30 fps, H.264, AAC | 1080×1920, 30 fps CFR, 2224 frames, H.264 High BT709, AAC 48 kHz stereo 261k, 1.44 Mbps video, 15.9 MB |
| Hook | Payoff image at frame 0; question by 2 s | Frame 0: the Moon a minute below its straight line, the fall labelled "a minute's fall ×1,000,000", the spine "4.9 m" below its straight line in one minute. "What's holding the Moon up?" is spoken by 1.71 s |
| Length | 60–75 s; picture = sound | 74.133 s / 74.133 s |
| Loudness | −14 LUFS, ≤ −1 dBTP on the AAC | **−14.1 LUFS, −1.8 dBTP**, LRA 2.3 LU |
| Voice over music | ≥ 10 LU | 12.5 LU (dialogue −14.1, music −26.6 LUFS while speaking) |
| Phone speaker | mono-safe | Correlation 0.77; mono loss 0.44 dB (dialogue 0.09 dB) |
| Sound sync | transients within a frame | 6 kinds, 32 events, all PASS: transients worst 3 ms; slow swells (body.vanish, section) worst 57 ms |
| Labels vs picture | sound on the first visible frame | 14/14 exact (DOM-measured first visible frame) |
| Text in the safe box | x 90–900, y 250–1420 | Render audit: 0 warnings over 2224 frames |
| Flashing | ≤ 3 flashes a second | 0 large-area luminance changes (frames none), 0 flash pairs, worst 0/s |
| Determinism | resumable, byte-stable | 8 chunks, every frame's sha256 checked against its log before encoding |
| Render cost | ≤ 4 h | 0.5 h for 2224 frames (0.84 s/frame, K avg 3.7, max 24) |

## Review rounds
1. **Script:** an independent review (retention 6/10): the hook contradicted the takeaway, the normal was two raw stats,
   the change gave away the why, "divide by thirty-six hundred" was homework, the takeaway restated the hook. Fixed:
   "What's holding the Moon up? Nothing. It's falling.", "about thirty Earths away", "Gravity bends it back toward us.
   Every moment, all the way round.", Aristotle's two realms and Newton's one-minute framing, "So the pull that drops an
   apple is the very same pull that holds the Moon", "You always see the Moon that late".
2. **Picture:** at true scale the Moon was under two pixels in the diagram (hollow marker rings added, claiming no
   size); the straight line ran through the title (the close view turned so it runs across the frame, the fall
   pointing down); the Moon passed through the notes and the spine (the diagram's clock slowed to 20,000× so it stays at
   the frame's right); the hook's badge clipped the title (now a label on the gap). 18 final-tier stills,
   `review/stills-ep04.jpg`.
3. **Final:** rendered 03:16–03:47 UTC, 26 Oct; QA PASS.
4. **Recheck, script audit and a fresh final (26 Oct):** a real bug fixed (the gravity-off beat never played: its cue
   matched the first "gravity"); the coordinating session's script audit applied ("So it falls, and always misses.",
   "Newton, the story goes…", "Gravity fades with distance squared: thirty-six hundred times weaker.", "…keeps the Moon
   falling."; Conduitt's account as the apple's source) and re-voiced; in the whoa an apple's first second falls beside
   the Moon's minute, both drawn ×1,000,000; the readout's ring grows at the real speed of light; the takeaway's diagram
   sits higher so the orbit clears the spine's label, and its labels wait for the pull-back to settle. Every text was
   also checked against the safe box and for overlaps at each counter's, label's and note's middle (141+ moments,
   not only the shots' settled ones): clean. Rendered 06:00–06:33 UTC, 26 Oct; QA PASS.
