# Season 3 (spinning Earth), finishing in the owner's voice: survey (16 Nov 2026)

Source data: `voice-owner-spoken/cutA` (script A, L01–L19 cut into 94 sentence wavs), `/tmp/Vheard.json` (ASR of recording V, words with times), `parts_plan.json`, `script-v4.md`, `CTA.md`.

## 1. What can be cut from the existing recordings
**Recording V (158 s) already holds every opening, cliffhanger, closer and ask** — nothing in group (a) is missing:
| Lines | Where in recording V | Status |
|---|---|---|
| V01–V16 openings/cliffhangers P1–P8 | 2.7–62.4 s | all heard. V12 was spoken "And the **day** keeps getting shorter" (script said "days") and V14 "At an hour and a half, **you're** almost weightless": captions follow the speech as heard. V13/V14 run together with ~0 gap (cut at a word boundary, check by ear) |
| V17–V24 closers "Part N of eight. Full video on YouTube." | 65.9–~92 s | recorded (C3–C8 not listed, as asked) |
| V25–V28 asks | 101–157 s | recorded, but with the old lead-in ("Hang on.") and way back ("Okay, back to the math."). **The new one-sentence ask is cut from inside V25/V26: "If you're enjoying this, tap like and follow." / "...and subscribe."** (the YouTube cut) — no new recording |

**Script A sentences (cutA/s001…s094)** are all there, one clean take each. Usable as they are = every sentence without a distance/speed/mass unit (see 2b for the ones that have one). One fix: `s047` ("The farther from the equator, the longer you keep your weight.") starts with 71 s of silence (the owner paused): trim to 71.1–73.4 s, no re-record.

### Part plan from the owner's v4 sentences (what each part is made of)
| Part | Open (V) | Body (cutA sentences) | Spoken ask | Closer | Cliff (V) | est. speech | est. film |
|---|---|---|---|---|---|---|---|
| 3 | V05 "The air can't keep up with the ground." | L06.2, **NEW ground-speed**, **NEW gust**, L06.5, L06.6 | odd: 1 sentence after "strip the surface" | none | V06 | 30 s | ~50 s |
| 4 | V07 | L07.2, **NEW sea height**, **NEW depth**, L07.5, L07.6 | none | C4 (V20) | V08 | 29 s | ~48 s |
| 5 | V09 | L08.1–.4, L09.1, **NEW equator speed**, L09.3, L09.4 | odd, after "five and a half percent lighter" | none | V10 | 33 s | ~52 s |
| 6 | V11 | L10.2, L10.3, L11.1, L11.2, L11.3 (trimmed), L11.4 | none | C6 (V22) | V12 | 32 s | ~50 s |
| 7 | V13 | L12.1, **NEW speed**, **NEW weight**, L13.1, **NEW jump**, L13.3, L13.4 | odd, after "you weigh half" | none | V14 | 37 s | ~55 s |
| 8 | V15 | **NEW weight**, **NEW jump**, L14.3 (+L14.4 = V16) | none | C8 (V24) | V16 | 23 s | ~40 s (short: it is the shortest part in every version) |

