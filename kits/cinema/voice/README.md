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
