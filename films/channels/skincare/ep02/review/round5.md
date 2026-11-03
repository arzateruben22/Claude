# Skin Sense No. 002, review round 5 (independent reviewer, draft-preview-r5.mp4)

Reviewed `review/draft-preview-r5.mp4` (540×960, 15 fps, 76.54 s, with audio), not the trimmed 75.0 s cut. Method:
frames every 0.5 s, every frame around the cuts, a safe box of 45 / 110 / 190 px, captions checked against
`vo/words.json` plus the line offsets in `film.json`, and the bottom strip sampled frame by frame to find where the
micrograph shows. Loudness is −14.1 LUFS integrated, peaks −1.5 dBFS, no dropouts. The timestamps below are on the
r5 draft. Frame-sample times are ±0.25 s; cut times are frame-exact.

## Verdict: FAIL

| | Score | Why |
|---|---|---|
| a. First 2 s | 3 | Beam, blooms and the question by 1.2 s. The surface reads as beige biscuit tiles with stick hairs, not a cheek, and the title band (a flat violet strip at 0–3 s) competes with the image. |
| b. One thread | 4 | The beam goes in, past blood, becomes a pulse, then the computer faces, then back to the cheek with "Yours does". It is one thread, and the detours earn their place. |
| c. Picture moves with the sentence | 3 | "past blood" with the capillary, the pulse trace peaking on "count your pulse", and the red bar on "red" all land. "back out" is still a white tangle, the face beat barely moves, and the "from within" spine never appears (blocker 4). |
| d. Every cut or move motivated | 3 | Seven picture cuts. The 1.4 s "rise" insert (38.3–39.7 s) and the cut back into the section for the chart (52.3 s) have no reason in the sentence. |
| e. Voice carries meaning, screen the figures | 4 | Clean split: "one ray in twenty" against ≈ 4–7 %, "several times more" against ≈ 40 %, mm values on the chart. The 2008 credit is truncated (blocker 3). |
| f. Rhythm | 3 | Lines breathe well and caption breaks now fall at phrases. The pulse beat holds one flat composition for 12.5 s (39.7–52.3 s), and nothing changes from 49.3 to 52.3 s. |
| g. Ending calls back, tease lands | 3 | The cheek and blooms return on "that's your glow" and the scar tease is concrete. But the twist is staged as a tone comparison (blocker 1), and the hook's spine never closes. |
| h. Production value | 1 | Almost every frame reads as a default 3D render or a template; see the next section. |

Finals bar: (a) 3 and (g) 3, both under 4; (h) 1, under 4; one ethical blocker and two honesty blockers open.

## (h) Against "a very high multi-million-dollar production budget aesthetic"

| Time | What reads as default, template or preset |
|---|---|
| 0–9 s, 66–69 s (macro) | One repeating diamond tile with straight stick hairs, no pore or micro-relief variation, flat beige albedo, no subsurface. One soft key, no rim, no fill shaping, no volumetrics in the beam. The beam is a frosted cylinder (it reads as a glass rod at 66.0 s). A flat violet clear colour shows as the sky at 0–1 s and 9–16 s. Depth of field is present but is the only lens effect: no motion blur, no grade. |
| 9–17 s (split) | The dry half is a translucent lighter rectangle laid over the frame, a visible compositing plate, not a material change. |
| 18–38 s (section) | Identical lathe-shaped cells repeated in rows. The stratum corneum is a striped band with orange dash artefacts. Paths are 1 px wireframe polylines. Vessels are untextured tubes. The violet clear colour sits above the surface. No volumetric light in the tissue, no depth cues. |
| 39.7–52.3 s, 60.9–65.6 s (faces) | Flat vector clip-art avatars (round head, "J" nose) on a noise-violet card. This is the clearest template look in the film, and it sits on the whoa and the twist. |
| 52.3–60.6 s (chart) | A flat app-style card over the section, with a blurry pink photo under it. |
| HUD | Badges, counters and captions are consistent with each other (the strongest part of the frame). They sit over unfinished 3D and 2D art in three different styles (macro, section, clip-art). |

What would reach 4:
- One art direction across the macro, the section and the faces: a physically based skin shader with subsurface scattering, a real micro-relief normal map, and pores and vellus hair with variation.
- Lighting: a key with warm rim, a fill, and atmospheric haze or god rays on the beam.
- A lens: depth of field plus motion blur on moves, then one film grade and grain over everything.
- The section rebuilt as tissue with variation (cells of different sizes, fibre bundles, volumetric glow along the paths), not tiled primitives.
- The faces as a rendered macro of one cheek (the same shader, subsurface on or off), not 2D avatars.

