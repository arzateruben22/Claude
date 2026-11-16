# Reality Rulebook S3 Part 4, the delivered version (16 Nov 2026)

Built from the owner's key images (no image-to-video credits): K1 (hands before the clap), K2 (palms meeting), K4 (the frozen
hummingbird at the window) in `reference/clips/ep4/`; K3 is the cover's kitchen. `src/render4.py` animates them: the real-speed
clap (a one-frame palm flash), the slow dissolve to the palms with skin ripples spreading from the seam (1,000x slower), the
**drawn** sound ring crossing the kitchen from the clap (a lens-warp ring, 47 px/s on screen, about a foot a second at 1,000x),
the camera drift to the window, the dissolve to the hummingbird (10,000x), the counter (1x, 1,000x, 10,000x, "up next: a bullet"),
captions, the "Sound wave (drawn), 767 mph in real life" card and the end card ("REALITY RULEBOOK, PART 4 OF 8, NEXT: A BULLET").
Sound is synthesised (`src/bed4.py`: room tone, quiet pan, the sharp real clap, the deep slowed clap, squeezed air, the ring's
breath, glass at the window, near-silence with a faint low hum) plus the owner's recorded closer C4 ("Part four of eight. Full
video on YouTube.", `voice-owner-spoken/rr-s3-part1-CD.m4a` 10.1-12.4 s) at 44.5 s. Even part: no spoken like/follow ask; the
pop-up is on at 40.3 s (after "a hundredth of a second"). 49 s. YouTube file 1440x2560 with "subscribe". -20.0 LUFS.
Cover: a zoom circle (rotation device 6; P1 side by side, P2 close-up, P3 giant number): K3's kitchen with the drawn ring and the frozen
hummingbird in a magnifier (`src/cover_p4.py`).

**Narration is NOT in yet** (owner records later): lines 1-10 of Part 4 in `voice-owner/Season-3-everything-left-to-record.md`
(the kit's lines; the captions show them). Then retime CAPS in `src/render4.py`, re-render (about 17 min), `src/post4.sh`.

Disclosures: footage is AI-generated (the owner's ChatGPT images); the sound ring is drawn, not photographed; the counter
labels (1x, 1,000x, 10,000x) are the design's. Physics to open before posting (all OPEN): sound about 343 m/s (767 mph) at 68 F;
at 1,000x that is about a foot a second and at 10,000x about an inch and a third a second (derivations); a 13 ft kitchen takes about
0.012 s; a clap's sound comes from the air pocket between the palms (Fu and Jung et al., "Hand clapping as a Helmholtz resonator",
Physical Review Fluids 2021: source to open); a hummingbird's wings beat about 50 times a second, so one beat takes about 20 s at 1,000x.
