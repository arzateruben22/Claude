"""python3 -I kits/cinema/script/test_numerals.py — the caption number rule, case by case (exit 1 on a failure)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from numerals import numerals, numerals_text   # noqa: E402

CASES = [
    ("In nineteen oh six they shared a Nobel, still arguing.", "In 1906 they shared a Nobel, still arguing."),
    ("In the nineteen fifties, electron microscopes finally showed it: a gap.", "In the 1950s, electron microscopes finally showed it: a gap."),
    ("In sixteen forty-four, Torricelli saw why.", "In 1644, Torricelli saw why."),
    ("In two thousand and twelve, it crossed into interstellar space.", "In 2012, it crossed into interstellar space."),
    ("A one-meter fall takes about point four five seconds, thrown or dropped.", "A 1-meter fall takes about 0.45 seconds, thrown or dropped."),
    ("First, just the drop, slowed twenty times.", "First, just the drop, slowed 20 times."),
    ("It flies twenty centimeters farther and still lands.", "It flies 20 centimeters farther and still lands."),
    ("Throw twice as fast, then three times: forty centimeters, then sixty.", "Throw twice as fast, then three times: 40 centimeters, then 60."),
    ("Measure it: nine gaps, a twentieth of a second each.", "Measure it: nine gaps, a twentieth of a second each."),
    ("Which ball lands first? One thrown sideways, one just dropped.", "Which ball lands first? One thrown sideways, one just dropped."),
    ("a dimpled disc, about seven and a half micrometers.", "a dimpled disc, about 7.5 micrometers."),
    ("The tightest vessels are about three micrometers: less than half its width.", "The tightest vessels are about 3 micrometers: less than half its width."),
    ("It coasts at about seventeen kilometers a second.", "It coasts at about 17 kilometers a second."),
    ("Earth to the Moon in six hours.", "Earth to the Moon in 6 hours."),
    ("crossed one hundred and thirty million light-years", "crossed 130 million light-years"),
    ("Melt down one point three million Earths", "Melt down 1.3 million Earths"),
    ("Some are more than a thousand times wider.", "Some are more than 1,000 times wider."),
    ("They matched to within a few parts in a million billion.", "They matched to within a few parts in a million billion."),
    ("Faster than a Formula One car.", "Faster than a Formula One car."),
    ("Voyager has crossed day one of fifteen hundred.", "Voyager has crossed day one of 1,500."),
    ("Thick wrapped ones, up to one hundred and fifty.", "Thick wrapped ones, up to 150."),
    ("about twenty-three hours", "about 23 hours"),
    ("Nearly six turns a second.", "Nearly six turns a second."),
    ("Each one has four iron atoms", "Each one has four iron atoms"),
    ("Oh, look at that.", "Oh, look at that."),
    ("At the tips hang about half a billion sacs.", "At the tips hang about half a billion sacs."),
    ("the air above one square centimeter weighs just over a kilogram.", "the air above 1 square centimeter weighs just over a kilogram."),
    ("Can one day outlast a year?", "Can one day outlast a year?"),
    ("To Proxima Centauri: four years and three months.", "To Proxima Centauri: four years and three months."),
    ("Light time, Sun to Earth: eight minutes, twenty seconds.", "Light time, Sun to Earth: 8 minutes, 20 seconds."),
]


def main():
    bad = 0
    for text, want in CASES:
        got = numerals_text(text)
        if got != want:
            bad += 1
            print(f"FAIL {text!r}\n   got  {got!r}\n   want {want!r}")
    toks = numerals([{"w": "In", "t": 1.0}, {"w": "nineteen", "t": 1.2}, {"w": "oh", "t": 1.5}, {"w": "six", "t": 1.7}, {"w": "they", "t": 2.0}])
    if [(t["w"], t["t"]) for t in toks] != [("In", 1.0), ("1906", 1.2), ("they", 2.0)]:
        bad += 1
        print(f"FAIL timing: {toks}")
    print(f"{len(CASES) + 1 - bad} of {len(CASES) + 1} pass")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
