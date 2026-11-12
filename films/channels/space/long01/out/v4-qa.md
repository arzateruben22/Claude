# v4 Part 1 and 2: QA (season3/qa_v4.py: 61-75 s, -14 LUFS, no still over 1.4 s, caption text = speech by ASR of the final mix)

## P1 follow (1080), after the motion fix (freezedetect also clean at d=1.0)
```
duration 65.69 s OK
loudness -14.0 LUFS OK
stills over 1.4 s: none OK
    0.35  caption: 'Watch the Moon.'
          speech : "Watch the moon. It's coming"
    1.18  caption: "It's coming closer."
          speech : "moon it's coming closer"
    6.54  caption: 'Tonight, the Moon starts coming closer.'
          speech : 'Tonight, the moon starts coming closer and it'
    9.63  caption: 'And it never stops.'
          speech : 'and it never stops.'
   12.71  caption: "Right now it's about 384,000 km away, drifting off 3.8 cm a year."
          speech : "Right now, it's about 384,000 kilometers away, drifting off 3.8 centimeters a year."
   20.54  caption: 'Tonight, it reverses.'
          speech : 'Tonight, it reverses a'
   22.55  caption: 'A thought experiment, built from real physics.'
          speech : 'a thought experiment built from real physics.'
   26.52  caption: 'Watch the number.'
          speech : 'Watch the number. It only'
   27.77  caption: 'It only goes down.'
          speech : 'It only goes down.'
   38.80  caption: '288,000.'
          speech : '288,000 a third.'
   41.05  caption: 'A third wider.'
          speech : 'A third wider.'
   46.28  caption: 'And the sea already feels it: more than twice the tidal pull.'
          speech : 'And the sea already fills it more than twice the tidal p'
   53.87  caption: 'If that made the sky feel bigger, tap like and follow.'
          speech : 'If that made the sky feel bigger, tap like and follow.'
   56.77  caption: 'Halve the distance, and the water starts to climb.'
          speech : 'Half the distance, and the water starts to climb.'
   62.08  caption: 'Part 1 of 8.'
          speech : 'Part 1 of 8.'
   62.99  caption: 'Full video on YouTube.'
          speech : 'Full video on YouTube.'
caption = speech: OK
QA PASS
```

## P1 subscribe (1440p source)
```
265 frames checked; edge flags: none
duration 66.17 s OK
loudness -14.1 LUFS OK
stills over 1.4 s: none OK
    0.35  caption: 'Watch the Moon.'
          speech : "Watch the moon. It's coming."
    1.18  caption: "It's coming closer."
          speech : "moon it's coming closer"
    6.54  caption: 'Tonight, the Moon starts coming closer.'
          speech : 'Tonight, the moon starts coming closer and it'
    9.63  caption: 'And it never stops.'
          speech : 'And it never stops.'
   12.71  caption: "Right now it's about 384,000 km away, drifting off 3.8 cm a year."
          speech : "Right now, it's about 384,000 kilometers away, drifting off 3.8 centimeters a year."
   20.54  caption: 'Tonight, it reverses.'
          speech : 'Tonight, it reverses a'
   22.55  caption: 'A thought experiment, built from real physics.'
          speech : 'a thought experiment built from real physics.'
   26.52  caption: 'Watch the number.'
          speech : 'Watch the number. It only'
   27.77  caption: 'It only goes down.'
          speech : 'It only goes down.'
   38.80  caption: '288,000.'
          speech : '288,000 a third.'
   41.05  caption: 'A third wider.'
          speech : 'A third wider.'
   46.28  caption: 'And the sea already feels it: more than twice the tidal pull.'
          speech : 'And the sea already fills it more than twice the tidal p'
   53.64  caption: 'If that made the sky feel bigger, tap like and subscribe.'
          speech : 'If that made the sky feel bigger, tap like and subscribe.'
   57.24  caption: 'Halve the distance, and the water starts to climb.'
          speech : 'Half the distance, and the water starts to climb.'
   62.55  caption: 'Part 1 of 8.'
          speech : 'Part 1 of 8.'
   63.47  caption: 'Full video on YouTube.'
          speech : 'Full video on YouTube.'
caption = speech: OK
QA PASS
```

## P2 follow (1080)
```
duration 55.20 s FAIL (outside 61-75 s)
loudness -14.1 LUFS OK
stills over 1.4 s: none OK
    0.36  caption: 'Half the distance.'
          speech : 'Half the distance.'
    1.50  caption: 'Now the ocean climbs.'
          speech : 'now the ocean climbs.'
    9.91  caption: 'Half the distance.'
          speech : 'Half the distance, twice.'
   11.80  caption: 'Twice as wide.'
          speech : 'Twice as wide.'
   13.83  caption: '8× the tidal pull.'
          speech : 'Eight times the title point.'
   27.00  caption: 'Not a measured height.'
          speech : 'Not a measured height.'
   33.10  caption: 'Just the idea: the whole ocean, lifted from above.'
          speech : 'Just the idea. The whole ocean lifted from above.'
   45.22  caption: 'Still looking up?'
          speech : 'Still looking up?'
   46.24  caption: 'Tap like and follow.'
          speech : 'Tap like and follow.'
   48.31  caption: 'And the night is about to change.'
          speech : 'And the night is about to change.'
   52.09  caption: 'Part 2 of 8.'
          speech : 'Part 2 of 8.'
   53.05  caption: 'Full video on YouTube.'
          speech : 'Full video on YouTube.'
caption = speech: OK
QA FAIL
```

## P2 subscribe (1440p source)
```
224 frames checked; edge flags: none
duration 55.96 s FAIL (outside 61-75 s)
loudness -14.1 LUFS OK
stills over 1.4 s: none OK
    0.36  caption: 'Half the distance.'
          speech : 'Half the distance.'
    1.50  caption: 'Now the ocean climbs.'
          speech : 'now the ocean climbs.'
    9.91  caption: 'Half the distance.'
          speech : 'Half the distance. Twice.'
   11.80  caption: 'Twice as wide.'
          speech : 'Twice as wide.'
   13.83  caption: '8× the tidal pull.'
          speech : 'Eight times the title point.'
   27.00  caption: 'Not a measured height.'
          speech : 'Not a measured height.'
   33.10  caption: 'Just the idea: the whole ocean, lifted from above.'
          speech : 'Just the idea. The whole ocean lifted from above.'
   45.34  caption: 'Still looking up?'
          speech : 'Still looking up tap'
   46.53  caption: 'Tap like and subscribe.'
          speech : 'Tap like and subscribe.'
   49.08  caption: 'And the night is about to change.'
          speech : 'And the night is about to change.'
   52.84  caption: 'Part 2 of 8.'
          speech : 'Part 2 of 8.'
   53.80  caption: 'Full video on YouTube.'
          speech : 'full video on YouTube.'
caption = speech: OK
QA FAIL
```
