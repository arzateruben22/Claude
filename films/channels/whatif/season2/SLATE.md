# Possibility Lab, Season 2: slate (ep07 to ep12)

Branch `claude/whatif-s2`. Same look, voice (am_puck, AI label) and structure as Season 1. Every figure below is a
CANDIDATE: no source has been opened by a person, so every claim starts OPEN in `claims.json`. Season 1 covered:
Earth tunnel, everyone in one city, ants, count to a billion, everybody jump, every raindrop. None repeat here.

## ep07 Walking to the Moon (the owner's pick; ep06's end card promises it)
- **Wait, what?** "How long would it take to walk to the Moon?"
- **Payoff:** nonstop at a steady pace it is about 9 years; at 8 hours a day, about 27 years. The sensitivity line
  is the walker's pace. Anchor: the longest recorded walks (a lap of the Earth is a tenth of it).
- **Assumptions:** a road exists; mean distance not the changing one; 5 km/h flat, no rest, then 8 h/day.
- **Claims:** Moon mean distance 384,400 km (NASA Moon fact sheet); average walking speed about 5 km/h
  (Bohannon 1997 / Mohler 2007, gait studies; hedged "comfortable pace"); arithmetic 384,400/5 = 76,880 h =
  8.8 yr; Earth circumference 40,075 km (NASA) as the anchor; longest-walk record (Guinness / news) as an
  OPEN anchor only.
- **Fits:** the destination the channel already promised; the simplest "same sum, huge number" story.

## ep08 Everyone holds hands
- **Wait, what?** "Everyone on Earth holds hands. How far does the line reach?"
- **Payoff:** about 14 million km: roughly 350 times around the equator, or 36 trips to the Moon.
- **Assumptions:** an arm span about equal to height (about 1.7 m, adult average); children and adults mixed
  (use an average of about 1.6 m as sensitivity); fingertip to fingertip, no gaps.
- **Claims:** world population about 8.2 billion (UN WPP 2024); mean human height or arm span (NCD-RisC,
  Lancet/eLife 2016 adult height; arm span ratio about 1.0 to height: Quanjer et al. 2014); equator 40,075 km
  (NASA); Moon distance 384,400 km (NASA).
- **Fits:** the same comparison engine as ep02 (the crowd) but linear, and it ties people to the planet.

## ep09 All the gold
- **Wait, what?** "Melt every ounce of gold ever mined. How big is the block?"
- **Payoff:** about 215,000 tonnes: a cube roughly 22 m on a side, which fits inside a tennis court's footprint
  (about 23.8 x 10.9 m) when stacked to a house's height.
- **Assumptions:** pure gold at 19.3 g/cm3; estimate of mined stock (about +/-5%); recycling changes nothing.
- **Claims:** total above-ground gold about 216,000 t end 2024 (World Gold Council); density of gold 19.32
  g/cm3 (NIST/CRC Handbook); tennis court size 23.77 x 10.97 m doubles (ITF); volume = mass/density.
- **Fits:** the viewer's body: a cube you could "walk around in 30 s". A wrong idea ("it'd fill a stadium")
  turned by arithmetic.

## ep10 Every shuffle is new
- **Wait, what?** "Shuffle a deck of cards. That exact order has probably never existed before."
- **Payoff:** 52! is about 8 x 10^67 orders. Everyone on Earth shuffling a deck a second since the Big Bang
  would not get close to 10^-40 of them.
- **Assumptions:** a fair shuffle (7 riffles, Bayer & Diaconis 1992); 8.2 billion people at 1 shuffle/s for
  13.8 billion years; "probably never" is a probability statement, said as one.
- **Claims:** 52! = 8.07 x 10^67 (exact arithmetic in `calc.py`); seven riffle shuffles randomise a deck
  (Bayer & Diaconis, *Annals of Applied Probability* 1992); age of the universe 13.8 Gyr (Planck 2018);
  population (UN WPP 2024).
- **Fits:** pure arithmetic that you can check yourself, tied to a deck on the viewer's table.

## ep11 All the water in one ball
- **Wait, what?** "Gather every drop of water on Earth into one ball. How big is it?"
- **Payoff:** about 1,400 km across, roughly the distance from Los Angeles to Seattle-ish (about 1,500 km by road,
  so say "about the width of Texas-plus", chosen at build), smaller than the Moon (3,474 km).
- **Assumptions:** includes oceans, ice, groundwater, lakes, atmosphere; excludes water locked in rock;
  sphere, uniform density 1 g/cm3.
- **Claims:** total water about 1.386 billion km3, 97% salt (USGS Water Science School, Gleick 1996); sphere
  diameter = (6V/pi)^(1/3); Moon diameter 3,474 km (NASA); Earth diameter 12,742 km (NASA); fresh liquid water
  below 1% (USGS).
- **Fits:** wrong idea ("the Earth is a water planet") flipped: the sum shows how thin it is.

## ep12 Catch all the lightning
- **Wait, what?** "Catch every lightning bolt on Earth for a year. Could it power the world?"
- **Payoff:** about 1.4 x 10^18 J: about 1% of one year of world electricity, about 4 days of it.
  Even if you could catch it, you cannot.
- **Assumptions:** about 1 GJ per flash (rough, order of magnitude); about 1.4 billion flashes a year (about
  44 a second, cloud-to-ground plus in-cloud); 100% capture, an impossible idealisation.
- **Claims:** global flash rate about 44 per second (Christian et al., *JGR* 2003, NASA OTD); energy per flash
  order 10^9 J (Rakov & Uman, *Lightning*, 2003, or NOAA/NWS note); world electricity about 30,000 TWh
  (Ember / IEA, 2023); 1 TWh = 3.6 x 10^15 J.
- **Fits:** a classic "free energy" myth tested by arithmetic; safe (nothing to try); links to the viewer's
  light switch.
- **Risk:** energy per flash is a wide-range figure; the episode states the range and says "order of
  magnitude", or the build swaps in whichever source a person opens.

## Cross-checks and risks
- Ep07, 08 and 11 use NASA distances/diameters; ep08, 10 use UN WPP 2024; the numerals in the voice must
  match the screen (calc.py is the single source, as in Season 1).
- Ep08 mentions the Moon distance only as a comparison, so ep07's payoff is not spoiled.
- Ep11 payoff wording ("about as wide as ...") will be chosen from a figure a person can open; no landmark is
  used until checked.
- Nothing here is advice or something to try; all premises are impossible on purpose.
