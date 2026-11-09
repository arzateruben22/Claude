# Outer Layer: changes to shared kit files

Every change is additive: old films render and mix byte-identically.

| Date | File | Change | Why | Old films |
|---|---|---|---|---|
| 27 Oct | `kits/cinema/studio/instruments.py` | New voice `pluck(note, dur, vel, tag, bright, damp)`: a seeded Karplus–Strong nylon pluck | Outer Layer's melodic, label and signature voice (bible §3); no existing voice is a warm string, and bells, fizz, ping, mallet and blip belong to other identities | Unchanged: a new function appended to the file |
| 27 Oct | `kits/cinema/studio/compose.py` | `"pluck"` added to the melodic layer's voices (`_melodic`, reads `pluck_bright`) and to the foley voices (`_voice`, reads `bright`, `dur`, `vel`) | So a preset can name it | Unchanged: two new branches, each placed after every existing voice. Checked: `compose.score` on a test sheet with restframe-bench, meanwhile-pulse and lightminute-vacuum gives the same sha256 before and after |
| 27 Oct | `kits/cinema/studio/vibes/outerlayer-slide.json` | New preset (F major, 64.2857 BPM, pad + pluck; signature plucks F5, C6, A5 at 0, 7, 14 frames) | The channel's sound | New file |
| 27 Oct | `kits/cinema/studio/instruments.py` | New voice `reed(note, dur, vel, tag, breath, attack, bright)`: a soft breathy reed (odd harmonics, seeded vibrato, band-passed breath, a 30 ms chiff so its onset is exact) | The coordinator's note: plucks are Back of the Envelope's identity, so Outer Layer's melodic, label and signature voice is a blown reed nobody else uses. `pluck` stays in the kit for Back of the Envelope | Unchanged: a new function appended |
| 27 Oct | `kits/cinema/studio/compose.py` | `"reed"` added to `_melodic` and `_voice`, after every existing voice | So a preset can name it | Unchanged |
| 27 Oct | `kits/cinema/studio/vibes/outerlayer-slide.json` | Melody, labels, counters and the signature moved from `pluck` to `reed`; bed 5 dB up (music sat 20 LU under the voice); swells anchored on their peak | As above | Outer Layer only |
| 27 Oct | `kits/cinema/studio/qa.py` | `"reed": "rise", "pluck": "rise"` added to `METHOD` | The sync meter cross-correlated the new tonal voices' waveforms and landed a period off (45–59 ms); ringing tones are found by their rise, as mallets and blips are | Unchanged: new keys only; no existing voice is measured differently |
| 27 Oct | `kits/cinema/studio/instruments.py`, `compose.py`, `qa.py` | **`pluck` reverted** (the function, its two compose.py branches and its qa.py key) | Back of the Envelope adds its own `pluck` (24a499a on its branch); the coordinator asked for the revert so the branches merge cleanly. Outer Layer uses `reed` only | The kit's `pluck`-free state is restored; `reed` stays |
| 2 Nov | `kits/cinema/studio/vibes/outerlayer-slide.json` | Foley entries `zap` (the kit's zap, −24 dB: UV rays landing) and `scale.jump` (a swell on F2), at the second builder's request for No. 004 | Outer Layer only; No. 001 uses neither kind, so its mix is unchanged |
| 2 Nov | `films/channels/skincare/set/section.js` (channel set) | Opt-in `mortarFloor` (default 0.15, as before; 0 hides the lipid sheets until lit) | No. 004's review: close up, the resting sheets stripe the dead layer | No. 001 unchanged (default) |

## 2 Nov, ~06:10 UTC: merged `claude/made-with-claude-film` (coordinator's request)

`kits/cinema/studio/compose.py` and `instruments.py` conflicted: Outer Layer's `reed` against Back of the Envelope's
`pluck`/`scratch`, all new branches of the same `if v == …` dispatch. Resolved by keeping both sets (no shared line
changed); `qa.py` auto-merged (Outer Layer's `"reed": "rise"` beside Back of the Envelope's entries).

Proof nothing moved (the studio run with each side's pre-merge kit, then with the merged kit, same sheet and voice):
- Outer Layer No. 001: `mix.wav` byte-identical (−14.07 LUFS / −2.0 dBTP; sync PASS).
- Back of the Envelope No. 001 (`films/channels/whatif/ep01`): `mix.wav` byte-identical (−14.05 LUFS / −1.99 dBTP,
  AAC −1.6 dBTP, as its committed `sound/qa.json`).
- set/motif.js (2 Nov, reboot): the gauge ruler's "µm" unit was inside a comment (never drawn); moved out. Only the reboot's films use set/ (season 1 renders from shelved-s1/set, unchanged).
- set/terrain.js (2 Nov): goldenHour's fog colour 0x3a2a20 → the theme's violet 0x2c1660 (the far edge melts into the ground colour; the second builder's override). Only the reboot's films use set/.
- set/uvcam.js (3 Nov, channel look v2): a new opt-in `form` (uniform uForm, default 0) gives the UV/daylight skin micro relief, a key, a rim and a small highlight, and a soft falloff in place of the hard oval edge. At form 0 the shader's output is unchanged (every new term is multiplied or mixed by uForm), so films that don't pass it render as before.
- set/prod.js (3 Nov, new): the channel production pass (lookV2, upgradeSkin, upgradeHairs, richen, hazeVolume, bokeh, backdropCss, grade). Opt-in; nothing older imports it.
- set/hudv2.js (3 Nov, new): unifyHud (labels, badges, counters, captions as one plate system, scoped to #hud.ol-v2) and stackAsCard. Opt-in; nothing older imports it.
- set/look3.js (3 Nov, new): lookV3 = lookV2 + skinV3 (warm terminator scatter, oily micro-speculars), hairsV3 (taper, dark root to pale backlit tip; groom 'lateral' for brows), grainV3 (fine, soft-light), a real black point. Opt-in; nothing older imports it.
- set/terrain.js (3 Nov, look v3): createTerrain gets an opt-in `organic` (default false): furrows along the edges of a warped Worley field (irregular plateaus of varied size), pores of varied depth and size, finer relief. organic false computes exactly as before, so films that don't pass it are unchanged.

- kits/cinema/film/compilation.mjs (9 Nov): a new optional `--theme <file>` draws the cards in another theme file (default `<channel>/theme.json`, so every earlier compilation is byte-identical). Used with `theme-ivory.json` (ivory ground, navy Newsreader headline, dark-teal accent; navy/ivory 15:1, text-2 6.7:1, accent 5.3:1) for the Season 1 long video.
- set/ss3.mjs, set/build_ep.py, set/tables.py, set/art_index.py, set/fix_windows.py, set/gen_art.py (9 Nov, new): the new-look composition engine (per-shot pictures with fallbacks, soft animated overlays, plates, engraved plate), build, tables and procedural placeholder art for Skin Sense 004 onward. set/ss2.mjs is the earlier engine (kept, unused).
