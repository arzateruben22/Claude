# Reality Rulebook S3 Part 3, the delivered version (16 Nov 2026)

Built from the owner's assets, no new image-to-video credits:
- the owner's kernel clip (`reference/clips/ep3/p3-kernel-clip.mp4`, 1080x1920, 60 fps, 10 s: the kernel trembles, the shell
  splits, steam, the camera pushes in; a bubble drifts out of frame), played with a speed ramp (0.29x while it trembles, 0.42x
  through the split, then 0.5x), motion-interpolated;
- the owner's two stills (`p3-start-kernels-bubble.webp`, `p3-end-droplet-ring.webp`): a dissolve from the close-up into the wide
  kitchen, a slow push toward the bubble, then the hole sweep (a circular reveal from the point where the popcorn touches the
  film, with a rolled-up rainbow rim and shed droplets, 7 s on screen = 0.007 s of real time at 1,000x), and a slow pull-back;
- the counter (1x real time, 100x slower, 1,000x slower, then "up next: sound"), captions and the "Hole edge" card are drawn in
  Episode 1-2's look (`src/render.py`, `src/cfg.py`);
- sound is synthesised (`src/bed.py`: room tone, gas flame, oil sizzle, ticks, a deep slowed "whoomp", steam, bubble shimmer, the
  hole's glassy sweep, drifting droplets) plus the owner's recorded like/follow line (D3 "follow" for TikTok, D4 "subscribe" for
  YouTube) from `voice-owner-spoken/rr-s3-part1-CD.m4a`; the pop-up is on the spoken "like" (42.7 s);
- odd part: no "Part 3 of 8" closer. 54.6 s. YouTube file upscaled to 1440x2560.
- cover: one giant number, "0.01 sec" (rotation device 2; P1 side by side, P2 close-up), `src/cover_p3.py`.

**Narration is NOT in yet** (the owner records later, like Part 2): `Reality-Rulebook-S3-Part3-recording-sheet.md` has the 11 lines
the captions show. Then: cut the takes into the caption windows in `cfg.py` and re-run `src/render.py` (captions) + `src/post.sh`.

Disclosures: the footage is AI-generated (the owner's ChatGPT clip and stills); the bubble pop is a composite of two stills
(an editorial transition, not a simulation); the counter labels are the design's (1x, 100x, 1,000x), not a measured frame rate.
Physics to open before posting (all OPEN): kernel pops near 180 C (356 F), Virot & Ponomarenko (J. R. Soc. Interface 2015,
PMC4345489); soap-film hole edge about 7 m/s (about 16 mph; Culick 1960, doi 10.1063/1.1735828; derivation); the whole pop in about
0.01 s (derivation: half a 1.6-inch bubble's circumference at 16 mph); film about a hundred times thinner than a hair (film about
0.5 to 1 micrometre against a hair's 50 to 100: derivation).

Rebuild: `src/seg1.sh` (clip ramp, slow: motion interpolation), `src/bed.py bed.wav`, `src/render.py full video_noaudio.mp4` (about 8 min),
then `src/post.sh` (mux, 1440 file, pop-up with the studio's cta.py), then the +4.5 dB / limiter 0.76 audio pass that brought it to -19.1 LUFS, -1.4 dBTP.
