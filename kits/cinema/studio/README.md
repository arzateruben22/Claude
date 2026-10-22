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
  or after it, then places the sound so its attack lands there. A build-up (a whoosh into a cut, a
  whistle into a landing) lands its peak or its end there instead.
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
| `instruments.py` | Pads, felt piano, glass bells, sub, chimes; taps, fizz, plops, splashes, swells, ticks, whistles, whooshes, sparkles, room tone |
| `compose.py` | Score from sections (chords, felt-piano patterns, sub by energy), foley from events, voice lines, the duck |
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

**The gate:** every transient within one frame of the frame that shows its event, with a median
≤ 10 ms. Swells and sweeps have no sharp moment to hear, so they pass within three frames.

## Presets

A preset is a client's sound, the way the style guide is their look. Never reuse one for another
client. `lumevina-dew` is "calm and clean": D lydian at 90 BPM (a 16th note is exactly 5 frames at
30 fps), soft pads, felt piano, small glass bells for labels, close foley in a small room.
