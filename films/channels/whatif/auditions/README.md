# Back of the Envelope: narrator auditions (27 Oct 2026)

Three Kokoro-82M voices read the draft episode-1 hook and one explanatory line (same text, same chain).
Narration will be labelled "Narration: synthetic voice (AI)". Taken elsewhere, never used here:
af_bella (Rest Frame), bf_emma (Meanwhile, Inside), am_michael (Light Minute), af_heart (Lumevina).

> Dig a tunnel straight through the Earth and step in. How long until you pop out the other side?
> For decades, textbooks said forty-two minutes. They assumed Earth is equally dense all the way down. It isn't: the core is roughly twice as dense as the rock above it.

(Draft wording, not yet fact-checked; the episode's claims.json will set the final figures.)

| File | Voice | Hook pace | Explanation pace | Pitch range, explanation (10–90%) | Aligner |
|---|---|---|---|---|---|
| `am_puck.m4a` | American male, Kokoro grade C+ | 3.78 w/s | 3.16 w/s | 13.7 semitones | 49/49 words heard |
| `bm_fable.m4a` | British male, grade C | 3.72 w/s | 3.16 w/s | 9.7 semitones | 49/49 |
| `af_kore.m4a` | American female, grade C+ | 3.73 w/s | 2.95 w/s | 12.4 semitones | 49/49 |

("forty-two" is reported as unheard by all three because the recogniser writes it as "42".)

Chain, identical for all three: `tts.py` at speed 1.0 → 0.5 s / 0.9 s / 0.6 s air → 80 Hz high-pass,
+1.5 dB at 140 Hz, −3 dB at 320 Hz, +2.5 dB at 3.2 kHz, +3 dB shelf from 9 kHz (polish.py's EQ) →
2:1 compressor → −16 LUFS, −1.5 dBTP → AAC 192k.

**Recommendation: am_puck.** The widest, most animated intonation of the three on the explanatory
line (13.7 st against 9.7 for bm_fable), which suits "playful premise, rigorous middle"; the best
Kokoro grade still free (C+). Risk: it is American male like Light Minute's am_michael; Puck sits
brighter and quicker, but if the owner wants a clear separation on the combined Instagram, **bm_fable**
(British male, no channel has one) is the alternative. All three run fast at speed 1.0, so the
episodes will voice at about 0.92–0.95.
