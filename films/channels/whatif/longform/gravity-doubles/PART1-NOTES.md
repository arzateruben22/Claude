# What If Gravity Doubled Every Hour? — Part 1 "Hour one" (picture first)

Season 3 re-topic (owner, 16 Nov 2026). Earth-spin stays on file untouched; this folder reuses its v2 look (copy of `earth-spin/scene.mjs`, the high-tech globe, the visor robot,
the v3 HUD style, magenta `#EB63FF`, 9:16 framing, the cinema kit). Script and outline: `PLAN-part1-script.md`.

## Files
| File | What |
|---|---|
| `scene.mjs` | the picture, a pure function of t (= `scene_head.mjs` from earth-spin + `scene_tail.mjs`, the new part; edit the tail, then `cat scene_head.mjs <(echo) scene_tail.mjs > scene.mjs`) |
| `part1.py` | writes `part1/film.json` (picture, no captions, no voice) and `part1/windows.json` / `windows.md` (per-line windows) from the scratch read |
| `voice_scratch.py` | scratch read, stock voice (Kokoro am_puck, speed 1.0, about the owner's pace). Sets timing and the guide only; it never ships |
| `part1_audio.py` | music stem + sfx stem (separate, no voice) and the guide mix |
| `part1_guide.py` | the recording guide: picture + scratch voice + teleprompter strip |
| `physics_check.mjs` | runs the scene's own ball integration and checks it against the physics |
| `part1_overlay.py` + `overlay_scene.mjs` | the caption overlay for when the voice arrives (no second picture render) |
| `out/` | `part1-picture.mp4`, `part1-guide.mp4`; stems `part1/audio/part1-music.flac` + `part1-sfx.flac` (separate, no voice; `part1_audio.py` writes wav, converted to flac for the repo) |

## The picture
- HUD: GRAVITY x-dial (thuds on each doubling), HOUR clock (00:00 → 01:00 → 20:00 race → back to 01:00 → 02:00), WEIGHT bar (100% blue; past 100% overflows in magenta).
- The ball: y'' = -g0·2^hour, bounce back up with the SAME launch speed (e = 1). Peak = h0 / (g/g0), time to the top = v0 / g. `node physics_check.mjs` prints the check. Dashed lines mark each hour's peak: hour 0 (white) stays, hour 1 (magenta) at half the height.
- x2 ring (line 2), knees dip at x2, step block with a ghost rider (line 5), a tree whose branches sag in proportion to g with ghost tips marking where they were (line 7),
  the payoff race to x1,048,576 / 20:00 and the globe shrinking to a glowing pinpoint (~1.25 s, a dark dip, no white flash) before snapping back to hour 1 (line 9), the first buckle at x4 (line 11).

## When the voice arrives (no second picture render)
1. Align the takes: `kits/cinema/voice/align.py <vodir> $CINEMA_VOICE/models` (takes named `l01.wav` … `l11.wav`, `lines.json` as in `part1/vo-scratch`) → `words.json`.
2. Dialog + final mix: put the takes at each window's `speech_t0` (`part1/windows.json`), reuse `part1_audio.py`'s stems (music + sfx) at -14 LUFS.
3. Captions: `python3 -I part1_overlay.py --vo <vodir> --picture out/part1-picture.mp4 --out <final.mp4> --audio <final mix> [--y 0.70]`.
   It renders one still per distinct caption look (page × lit word) twice (black / white) with the kit, makes transparent PNGs by a difference matte, and lays them over the picture
   (about 100 looks, a few minutes; the picture is never re-rendered). The thumbs-up + bell pop-up goes on the same way as a second layer.
4. The YouTube "subscribe" file only needs the caption "follow" → "subscribe" and the audio: rerun step 3 with the other words/audio.

## Placeholders / TODO
- The owner's takes (the scratch voice is stock and never ships).
- v2 (16 Nov, owner: more compelling visuals): `scene2.mjs` (= `scene_head.mjs` + `scene_tail2.mjs`, built by `mk_v2.py` from the v1 tail), `glimpses.js` (cup, stair, skeleton, tower, city, ocean + sky layer, mountain ledge), film `part1v2/film.json` from `part1v2.py` (windows frozen; only line 11 text changed), `part1v2_audio.py`, `part1v2_guide.py`; outputs `out/part1-picture-v2.mp4`, `out/part1-guide-v2.mp4`, stems in `part1v2/audio/`.
- Caption position `--y` chosen when the real takes are in (0.70 sits under the robot's feet on the globe).
- The thumbs-up + bell pop-up (`cta.py`): not in this repo's branch; it layers on after the captions.
- Claims in `PLAN-part1-script.md` stay OPEN: "standing up gets dangerous" at 4 g needs an aerospace-medicine source; the branch sag is drawn loosely ("a little lower").
