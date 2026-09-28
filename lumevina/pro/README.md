# Lumevina Studio: digital products for estheticians

Ten downloadable products, built from Lumevina's own forms and tools, ready to sell on Etsy (and
anywhere else). Everything is generated from the content files in `src/`, so a wording change is
one edit and one rebuild.

| # | Product | Files the buyer gets | Price |
|---|---|---|---|
| 01 | Client Intake & Consent Kit | Fillable PDF (Letter, A4), Word | $24 |
| 02 | Aftercare Card Set | 5x7 print sheets (Letter, A4), phone images, Word | $14 |
| 03 | Skin Analysis & Treatment Record | Fillable PDF (Letter, A4), Word | $9 |
| 04 | Service Menu & Price List | Word, sample PDF, 40-description library | $14 |
| 05 | Membership Pricing Calculator | Excel / Google Sheets | $19 |
| 06 | Bookkeeping & Profit Tracker | Excel / Google Sheets | $16 |
| 07 | Rebooking & Membership Scripts | PDF (Letter, A4), Word | $15 |
| 08 | Open Your Studio 90-Day Planner | Fillable PDF (Letter, A4) | $17 |
| 09 | Skin Journal & Routine Planner | Fillable PDF (Letter, A4) | $8 |
| 10 | Esthetician Business Kit (01–08 + 09 as a bonus) | ZIP | $69 |

## What's where

- `dist/<product>/files/` what the buyer downloads (at most five files, each under 20 MB)
- `dist/<product>/images/` five listing photos, 2500 × 2000
- `dist/etsy/listings.json` and `listings.csv` titles, tags, descriptions, prices, sections
- `dist/etsy/shop/` shop icon and banner
- `SHOP.md` the shop's name, About story, policies and FAQ
- `REVIEW.md` Evelyn's review checklist
- `LAUNCH.md` what's left to do, other storefronts, and the growth plan
- `etsy/upload.py` creates the Etsy drafts with photos and files

## Rebuilding

```
python3 pro/build.py            # everything
python3 pro/build.py 01 07      # just those products
python3 pro/build.py --no-images
```

Needs `python-docx`, `openpyxl` and `pymupdf`, Node with Playwright (Chromium), and LibreOffice to
calculate the spreadsheets. The build checks every page for overflow and every listing against
Etsy's limits (title length, 13 tags of 20 characters, 5 files of 20 MB).

## How it's made

- `src/doc.py` one content model, two outputs: print HTML (then PDF) and Word
- `src/render.cjs` prints to PDF and measures every write-on line and box
- `src/fill.py` turns those into fillable PDF form fields
- `src/p01_*.py … p10_*.py` the products
- `src/sheets.py` the spreadsheet look; `p05`, `p06` build the workbooks with live formulas
- `src/mockups.py` the listing photos, drawn from the real files
- `src/listings.py` the Etsy catalog