## Blockers (each with a fix)

1. **60.9–65.6 s, ethical (bible §1, one tone per episode):** the "light stays on top" face, captioned "looked like
   plastic", is pale grey-white. The "light goes inside / that's your glow" face is brown. On screen this pairs a
   lighter skin tone with "plastic" and a darker one with "glow", which is a tone change inside the story placed on
   a value line.
   - Fix: both faces in the episode's one medium tone and the same albedo. Only the shading differs: a hard
     specular highlight with no subsurface on the left, soft subsurface on the right.
2. **About 34.3–36.7 s, honesty:** the stained-tissue micrograph fills the bottom of the frame (y ≈ 810–960) during
   "past your melanin and your blood" with **no** "behind: a tissue photo (normal skin)" note. Also undisclosed:
   52.27–about 52.5 s (the photo is up while the note is still fading in) and about 60.4–60.67 s (the note has faded
   out and the photo is still up).
   - Fix: either keep the photo only inside the depth beat, or show the note on every frame where any of the photo
     is visible. Tie the note's opacity to the photo's, not to the chart card.
   - The note itself is about 11 px (cap height about 8 px), dim, upper-case mono. Raise it to at least 14–15 px
     in `text-2`.
3. **About 40.5–51.8 s:** the "Verkruysse et al., 2008" source badge is covered by the "pulse, from colour" plate
   and reads "| Verkr" for the whole beat. Wu et al. 2012 (c17) is credited nowhere on screen.
   - Fix: move the source badge to the top right under "Model face, not a photo", or put the pulse plate higher.
     Put Verkruysse 2008, Wu 2012 and Jensen 2001 in the end-card footnote as the script says.
4. **66–69 s:** the spine "the glow comes from within" never appears. In `film.json`, `c-final` has `t0` 66.57 and
   `t1` 42.87, so its end is before its start.
   - Fix: set `t1` to about 68.9 (or retire the counter and change the script's spine line).

## Other findings, most severe first

5. **69.4–76.5 s, end card.** The footnote is the old "Only about 4–7 %…" text, not the script's "A camera can read
   a pulse from the colour of a face (Verkruysse et al., 2008)." The chip reads "Skin Sense · No. 003"; the script's
   end card says "Skin Sense · No. 002".
   - Fix: decide which one the bible means and match the script. Also add the viewfinder brackets that bible §4
     asks for.
6. **38.3–39.7 s.** An unmotivated "rise" insert on the macro terrain still carries the section's "Simplified · one
   example (model)" badge. Then the face card opens on a nearly empty violet frame (39.73–about 40.0 s).
   - Fix: either cut straight from the capillary to the face on "Blood moves", or make the rise a continuous push
     out of the vessel to the surface. Draw the face on the first frame of the beat.
7. **39.7–52.3 s.** 12.5 s on one flat composition; the face scales a few percent and the cheeks pulse faintly.
   49.3–52.3 s is a dead hold. This breaks bible §8 (at most about 3 s per composition).
   - Fix: a real push from the face into the cheek on "changes colour". Draw the pulse trace and then the count
     ("≈ 72 / min" style, as illustration) on "count your pulse". Cut the hold to about 1 s.
8. **Text under the floor (about 14 px at 540 px wide):**
   - The tissue-photo note: about 11 px.
   - "LIGHT STAYS ON TOP" / "LIGHT GOES INSIDE": about 11 px, at 60.9–65.6 s.
   - The depth-axis labels "0 mm"–"5 mm": about 12 px, dim.
   - "MODEL FACE" and "pulse, from colour": about 13 px.
   - The series line "SKIN SENSE · NO. 002": about 13 px.
   - Fix: 15–16 px.
9. **24.9–25.6 s, "finds its way back out".** The exits are lost in the full-frame tangle.
   - Fix: dim the tangle and brighten a handful of paths that leave through the surface on "out".
10. **52.3 s.** The chart is a card laid over the section, which a viewer reads as "the section is behind a slide".
    - Fix: draw the blue and red penetration in the section itself. Then the micrograph (if kept) sits at the true
      depth with its note.

## Top fixes, in order

1. Make the computer faces one tone.
2. Disclose the micrograph on every frame where it shows (or remove it at 34–37 s), and make the note legible.
3. Uncover the Verkruysse credit; add Wu 2012.
4. Fix `c-final` so "from within" shows.
5. Do the production-value pass. Highest return first: the faces as rendered macro skin, the section rebuilt with
   variation and volumetrics, then one grade, motion blur and grain over the whole film.
6. Motivate the face beat (push, pulse count, no dead hold) and remove the 38.3 s insert.
