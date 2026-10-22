# render.mjs: chunked, resumable rendering for the long films

`render.mjs` renders a film of 60 s to 3 min one frame at a time into PNGs on disk. It encodes
each finished chunk, deletes that chunk's PNGs, and joins the chunks at the end. A kill, a
crashed page or a container restart costs at most the frame in flight: every start resumes
where the last one stopped.

Each frame is drawn on the pilot's page, unchanged. That covers the `page(scene, W, H)` HTML,
motion.js, studio3d.js, the cinema3d.js finish, the seeded clock and random, the Chromium flags,
`window.cinemaFrame(t)` with `CINEMA.fps` at the delivery rate, the AUDIT and `--plain`. The
code for all of this is copied from `films/skin-school-pilot/motion/render.mjs`, and a check
confirmed it matches byte for byte. The runtime files are read from the pilot's folder, not
copied.

## Run it

```
export PLAYWRIGHT_DIR=$(dirname $(npm root -g)) CHROMIUM=/opt/pw-browsers/chromium   # run.sh sets both; never playwright install
M=films/skin-school-tiktok/motion

$M/run.sh --tier draft                 # detached (setsid + nohup), log in build/draft/9x16/render.log
$M/run.sh status                       # rendering or not, and the last log lines
$M/run.sh stop                         # SIGTERM; finished frames stay
$M/run.sh                              # after a restart or a kill: the same options again, resumed
$M/run.sh --tier final                 # the long one (60 s ≈ 2.5–3 h measured), same way

node $M/render.mjs --tier final --assemble --audio <the studio's mastered .m4a>
node $M/render.mjs --cues              # the scene's event table → build/cues-<id>-9x16.json, renders nothing
node $M/render.mjs --tier animatic --from 20 --to 30          # a part, in the foreground
node $M/render.mjs --tier final --times 9,20                  # single frames (stills)
```

