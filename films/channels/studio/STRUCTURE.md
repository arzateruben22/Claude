# Folder structure

Where every file lives, what it is called, and what Prism Studio reads. Marks used below:

- **today**: exists on the branch named.
- **S3**: Season 3 adds it, following rules already written in [SEASON-FORMAT.md](../SEASON-FORMAT.md).
- **new**: added by this blueprint.

Prism's importer is strict about names. A file in the wrong place is not an error: it is silently ignored. Check
names against this page before a push.

## 1. Which branch holds what

| Branch | Holds | Written by |
|---|---|---|
| `claude/made-with-claude-film` | The shared rules (`films/channels/*.md`), briefs, recording scripts, this blueprint (`films/channels/studio/`), and Prism Studio's production code (`prism-studio/`). Its copies of `films/channels/<slug>/` are old | Coordinator |
| `claude/physics-s2` | `films/channels/physics/`: Reality Rulebook, current | Its builder |
| `claude/space-s2` | `films/channels/space/`: One More Orbit, current | Its builder |
| `claude/whatif-s2` | `films/channels/whatif/`: Possibility Lab, current | Its builder |
| `claude/outer-layer-s1-b` | `films/channels/skincare/`: Skin Sense, current | Its builder |
| `main` | The Taqueria Los Güeros site. Never touched by channel work | Nobody here |

- Read another branch without switching: `git show origin/<branch>:<path>` and `git ls-tree -r --name-only origin/<branch> -- <path>`.
- The kit (`kits/cinema/`) is on every branch. `film/render.mjs`, `film/qa.py`, `cinema3d.js` and `studio/qa.py` are identical on the four channel branches and the shared branch. The rest is forked (`git diff` of `kits/cinema` against the shared branch, 11 Nov 2026); merge before changing any of these (Roadmap stage 1):
  - `film/compilation.mjs`: five versions (each channel branch and the shared branch).
  - `script/lint.py`: three forks (Reality Rulebook, One More Orbit, Skin Sense) plus the base, which Possibility Lab's branch keeps unchanged.
  - Also forked: `sci/hud.js` (Reality Rulebook); `script/claims_sheet.py`, and a new `script/test_via.py` (One More Orbit); `studio/compose.py` (Possibility Lab); `kits/cinema/motion/` (Skin Sense only).
  - Missing on Skin Sense's branch: `film/splice.py`, `RENDERER-README.md`, `requirements.txt`, `.env.example`.
- Channel branches also carry old copies of `prism-studio/` and of the shared rule files (One More Orbit and Possibility Lab keep `CTA.md`, `PACKAGING.md` and `SEASON-FORMAT.md` inside the channel folder). The copies on `claude/made-with-claude-film` are the current ones.
- `films/channels/body/` (Body Backstage) is archived. Ignore it.

## 2. The shared folder, on `claude/made-with-claude-film`

```
films/channels/
  PACKAGING.md  SEASON-FORMAT.md  CTA.md  STUDIO-STYLE.md  DECISIONS.md      today  shared rules
  CHATGPT-ART-PROMPTS.md  MASTER-PROMPT-CHATGPT.md  MASTER-PROMPT-NEW-USER.md today  prompts the owner pastes into ChatGPT
  briefs/                    today  builder and coordinator briefs, STANDARDS-v2.md
  voice-scripts/             today  make_recording_script.py and one <channel>-season-N-recording-script.md per season
  packaging-drafts/          today  title and thumbnail drafts made before a film exists
  crosscheck.json            today  the early cross-channel check
  .gitignore                 today  ignores */*/build/, */compilations/*/work/, *.part.mp4, finals.log
  studio/                    new    this blueprint
    README.md  STRUCTURE.md  SHOTS.md  NEW-EPISODE.md  QA.md  AUTOMATION.md  ROADMAP.md  LIBRARY.md
    identities/<slug>.json   new    one identity file per channel
    schema/                  new    episode.schema.json, shot.schema.json
    qa/rubric.json           new    the hard gates and the 100-point rubric, as data (QA.md)
    templates/               new    starting files, including the Episode Intelligence Report
    tools/                   new    python3 standard-library tools: new_episode.py, validate.py, qa_episode.py
    reports/                 new    README.md (how reports are written) and season reviews
    archive/<slug>.json      new    one row per delivered episode or long video (section 9; Roadmap stage 3)
```

