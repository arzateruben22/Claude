# The master studio

A film's sound, built from the same timeline as its picture: an original score, foley on every
event, the voice, the music stepping back under it, and a master measured on the file that
actually ships. numpy only (plus ffmpeg for the AAC); seeded, so the same cue sheet makes the
same sound every run.

```
python3 -I kits/cinema/studio/render.py SHEET.json OUTDIR
python3 -I kits/cinema/studio/render.py --from-scene CUES.json --preset NAME OUTDIR   # an adopted scene
```

`OUTDIR` gets `mix.wav`, `mix.m4a` (AAC 256k), `stems/{dialog,music,effects}.wav` (they sum to the
mix exactly), `master.json`, `cues-placed.json`, `qa.json` and `spectrogram.png` (every section and
cue drawn on the mix). Rendering 26 s takes about 8 s.

## The cue sheet

```json
{"duration": 26, "fps": 30, "preset": "lumevina-dew",
 "sections": [{"id": "healthy", "t0": 0, "t1": 6, "energy": 0.45}],
 "events":   [{"t": 0.8, "kind": "label", "tag": "l-hair", "pos": [0.12, 0.45]},
              {"t": 18.1, "kind": "drop.fall", "tag": "mand", "t1": 19.0}],
 "voice":    [{"id": "vo01", "t": 0.3, "file": "vo/01.wav"}],
 "shown":    {"l-hair": 0.8}}
```

- **Times** are when the event first shows on screen. The studio snaps each to the first frame at
  or after it, then places the sound so its **anchor** lands there. The anchor is set per foley
  entry: `"anchor": "onset"` (the default: its attack), `"peak"` (its designed loudest moment: a
  whoosh builds into the cut) or `"end"` (its last sample: a whistle, glide or tape ramp arrives).
  `"at": "t1"` lands it on the frame that shows the event's end (`t1`) instead of its start.
- **Kinds** come from `kits/cinema/events.json` (lead, priority, span, motion-blur floor), so the
  picture, the sound and QA share one table.
- **pos** (screen x, y from 0 to 1) pans the sound with what makes it.
- **shown** (optional) is the picture's own measurement of when an event appears, for an
  independent sync check.
- An adopted scene writes its sheet from its own event table: `render.mjs --cues` reads
  `window.SCENE_CUES()` (see `films/skin-school-pilot/motion/scenes3d.mjs`).

## Files

| File | What it does |
|---|---|
| `core.py` | 48 kHz float32 stereo, `Bus.add(sig, t, gain_db, pan)`, notes, seeded noise by name, WAV in and out (24-bit, TPDF dither) |
| `dsp.py` | Zero-padded FFT filters and shelves, envelopes, a seeded stereo room (`reverb`), soft saturation, resampling, onsets |
| `instruments.py` | Pads, felt piano, glass bells, sub, chimes; taps, fizz, plops, splashes, swells, ticks, whistles, whooshes, sparkles, room tone. For the science channels: mallet, thump, ping, glide, drone, blip, boing, hum; squish, zap, knock, shutter, ramp |
| `compose.py` | Score from sections (chords; the melodic layer, drone and heartbeat pulse the preset asks for; sub by energy), foley from events (anchors, `seq` phrases), voice lines, the duck |
| `duck.py` | The music steps back under the voice: from the line spans, with pre-roll, so it dips before the first word and never pumps on breaths |
| `meter.py` | BS.1770 integrated loudness, short-term, LRA, 4× true peak, stereo correlation, mono loss |
| `master.py` | True-peak limiter (5 ms look-ahead), gain to target, one gain curve for every stem, AAC encode, and the closed loop: the ceiling drops 0.5 dB at a time until the decoded AAC reads ≤ −1.5 dBTP |
| `qa.py` | Sync per event kind, measured in the mastered effects stem (see below); music under the voice; phone checks |
| `review.py` | The spectrogram with sections and cues |
| `vibes/*.json` | One preset per client sound: key, mode, tempo, progression, layer levels, rooms, saturation, and a foley voice per event kind |

