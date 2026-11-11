# Channel identity files

One JSON file per active channel. Each is the machine-readable summary of that channel: who it is, how it looks and
sounds, which formats it makes, and the rules that bind every episode. A new episode starts from four inputs
(channel name, topic, target duration, output format); everything else it needs comes from here.

| File | Channel | Prefix | Branch | Voice from Season 3 | AI stand-in for drafts |
|---|---|---|---|---|---|
| [skincare.json](skincare.json) | Skin Sense | `ss` | `claude/outer-layer-s1-b` | guest: Evelyn's recordings (`voice-evelyn/`) | AI voice `bf_isabella` |
| [physics.json](physics.json) | Reality Rulebook | `rr` | `claude/physics-s2` | tts: AI voice `af_bella` at speed 0.85 | none needed |
| [whatif.json](whatif.json) | Possibility Lab | `pl` | `claude/whatif-s2` | owner's recordings (`voice-owner/`) | AI voice `am_puck` |
| [space.json](space.json) | One More Orbit | `oo` | `claude/space-s2` | owner's recordings (`voice-owner/`, none received yet) | AI voice `am_michael` |

Body Backstage is archived and has no identity file.

## What each field means

| Field | Meaning | Where the value comes from |
|---|---|---|
| `slug`, `name`, `prefix`, `branch`, `filmsPath` | Folder name, public name, id prefix, the branch the channel is built on, its folder on that branch | `films/channels/voice-scripts/make_recording_script.py` (`CHANNELS`), the branch list |
| `tagline` | The channel's one-line promise as published | `theme.json` `promise` on the channel branch |
| `promise` | What every episode must deliver | the channel `bible.md` |
| `identity.palette` | On-screen colour tokens, upper-case hex | `theme.json` `tokens`; Skin Sense: `set/ss3.mjs` and `theme-ivory.json` |
| `identity.type` | Display, body and mono font families | `theme.json` `type` |
| `identity.look`, `lighting`, `camera`, `materials` | The look in words, as built today | `bible.md`, `theme.json` `scene`, the `set/` module headers |
| `identity.signatureDevices` | Recurring devices that make a frame recognisable | `theme.json` `motif`, `bible.md` |
| `seasonLooks.s<N>` | A season's look on top of the base identity. `palette` holds only the tokens that change. `status` is `approved` or `pending look gate` | the owner's dated decisions in [SEASON-FORMAT.md](../../SEASON-FORMAT.md), the season's script or art notes |
| `voice` | `kind` is `tts`, `owner` or `guest`. `id` is the voice name passed to `kits/cinema/voice/tts.py --voice` for `tts`, or the recordings folder inside the channel folder for `owner` and `guest`. `wpm` is the reading pace used to time recording scripts | `make_recording_script.py`, the channel's `vo/lines.json` |
| `sound` | Score preset, foley, loudness target and sound rules | `kits/cinema/studio/vibes/*.json`, `theme.json` `motif.sound`, `kits/cinema/film/qa.py` |
| `formats.<kind>` | One entry per format the channel makes: `short`, `premium`, `part`, `long`. A missing kind means the channel does not make that format | [SEASON-FORMAT.md](../../SEASON-FORMAT.md), `kits/cinema/film/render.mjs` (`TIERS`) |
| `packaging` | The channel's title-and-thumbnail DNA and its packaging accent | [PACKAGING.md](../../PACKAGING.md), [STUDIO-STYLE.md](../../STUDIO-STYLE.md) |
| `cta.section` | The bold heading of the channel's like/follow lines | [CTA.md](../../CTA.md) |
| `rules`, `never` | Binding rules and prohibitions for this channel | the shared rule files and the channel bible |
| `sources` | Where the values came from. `branch:path` means a file on that branch; a bare path is on this branch | |

`version` is the version of this file format, not of the channel. Change it only when a field is added, removed or renamed.

## How tools read them

- Path: `films/channels/studio/identities/<slug>.json`. Plain JSON, UTF-8. No tool needs more than the standard library.
- Find a channel by `slug`, or by `name` without regard to case ("Skin Sense" gives `skincare`).
- Episode id: `prefix` + `-s<season>e<nn>` (see [../schema/](../schema/)).
- `formats[kind]` fills `format` in `episode.json`. If the kind is missing, stop and ask: the channel has no such format.
- `voice` fills `voice` in `episode.json`. For `owner` and `guest`, drafts use the AI stand-in named in `rules` (and in the
  table above) and are labelled as AI. Evelyn's voice is never synthesised.