## 3. A channel folder, on that channel's branch

```
films/channels/<slug>/
  theme.json                 today  the look the renderer reads (tokens, fonts, sizes, safe box)
  fonts/                     today  self-hosted faces and their licences, SOURCES.md
  bible.md                   today  the channel's full look, sound and episode template
  PRODUCTION.md  KIT-CHANGES.md  today  the build log, and what the channel changed in the kit
  set/                       today  reusable scene modules and channel tools (LIBRARY.md lists them)
  library/                   today  owner-made art kept for reuse (.webp)
  auditions/ or review/      today  narrator auditions
  season2/                   today  SLATE.md (the three film channels), and One More Orbit's packaging, cover, posting and bridge tools
  ep01/ ... ep12/            today  Seasons 1 and 2, six episodes each
  ep13/ ...                  S3     Season 3 episodes or parts (section 6)
  compilations/<name>/       today  one folder per long video: what Prism imports (section 5)
  voice-owner/               S3     the owner's recordings (Possibility Lab today; One More Orbit when they arrive)
  voice-evelyn/              S3     Evelyn's recordings (Skin Sense only)
  <long film working folder> S3     script, scene, voice and art of the season's long film (section 5)
```

Channel-only items that exist today:

| Channel | Extra folders and files |
|---|---|
| Reality Rulebook | `lf01/` (Season 3 long film, working folder), `ep13/` to `ep20/` (its parts: compiled, not rendered) |
| One More Orbit | `long01/` (Season 3 long film: script, `calc.py`, claims, `art/`), `compilations/s2-bridges/` (bridge lines and their claims) |
| Possibility Lab | `longform/earth-spin/`, `longform/earth-hole/`, `longform/cold/`, `voice-owner/`, `cta/`, `covers.py`, `srt.py`, `posting_pack.py`, `declutter.py`, `voice-lines-s3.md` |
| Skin Sense | `theme-ivory.json`, `s3-slate/` (eight packaging drafts), `s3-looktest/` (the look-gate clip), `voice-evelyn/`, `looktest/`, `looktest2/`, `concepts/`, `reference/`, `s1v2/`, `shelved-s1/`, and alternate cuts `ep04s/`, `ep07c/` to `ep11c/` |

Prism imports only two-digit `epNN` folders inside a season slate, and `compilations/<name>/`. It never sees any other folder.

## 4. An episode folder: short, premium lesson or part

Folder: `films/channels/<slug>/epNN/`, two digits. The same shape serves all three 9:16 kinds.

