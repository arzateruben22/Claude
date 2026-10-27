# Voice: synthetic narration and word timings

```
kits/cinema/voice/setup.sh                       # once per machine: pinned venv + models (SHA256-checked)
export CINEMA_VOICE=$HOME/.cache/cinema-voice
$CINEMA_VOICE/venv/bin/python -I kits/cinema/voice/tts.py   films/<film>/script.md films/<film>/vo --voice af_heart --lexicon films/<film>/pron.json
$CINEMA_VOICE/venv/bin/python -I kits/cinema/voice/align.py films/<film>/vo
```

- **`tts.py`** voices one WAV per `vo:` line with Kokoro-82M. It applies the film's pronunciation
  list as phonemes, trims each line to the voice, and writes `lines.json`: the text, the exact
  phonemes, each file's SHA256, the model's SHA256 and the toolchain versions.
- **`align.py`** writes `words.json`: every script word with its start and end inside its line.
  Parakeet TDT hears the words, each start is snapped to the voice's own energy, and difflib
  matches them back to the script, so captions keep the script's spelling.
- **Commit the outputs.** Commit the WAVs, `lines.json`, `words.json` and `pron.json` with the
  film. Rendering and mixing never need the voice venv; only re-voicing a line does.

## A real voice instead (`polish.py`)

```
python3 -I kits/cinema/voice/polish.py "voice check.m4a" --out voice-check                 # before.wav / after.wav, level-matched
python3 -I kits/cinema/voice/polish.py "Rest Frame 001.m4a" --film films/channels/physics/ep01 [--fix 04="line 04.m4a"] [--strength extra]
$CINEMA_VOICE/venv/bin/python -I kits/cinema/voice/align.py films/channels/physics/ep01/vo-recorded
```

A phone recording (3 s of room tone, then every vo line once, 2–3 s apart) becomes one polished WAV per
line plus `lines.json` with tts.py's fields (`"voice": "recorded"`, `"phonemes": null`), in
`<film>/vo-recorded` (the film's `vo/` is never touched). align.py, lint.py and timeline.py read it as
they read a synthetic voice, so the film re-times itself to the reading; swap it in for `vo/` to use it.
System Python, numpy and ffmpeg only.

The chain, in order: speech to a known level · 80 Hz high-pass · spectral noise reduction learned
from the room tone and pauses (at most −15 dB a band; −20 with `--strength extra`) · body +1.5 dB at
140 Hz, mud −3 dB at 320 Hz, presence +2.5 dB at 3.2 kHz, air +3 dB from 9 kHz · a 2:1 leveler and a
4:1 peak catcher (about 6 dB on the loudest words) · a gentle 2.5:1 expander under the quiet words
(at most −18 dB; compressors lift the room) · a split-band de-esser (5–10 kHz) · −21 LUFS per take
(where Kokoro's lines sit, so the mixer needs no change), peaks at −2 dBFS · cut at pauses of 1.6 s
or more, each line trimmed to the voice (30 ms of air, 10 ms fades). It reports, before and after:
noise floor, voice over floor, mud, presence and sibilance balance, loudness, peak, and each line's
pace against the 2.2–3.0 words/s gate.

Measured on a stand-in (Rest Frame 001's synthetic lines made muddy, roomy, hissy and humming, recorded
quietly, as a cheap phone would): the room went from 29 dB to 50 dB under the voice, presence +5 dB
with sibilance held level with it, all 8 lines cut, each within 0.06 s of the source (the long "why"
line 0.25 s), −21 LUFS ±0.4. A real voice is the test that matters: tune presence, air and
`--strength` on the owner's voice check before voicing a film.

A film voiced by a person doesn't need the synthetic-voice label; its `lines.json` says `recorded`.

## How accurate the word times are (measured 2026-10-22)

Two tests, because Kokoro audio has no ground truth of its own.

**Ground truth from Piper.** Piper's phoneme alignments come from its own duration model, so they
give exact word starts for its audio. Over 102 words, these are Parakeet's starts against that
truth:

| | Median error | 90th percentile | Within one frame (33 ms) |
|---|---|---|---|
| Parakeet as it comes | 48 ms | 98 ms | 29% |
| **Snapped to the voice's energy** (what `align.py` does) | **22 ms** | **85 ms** | **61%** |
| Same, words inside phrases only | 26 ms | 86 ms | 56% |

**Kokoro, at words that follow a pause.** The true start is unambiguous there: the first sound
after the silence. Snapped Parakeet starts land there with a median of 0 ms, and 1 outlier of 25
misses by 250 ms. Kokoro's own phoneme durations can be exposed from its graph (the rounded
`/encoder/Clip` output). Measured the same way, they run late: median +43 ms, up to 97 ms. So
they are a cross-check, not ground truth.

**What that means:**
- **Line and sentence starts are exact.** Use them for cuts and for shots that begin on a line.
- **Word highlights in captions** are fine. A highlight 20–80 ms off is not noticeable.
- **A camera landing or a sound hit on a starred word** needs a look. If the starred word is the
  first after a pause, it's exact. Inside a phrase, check that word by ear and eye in the T0
  animatic, or rewrite the line so the word follows a comma.
- **The gate in `STUDIO-PLAN.md`** ("every caption word lit within ±1 frame of its onset") is not
  met inside phrases with this method: 61% are. Line starts and words after a pause meet it.

## Pronunciation

Kokoro's phonemizer reads some science terms wrong: "sebum" as SEH-bum, "comedone" as
kuh-MED-own. Put the fix in the film's `pron.json` as phonemes, for example
`{"sebum": "sˈibəm", "comedone": "kˈɑːmɪdˌoʊn"}`. `lines.json` records the phonemes actually sent,
so the fix can be checked by eye. Still, have someone **listen** to every science term at T0. A
speech recognizer will write the right word even when the voice says it wrong, so the transcript
can't catch this.

## Labelling

A natural synthetic narrator needs TikTok's AI-generated label and "voice: synthetic" in the post.
Don't clone a real person's voice without written consent.
