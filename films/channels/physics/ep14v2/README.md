# Reality Rulebook S3 Part 2, the delivered version (16 Nov 2026)

The owner's ChatGPT "Episode 2" (ep2.mp4, 52 s, 1080x1920 30 fps, captions baked, no narration) with the latest updates:
- the fly -> mosquito cut (12.0 s) and the mosquito -> tap cut (20.4 s) replaced by camera-move transitions (xfade
  smoothleft 0.7 s, smoothdown 0.8 s);
- the end card held 1.6 s longer with the owner's closer C2 ("Part two of eight. Full video on YouTube.", from
  voice-owner-spoken/rr-s3-part1-CD.m4a 3.95-6.3 s), the bed ducked under it;
- the bed raised 16 dB (it was -35 LUFS), mix -19.3 LUFS;
- a silent like/follow pop-up at 39.5 s (even part: no spoken ask);
- the YouTube file upscaled to 1440x2560 with "subscribe";
- cover: an extreme close-up of the crown (cover_p2.py).


Physics: the fly's wings measured 2.0 beats/s at 100x (correct); the mosquito 5/s at 100x (500/s real).

## 17 Nov 2026: the owner's narration is in
- The nine caption lines, read by the owner in one take each (`voice-owner-spoken/rr-s3-part2.m4a`, slate "Reality Rulebook, Part 2"), placed on
  the baked captions (speech starts 0.12 s after each caption appears; the captions are mapped through the cuts: -0.7 s after the 12.0 s
  cut, -1.5 s after the 20.4 s cut). De-clipped (the hard consonants touched full scale), rumble cut, -16 LUFS.
- The bed is now +7 dB (it was +16 dB when there was no voice); the owner's closer C2 at 48.3 s is de-clipped and matched to the voice.
- The silent like/follow pop-up moved to 35.9 s (the gap after "Tiny droplets pinch free."); even part: no spoken ask.
- Mix -16.8 LUFS. Rebuild: `src/build.sh` (picture, bed, voice, C2), `src/voice_place.py`, `src/mix.py`, `src/post2.sh` (1440 file + pop-ups).
- Mishears by the recogniser ("to a second", "tidal pool") are not the owner's words; the take matches the captions.

## 17 Nov 2026 (later): smoother joins (owner: "a smoother transition from fly to mosquito and then to the water faucet")
- fly -> mosquito: a 1.2 s smoothstep dissolve (it was a 0.7 s left wipe). Both shots share the counter and the kitchen, only the creature
  changes, so a soft dissolve reads as one scene.
- mosquito -> faucet: a 0.9 s camera pan to the right with motion blur (`src/whip.py`: the two shots slid along one strip on a smootherstep
  ease, 8 sub-frames of blur), toward the mug on the right edge of the mosquito shot (it was a 0.8 s down-wipe).
- The overlaps are longer (1.2 s + 0.9 s), so everything after the cuts is 0.6 s earlier than the first narration build: the film is
  51.5 s, the captions/voice lines are re-placed (`src/voice_place2.py`), the closer C2 is at 47.7 s, the silent pop-up at 35.4 s.
  `src/build2.sh` rebuilds everything (picture, pan, bed, voice, mix, 1440 file, pop-ups). Mix -16.8 LUFS.

