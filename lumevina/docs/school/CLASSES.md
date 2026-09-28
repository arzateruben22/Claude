# Skin School Live: the in-person classes, and why they're priced this way

Three formats, all booked from the Skin School page and all landing in the dashboard's books
(Bookkeeping, and the Skin School Live panel with who's coming to each class).

| | Skin School Live | Glow Party | Pro Night |
|---|---|---|---|
| Who | Anyone | A host and their friends | Estheticians and students |
| Size | 6 seats (runs with 3+) | 4 to 8 guests, host included | 8 seats (runs with 4+) |
| Length | 2 hours | 2 hours | 3 hours |
| Price | $129 a seat, members $109 | $690 for up to 6, then $95 a guest; +$75 at their home; half down | $249 a seat |
| Includes | Skin check under the lamp, a routine built on the spot, take-home kit (travel cleanser, SPF 30, printed skin journal), Skin Basics online, drinks, 15% off a facial booked that night | The same, just for their group | The Esthetician Business Kit (the Etsy bundle), a printed 90-day planner, dinner and wine |
| When | Sundays 2–4 PM, Mondays 6:30–8:30 PM | Any open Sunday or Monday | A Monday, 6:30–9:30 PM |

## The one decision that makes the margins

**Classes run only when the studio is closed** (Sundays, and Monday evenings). A class never takes a
facial slot, so every dollar it keeps is extra, not moved from one column to another. If a class ran
on a Thursday it would have to beat the two facials it replaced; on a Sunday it only has to beat zero.

## The math, per class

Supplies per guest: travel cleanser and SPF 30 minis about $14, the printed journal about $3, drinks
about $5, so **$22**. Pro Night: printed planner about $6 and dinner with wine about $22, so **$28**
(the business kit is a download and costs nothing to give). Card fees are 2.9% + 30¢.

**Skin School Live, full (6 × $129)**

| | |
|---|---|
| Money in | $774 |
| Card fees | −$24 |
| Supplies | −$132 |
| **Kept** | **$618 (80%)** |
| Per hour, with 30 minutes of setup | about $247 |

At the minimum of 3 seats it keeps about $309. With all six on the member price ($109) it keeps
about $501.

**Glow Party**

| | 6 guests at the studio | 8 guests at their home |
|---|---|---|
| Money in | $690 | $955 |
| Card fees | −$20 | −$28 |
| Supplies (and travel) | −$132 | −$191 |
| **Kept** | **$538 (78%)** | **$736 (77%)** |

A party costs a little less per head than the public class ($115 at six) because the host fills
every seat and does the inviting. That's the trade: a slightly lower price for a guaranteed full room
and no marketing.

**Pro Night, full (8 × $249)**

| | |
|---|---|
| Money in | $1,992 |
| Card fees | −$60 |
| Supplies | −$224 |
| **Kept** | **$1,708 (86%)** |
| Per hour, with 45 minutes of setup | about $455 |

At the minimum of 4 seats it keeps about $854.

**For comparison:** a 60-minute Custom Facial at $195 keeps about $173 after product and the card fee. A full Skin
School Live keeps about 1.4 times that per hour, on a day the studio would otherwise be dark, and a
full Pro Night about 2.6 times.

## What the classes bring in afterward

The numbers above are only the night itself. Each class also:

- **Books facials.** Everyone leaves with 15% off a facial booked that night. If two of six book a
  $195 facial, that's about $330 more.
- **Grows the membership.** A guest who has just had their skin checked and a routine built is the
  easiest membership conversation there is. One new Glow member is $159 a month.
- **Sells the shelf.** The kit is travel size on purpose: the full sizes are on the shelf.
- **Fills the email list.** Every guest has Skin Basics online, so they're already in Skin School.
- **Pro Night sells the Etsy shop.** Estheticians who come will tell others where the kit is sold.

## Why these prices

- **$129** sits in the middle-to-upper band for a two-hour, hands-on skincare class in Los Angeles
  (group skincare workshops listed locally run roughly $65 to $150), and the kit plus Skin Basics
  ($49 on its own) make it feel like more than it costs. Members get $20 off, the same kind of perk
  they have everywhere else.
- **Six seats** is the most that still gets everyone real time under the lamp in the first half hour
  and a routine built with them. Past six the class turns into a lecture, and the lecture is what the
  online course is for.
- **Minimum of three:** below that it's better to move people to the next date.
- **Half down for parties** protects a Sunday that's been held for one group.
- **$249 for Pro Night** is priced on value: the kit alone is $69 on Etsy, and business workshops for
  estheticians commonly run $150 to $400.

## Changing anything

Everything lives in `curriculum.js` under `live`: prices, seats, supply costs, what's included, and
`plan`, the list of upcoming sessions (class, days from today, weekday, start time, minutes).
Run `python3 docs/school/build.py` after a change.