| Path | What it is | Written by | Prism reads it |
|---|---|---|---|
| `episode.json` | **new.** The master episode spec ([schema/](schema/)) | Scaffold tool, then the builder | No |
| `shots.json` | **new.** The shot manifest ([SHOTS.md](SHOTS.md)) | Builder | No |
| `script.md` | `## beat {direction}` headings and `vo:` lines with claim tags | Builder | Yes: script and hook |
| `claims.json` | The claims ledger: `id, claim, sentence, source_url, source_title, accessed, verified_via, status, note` | Builder; a person sets a claim to OK | Yes: sources |
| `calc.py`, `calc.json` | Every computed number (Possibility Lab, and every long film) | Builder | No |
| `pron.json` | Pronunciations for the AI voice | Builder | No |
| `voice.py` | Per-line voice speeds (One More Orbit, Possibility Lab, Skin Sense) | Builder | No |
| `vo/` | One WAV per line, `lines.json`, `words.json` | `kits/cinema/voice/` | No |
| `compile.py` | The episode's direction; writes `film.json` and `sheet.json`. Skin Sense uses the shared `set/build_ep.py` instead | Builder | No |
| `film.json` | The clock the renderer reads: `id`, `dur`, `fps`, `title`, `shots`, `captions`, cues, `disclosures` | The compile step. Never edited by hand | Yes: title, duration, captions, AI flags |
| `sheet.json` | The sound cue sheet | The compile step | No |
| `scene.mjs` | The picture: a browser module with `window.seek(t)` | Builder | No |
| `art/` | Owner-made paintings, their layers and depth maps, `index.json` | Owner, then the builder | No |
| `audio/` | Skin Sense only: mix, stems, `qa.json`. Other channels keep sound in `build/audio/` | `kits/cinema/studio/render.py` | No |
| `build/` | Frames, chunks, logs, `qa-delivery.json`. Git-ignored | `kits/cinema/film/render.mjs`, `qa.py` | Only `build/qa-delivery.json` |
| `review/` | `scene-table.md`, `claims-table.md`, `clarity-review.md`, the scorecard, `HUMAN-REVIEW.md`, and **new** `qa-report.json` (written by `tools/qa_episode.py`), `rubric-scores.json` (the people's scores and gates) and `intelligence-report.md` | Builder and reviewers | No |
| `out/` | The delivery (next table) | Render and export tools | Yes |

Files in `out/`. `<name>` is the delivery name (section 8).

| File | What it is | Rule |
|---|---|---|
| `<name>-9x16.mp4` | The master, 1080x1920, 30 fps | Exactly one file may end in `-9x16.mp4`: Prism takes the first it finds. Drafts end in `-9x16-draft.mp4` |
| `<name>-9x16.jpg` | The poster frame | Same name as the master. A missing poster shows as a broken picture in Prism |
| `<name>-cover.jpg` | The designed 9:16 cover, 1080x1920 | Must be modified after the master, or Prism uses the poster |
| `<name>-9x16-youtube.mp4` | The YouTube file, 1440x2560, an upscale | Must not be older than the master |
| `packaging.json` | Titles, thumbnails, the winner ([PACKAGING.md](../PACKAGING.md)) | The winner title becomes the YouTube title |
| `<name>.srt` | Captions as a file | Optional. Prism builds captions from `film.json`, never from this |
| `POSTING.md`, `posting.json` | Posting text | Optional; `npm run text:pack` in `prism-studio/` writes them |
| `<name>-9x16-contact.jpg`, `-cover-480.jpg`, `-thumb.jpg` | Contact sheet and small covers | Optional |

A 16:9 file in an episode folder is ignored. Prism records every episode as 1080x1920 without measuring it.

Set `disclosures.aiVisuals` and `disclosures.aiVoice` in `film.json`. Prism falls back to "is there an `art.json`" for
visuals, and the push never sends `art.json`, so the flag is the only reliable signal. Prism still hard-codes
`aiVoice: true`; reading the flag is on the Season 3 list (section 10).

## 5. A long video

A long video has two folders: one to work in, one that Prism imports.

**Working folder**, at the channel root. Prism's push skips it, so anything can live here.

| Channel | Season 3 working folder (today) |
|---|---|
| Reality Rulebook | `lf01/` |
| One More Orbit | `long01/` |
| Possibility Lab | `longform/earth-spin/` |
| Skin Sense | none: its long video is the six lessons joined at the end of the season. Its plan (`episode.json`, the card narration, its claims) sits in a sub-folder of the delivery folder, `compilations/s3/plan/`; a sub-folder is never pushed (Season 2 kept its card narration in `compilations/vol02/voice/` the same way) |

Keep Season 3's folders as they are; renaming mid-build breaks paths (`ep13/film.json` points at `../lf01/scene.mjs`).
From the next film on, use `longform/<film-slug>/` on every channel. Inside it: `episode.json` and `shots.json` (**new**),
`script.md`, `claims.json`, `calc.py`, `calc.json`, `pron.json`, `vo/` (the AI voice), `vo-owner/` (lines cut from the
owner's real recording) or `vo-own/` (lines of the owner's cloned voice: synthetic, labelled AI), the compile step, `film.json`,
`sheet.json`, `scene.mjs`, `art/`, `review/`, `packaging.json`, and `out/` for drafts.

**Delivery folder**: `films/channels/<slug>/compilations/<name>/`. Only finished files go here.

| File | Required | Rule |
|---|---|---|
| `<name>-16x9.mp4` | Yes | The 2560x1440 upload. One video per folder: Prism takes `<name>-16x9.mp4`, else the first other `*-16x9.mp4`. Do not add a second (for example a 1080 copy) |
| `thumbnail.jpg` | No, but always make it | 1920x1080 JPG under 2 MB ([PACKAGING.md](../PACKAGING.md)). `compilation.mjs` writes it at 1280x720: render it with the channel's own tool (section 12) |
| `chapters.txt` | No, but needed for linking | One line per part. **Every line must equal exactly one part's title.** One extra or changed line and nothing links |
| `description.md` | No | Its first line is the fallback title (3 to 100 characters) |
| `qa.json` | No | Prism shows `fails`, `dur`, `lufs` |
| `packaging.json` | No, but always make it | The winner title is the YouTube title. `kits/cinema/film/compilation.mjs` does not write it: copy it from the working folder |
| `work/` | | Git-ignored intermediates. Sub-folders are never pushed |

Naming the delivery folder:

| Kind | Folder | Example |
|---|---|---|
| A long film (one story, 8 parts) | `compilations/<film-slug>/` | `compilations/earth-spin/earth-spin-16x9.mp4` |
| A season's joined long video | `compilations/s<season>/` | `compilations/s3/s3-16x9.mp4` (Skin Sense Season 3) |
| Already delivered | `compilations/vol01/`, `compilations/s2/`, Skin Sense's `compilations/vol02/` | Leave them as they are |

In `episode.json`, a long film's `folder` is the delivery folder's name, and its number is 0 (`pl-s3e00`).

Known problems to avoid:

- SEASON-FORMAT.md says parts link through `description.md`. They link through `chapters.txt`.
- Possibility Lab's `compilations/s2/chapters.txt` has a seventh line, "The six answers, ranked", that matches no episode, so none of its episodes link.
- `compilation.mjs` marks QA failed over 95 MB or outside 5 to 11 minutes. Prism shows the failure and still imports.
- A single continuous 16:9 film has no tool yet that writes its 2560x1440 file ([README.md](README.md), "Master resolution per format").

## 6. Seasons, slates and folder numbers

| Season | Reality Rulebook, One More Orbit, Possibility Lab | Skin Sense | State |
|---|---|---|---|
| 1 | `ep01` to `ep06`, shorts; `compilations/vol01/` | `ep01` to `ep06`; `compilations/vol01/` | today |
| 2 | `ep07` to `ep12`, shorts; `compilations/s2/` | `ep07` to `ep12`; `compilations/vol02/` | today |
| 3 | `ep13` to `ep20`: parts 1 to 8 of the long film; `compilations/<film-slug>/` | `ep13` to `ep18`: six premium lessons; `compilations/s3/` | S3 |
| 4 | starts at `ep21` | starts at `ep19` | later |

- A part folder holds its own `script.md`, `claims.json`, `film.json` and `out/`, like any episode. Its `film.json` names the long film's scene (Reality Rulebook: `"scene": "../lf01/scene.mjs"`), so one scene gives both renders.
- Part N of 8 is folder `ep(12+N)`. Part 8 stops before the payoff; the payoff exists only in the long film.
- A part's title must equal its line in the film's `chapters.txt`, character for character.
- Season plans before any folder exists: `season2/SLATE.md` (today), Skin Sense's `s3-slate/*.packaging.json` (today), `films/channels/packaging-drafts/` (today).
- Prism knows a season only from a slate in its importer. Folders outside every slate import nothing: Reality Rulebook's `ep13` to `ep20` exist today and are invisible to Prism until section 10 is done.
- A season in Prism is a `series` row found by its title. Never rename a season's series title.
- Prism shows a later season once its first folder (`ep13`) exists. Push `ep13` before, or together with, the film.

## 7. Voice, owner art and packaging

**Voice recordings**, on the channel's branch:

| Path | Holds | State |
|---|---|---|
| `films/channels/whatif/voice-owner/` | `pl-s3-partA-1.m4a`, `pl-s3-partA-2.m4a`, `pl-s3-parts-closers-cta.m4a`, `proof.m4a`, `README.md`, `cut.py`, `cutS.py`, cut lines | today |
| `films/channels/space/voice-owner/` | `oo-s3.m4a` (Part A), `oo-s3-parts.m4a` (Part B), `part-closers.m4a` (Part C), `oo-s3-cta.m4a` (Part D) | S3: none received yet |
| `films/channels/whatif/longform/earth-spin/vo-own/` | Lines of the owner's cloned voice for the Season 3 film's Part A (synthetic, labelled AI). `vo-owner/` beside it holds the lines cut from his real recording | S3: named in `compile.py`; not committed on the branch as of 11 Nov 2026 |
| `films/channels/skincare/voice-evelyn/` | `evelyn-s3-full.m4a` (9:02) | today |
| `films/channels/voice-scripts/<channel>-season-N-recording-script.md` (shared branch) | What the speaker reads, in four parts | today |
| `films/voice-inbox/` (shared branch) | Loose recordings of the owner, before they are placed | today |

- File names are the recording script's (`films/channels/voice-scripts/make_recording_script.py`): `<prefix>-s<season>.m4a`, `<prefix>-s<season>-parts.m4a`, `part-closers.m4a`, `<prefix>-s<season>-cta.m4a`. [SEASON-FORMAT.md](../SEASON-FORMAT.md) still writes the last one as `<pl|oo>-cta.m4a`, without the season (Roadmap 1.8). The owner may send one file or several; the folder's `README.md` records what each holds and when it arrived.
- Recordings are never edited in place. Cut lines go to the episode's `vo/` (or `vo-owner/`) through `kits/cinema/voice/polish.py` and `align.py`.
- Evelyn's recordings are used as recorded. No AI copy of her voice, ever. Her written OK and credit choice are recorded by the owner; put a TODO in the handoff until they are.
- Skin Sense and One More Orbit use real recordings in Season 3. Possibility Lab's Season 3 film uses the owner's cloned voice for Part A, labelled AI (`disclosures.aiVoice` true; "Narration: a synthetic version of the owner's own voice (AI)"), with his real takes for the part lines and as the alternate set. His consent to the clone is not on record in the repo yet.
- No `.wav` or `.m4a` reaches Prism: the push skips `vo/`, `voice-owner/` and `voice-evelyn/`.

**Owner art** (paintings made in ChatGPT):

| Path | Holds |
|---|---|
| `<episode or working folder>/art/` | The paintings used by that film, as `.webp`. Skin Sense adds layers `-L0`, `-L1`, `-L2`, a `-depth.png` and `index.json` (`set/art_index.py`) |
| `films/channels/<slug>/library/` | Paintings kept for reuse across episodes and covers |
| `<working folder>/art/README.md` | What each painting is for and what it may not be used for (One More Orbit: `long01/art/README.md`) |

- Every film that shows a painting sets `disclosures.aiVisuals` to true and says "AI illustration" in its description.
- Record a painting's real pixel size. One More Orbit's are 1672x941 and Skin Sense ep12's are 941x1672: both are smaller than the master, so they are upscaled and are never called native.
- Prompts: [CHATGPT-ART-PROMPTS.md](../CHATGPT-ART-PROMPTS.md), and `chatgptPrompt` in each `packaging.json`.

**Packaging**:

| Path | Holds |
|---|---|
| `epNN/out/packaging.json` | One per episode, lesson or part (9:16 cover) |
| `compilations/<name>/packaging.json` | One per long video (16:9 thumbnail) |
| `films/channels/packaging-drafts/`, `skincare/s3-slate/` | Drafts written before the film exists. Hypotheses, not decisions |

Prism keeps `winner`, `titles[].text`, `thumbnails[]`, `pairings[]`, `checks`, `testAndCompare`, `thumbnailFile`,
`chatgptPrompt` and `format`. It drops any key it does not know (`scoresNote`, `notes`) and ids over 8 characters. The
shape is in [PACKAGING.md](../PACKAGING.md).

## 8. Naming conventions

| Thing | Pattern | Example |
|---|---|---|
| Channel slug | lower case, fixed | `skincare`, `physics`, `whatif`, `space` |
| Episode id (in `episode.json`, `shots.json`) | `<prefix>-s<season>e<nn>`; the long film is `e00` | `rr-s3e01`, `pl-s3e00` |
| Episode folder | `epNN`, two digits, numbered through the channel's life | `ep13` |
| Delivery name, three film channels | `<channel-name>-s<season>e<nn>` | `reality-rulebook-s3e01` in `ep13/out/` |
| Delivery name, Skin Sense | `skin-sense-<folder number, three digits>` | `skin-sense-013` in `ep13/out/` |
| Delivery name, Season 1 (all channels) | `<channel-name>-<folder number, three digits>` | `one-more-orbit-001` |
| Master, poster, cover, YouTube file | `<name>-9x16.mp4`, `<name>-9x16.jpg`, `<name>-cover.jpg`, `<name>-9x16-youtube.mp4` | |
| Long video | `compilations/<name>/<name>-16x9.mp4` | `compilations/s2/s2-16x9.mp4` |
| Shot id | `S01`, `S02`, ... | |
| Claim id | `c1`, `c2`, ... | |
| Voice line | `vo01`, file `vo/01.wav` | |
| Recording | `<prefix>-s<season>.m4a`, `<prefix>-s<season>-parts.m4a`, `<prefix>-s<season>-cta.m4a`, `part-closers.m4a` | `oo-s3-parts.m4a`, `oo-s3-cta.m4a` |
| Recording script | `<channel-name>-season-<N>-recording-script.md` | `skin-sense-season-3-recording-script.md` |

Rules for every name:

- Lower case, digits, hyphens. No spaces: Prism's push skips names with spaces.
- `x` in aspect tags inside file names (`9x16`, `16x9`); a colon in JSON (`"9:16"`).
- Every committed file is under 90 MB.
- `film.json` `id` is set by the compile step and names the render's output. It does not have to equal the episode id.

## 9. Episode Intelligence Reports and the archive

| What | Where | Branch | State |
|---|---|---|---|
| The report for an episode, lesson or part | `films/channels/<slug>/epNN/review/intelligence-report.md` | Channel branch | new |
| The report for a long video | `<long film working folder>/review/intelligence-report.md` | Channel branch | new |
| The template | `films/channels/studio/templates/` | Shared branch | new |
| The archive index | `films/channels/studio/archive/<slug>.json` | Shared branch | new; the tool that builds it is Roadmap stage 3 |

- The report is written by the builder when the episode is delivered, and updated once when analytics exist. It keeps
  two lists apart: **verified** (measured by a tool or read from a platform, with the file or screen it came from) and
  **hypotheses** (what we think worked and why). No number is written without its source. "Not yet measured" is a valid entry.
- `review/` is never pushed to Prism, so a report cannot leak into a post.
- The archive index holds one row per delivered episode or long video: id, folder, title, branch and commit, delivery
  date, each delivered file with its size and whether its pixels are native or an upscale, the QA result, the internal
  rubric score, the report's `branch:path`, and whether Prism has it. It is built from the channel branches with
  `git show` and `git ls-tree`, never typed by hand.

The archive that exists today:

| Layer | What it keeps |
|---|---|
| git, on each channel branch | Every delivered file: masters, YouTube files, covers, packaging, reviews |
| Prism Studio | Uploaded seasons move to Library, Archived seasons (read-only). Episode videos are erased from its server 3 days after both "Uploaded" buttons; covers, captions and text stay. Long videos are never erased |
| `films/library.py` | A download page. Stale: it lists three channels under their old names |

## 10. What Prism needs before Season 3 imports

All in `prism-studio/` on `claude/made-with-claude-film` (Roadmap stage 1). Deploy items 1 and 2 first, then push `ep13`
before or with the film.

1. `scripts/import-episodes.ts`: add a `SEASON3` slate. Film channels: 8 titles identical to the film's `chapters.txt` lines. Skin Sense: 6 titles. The series title starts "Season 3:".
2. `seasonsFor`: add Season 3 at `first: 13`, or derive `first` from the earlier slate lengths.
3. `slateForEpisode`: no change; add a test.
4. Read `film.json` `disclosures.aiVoice` instead of the hard-coded `aiVoice: true`. In Season 3, Skin Sense and One More Orbit use real recordings; Possibility Lab uses the owner's cloned voice, labelled AI; Reality Rulebook keeps its AI voice.
5. `src/domain/metadata.ts`: posting wording for a real voice, and for the owner's cloned voice ("a synthetic version of the owner's own voice (AI)").
6. `metadata.ts` reads only `hook`, `why`, `takeaway` or `whoa`. Season 3 parts have `hook`, `body`, `tease`: fall back to `body`.
7. The importer appends "?" to a hook that is a statement. Fix.
8. `src/domain/lessons.ts`: no change needed for a pushed film. `registerCompilation` links parts through `linkByChapters`, which has no count limit; `LESSON_MAX = 6` is used only by `createLesson` and the Lessons form (the owner piling shorts inside Prism). Optional: raise it to 8 only if the owner should be able to build an 8-part lesson inside Prism.
9. `registerCompilation`: retry linking when no parts are linked, so corrected chapters take effect.
10. `src/domain/catalog.ts`: no change needed.

## 11. Pushing to Prism

- Tool: `prism-studio/scripts/push-media.mjs` (`npm run media:push`), then the import (`npm run import:episodes`). SEASON-FORMAT.md names `push-one.sh`; that file is tracked on no branch.
- The coordinator pushes, from a checkout of `claude/made-with-claude-film`: that branch holds the current `prism-studio/`. Skin Sense's branch has no `scripts/push-media.mjs`, and the three film branches hold an older copy (`src/domain/media-push.ts` differs too).
- Bring the delivered files in without committing them, fix the times, look at what would be sent, then push with the channel slug:

  ```
  git checkout origin/<branch> -- films/channels/<slug>/epNN/script.md films/channels/<slug>/epNN/claims.json \
      films/channels/<slug>/epNN/film.json films/channels/<slug>/epNN/out films/channels/<slug>/compilations/<name>
  # set each cover and YouTube file one second newer than its master (prism-studio/RUNBOOK.md)
  touch -d @$(( $(stat -c %Y <master>) + 1 )) <cover or YouTube file>
  cd prism-studio
  node scripts/push-media.mjs --dry-run <slug>      # must list only the files you brought in
  node scripts/push-media.mjs <slug>
  npm run media:check                               # where the studio's database is: it reads the imported episodes
  ```

- The dry run matters. The push sends every file under `films/channels/<slug>/` whose size or modified time differs from the server's copy, and the shared branch's checkout still holds old copies of other episodes (for Skin Sense, masters that differ from the channel branch's). If the dry run lists a file you did not bring in, stop: an old copy would replace a newer final. Without the slug it walks every channel folder.
- `git checkout origin/<branch> -- <paths>` also stages those files. Do not commit them on the shared branch; restore the paths afterwards.
- A scratch tree avoids both problems: `git archive origin/<branch> <paths> | tar -x -C <scratch>`, copy `prism-studio/scripts/push-media.mjs` to `<scratch>/prism-studio/scripts/`, set each cover's time (`git archive` gives every file the commit's time, so a cover is not yet newer than its master), and run the copy from there. It sends only what is in the scratch tree, and nothing is staged.
- `build/qa-delivery.json` is git-ignored, so it does not come across either way: Prism then shows no kit QA result for the episode.
- Sent: `script.md`, `claims.json`, `film.json`, `build/qa-delivery.json`, and every file directly in `out/`, `compilations/` and `compilations/<name>/` ending mp4, jpg, jpeg, png, srt, vtt, json, md or txt (up to 2 GB each).
- Skipped: every other folder, `art.json`, `theme.json`, webp and wav files, names with spaces, `ep100` and above, cleared videos, archived channels.
- A checkout scrambles modified times, which is why the step above sets them: a cover older than its master is not used, and an older YouTube file falls back to the 1080 master.
- A malformed `film.json` or `claims.json` fails the whole import. Validate JSON before pushing.
- Nothing is published by a push. The owner posts by hand and presses "Uploaded".

## 12. Mismatches found, to fix

| Finding | Effect | Fix |
|---|---|---|
| Skin Sense `ep04` to `ep12` and `s3-looktest/` already hold an `episode.json` in another shape (the input of `set/ss3.mjs`; in the look test, of `set/night.mjs`) | It collides with the new master spec's file name | Rename the old file's role before the first Season 3 lesson (for example `compose.json`, one change in `set/ss3.mjs`, `build_ep.py`, `make_sheet.py`, `tables.py`). Roadmap stage 1. Until then do not validate those folders |
| Skin Sense writes delivery QA to `review/qa-delivery.json` (`set/final.sh`) | Prism reads only `build/qa-delivery.json`, so its QA result is not attached | Write it to `build/` as the other channels do |
| Three names for a long film's working folder (`lf01`, `long01`, `longform/<slug>`) | Tools cannot guess the path | `longform/<film-slug>/` from the next film on; Season 3 stays as built |
| The shared `films/channels/.gitignore` ignores `*/*/build/` only | `lf01/build/` and `long01/build/` are covered; a `longform/<slug>/build/` is not. Possibility Lab's branch already adds `whatif/longform/**/build/` | Add `*/longform/**/build/` on every branch when `longform/` becomes the rule |
| Skin Sense's `theme.json` still holds the old violet look; its bible and `s3-looktest/BRIEF.md` predate the Season 3 voxel decision | A builder reading them builds the wrong look | Read `identities/skincare.json` and SEASON-FORMAT.md first; update the branch files at the look gate |
| `episode2d.json` in Skin Sense `ep12` | Its role is not documented | The builder documents or removes it |
| Section 5 and [PACKAGING.md](../PACKAGING.md) ask for `thumbnail.jpg` at 1920x1080; every version of `compilation.mjs` writes it at 1280x720 (`scale=1280:720`) | A long video's thumbnail is delivered below the asked size | Render the thumbnail with the channel's own tool at 1920x1080 (One More Orbit: `season2/make_long_thumb.py`), or change `compilation.mjs`'s scale when its forks are merged (Roadmap 1.3) |
| [PACKAGING.md](../PACKAGING.md) still gives "The Moon Starts Coming Closer. It Won't Stop." as a good title; `identities/space.json` forbids it as retired (it reads like a real event) | A builder copying the example writes a title the channel may not use | Replace the example in PACKAGING.md (Roadmap 1.8) |
