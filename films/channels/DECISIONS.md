# Three science channels: decisions (provisional until the user changes them)

Source: the three bibles (`body/`, `space/`, `physics/bible.md`) and the cross-check
(`crosscheck.json`). Each decision below is the bible's recommendation with the cross-check's fix
applied. The user can override any of them; nothing here is published.

| | Body | Space | Physics |
|---|---|---|---|
| **Channel** | **Meanwhile, Inside** | **Light Minute** | **Rest Frame** |
| Promise | What your body is doing right now, while you watch | One minute, one "whoa" about the universe, every number sourced | Everyday things, slowed down until the physics shows |
| Look | "Surgical green": `#0A1F1C` bg, chartreuse `#D6F25F` signal, pulse `#FF6688` for blood only | Indigo night `#080A1C`, teal `#4FE3C6` light, lilac `#B9A6FF` gravity | "Daylight lab": warm-paper cyc `#E6E2D8`, ink `#15171C`, cobalt `#1F3BD1`, marker `#FFD43B` |
| Type | Fraunces (display) + Atkinson Hyperlegible Next (text) | Unbounded (display) + **Lexend** (text) + **Martian Mono** (counters) | Archivo (display) + IBM Plex Sans / Mono |
| Narrator | bf_emma | **am_michael** | af_bella (speed 0.95) |
| Sound | E♭ major, 75 BPM (resting heart rate); mallet ostinato on the lub-dub | E dorian, **56.25 BPM** (16th = 8 frames); no piano: drone + glide fifths; **pings** for labels (no glass bells: Lumevina's) | G mixolydian, 112.5 BPM (16th = 4 frames), staccato blips instead of the felt piano; hard, close foley: knocks, ticks, shutters |
| Signature | thump E♭2, thump B♭2 +0.4 s, mallet G5 +1.2 s (no bell) | pings E5, B5, F♯6 | a ball bouncing to rest: knocks D6, B5, G5 at 0, +12, +20 frames |
| Motif | The **pulse line** (ECG trace under the title, leaders, scale bar); **no circle** (space owns the ring) | The **light-time ring** + honesty badges | The **strobe ladder** + honesty badges |
| Recurring segment | "Meanwhile" real-time tally ("while you watched: about 85 heartbeats") | Closing light-time readout | A "measure it" beat on the strobe ladder |
| Label colours | Body O₂ → white with an O₂ glyph and ring; CO₂ → slate; immune gets a dashed ring (cross-check) | As the bible | As the bible |

## Shared rules (from the cross-check)
- Glass bells belong to Lumevina. Every channel's counter end plays its own signature through a generic `seq` voice.
- The score engine takes the melodic layer's voice and pattern from the preset, so the channels don't share one arrangement.
- `cinema3d.js` gets an opt-in `probe2` (camera motion measured correctly, near-lens samples dropped) and a `CINEMA_PX` hook. Skin School's in-flight render must stay byte-identical, so `cinema3d.js` is not edited until its final render is done.
- Script fixes before voicing: body "most of your own cells" wording and the unsupported capillary claim; physics throws at 0.44 / 0.89 / 1.33 m/s (20 / 40 / 60 cm); space "orbit sped up" badge and one galactic-centre distance for the whole channel; the Moon "drops about 1.4 mm each second".
- Space episode "Nearest star" goes second (it is tied to 18 Nov 2026).
- Cadence: render on one box per channel (one cloud session each), bank 5–7 episodes per channel, then go daily.
- Names: open-web searches only. Handle and trademark checks (USPTO, EUIPO, TikTok/YouTube/Instagram) are TODO before launch.

## Platforms (the user, 24 Oct)
- **YouTube and TikTok: one channel per subject.** Meanwhile, Inside, Light Minute and Rest Frame
  each get their own YouTube channel and their own TikTok account, and so does every subject added
  later. Each keeps its own name, look, narrator and sound.
- **Instagram: one combined account** that posts every channel's episodes. Each post still
  carries its own channel's look, name, end card and AI label. The account's name and bio frame
  it as the studio's science shelf.
  - TODO: the combined account's name and handle.
  - Open question: the user said "all 4 channels". Skin School belongs to the client (Lumevina,
    Evelyn Romero), so it posts on the combined account only if Evelyn agrees in writing. Until
    then it stays on Lumevina's own accounts.
- **Writing, for every channel:** `kits/cinema/script/WRITING.md` (the story standard: a person, a
  wrong idea or stakes in every episode; open loops; earned wonder; the "Never write" list, which
  `lint.py` checks).