## How sync is measured

Each placed sound is found again in the mastered effects stem, not taken from the placement math,
so a placement bug, a reverb that smears an attack, or a limiter that eats a transient all show
up as error. Each kind of sound is located the way it can be located:

- **Ringing tones** (bells, chimes, ticks) by the sharp rise of the energy envelope. Their
  waveform matches itself a period later almost as well, and the reverb build-up makes later
  periods louder.
- **Noise and clicks** (taps, fizz, plops) by plain cross-correlation of the attack.
- **Sweeps and showers** by the waveform around their loudest moment.
- **Smooth swells** by the shape of the envelope.

The table is `qa.METHOD`. Mallets, pings, blips, boings and thumps ring, so they rise; knocks,
shutters, zaps and squishes match their own waveform; glides go by their peak; ramps, hums and
drones by shape. A `seq` phrase is found the way its first note is.

**The gate:** every transient within one frame of the frame that shows its event, with a median
≤ 10 ms. Swells and sweeps have no sharp moment to hear, so they pass within three frames.

## Presets

A preset is a client's sound, the way the style guide is their look. Never reuse one for another
client.

| Preset | Sound |
|---|---|
| `lumevina-dew` | Lumevina Skin School, "calm and clean": D lydian at 90 BPM (a 16th is exactly 5 frames at 30 fps), soft pads, felt piano, small glass bells for labels, close foley in a small room |
| `meanwhile-pulse` | Meanwhile, Inside (body), "warm wonder": E♭ major at 75 BPM, a resting heart rate. A wooden-mallet ostinato locked to the lub-dub over a quiet heartbeat pulse; mallets for labels, a mallet harmonic for binding. Signature: thump E♭2, thump B♭2 +0.4 s, mallet G5 +1.2 s |
| `lightminute-vacuum` | Light Minute (space), "vast and calm": E dorian at 56.25 BPM (a 16th is 8 frames). No piano: pads in a long hall over a drone of fifths, slow gliding open fifths; telemetry pings for labels; nothing booms. Signature: pings E5, B5, F♯6, 6 frames apart |
| `restframe-bench` | Rest Frame (physics), "precise and playful": G mixolydian at 112.5 BPM (a 16th is 4 frames). Staccato blips in eighths, 16ths once the energy rises; hard, close foley (knocks, ticks, shutters). Signature: knocks D6, B5, G5 at 0, +12, +20 frames |

Glass bells (bell, chime, a bell sparkle) are Lumevina's; the three channels never use them.

**The melodic layer** is `layers.melody`: `{voice, pattern, step, double_above, octave, gain, dur, bright}`.
`voice` is felt, mallet, blip or glide (a glide slides from the pattern's previous tone); `step` is
in beats (1 = quarters, 0.25 = 16ths) and halves once a section's energy reaches `double_above`; a
`null` in the pattern is a rest; tones are the chord's upper notes moved up `octave`. Without
`layers.melody` it is the felt piano of `layers.felt` (Lumevina's arrangement, unchanged); `null`
turns it off. Two optional layers: `layers.drone` `{notes, gain}` holds a drone under the whole film,
and `layers.pulse` `{notes, beats, gains, gain, above}` puts a thump on every beat (and a second one a
fraction of a beat later) in sections at or above `above`.

**Phrases** use the `seq` voice: `{"voice": "seq", "seq": {"voice", "notes", "offsets"}}`, where the
inner `voice` is one name or one per note, `offsets` are seconds from the first note (or `frames`
instead), `gains` dB per note, and any other field goes to each note's voice. A preset keeps its
signature at the top (`"signature": {...}`) and its `signature` and `counter.end` entries name it
(`"seq": "signature"`), so the title card and every counter's end play the same phrase.
`events.json` has one shared `signature` kind; each preset maps it to its own phrase.

**Regression:** a change to the engine must leave `lumevina-dew` byte-identical. Render
`films/skin-school-tiktok/sheet.json` (with `--root films/skin-school-tiktok`) before and after and
compare the `mix.wav` sha256.
