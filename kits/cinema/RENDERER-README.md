> Run every command below from the repository root (the folder that contains `kits/` and `films/`).

# Prism Studio renderer export

The code-rendered film pipeline behind the five channels (Reality Rulebook, One More Orbit, Possibility Lab,
Body Backstage, Skin Sense): three.js scenes drawn frame by frame in headless Chromium, narration from an offline
voice model, a code-composed score and mix, and ffmpeg encoding. This is **runnable production code and assets**,
not a knowledge pack. Finished videos, secrets and caches are left out.

## What is inside
| Path | What |
|---|---|
| `kits/cinema/` | The renderer (`film/render.mjs`, `film/run.sh`), the film look (`cinema3d.js`, `keys.js`), shared scene blocks (`sci/`), the sound studio (`studio/`), script tools (`script/`), voice tools (`voice/`), three.js r160 (`vendor/`, MIT) |
| `films/channels/<channel>/` | For each of the five channels: `theme.json`, `bible.md`, `PRODUCTION.md`, `fonts/` (OFL licences included), `set/` (scene pieces), and for episodes `ep01`-`ep06`: `script.md`, `claims.json`, `compile.py`, `film.json`, `scene.mjs`, `voice.py`, pronunciations and cue sheets |
| `films/channels/skincare/ep01/vo/` | The 8 narration WAVs plus `lines.json` and `words.json` for **one working Skin Sense sample** (episode 001) |
| `kits/cinema/voice/` | Kokoro and Parakeet setup, text-to-speech, alignment; plus the voice-clone toolchain (`clone.py`, `setup_clone.sh`, `clone.lock.json`, `CLONE.md`, `ingest_male.py`) from the `claude/voice-clone` branch |
| `.claude/skills/cinema-kit/` | The written process Claude follows with this kit |
| `.env.example`, `requirements.txt` | Variable names only; Python packages |

Channel and episode counts: channels are `physics`, `space`, `whatif`, `body`, `skincare`.

## System requirements
- Linux or macOS, 4+ CPU cores, 8 GB RAM, about 10 GB free disk for one episode's frames (frames are deleted after each chunk is encoded).
- Node.js 22, `ffmpeg` 6 or newer with libx264 and AAC, Python 3.11 to 3.13.
- Playwright with Chromium: `npm i -g playwright` then `npx playwright install chromium` (any recent Chromium works; the renderer uses `$CHROMIUM`).
- GPU is not required. Rendering uses software WebGL (SwiftShader). The tested speed was about 1.4 to 2.4 s per frame at the draft tier (540x960) on a 4-vCPU cloud container; final tier (1080x1920) is several times slower.

## Install
```
# 1. Renderer
npm i -g playwright && npx playwright install chromium
export PLAYWRIGHT_DIR=$(dirname $(npm root -g))
export CHROMIUM=$(node -e "console.log(require('playwright').chromium.executablePath())")

# 2. Python tools (sound studio, script tools)
python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt

# 3. Narration (only needed to re-voice a line; the sample already includes its WAVs)
kits/cinema/voice/setup.sh            # downloads pinned models, checks every SHA256, builds a venv
export CINEMA_VOICE=$HOME/.cache/cinema-voice
```

## Render the Skin Sense sample (works with no extra downloads)
```
# two still frames (about 10 seconds)
node kits/cinema/film/render.mjs --film films/channels/skincare/ep01 --tier draft --times 5,30

# the whole 75-second draft (540x960, 15 fps, about 30 to 45 minutes on 4 cores), detached and resumable
kits/cinema/film/run.sh films/channels/skincare/ep01 --tier draft
kits/cinema/film/run.sh films/channels/skincare/ep01 status

# final quality (1080x1920 at 30 fps) is much slower
kits/cinema/film/run.sh films/channels/skincare/ep01 --tier final
```
Output goes inside the episode folder: `build/` (frames and chunks) and `out/` (the delivery mp4 and poster). The two-still test above was run on this exact package and rendered correctly. The full draft and the audio mix were **not** run on this package.

## Narration and sound
```
# voice: one WAV per line, then word timings
$CINEMA_VOICE/venv/bin/python -I kits/cinema/voice/tts.py   films/channels/skincare/ep01/script.md films/channels/skincare/ep01/vo --voice bf_isabella --lexicon films/channels/skincare/ep01/pron.json
$CINEMA_VOICE/venv/bin/python -I kits/cinema/voice/align.py films/channels/skincare/ep01/vo
# score, foley and mix to -14 LUFS: see kits/cinema/studio/README.md
```
Each episode's `voice.py` shows the voice and settings that episode used (Skin Sense used `bf_isabella`).

## Models you must obtain (never included)
- **Kokoro-82M** voice model and voices (Apache-2.0) and **Parakeet TDT 0.6B v2** timing model (CC-BY-4.0, credit NVIDIA), plus Silero VAD (MIT): `setup.sh` downloads them from GitHub release files at pinned SHA256s.
- **Voice clone (optional):** Chatterbox (Resemble AI, MIT) from Hugging Face via `setup_clone.sh`; see `kits/cinema/voice/CLONE.md`. It needs `huggingface.co` network access, **your own recordings and a consent line**, and it refuses to run without them. No recordings are included.

## External services
- None are needed to render. Rendering is local and free.
- Optional: an image model API (OpenAI or Google) for new key art, a hosted Prism Studio to receive finished films (`STUDIO_URL`, `MEDIA_PUSH_TOKEN`), and a host such as Railway. Keys are never stored in this package.

## Licenses
- three.js r160: MIT (`kits/cinema/vendor/THREE-LICENSE`).
- Fonts: SIL Open Font License files sit beside each channel's fonts (`films/channels/*/fonts/*OFL*.txt`, `SOURCES.md`); IBM Plex has its own licence file.
- Voice models: see above; record them in each film's `assets.md`.
- Your own scripts and renders are yours. The channel styles and bibles are the studio's.

## What is missing (honest list)
- **Only Skin Sense episode 001 has its narration audio and word timings in the package.** Every other episode has its script, scene and timings, but its WAVs and the final mixed audio were left out (large); regenerate with the voice tools above.
- **No finished videos, covers or posting packs.** Those live in the repository's `out/` folders and in your hosted studio.
- **Excluded exploratory folders:** `looktest`, `auditions`, `concepts`, `s1v2`, `shelved-s1`, `review` and `compilations` (look tests, review stills and long-video sources). They are in the original repository.
- **The Prism Studio web app** (Next.js with Postgres, review, calendar, uploads) is a separate project in `prism-studio/` of the repository and is not in this zip.
- **Body Backstage 003-006 and Skin Sense 004-006** are drafts that failed or are awaiting review; their code is here as it stood and is not final.
- **The new Skin Sense look** (ivory ground, photoreal illustrated slides) is a plan in `films/channels/skincare/STYLE-REFERENCE-2.md`; the image-model key-art step is not built yet.
- **Not tested here:** the voice setup scripts' downloads, the voice clone, the sound studio and a full-length render on this exact package. The renderer's own commands and the two-frame sample were tested.
- **Source repository:** `arzateruben22/Claude`, branch `claude/made-with-claude-film` (private). Everything here comes from `kits/cinema/` and `films/channels/` on that branch, plus the voice-clone files from the `claude/voice-clone` branch.