## 2. Minimal recording list for the owner
### (a) openings / cliffhangers not yet recorded: none.
### (b) sentences that still say km/h, kilometers, meters or kilograms: re-record in US units (on-screen numbers = speech)
HUD speed = 1,040 mph × (23.934 h / day length), rounded to 10. Weight lost = (spin / 17)². 1 km = 0.6214 mi, 1 kg = 2.2046 lb, 1 m = 3.281 ft.
| For | Old (in the recording) | NEW wording to record | Conversion / check |
|---|---|---|---|
| P3, long | L06.3 "...about sixteen hundred and seventy kilometers an hour" | "The ground moves through it at about a thousand and forty miles an hour." | 1,670 km/h = 1,038 mph; HUD 1,040 mph |
| P3, long | L06.4 "...strongest gust ever measured was about four hundred and eight kilometers an hour" | "The strongest gust ever measured was about two hundred and fifty miles an hour." | 408 km/h = 253 mph; 1,040 / 250 = 4.2, so L06.5 "four times faster" still holds (the gust source, c24, is still OPEN) |
| P4, long | L07.3 "...thirty-three kilometers higher" | "At a twelve hour day the sea wants to stand about twenty miles higher at the equator." | 33 km = 20.5 mi |
| P4, long | L07.4 "...three point seven kilometers deep" | "The ocean is only about two point three miles deep." | 3.7 km = 2.30 mi |
| P5, long | L09.2 "...nearly seven thousand kilometers an hour" | "The equator moves at about forty-one hundred and fifty miles an hour." | 1,040 × (23.934 / 6) = 4,148 mph (6,679 km/h) |
| P7, long | L12.2 "...over thirteen thousand kilometers an hour" | "The ground moves at about eighty-three hundred miles an hour." | 1,040 × 7.98 = 8,297 mph (13,358 km/h) |
| P7, long | L12.3 "...seventy kilograms feels like fifty-five" | "You weigh twenty-two percent less: a hundred and fifty pounds feels like a hundred and seventeen." | (7.98 / 17)² = 22.0%; 150 × 0.78 = 117 lb (70 kg = 154 lb) |
| P7, long | L13.2 "...half a meter now lifts you about a meter" | "The jump that lifts you a foot and a half now lifts you about three feet." | g halves, so jump height doubles (0.5 m = 1.6 ft) |
| P8, long | L14.1 "...seventy kilograms becomes eight" | "At an hour and a half you are almost weightless, about one eighth of your weight: a hundred and fifty pounds becomes about eighteen." | (15.96 / 17)² = 88.1%, weight 11.9% (about 1/8); 150 × 0.119 = 17.9 lb |
| P8, long | L14.2 "A half-meter jump carries you about four meters ..." | "A foot-and-a-half jump carries you about thirteen feet, higher than a basketball hoop, and a cup falling off a table takes about three times as long to land." | jump ×8.4: 1.5 ft → 12.6 ft (4 m = 13.1 ft; hoop = 10 ft); fall time × sqrt(8.4) = 2.9 |
| long only | L03.1 "...sixteen hundred and seventy kilometers an hour" | "Right now the ground carries you at about a thousand and forty miles an hour." | 1,670 km/h = 1,038 mph |
| long only | L05.3 "...thirty-three hundred kilometers an hour, nearly three times the speed of sound" | "The ground moves at about two thousand and eighty miles an hour, nearly three times the speed of sound." | 1,040 × 23.934 / 12 = 2,074 mph (P2 already shows ≈2,080 mph); 2,080 / 767 = 2.7 |
| long only | L15.1 "...seven point nine kilometers a second, the speed of a satellite in low orbit" | "At a day of an hour and twenty-four minutes, the ground moves at about seventeen thousand seven hundred miles an hour, the speed of a satellite in low orbit." | 1,040 × 17 = 17,680 mph (7.9 km/s = 4.9 mi/s) |
| long only | L18.1 "...sixteen hundred kilometers an hour" | "So the next time you stand still, remember you're already moving at a thousand miles an hour." | 1,040 mph |
Count: **10 sentences for the parts (about 40 s of speech); 14 for the long film (about 60 s).** L17.2 ("six times ten to the thirty-first joules") has no US unit; keep it unless the owner says otherwise.
### (c) anything else genuinely missing: nothing to record. To fix without recording: trim `s047`; V12/V14 wording as heard; the "vs. a still Earth" label (below).

## 3. The 16 Nov rules for ALL parts
- **P1 (v3, in Prism):** drops the closer (3.35 s) and the 5.1 s ask becomes the 2.6 s sentence cut from V25. Everything after the ask moves 5.9 s earlier: re-render from about 36 s on (chunks 3–4, ~30 min) + audio + captions.
- **P2:** drops its spoken ask (5.1 s): re-render from the ask on (~29 s, chunks 2–4, ~35 min). Closer C2 stays.
- **P3/P5/P7 (odd):** one-sentence ask after the payoff, no closer. **P4/P6/P8 (even):** closer, no spoken ask. Pop-up on every part (coordinator adds).
- **Open item "vs. a still Earth":** the weight row says "WEIGHT 98.6%": add the small label "vs. a still Earth" (on P1 from 20 s, P2 from 18 s, P5, P7, P8 and the long film). For P1/P2 do it in the same re-render as the ask change (chunk ranges above already cover the weight row except P1 chunk 2 and P2 chunk 1: +10 min each).

## 4. Time estimates (render about 1.6 s per frame; one render at a time)
- **One part (P3–P8): about 70 min** = prep and sentence cutting 15 min + render 40–45 min + QA/subscribe splice 12 min. P3 first; then P4, P5, P6, P7, P8 in order: **about 7 h total**. With the stand-in voice for unrecorded sentences the timing is swap-ready (windows from words.json; same steps as PRODUCTION.md), so the owner's new sentences need only audio + captions, plus a picture re-render only for a span whose length moved by more than 0.1 s per beat.
- **Long film:** the owner's pace changes every timing, so it re-renders whole: about 5.5–6 min of film = ~10,000 frames = **about 5 h render** + ~1 h prep, master encode and QA. The partial v2 chunks on disk follow the stock-voice timing and cannot be reused.
- **P1/P2 rule update + label:** about 70 min each (can run while recordings are pending).
