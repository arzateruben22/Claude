# Shipping from home

Some products go out from the studio by mail: shelf orders from the website, the monthly Glow Routine
box, and Skin School starter kits. Anything a client buys through a brand's own link or client portal
(GlyMed+, Face Reality and the other lines on the Shop page) the brand ships itself.

The friendly, step-by-step version with a shopping checklist and a cost calculator is
**`shipping-kit.html`** (also in Evelyn's hub). This file is the reference behind it.

## How it works

1. **The client checks out.** Choosing "Ship it to me" asks for the address the way a label needs it:
   street, apt, city, state and ZIP, with the phone's autofill. A returning client's last address is
   filled in for them. A client with an appointment in the next 45 days gets "Pick up at my visit"
   picked for them, which is free for them and costs no postage. They can still choose shipping.
2. **The order lands on the dashboard's Shipping card** under *To pack*, with the package to use, an
   estimated weight, roughly what postage will cost, and a ship-by date two business days out. Glow
   Routine boxes wait under *Coming up* until three days before their monthly date.
3. **Packing slips** print on the label printer, one 4 × 6 slip per order with a thank-you note.
4. **Download for Pirate Ship** saves a spreadsheet of everything waiting. In Pirate Ship: Import,
   Upload a spreadsheet, pick the file, buy the labels, print.
5. **Mark shipped** with the tracking number and what the label cost. The books swap the estimate
   for the real price, and the card shows the month's label spending and the average cost per package
   next to the $8 the shop charges.

## What to buy (about $194)

| Item | What to get | About |
|---|---|---|
| Label printer | MUNBYN RW403B: 4 × 6 thermal, no ink, Bluetooth, Mac, Windows, iPhone, Android | $80 |
| Labels | 4 × 6 in thermal, fanfold, 500 | $13 |
| Scale | Digital shipping scale, 50 lb, reads ounces (Accuteck or similar) | $25 |
| Bubble mailers | 6 × 10 in (#0), 100 | $27 |
| Small boxes | 6 × 6 × 4 in, 25 | $22 |
| Packing tape | 2 in clear, with a dispenser gun | $12 |
| Bubble wrap | Small roll, 12 in wide | $10 |
| Zip bags and paper towels | Sandwich size, one per bottle | $5 |

Later: medium boxes (10 × 8 × 4 in) for sets, Lumevina stickers, tissue paper. If the MUNBYN is ever a
hassle, the Rollo Wireless (about $285) prints over Wi-Fi with AirPrint and needs no driver on a Mac.
To start for $0, Pirate Ship also prints labels on plain paper from a regular printer.

## One-time setup

1. Free Pirate Ship account with the Lumevina email; add a card (charged per label only).
2. "Ship from" address: the studio, not home. It prints on every label and receives returns.
3. Pirate Ship settings: email notifications with the Lumevina name and logo, so clients get tracking.
4. Printer: load labels, install MUNBYN's driver (Mac or Windows) from munbyn.com. On a new laptop,
   install it again; Pirate Ship itself runs in the browser, so nothing else moves.
5. Pirate Ship label size: 4 × 6, thermal. Print a test label.
6. Practice with the dashboard's sample orders: Download for Pirate Ship, then Import in Pirate Ship.

## Packing skincare

Cap tight and taped, each bottle in a zip bag with a folded paper towel, glass and pumps and droppers
in bubble wrap and a box (never a mailer), gaps filled so nothing rattles, packing slip on top, every
seam taped.

## The packages

| Package | Size | For | Postage, 2026 |
|---|---|---|---|
| Bubble mailer | 6 × 10 in | One plastic bottle or tube | $6.93 to $8.40 (Ground Advantage, under 1 lb) |
| Small box | 6 × 6 × 4 in | 2–3 items, or glass, pumps, droppers | $6.93–8.39 nearby, up to $14.36 across the country |
| Medium box | 10 × 8 × 4 in | Sets, kits, 4+ items | About $10 to $17 when full |

Packaging and supplies add about $0.40 for a mailer, $1.10 for a small box and $1.50 for a medium one.

## The numbers

USPS Ground Advantage commercial prices (what Pirate Ship charges) from July 12, 2026. Since that
date every package under 1 lb costs the same as a 15.99 oz one, by zone:

| Zone | Where, from Woodland Hills | Under 1 lb |
|---|---|---|
| 1 | LA and Ventura | $6.93 |
| 2 | San Diego, Orange County, Inland Empire | $6.94 |
| 3 | Fresno, Las Vegas | $7.30 |
| 4 | Bay Area, Sacramento, Phoenix, Salt Lake City | $7.46 |
| 5 | Seattle, Portland, Denver | $7.69 |
| 8 | New York, Miami, Atlanta | $8.40 |

Priority Mail Cubic is priced by size, not weight (up to 20 lb). The small box and the mailer are its
smallest size: $8.39 nearby and $14.36 across the country. For a small box over a pound, Cubic is
usually the cheaper option; Pirate Ship shows both.

**The $8 fee.** Most orders go to the LA area: a mailer is about $7.33 all in and a small box about $8
to $9.50, so $8 roughly breaks even. Members and orders over $75 ship free, by design. If the Shipping
card's monthly average stays above $9, raise `SHIP_FEE` to 9 or `FREE_OVER` to 85 in `js/cart.js`.

## Good to know

- Ground Advantage and Priority Mail include up to $100 of insurance.
- Anything labeled flammable, and aerosol sprays, go by ground only with special marking. Check first.
- Before shipping a brand's products, confirm with the rep that a professional account may sell online.
- Products sold to California addresses need sales tax; set it up with the accountant first.
- Free USPS pickup: schedule at usps.com the night before. Or the post office, or a blue mailbox if it fits.

## Changing things

| What | Where |
|---|---|
| Package sizes and supply costs | `PACKS` in `js/shipping.js` |
| What each product weighs as shipped | `ITEMS` in `js/shipping.js` (weigh the first few and correct them) |
| Postage estimates | `GROUND` and `CUBIC` in `js/shipping.js` (USPS changes prices most Januarys and Julys) |
| Distance zones from the studio | `ZONES` in `js/shipping.js` |
| Shipping fee and free-shipping line | `SHIP_FEE`, `FREE_OVER` in `js/cart.js` |
| The slip's thank-you notes | `NOTE` and `slip()` in `js/shipping.js` |
| The live version (database, webhook) | `server/README.md`, Shipping |

Sources: [USPS rate changes, July 2026 (ship.com)](https://www.ship.com/post/usps-rate-changes-july-2026) ·
[USPS cubic pricing explained (ship.com)](https://www.ship.com/post/usps-cubic-pricing-explained) ·
[Pirate Ship pricing (Capterra)](https://www.capterra.com/p/172133/Pirate-Ship/pricing/) ·
[Pirate Ship spreadsheet import](https://support.pirateship.com/en/articles/1068428-how-do-i-upload-address-spreadsheets-into-pirate-ship) ·
[MUNBYN RW403B review (TechRadar)](https://techradar.com/pro/quicker-more-reliable-and-more-fun-the-munbyn-rw403b-is-the-best-shipping-label-printer-weve-tested-and-it-just-got-a-big-price-cut)
