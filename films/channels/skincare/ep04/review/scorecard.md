# Scorecard: Outer Layer No. 004, "What a tan is"

## Measured gates (final)

From `kits/cinema/film/qa.py` (PASS) and `scorecard.py` on `out/outerlayer-004-9x16.mp4`, rendered at the final tier (1080×1920, CRF 15) by the render worker at 74499b6 and re-checked here. The text-in-safe-box audit is written on the rendering box, so it is not in this table; the draft audit at the same code was clean.

| Gate | Target | Result |
|---|---|---|
| Format | 1080×1920, 30 fps, H.264, AAC | 1080×1920, 30 fps CFR, 2226 frames, H.264 High BT709, AAC 48 kHz stereo 260k, 6.41 Mbps video, 62.0 MB |
| Length | 60–75 s; picture = sound | 74.200 s / 74.200 s |
| Loudness | −14 LUFS, ≤ −1 dBTP on the AAC | **−14.1 LUFS, −1.9 dBTP**, LRA 3.5 LU |
| Voice over music | ≥ 10 LU | 15.2 LU (dialogue −13.5, music −28.7 LUFS while speaking) |
| Phone speaker | mono-safe | Correlation 0.89; mono loss 0.11 dB (dialogue 0.08 dB) |
| Sound sync | transients within a frame | 12 kinds, 38 events, all PASS: transients worst 13 ms; slow swells (reveal, scale.jump, section, swell) worst 51 ms |
| Labels vs picture | sound on the first visible frame | 11/11 exact (DOM-measured first visible frame) |
| Flashing | ≤ 3 flashes a second | 6 large-area luminance changes (frames 154, 345, 490, 784, 1020, 1162), 3 flash pairs, worst 1/s |

## Compelling pass (the owner's 30 Oct standard; one independent reviewer, every round)

| Point | Draft 3 | Draft 4 | Draft 5 | Draft 6 | Draft 7 | Draft 8 | Draft 9 |
|---|---|---|---|---|---|---|---|
| (a) First 2 s | 3 | 4 | 4 | 4 | 4 | 4 | **4** |
| (b) One thread | 4 | 4 | 4 | 4 | 4 | 4 | **4** |
| (c) Picture moves with the sentence | 3 | 4 | 4 | 4 | 4 | 4 | **4** |
| (d) Motivated cuts | 3 | 3 | 3 | 2 | 3 | 3 | **4** |
| (e) Voice meaning, screen figures | 4 | 5 | 5 | 5 | 5 | 5 | **5** |
| (f) Rhythm | 4 | 4 | 4 | 4 | 4 | 4 | **4** |
| (g) Ending and tease | 4 | 4 | 4 | 4 | 4 | 4 | **4** |

(Drafts 1–2 were reviewed against the full checklist before the compelling pass was scored per round.)

## Review rounds, in short
1. Draft 1: tease caption over the end card, camera inside cells, five hard cuts, the to-scale line said more than its
   note (width vs thickness), gauge under the captions, subjects too dim, caption breaks, tone implication, badges.
2. Draft 3: fixes in; plus the channel's one-tone rule (owner-approved 2 Nov): medium throughout.
3. Drafts 4–9: the cuts. Overlay irises read as white blobs; the final answer is match cuts on a sound, computed
   from the picture (the incoming subject lands on the outgoing subject's spot and eases back over 0.8 s), and a
   halo on the fused bases as each DNA shot opens. Field, to scale and close became one camera move.

## Still open, for people
- The dermatologist on c4's wording ("under a trillionth of a second" against the source's "within about 1 ps", lab DNA).
- Close cells read as open cups at about 260 µm (the shared section's cut-face look); a taste call.
