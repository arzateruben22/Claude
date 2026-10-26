# Scorecard: Rest Frame No. 002, "The swing's secret" (final)

Measured on the delivered file `out/rest-frame-002-9x16.mp4` by `kits/cinema/film/qa.py` and `scorecard.py`, unless noted.

| Gate | Target | Result |
|---|---|---|
| Format | 1080×1920, 30 fps, H.264, AAC | 1080×1920, 30 fps CFR, 2184 frames, H.264 High BT709, AAC 48 kHz stereo 259k, 3.65 Mbps video, 35.7 MB |
| Length | 60–75 s; picture = sound | 72.800 s / 72.800 s |
| Hook | Payoff image at frame 0; question by 2 s | Frame 0: both swings just before the bottom, ghosts trailing, the title in the air. "Which swing gets back first?" is spoken by 1.8 s |
| Loudness | −14 LUFS, ≤ −1 dBTP on the AAC | **−14.1 LUFS, −1.9 dBTP**, LRA 3.7 LU |
| Voice over music | ≥ 10 LU | 21.3 LU (dialogue −13.8, music −35.1 LUFS while speaking) |
| Phone speaker | mono-safe | Correlation 0.96; mono loss −0.13 dB (dialogue 0.05 dB) |
| Sound sync | transients within a frame | 12 kinds, 85 events, all PASS: transients worst 0.7 ms; slow swells (reveal, section, swell, time.normal, time.slow) worst 0 ms |
| Labels vs picture | sound on the first visible frame | 15/15 exact (DOM-measured first visible frame) |
| Text in the safe box | x 90–900, y 250–1420 | Render audit: 0 warnings over 2184 frames |
| Flashing | ≤ 3 flashes a second | 0 large-area luminance changes (frames none), 0 flash pairs, worst 0/s |
| Determinism | resumable, byte-stable | 8 chunks, every frame's sha256 checked against its log before encoding |
| Render cost | ≤ 4 h | 0.6 h for 2184 frames (0.97 s/frame, K avg 3.6, max 12) |

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
6. **The 25 Oct final**: one run, 41.5 min, no restarts (QA PASS); superseded by the 26 Oct passes below.
7. **Recheck pass** (26 Oct, at the user's request): captions break at phrases; the spine readout pinned to the safe
   line, cards narrower; the Harvard tag shortened.
8. **Fact audit** (the coordinating session, 26 Oct): "Pull its twin three times farther… Three times the distance… and
   still, neck and neck" and "Now hang fifteen, each a little shorter. Only length changes. For half a minute, they
   drift apart. Then, just as gradually… back in line" re-voiced (lint 0 errors before and after); c4, c11 and c12
   retitled to Lima & Arun (Am. J. Phys. 74, 892); c6 and c15 repointed; c10 and c17 reworded for the symmetric half-minute; c16 and c17 at 15° (realigned at 60.26 s).
9. **Rule 8, "One line wins"** (an implementer, an independent reviewer and a fixer): the lanes step back by opacity
   0.70 (a third of their contrast on screen; 0.33 had kept a tenth) and 0.50 under the ghost ladders; the clock steps
   back on "One swing"; the spine is keyed per shot and its held 0.31 s is relabeled "30° lag, 20 swings", then
   "lost in 20 swings"; the speed note top left, the hook's bottom left; lanes drawn back to front.
10. **HUD audit** (every 0.25 s, the whole film): one crossfade overlap ("1 s across" with "1/10 s apart" at 10.5 s);
    the ghost pill now lands on "tenth". Twelve final-tier stills (`stills-ep02.jpg`) looked at 390 px wide.
11. **Final**: 0.6 h; stopped for a pause at 09:46 with 2093 of 2184 frames on disk (its last progress line read
    2070/2184), resumed at 13:40 after a machine restart from those finished frames (91 rendered), each frame's sha256
    checked before encoding.

## Noted, not fixed
- In the whoa's ×10 stretch each pendulum makes about one back-and-forth swing every 3 frames; with motion blur it reads as a
  shimmer of the wave pattern. It is badged "10× faster".
- The whoa's 1.2 s ramp from ×10 back to real time (45.90–47.10 s) has no speed note: "10× faster" leaves as the
  ramp begins (HUMAN-REVIEW item 4 gives the window).

## Not measured here
- A physicist's sign-off on the claims and pictures: `CLAIMS-REVIEW.md`, `HUMAN-REVIEW.md`.
- A listen on a phone speaker and on headphones ("Pull its twin", "just as gradually").
