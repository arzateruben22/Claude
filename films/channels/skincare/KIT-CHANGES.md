# Outer Layer: changes to shared kit files

Every change is additive: old films render and mix byte-identically.

| Date | File | Change | Why | Old films |
|---|---|---|---|---|
| 27 Oct | `kits/cinema/studio/instruments.py` | New voice `pluck(note, dur, vel, tag, bright, damp)`: a seeded Karplus–Strong nylon pluck | Outer Layer's melodic, label and signature voice (bible §3); no existing voice is a warm string, and bells, fizz, ping, mallet and blip belong to other identities | Unchanged: a new function appended to the file |
| 27 Oct | `kits/cinema/studio/compose.py` | `"pluck"` added to the melodic layer's voices (`_melodic`, reads `pluck_bright`) and to the foley voices (`_voice`, reads `bright`, `dur`, `vel`) | So a preset can name it | Unchanged: two new branches, each placed after every existing voice. Checked: `compose.score` on a test sheet with restframe-bench, meanwhile-pulse and lightminute-vacuum gives the same sha256 before and after |
| 27 Oct | `kits/cinema/studio/vibes/outerlayer-slide.json` | New preset (F major, 64.2857 BPM, pad + pluck; signature plucks F5, C6, A5 at 0, 7, 14 frames) | The channel's sound | New file |
| 27 Oct | `kits/cinema/studio/instruments.py` | New voice `reed(note, dur, vel, tag, breath, attack, bright)`: a soft breathy reed (odd harmonics, seeded vibrato, band-passed breath, a 30 ms chiff so its onset is exact) | The coordinator's note: plucks are Back of the Envelope's identity, so Outer Layer's melodic, label and signature voice is a blown reed nobody else uses. `pluck` stays in the kit for Back of the Envelope | Unchanged: a new function appended |
| 27 Oct | `kits/cinema/studio/compose.py` | `"reed"` added to `_melodic` and `_voice`, after every existing voice | So a preset can name it | Unchanged |
| 27 Oct | `kits/cinema/studio/vibes/outerlayer-slide.json` | Melody, labels, counters and the signature moved from `pluck` to `reed`; bed 5 dB up (music sat 20 LU under the voice); swells anchored on their peak | As above | Outer Layer only |
