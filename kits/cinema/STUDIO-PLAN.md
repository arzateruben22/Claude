# Master studio for longer films: the plan

Longer films (60 s to 3 min, 9:16 first) with sound built in: voice, an original score and
foley composed from the same timeline as the picture, then mixed and mastered for TikTok, Reels
and Shorts. First film: Skin School, "Why does a pore clog?" (`films/skin-school-tiktok/`).

This plan came out of a research and design run on 2026-10-22: four researchers (TikTok specs,
our two audio engines, rendering at length, voice tooling in this container), three competing
designs (narration-first, music-first, event-first), a judge, and a completeness critic. The
narration-first design won. The critic's corrections are folded in below.

## The idea in one paragraph

You give a topic. Claude writes a script with one spoken line per beat. A compiler turns the
script and the voice's measured word times into one timeline (`film.json`). The picture, the
captions, the score, the foley and the voice all read it, so nothing drifts. The voice sets the
clock: speech is stretched by ±10% at most, while camera keys and music recompile for free. With
no voice, the captions set the clock. The score is composed from the film's style-guide tokens
(light, palette, pacing, scale), so each client gets their own sound, the way they get their own
palette.

## Layout

```
kits/cinema/
  events.json          one row per event kind: sound lead (s), family, priority, K floor
  studio/              numpy only (no scipy)
    dsp.py             filters (FFT), envelopes, reverb, saturation, seeded noise
    meter.py           BS.1770 loudness (gated), true peak (4x), loudness range, mono check
    master.py          true-peak limiter, master to target, stems, AAC encode + re-measure
    duck.py            the music dips under the voice (attack, release, pre-roll)
    instruments.py     pads, plucks, bells, taps, fizz, plop, splash, swell, ticks, whoosh, sub
    compose.py         tempo grid, sections, chords, arrangement by energy, foley from events
    vibes/*.json       one preset per client sound (key, mode, BPM, palette, space, foley)
    qa.py              loudness on the decoded AAC, sync per event kind, music under voice
  voice/
    setup.sh           pinned venv + model downloads with SHA256 (models are never committed)
    tts.py             Kokoro, one call per line, pronunciation list applied as phonemes
    align.py           Parakeet word times + snap to the first frame with sound
  script/
    compile.py         script.md + voice timings + preset -> film.json
    shots.js           shot(kind, box, t0, t1, aspect) -> camera keys
```

Each film commits its generated voice WAVs, word-timing JSON and pronunciation list, so
rendering and mixing never need the voice venv.

## Numbers we design to

| Item | Value | Source / status |
|---|---|---|
| Frame | 1080×1920, 30 fps, H.264 yuv420p faststart, 10–12 Mbps | TikTok API docs; bitrate from third-party guides |
| Length | over 60 s (Creator Rewards needs > 1 min, but also account eligibility, unchecked); 3:00 posts everywhere | TikTok docs, partly verified |
| Loudness | −14 LUFS integrated, ≤ −1 dBTP **measured on the delivered AAC** | Common practice; TikTok publishes no target. Verify with a private test upload |
| Limiter | start at −2.0 dBTP, then lower by 0.5 dB until the AAC reads ≤ −1.5 dBTP | The prototype leaks ~0.2 dB; AAC adds 0.6–0.9 dB (synthetic test only) |
| Safe box, organic (TikTok/Reels/Shorts) | text and named subjects inside x 90–900, y 250–1420 | TikTok third-party figures; Reels/Shorts unverified |
| Safe box, if promoted as an ad | L-shape: x 120–900 for y 240–840, then x ≤ 780 and y ≤ 1213 | TikTok ad template as reported; strictest figures |
| Hook | question spoken and captioned by 2.0 s (TikTok says 3 s); payoff image at frame 0 | Our pick |
| Captions | 56–72 px, ≤ 32 characters a line, ≤ 2 lines, ≥ 1 s on screen, word highlighted, 4.5:1 | Our pick + accessibility floor |
| Labels | ≥ 0.035×H tall, 4.5:1, never overlapping captions, colour never the only cue | Critic |

## Render reality on this container

| Step | 60 s film |
|---|---|
| Voice | about 1 min |
| Score, mix, master | a few min (target) |
| T0 animatic, 540×960, finish off | a few min |
| T1 draft, 540×960, 15 fps | about 15 min |
| T2 final-look stills, one per 2 s | about 7 min |
| T3 final, 1080×1920 30 fps | 2.9–3.7 h calm to mixed (measured on made-with-claude); about 5.5 h for action |

- **Background jobs stop at 2 h at most** (30 min by default), and a worker restart can kill a
  render. So T3 runs in **chunks of 60–90 min**, detached and polled, each resumable: PNGs written
  under a temp name and renamed, a `frames.jsonl` line per frame, retry on a fresh page, a new page
  every ~300 frames. Chunk edges sit only on hard cuts, or the shutter clamps at a fake edge.
- **One job at a time.** Voice, alignment, audio and QA never run during a render (two jobs slow
  each other 1.6–1.8×).
- Each finished scene is encoded to an intermediate and its PNGs deleted (peak disk ~1.5 GB).
- Delivery joins the intermediates, adds the mastered audio, checks that both lengths match
  within one frame (no `-shortest`), and makes a < 15 MB preview for the Artifact.

## Sessions, each with an exit check

1. **Studio core.** `events.json`, `studio/` (meter, limiter, master, duck, instruments,
   compose), the `lumevina-dew` preset. Proven by re-scoring the existing 26 s 8-2 pilot from a
   compiled cue sheet. **Exit:** −14 ±0.5 LUFS and ≤ −1 dBTP on the AAC, every event kind in sync
   within ±1 frame, no render needed.
2. **Voice and captions.** `voice/setup.sh`, TTS with the pronunciation list, word times measured
   against ground truth (not assumed), the compiler, captions, a T0 animatic with the full mix.
   **Exit:** every caption word lit within ±1 frame of its onset; science terms signed off by ear.
3. **Picture.** Chunked, resumable renderer (fixing render.mjs's `--from` bugs, 1080×1920), the
   TikTok layout pass on her page (header and caption out of the apps' UI zones, her `#cap`
   replaced by the new captions), the scene stretched to 60 s, T1 and T2 for approval.
4. **Final.** T3 in chunks, every gate, the < 15 MB Artifact preview, the delivery packet (MP4,
   post text with "voice: synthetic", cover frame), then commit.

## Gates before posting (people, not code)

- **Evelyn's written approval** of the script, voice, score and the posting account. Her lesson
  clips are silent on purpose; this adds narration in her identity.
- **Expert review of the skin claims** ("Mandelic acid keeps the pore clear", "Benzoyl peroxide
  clears the bacteria", "Judge it at 8 to 12 weeks"), and a disclaimer if she wants one.
- **AI labelling:** TikTok's AI-generated toggle on, and "voice: synthetic" in the post. EU AI Act
  Article 50 transparency applies from 2 Aug 2026; get a legal read for EU audiences.
- **Branded content:** if a post promotes products, turn on TikTok's disclosure.
- **A listen** on phone speakers (mono, nothing under ~200 Hz) and headphones.

## Still unverified (treat as starting values)

The vibe table (warm → lydian, cool → dorian and so on), the tempo tiers, the ducking depths, the
caption plate width, Parakeet's word-level accuracy inside phrases, Kokoro's determinism across
onnxruntime versions, the AAC true-peak overshoot on real voice + music, and Reels/Shorts safe
zones. Each is measured, not assumed, in the session that first needs it.
