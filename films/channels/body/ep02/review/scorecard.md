# Scorecard: Meanwhile, Inside No. 02, "A billion passengers" (final)

Measured on the delivered file `out/meanwhile-inside-002-9x16.mp4` by `kits/cinema/film/qa.py` and `scorecard.py`, unless noted.
The delivered file carries the written-number captions (27 Oct: "Room for about / 1 billion passengers.", "hemoglobin:
about / 270 million copies."): chunks 0 and 1 were rendered again with them and the sound copied untouched from the
previous master, so the sound rows are unchanged.

| Gate | Target | Result |
|---|---|---|
| Format | 1080×1920, 30 fps, H.264, AAC | 1080×1920, 30 fps CFR, 2184 frames, H.264 High BT709, AAC 48 kHz stereo 262k, 2.75 Mbps video, 27.5 MB |
| Length | 60–75 s; picture = sound | 72.800 s / 72.800 s |
| Hook | Payoff image at frame 0; question by 2 s | Frame 0: the cut-open red cell packed with hemoglobin, one O₂ boarding at the cut (labelled), the title "A billion passengers", "not to scale". "What's this cell carrying?" is spoken by 1.5 s |
| Loudness | −14 LUFS, ≤ −1 dBTP on the AAC | **−14.1 LUFS, −1.9 dBTP**, LRA 2.9 LU |
| Voice over music | ≥ 10 LU | 15.8 LU (dialogue −13.4, music −29.2 LUFS while speaking) |
| Phone speaker | mono-safe | Correlation 0.89; mono loss 0.07 dB (dialogue 0.09 dB) |
| Sound sync | transients within a frame | 13 kinds, 50 events, all PASS: transients worst 9 ms; slow swells (breath, diffuse, dissolve, section, swell) worst 47 ms |
| Labels vs picture | sound on the first visible frame | 16/16 exact (DOM-measured first visible frame) |
| Text in the safe box | x 90–900, y 250–1420 | Render audit: 0 warnings over all 2184 frames (the first run), over the re-rendered 1200–1499, and over 0–599 (the caption fix) |
| Flashing | ≤ 3 flashes a second | 5 large-area luminance changes (frames 745, 1199, 1201, 1344, 1967), 3 flash pairs, worst 2/s |
| Determinism | resumable, byte-stable | 8 chunks, every frame's sha256 checked against its log before encoding |
| Render cost | ≤ 4 h | 2.5 h for 2184 frames (4.19 s/frame, K avg 3.8, max 12) |

## Review rounds
1. **Script review** (independent, before voicing): 6/10. Fixed: "land faster" → "easier" (cooperativity is affinity,
   not speed); "every iron grips" → "each can hold"; "they board" → "the empty seats fill" (returning blood is still
   about 75% loaded); "fuel gauge" → "passenger count"; the tease hedged to the fastest fibres; the whoa escalates to
   the body's loop instead of repeating the hook's billion.
2. **Voiced lint**: bf_emma voiced one sentence at a time (a speed per sentence, measured pauses) so every line sits
   at 2.5–3.0 words a second and the hook's question ends at 1.5 s. 0 errors before and after voicing.
3. **Picture rules** (WRITING.md, merged mid-build): the spine readout, the body locator, the loop to frame 0, the
   end-card fact, the score's build and drop; rule 8 ("one line wins"): speed notes top left, standing cheats top
   right.
4. **Visual review** (four lenses: motion, layout, graphics, honesty; each finding adversarially verified): the colour
   now follows the load on every docking (no "4 of 4" over a dark molecule); returning blood drawn darker red, not
   empty; the light rays rebuilt over the vein in true light colours (never the blood pink) with the vein swallowing
   the red; the meanwhile changes the picture (real speed, a pull-back); the readouts and labels moved clear of the
   badges and point at what they name; the backdrop's centre colour fixed (`set/look.js`).
5. **Captions**: the balanced pager (opt-in kit change) ends the one-word tails; no kept phrase is split.
6. **Fact-check audit** (independent, 26 Oct): "Your veins look blue" → "Veins often look blue" (re-voiced; the other
   seven takes came back byte-identical); the badges and end-card fact it asked for were already on screen.
7. **Final-tier stills**: ten frames from the delivered file, each looked at (`stills-ep02.jpg`; taken again from the
   caption-fixed file, where the changed captions read cleanly).
8. **Final**: one run, 2.5 h. The stills then showed the "air sac" label sliding under the "Not to scale" badge at 43.6–44.9 s as the push-in carried its anchor off the top: the label now shows from "blood" to just after "lungs" (re-mixed: its tick sits in the lung swell, which the sync check now measures in the tick's own band), and only the 40–50 s chunk was re-rendered and re-assembled.

## Noted, not fixed
- The delivered file mixes two builds by design: the 40–50 s chunk was rendered after the air-sac label's times changed
  (`--force-mixed`); every other frame is from the first run, and nothing else in `film.json` differs between them.
- The skin shot is an illustration of light paths (badged): the rays start above the skin's surface so their bounce
  reads at phone size.

## Not measured here
- A physiologist's sign-off on the claims and pictures: `CLAIMS-REVIEW.md`, `HUMAN-REVIEW.md`.
- A listen on a phone speaker and on headphones.
