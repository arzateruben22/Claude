# Outer Layer: narrator auditions (27 Oct 2026)

Each file reads episode 1's hook and one explanatory line from its why beat, with the film's
pronunciation list (`ep01/pron.json`), at Kokoro speed 1.0, 0.8 s apart:

> Is the skin you see alive? Not one cell of it.
> Scientists picture it as a brick wall: dead cells for bricks, fats for mortar. And that wall is what keeps your water inside.

Polish: 80 Hz high-pass, loudness-normalised to −16 LUFS (speech level for listening on a phone),
true peak ≤ −1.3 dBTP, AAC 128 kb/s mono. Not mixed with music. Voices already taken in the studio
(never used here): af_bella, bf_emma, am_michael, af_heart.

| File | Voice | Pace (words/s, hook · why) | Speech recogniser | Notes |
|---|---|---|---|---|
| `af_nicole.m4a` | af_nicole (US female, Kokoro grade B−) | 2.65 · 2.03 | every word heard | Soft and breathy, close to a whisper. Kindest-sounding, but slow: a 175-word episode would run about 85 s, so it needs `--speed` ≈ 1.15 or a shorter script; a near-whisper also reads as "skincare ASMR", the register of beauty ads this channel is meant to stand apart from, and thins out on phone speakers under music |
| `bf_isabella.m4a` | bf_isabella (UK female, C) | 3.98 · 3.32 | every word heard | Clear, calm, a clinic-explainer register; Latin and technical words land. Fast at 1.0, comfortable at `--speed` ≈ 0.9 |
| `am_fenrir.m4a` | am_fenrir (US male, C+) | 4.55 · 3.18 | every word heard | Low and steady. Distinct from the three female narrators, but the studio already has an American male (am_michael, Light Minute) |

**Recommendation: bf_isabella at `--speed 0.9`.** It is the clearest of the three in the measured
and heard checks, its calm, unhurried register fits "calm, precise, kind" without the beauty-ad
softness of af_nicole, and at 0.9 it lands in the studio's 2.2–3.0 words/s band. The risk is that
Meanwhile, Inside (bf_emma) is also British and female; the timbres differ (Isabella is lower and
warmer), and Outer Layer's look and sound set it apart. If the owner prefers a male voice, am_fenrir
at `--speed 0.92` is the alternative. Re-voicing before the final render is cheap (voice →
align → compile).
