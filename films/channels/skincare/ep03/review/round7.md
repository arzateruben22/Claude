# No. 003 (Skin Sense), review round 7 (independent reviewer, draft-preview-r7)

**Draft reviewed:** `review/draft-preview-r7.mp4`, 540×960, 15 fps, 75.01 s, with audio.

**How I checked:** full frames at the hook (0–2.5), the takeaway rise (60.4), the mouse panel and the ending
(62.5–70), and every frame of both dips. Times below are in the r7 file. The section blocks were not changed this
round, so I carried over their round-6 reading.

**Verdict: FAIL.** (a) and (h) are still at 3, and the fix for blocker A created a new safe-box blocker.

## Round-6 items

| Item | Status | Checked |
|---|---|---|
| A. Mouse panel collision | **Fixed for the blocks.** Both blocks sit above the caption at about 70 % scale, and the "mice with these cells / mice without them" labels read correctly. **New problem:** the merged badge breaks the safe box (blocker A2). | 62.5–65.8 |
| B. Scar band | **Partly.** At 1.2–2.5 the raised edge and the rosier satin finish now show. But at frame 0 the band is defocused and still reads as a flat pale stripe, and the striations can't be seen at 540. | 0.0–2.5, 60.4 |
| C. Section blocks | **Not changed** (as stated). | — |
| 4. Empty dip | **Fixed.** One violet frame at 39.3 and one at 52.4. | 38.6–39.8, 51.2–52.6 |
| 5. Cells at the old scar | **Fixed.** The label reads "while it healed: cells at the seam". | 66.6 |
| 6. Mice wording | **Fixed.** | 62.5–65.8 |
| 7. Footnote size | **Fixed.** About 15 px, readable, and it names Martin et al., 2003 (mice). | 70.0 |

## Scores

| | Score | Why |
|---|---|---|
| a. First 2 s | 3 | The terrain is strong, and the question and "an old scar" are up by 1.3 s. The scar band's new edge only shows from about 1.2 s; at frame 0 it is still a blurred white stripe, so the hook's subject is the weakest-looking thing in the frame. |
| b. One thread | 4 | Unchanged and holding. |
| c. Picture moves with the sentence | 4 | The rope, mouth and mouse beats land on their words. "while it healed: cells at the seam" now matches the biology. |
| d. Every cut or move motivated | 4 | Each dip is now one frame on a scale jump. |
| e. Voice carries meaning, screen the figures | 4 | Unchanged. |
| f. Rhythm | 3 | Holds of 2–4 s on one composition remain at 36–38.3, 49.5–51.5 and 55–59. The end card is static from about 71.5 to 75. |
| g. Ending calls back, tease lands | 4 | The rise to "the same old scar" works, the mouse panel now reads, and UV "the price of defence" lands. |
| h. Production value | 3 | No change to the section blocks, so they still read as default renders: plasticine collagen, bar-stack patch, a slab over a void with no rim, a pin-sharp foreground, and toy-scale mouse blocks. |

**Finals bar:** no score below 3 (passes); g at 4 or more (passes); a and h at 4 or more (both fail); nothing
factual or ethical open (passes).

## Blockers, in priority order

**A2. 61.6–66.0: the merged mouse badge runs off the left edge.**
- "Mouse study · Martin et al., 2003 · model" is wider than its slot. Its plate starts at x ≈ 0 and its text at about 7 px, against a 45 px side margin.
- The leading tick is lost, and on a phone the left edge sits under the platform UI. This is the panel's only honesty label (the model disclosure was folded into it), so it has to sit fully in the safe box.
- **Fix:** right-anchor the badge at x ≤ 495. Either break it into two lines ("mouse study · Martin et al., 2003" / "model, not a photo") or shorten it ("mouse study · Martin 2003 · model"). Add a layout check that clamps every badge to the safe box.

**C. (h) is below 4: the section blocks, 5.6–39, 39.3–51.5 and 61.6–66.**
- This is round 6's list, still open:
  - fibrillar collagen with a slight sheen, and irregular strands in the patch;
  - a rim on the slab edges, with the slab sitting in haze rather than floating on a void;
  - foreground focus falloff and motion blur on the pushes;
  - a wetter, finer material for the mouth lining, with no pillars;
  - mouse blocks lit like the main section, not toy dioramas.
- Without this pass, (h) stays at 3.

**B. (a) is below 4: the scar at frame 0, 0.0–1.2.**
- The new edge reads only once the glide settles.
- **Fix:** start with the scar band in the focal plane at 0.0 (shift focus to the band, or start the glide later in its path). Strengthen the edge's shadow so the band reads as raised skin, not paint, in the very first frame.
- Make the striation visible at 540, about 2× its current contrast.

## Fix order

1. A2: the badge layout (a small fix).
2. C: the section material and lighting pass. This is the main thing between this draft and a final.
3. B: focus at frame 0.
