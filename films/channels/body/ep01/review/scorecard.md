# Scorecard: Meanwhile, Inside No. 01, "Single file" (final)

Measured on the delivered file `out/meanwhile-inside-001-9x16.mp4` by `kits/cinema/film/qa.py` and `scorecard.py`, unless noted.

| Gate | Target | Result |
|---|---|---|
| Format | 1080×1920, 30 fps, H.264, AAC | 1080×1920, 30 fps CFR, 2148 frames, H.264 High BT709, AAC 48 kHz stereo 262k, 3.84 Mbps video, 36.8 MB |
| Length | 60–75 s; picture = sound | 71.600 s / 71.600 s |
| Hook | Payoff image at frame 0; question by 2 s | Frame 0: the red cell folded into a parachute in a capillary, the title "Single file", the speed note. "Why is this cell folded?" is spoken by 1.6 s |
| Loudness | −14 LUFS, ≤ −1 dBTP on the AAC | **−14.1 LUFS, −2.4 dBTP**, LRA 2.8 LU |
| Voice over music | ≥ 10 LU | 15.9 LU (dialogue −13.5, music −29.3 LUFS while speaking) |
| Phone speaker | mono-safe | Correlation 0.88; mono loss 0.11 dB (dialogue 0.09 dB) |
| Sound sync | transients within a frame | 12 kinds, 33 events, all PASS: transients worst 9 ms; slow swells (breath, diffuse, dissolve, section, swell) worst 57.5 ms |
| Labels vs picture | sound on the first visible frame | 8/8 exact (DOM-measured first visible frame) |
| Text in the safe box | x 90–900, y 250–1420 | Render audit: 0 warnings over 2148 frames |
| Flashing | ≤ 3 flashes a second | 5 large-area luminance changes (frames 669, 671, 1291, 1537, 1945), 3 flash pairs, worst 1/s |
| Determinism | resumable, byte-stable | 8 chunks, every frame's sha256 checked against its log before encoding |
| Render cost | ≤ 4 h | 2.8 h for 2148 frames (4.72 s/frame, K avg 3.8, max 16) |

## Review rounds
1. **Script review** (independent, before voicing v2, 24 Oct): the story standard's fixes (the wrong idea "it stretches",
   the stakes, the nucleus, the billion-passenger tease).
2. **Voiced lint**: bf_emma one sentence at a time (a speed per sentence, measured pauses); every line 2.66–2.99
   words a second; the hook's question spoken by 1.6 s. 0 errors before and after voicing.
3. **Fact-check audit** (independent, 26 Oct; each finding adversarially verified): five fixes, all applied —
   "its surface stretches", "about seven and a half micrometers", "The tightest vessels", the takeaway re-written so
   its button follows ("Sickle cells lose the disc shape…"; new c17), and a sickle cell on screen. Four lines re-voiced;
   the other four takes came back byte-identical.
4. **The coordinating session's own pass on the same audit**, merged: the spring back lands on "disc shape", the O₂
   label lands on "out", scale pills show text alone where the HUD would clamp their bar, c3 scoped to mouse cells.
5. **Independent check of the fixes** (two agents: text and claims; scene code): the sickle cell's label and badge
   were mistimed (fixed: on screen while the crescent is), the crescent was too shallow to read or to block the lumen
   (bent deeper: it now wedges across 4.6 of the 5.2 µm), its placement depended on the previous seek (now a pure
   function of t, the queue eased), three caption keep phrases could never fit a row (trimmed), c17's claim scoped to
   its study.
6. **First looks** (24 frames at the finish): three notes stacked in one corner while the sickle cell was on screen
   (rule 8: at most two): merged into "illustration · not to scale".
7. **Final-tier stills**: ten frames from the delivered file, each looked at (`stills-ep01.jpg`).
8. **Final**: one run, 2.8 h (the episode's first full-resolution render; v1 and v2 were delivered as draft previews).

## Noted, not fixed
- The film runs slowed throughout (the clock's "100× slower" note; "10× slower" on the ride-along), as v2 did: at real
  speed a capillary's cells cross the frame in a few frames.
- The "7.5 µm" pill in the meet close-up shows its text alone: a true 7.5 µm bar there is wider than the HUD allows.
- No end-card fact: the picture rules (WRITING.md, from episode 2 on) were not retro-fitted to episode 1.

## Not measured here
- A physiologist's sign-off on the claims and pictures: `CLAIMS-REVIEW.md`, `HUMAN-REVIEW.md`.
- A listen on a phone speaker and on headphones.