- `seasonLooks["s<season>"]` fills `look`. If its `status` is not `approved`, set `status.lookGate` to `pending` in
  `episode.json` and do not start a full build.
- `cta.section` selects the lines in [CTA.md](../../CTA.md). Rotate them; never write a new one into a script.
- A `sources` entry with a branch is read with `git show origin/<branch>:<path>`.

```python
import json
from pathlib import Path

def identity(channel, root="films/channels/studio/identities"):
    for f in sorted(Path(root).glob("*.json")):
        d = json.loads(f.read_text(encoding="utf-8"))
        if channel.lower() in (d["slug"], d["name"].lower()):
            return d
    raise SystemExit(f"no identity file for {channel!r}")

ch = identity("Possibility Lab")
fmt = ch["formats"]["part"]          # {'aspect': '9:16', 'size': [1080, 1920], 'fps': 30, 'durationS': [61, 75], ...}
```

Builders work on their channel branch, where this folder may be missing or old. Read the current file from the shared
branch: `git show origin/claude/made-with-claude-film:films/channels/studio/identities/<slug>.json`.

## What these files are not

They do not draw anything. The renderer still themes a frame from each channel's `theme.json`
(`kits/cinema/film/page.mjs`), and the picture comes from the channel's `set/` code. An identity file is the summary
that planning, scaffolding and QA tools read. If it disagrees with `theme.json` on a hex or a font, `theme.json` is
what the viewer sees, so correct the identity file in the same change.

## How to change one

The order of authority, highest first:

1. The owner's latest dated decision, in the owner's words.
2. The shared rule files on this branch: [SEASON-FORMAT.md](../../SEASON-FORMAT.md), [PACKAGING.md](../../PACKAGING.md),
   [CTA.md](../../CTA.md), [STUDIO-STYLE.md](../../STUDIO-STYLE.md), [DECISIONS.md](../../DECISIONS.md).
3. The channel's `theme.json` on its branch.
4. The channel's `bible.md` on its branch.
5. The directive's summaries (they are older than several of the above).

Steps:

1. Write the owner's decision, dated, into the shared rule file it belongs to. Quote the owner where the wording matters.
2. The channel builder updates `theme.json` and `bible.md` on the channel branch if pixels change.
3. Edit the identity file here: the value, then a `sources` entry for where it came from. For a season look, add or
   edit `seasonLooks.s<N>` and leave the base `identity` alone.
4. Set `seasonLooks.s<N>.status` to `approved` only after the owner has approved a still and a test clip. Until then it
   stays `pending look gate`.
5. Check it parses: `python3 -I -c "import json,sys; [json.load(open(f)) for f in sys.argv[1:]]" films/channels/studio/identities/*.json`
6. Tell the channel builder. A change here does not reach a channel branch by itself.

Never change `slug`, `prefix` or `branch` without the coordinator: file names, episode ids, Prism's season slates and the
owner's upload links depend on them.

## Where the files differ from the directive's summaries

| Channel | The directive says | The files record | Why |
|---|---|---|---|
| Skin Sense | ivory, peach, rose, navy shadows, deep green `#00685F` | That as the base identity, plus `seasonLooks.s3`: voxel skin layers on `#0B1513`, teal `#3FBFAE`, ivory serif captions, `pending look gate` | The owner's 11 Nov 2026 decision in SEASON-FORMAT.md is newer. The owner is asked to confirm it for Season 3 |
| Skin Sense | peach and rose as colours | No hex for peach or rose | No token for them exists in the repo; they come from the paintings |
| Reality Rulebook | cobalt `#2F5BFF` | On-screen cobalt `#1F3BD1` (`theme.json`); `#2F5BFF` only as `packaging.accent` | `#2F5BFF` is the packaging and Prism colour, not a scene token |
| Reality Rulebook | high-speed photography look | "Daylight lab" lit like a high-speed photo studio; Season 3 is a daylight kitchen | Same idea, the channel's own name for it |
| Possibility Lab | small glossy blue faceless mannequin | A flat-shaded blue faceless anchor figure (`set/anchor.js`) | That is how it is built; glossy is not rendered today |
| One More Orbit | indigo `#080A1C`, teal `#4FE3C6`, lilac `#B9A6FF` | The same; `packaging.accent` is violet `#5B3FD0` | Matches |