`--scenes` defaults to `motion/scene.mjs` (the film's scene, `skin-school-pore`). A relative
path is read from `motion/`. To test on the pilot, use
`--scenes ../../skin-school-pilot/motion/scenes3d.mjs`.

## Tiers

| Tier | Size (9x16 / 16x9) | fps | Finish | Use |
|---|---|---|---|---|
| `animatic` | 540×960 / 960×540 | 6 | none (`--plain` path) | lock the voice timing |
| `draft` | 540×960 / 960×540 | 15 | full, with `CINEMA.kMax = 6` | review the motion |
| `final` (default) | 1080×1920 / 1920×1080 | `--fps` (30) | full | delivery |

The shutter always follows the delivery rate (`--fps`, default 30), as in the pilot's `--quick`.
A draft frame is therefore a final frame with fewer motion-blur sub-frames, sampled 15 times a
second. `--plain` on another tier writes to `<tier>-plain/`, so it never mixes with finished
frames. `--aspect` defaults to `9x16`. A run renders one aspect.

## On disk

```
build/<tier>/<aspect>/
  manifest.json                 settings, the sha256 of each code file and of the page HTML, Chromium, start date, runs
  frames/<chunk:03d>/<frame:05d>.png    written as .png.tmp, fsynced, then renamed
  frames/<chunk>/frames.jsonl   one line per finished frame: frame, t, sha256, K, ms (fsynced; kept)
  frames/<chunk>/chunk.json     the versions that rendered into this chunk, and its verified encode
  chunks/<chunk:03d>.mp4        libx264 crf 15, yuv420p BT.709, constant fps, -g = fps
  master.mp4, master-audio.mp4, contact-sheet.jpg, audit.json, render.log, render.pid
films/skin-school-tiktok/out/<name>.mp4 + .jpg     the delivery file and its poster
films/skin-school-tiktok/motion/.tmp/              the page HTML, at the pilot's depth (see below)
```

Chunk k covers frames [k·chunk·fps, (k+1)·chunk·fps). `--chunk` defaults to 10 s and must be a
whole number of frames. Each page loads the whole scene and renders only the frames it is given,
so the shutter stops at the scene's real end, not at a chunk edge.

The page sits in `motion/.tmp/`. From there, a scene's `../vendor/three.module.min.js` resolves
through `motion/vendor` (a link to the pilot's vendor folder), and
`../../../../kits/cinema/...` resolves too. The finish goes in after the exact line
`import * as THREE from "../vendor/three.module.min.js";`, as in the pilot. A 3D scene without
that line is refused, so it cannot render silently without the finish.

## What counts as done, and when it refuses

- **A frame is done** when its PNG exists, its frames.jsonl line exists, and the PNG's sha256
  matches that line. A frame whose chunk has a verified mp4 is also done (the mp4's size and
  sha256 must match chunk.json).
- On resume, it also removes stray `.tmp` files and starts a fresh line after a cut-off
  frames.jsonl line. PNGs without a line, or with the wrong hash, are rendered again.
- **The code hash** is the sha256 of the scene module, motion.js, studio3d.js and cinema3d.js.
  When the scene lives in this film's folder, `../film.json` is included too, because the scene
  reads it at import. `--resume` refuses (exit 2) when the hash differs from the manifest's. It
  also refuses when the page HTML or the Chromium build differs, and the error names the changed
  files. `--force-mixed` accepts the mix and records it under `mixed` in the manifest.
- **Different settings** (size, fps, shutter, kMax, plain, chunk length, scene id or length)
  are always refused. Use `--fresh` over the whole film, or another `--build`.
- **Without `--resume`**, a run refuses to touch chunks that already hold frames. `--fresh`
  discards the chunks the range touches, or every chunk when there is no range. The checks
  run before anything is deleted, so a refused run deletes nothing.
- **`--assemble`** refuses chunks that were rendered by more than one version (from
  chunk.json), unless you pass `--force-mixed`.

## Robustness

- **Fresh pages:** a new page every 300 frames (`--page-frames`).
- **Retries:** a frame that throws, hits a page error or crash, or runs past `--frame-timeout`
  (600 s) is retried on a fresh page, up to 2 times. If Chromium itself is gone, it is
  relaunched. After the third failure the run stops with exit 3 and an error that names the
  frame, its time and its chunk.
- **Encode failures:** a failed chunk encode is logged as an ERROR, the PNGs are kept, and
  rendering goes on. The run then ends with exit 4, and the next resume encodes that chunk first.
- **Signals:** on SIGINT or SIGTERM the renderer stops ffmpeg and Chromium, records the run, and
  exits 130 or 143. A SIGKILL leaves no Chromium behind (tested).
- **One render at a time:** a lock file (`build/.render.lock`, keyed to a live `render.mjs` PID)
  allows one render, `--assemble` or `--cues` at a time for this film, whatever `--build` is.
  The pilot's renderer does not take this lock.
- **Exit codes:** 0 done · 2 refused · 3 a frame failed 3 times · 4 an encode, verify or
  assembly step failed · 1 unexpected · 130/143 a signal.
- **run.sh:**
  - It always passes `--resume`.
  - It saves the options to `build/last-run.args`, so a bare `run.sh` repeats them. With nothing
    saved, a bare `run.sh` refuses instead of starting a final render.
  - It refuses `--fresh`.
  - It restarts render.mjs after exit 1 or 3, up to 3 times. A kill by PID (137/143) is not
    restarted.
- **Progress:** one line per 30 frames (frame, t, K, s/frame over the last 30, ETA). One line
  per finished chunk (K avg/max, s/frame, size, frames verified). A summary at the end.

## Chunk finish and assembly

1. **Chunk finish.** When every frame of a chunk is done, it is encoded with libx264 (crf 15,
   preset medium, yuv420p, BT.709 tags as in made-with-claude, constant fps, keyframe every
   second). The result is written to `.part.mp4`, decoded with `ffprobe -count_frames`, then
   renamed. Next, chunk.json records its size and sha256, and the PNGs are deleted
   (`--keep-png` keeps them).
2. **`--assemble`** works on the chunks covering `--from/--to`, or the whole film by default:
   1. It joins them with the concat demuxer (`-c copy`) into `master.mp4` and checks the packet
      count.
   2. `--audio` is muxed with no `-shortest`. AAC is copied, anything else is encoded to AAC
      256k with a warning. The lengths are checked before and after the mux: more than one frame
      apart stops the assembly with exit 4.
   3. The delivery file is encoded to `out/<name>.mp4`: crf 19, preset slow, maxrate 12M,
      bufsize 24M, yuv420p, faststart. The frame count and the A/V lengths are checked again.
   4. The poster is taken at `--poster` seconds (default: the scene's `poster`).
   5. The contact sheet (`contact-sheet.jpg`) is built by ffmpeg straight from the chunk mp4s:
      one frame every 2 s, with timestamps.
3. **Naming.** `--name` defaults to `skin-school-pore-<aspect>` for the whole final film. Other
   tiers add `-<tier>`, and a partial range adds `-<from>s-<to>s`, so a review cut never
   overwrites the delivery file.

## Measured on this container (2026-10-22)

Measured on 4 CPUs with SwiftShader, Chromium 141.0.7390.37, one page, no other render running
unless noted. The scene is the pilot's 8-2 (26 s) unless noted. The test output is in
`build/render-test/` (git-ignored; delete it when done).

**Seconds per frame**

| What | s/frame | K |
|---|---|---|
| animatic 540×960, 6 fps | 0.52–0.59 | – |
| draft 540×960, 15 fps, frames 0–89 | 1.30–1.42 | avg 2.2, max 5 |
| final 1080×1920, t = 9 s (first frame on the page / next frame) | 11.7 / 9.7 | 11 |
| final 1080×1920, t = 20 s (two frames) | 7.1 / 6.9 | 2 |
| final 1080×1920, one frame every 2 s over 0–24 s (13 frames) | mean 4.9–5.1 (3.1–10.1) | 2–12 |
| final 1080×1920, **the TikTok scene** at 3, 10, 20, 30, 40, 50, 58 s | mean 5.7 (2.9–13.5) | 2–17 |

- Opening a page costs 1–2 s, and the first frame on it costs about 1 s extra (warm-up).
- A final PNG is 2.75–2.85 MB, a draft PNG 0.76–0.85 MB.
- At 5–6 s a frame, the 60 s film (1,800 frames) is about 2.5–3 h of rendering. Expect more if
  the busy shots (K 12–17) run long.

**Kill and resume (draft, frames 0–89, chunks of 2 s)**

1. Run A was started through run.sh and killed by PID with SIGKILL after frame 43, 14 frames
   into chunk 1.
   - Chunk 0 was already encoded.
   - No Chromium process was left behind.
   - run.sh did not restart it (exit 137).
2. Then, by hand, frame 42's PNG was cut to 20 KB, half a frames.jsonl line was appended, and a
   stray `.png.tmp` was added.
3. Resuming with a bare `run.sh` found 43 of 90 frames done. It reported the cut-off line and
   the hash mismatch, and rendered the other 47.
4. A was compared with clean runs B and C: all 90 per-frame sha256s were identical. The chunk
   mp4s were byte-identical too.
5. `run.sh stop` (SIGTERM) in the middle of chunk 1 exited with 143 and left nothing running.
   The resume rendered 22 of 60 frames, and all 60 matched A.

**Refusals and faults**

- Refusals: an edited scene module with `--resume` was refused (exit 2, "changed: scene"). So
  were a run without `--resume` over existing frames, and a different `--chunk`.
- `--fresh` with other code was refused before deleting anything. `--force-mixed` let it
  through. `--assemble` then refused the two versions until given `--force-mixed`.
- Injected faults (`RENDER_TEST_FAULTS=frame:throw|close|crash|hang`) all recovered on fresh
  pages, with a new page every 5 frames: a throw, a closed page, a crashed renderer, and a hang
  with a 5 s timeout. The frames were identical to an uninterrupted render.
- Three faults on one frame stopped the run with exit 3, naming the frame.
- A failing ffmpeg kept rendering, exited with 4 and kept the PNGs. The resume encoded both
  chunks first.

**Assembly (draft 0–6 s, 90 frames)**

- Audio 6.2 s was refused: 0.200 s apart, more than one frame (0.067 s).
- Audio 6.05 s was muxed: 50 ms apart, which is within one frame.
- An AAC .m4a was copied, and a WAV was encoded to AAC 256k.
- The delivery file had 90 frames at 15 fps, BT.709, with moov before mdat, at 1.8 Mbps.
- The poster at 3.00 s is frame 45 exactly: PSNR 45.6 dB against frame 45, and 29 dB against
  its neighbours.

**Determinism**

- **Uninterrupted renders are byte-identical** from run to run: draft A, B and C (90 frames,
  plus their chunk mp4s), and final 13 frames twice.
- **Draft frames on a fresh page** match too: after a resume, and with a new page for every
  frame (30 frames).
- **Final frames, each on its own fresh page**, against the same frames rendered in sequence:
  1 of 13 differs. That is frame 420 (t = 14 s), where 1 pixel of 2,073,600 is off by 1 in one
  channel, in the dark background.
  - Repeated sequential runs never differ, so this comes from state that the previous frame
    leaves on the page, not from chance.
  - A resumed or page-rotated final render can therefore differ from an uninterrupted one by
    the odd pixel at one level. Resume checks each frame against its own hash, so it is not
    affected.
- **Plain path (animatic) with the pilot scene before commit 545e1fa:** 19 of 24 frames
  differed between a sequential render and a fresh page per frame.
  - The differences were 2,962–17,653 pixels (0.6–3.4%), with channel differences up to 244:
    the labels were placed with the previous frame's camera.
  - With `camera.updateMatrixWorld()` in `place()` (545e1fa), all 24 frames are identical.
  - Finished frames were not affected, because the sub-frame renders update the camera before
    the last seek.
- **The pilot's "2–5 of 52 samples vary"** was not reproduced. It is probably page history:
  its `--verify` renders sample after sample on one page, and its sample hashes are misindexed
  after `--from`. The pilot's `--verify` was not rerun to confirm this.
