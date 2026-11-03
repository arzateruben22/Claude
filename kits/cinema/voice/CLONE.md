# Cloning the owner's voice: model choice (2026-11-03)

**Choice: Chatterbox (Resemble AI), English model, on CPU.** Fallback: OpenVoice V2 on top of Kokoro.

## Licence evidence

Checked from the build container, where huggingface.co is blocked (proxy 403), so **weight licences are
not yet verified from the source.** What was verified, and what is still open:

| Model | Code | Weights | CPU, 4 vCPU | Verdict |
|---|---|---|---|---|
| **Chatterbox** | MIT: LICENSE on GitHub (Copyright 2025 Resemble AI) and PyPI `chatterbox-tts` 0.1.7 | MIT per the model card, **not yet seen**: the GitHub README gives one "MIT license" link and no separate weights licence | 0.5B model; expect minutes per episode, **not measured yet** | **Chosen**, pending the weights check |
| OpenVoice V2 | MIT; README: "Free for commercial use" (V1 and V2, since April 2024) | MIT per the same README line, checkpoint card not seen | Fast. It only recolours the timbre of a separate base voice (MeloTTS, whose licence I did not check) | Fallback. It keeps the base voice's pacing and can't whisper |
| Zonos | Apache-2.0 | Not stated on the repo page | README: 6 GB+ VRAM; CPU "likely won't be sufficient" | **Rejected**: GPU |
| Pocket TTS (Kyutai) | MIT | Not stated; voice licences listed separately | ~2.3-2.5x realtime on 4 vCPU per its README | Worth a listen as a second candidate; weights licence unchecked |

`setup_clone.sh` **enforces the weights licence**: it reads the Hub model tags and stops unless they say
`license:mit`. Nothing is downloaded or used on a guess. Rejected on known non-commercial weights
(from memory, unverified here): XTTS-v2, F5-TTS, Fish-Speech.

## Things to know

- **Watermark.** Every Chatterbox file carries Resemble's Perth watermark (imperceptible, survives MP3 and
  editing). Fine for monetised channels, but never strip it, and it is separate from the platforms'
  "synthetic voice" label, which still applies to a cloned voice.
- **Whispers.** No whisper control. clone.py conditions whisper beats (`--whisper-beats`) on a whispered
  reference and lowers expressiveness. Whether it holds a whisper is unknown until we hear it.
- **Pins.** `chatterbox-tts==0.1.7` pins torch 2.6.0, transformers 5.2.0 and numpy<2 on Python<3.13, so it
  lives in its own venv (`clone-venv`, Python 3.11 preferred), apart from the Kokoro one. Torch comes
  from PyPI, so download.pytorch.org isn't needed. `clone.lock.json` pins the weights revision and the
  SHA256 of every file; they are filled on the first download, then reviewed and committed.
- **Privacy.** References and conditioning clips live only in `~/.cache/cinema-voice/owner/`
  (chmod 700). clone.py refuses to run if that path is in a git work tree; `.gitignore` also blocks
  `owner/`, `*.pt`, `*.safetensors`, `voice-ab/`.

## Hosts needed

`huggingface.co` and `cdn-lfs.huggingface.co` (plus `cas-bridge.xet.hf.co` / `*.xethub.hf.co` if the files
are served through Xet; the first failure will name it). PyPI already works. A new session is likely
needed after the allow-list changes.

## Use

```
kits/cinema/voice/setup_clone.sh
$CINEMA_VOICE/clone-venv/bin/python -I kits/cinema/voice/clone.py films/channels/physics/ep01/script.md films/channels/physics/ep01/vo-clone \
    --takes <polished takes> [--whisper-takes <dir> --whisper-beats id]
$CINEMA_VOICE/venv/bin/python -I kits/cinema/voice/align.py films/channels/physics/ep01/vo-clone
```

Reference pick (tested on Kokoro stand-ins; no real voice yet): the takes of 3 s or more at 2.0-3.3 words/s,
ranked by voice-over-room level, the cleanest concatenated to about 60 s (30-90 s). A 10 s window
of the single cleanest take is the conditioning clip. Output is level-matched to -21 LUFS, peaks -2 dBFS.
