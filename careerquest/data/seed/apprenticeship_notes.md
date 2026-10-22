# Apprenticeship seed notes

Companion to `apprenticeship_programs.json`, `certification_requirements.json` and `certification_facts.json`. Shaped from `data/research/electrician_research.{json,md}` on 2026-10-21.

## Read first: how the research was verified

In the research sandbox, direct page fetches (WebFetch and curl) to dir.ca.gov, cslb.ca.gov, bls.gov, laett.com, ocett.org, goweca.com, abcsocal.org and every other external host were blocked by the environment's network policy. Every fact in the seed files was confirmed through web-search extracts (quoted snippets) of the cited official pages, not by reading the full page. Anything that only appeared on a third-party page is marked unverified. Re-check fees, dates and wages on the live official URLs before shipping.

## Omitted program: IEC (Independent Electrical Contractors)

The research included a placeholder entry `iec-los-angeles`. It is **omitted from `apprenticeship_programs.json`** because no DAS-registered IEC chapter apprenticeship program in Los Angeles or Orange County could be verified. The DAS electrician program lists for Los Angeles and Orange counties show Los Angeles Electrical JATC, Orange County Electrical JAC, WECA, ABC Southern California and IBEW Local 40/NECA, but no IEC entry. Treat IEC as not available in LA/OC unless confirmed on ieci.org.

- DAS LA list: https://www.dir.ca.gov/databases/das/results_aiglist.asp?varCounty=LOS+ANGELES&varType=22
- DAS OC list: https://dir.ca.gov/databases/das/results_aiglist.asp?varCounty=ORANGE&varType=22

## Field-mapping decisions (research -> `ApprenticeshipProgram`)

- `region` is constrained to `"Los Angeles County" | "Orange County" | "Southern California" | "Riverside / Inland Empire"`.
  - WECA: research says "Southern California (Riverside training center; DAS lists WECA programs in both Los Angeles and Orange counties). No LA- or OC-based WECA classroom facility was verified." Stored as **Southern California**; the Riverside training-center address is in `contact.address`.
  - ABC SoCal: campuses in Anaheim, San Fernando and Riverside covering LA, Orange, Riverside, San Bernardino and Ventura counties. Stored as **Southern California**; both the Anaheim HQ and San Fernando addresses are in `contact.address`.
  - No program was assigned "Riverside / Inland Empire".
- `isUnion` derives from the research `unionAffiliation` (IBEW 11, 441, 40 and the ITS JATC are union; WECA and ABC SoCal are non-union / merit shop).
- `contact` is limited to `phone`, `address`, `email`. Dropped: ETI fax (323) 721-6522; OCETT fax (714) 245-9894 and email info@ocett.org (both from a third-party directory, unverified); IBEW 40 training director Jesse Barron (mentioned in `recruitmentNote` instead).
- `startingWage` / `classroomHours` / `fees` are `null` wherever the research marked them unverified or not retrieved. The only verified dollar starting wage is IBEW 11 / ETI ($26.00/hr, 40%, official notice dated 01/26/2026). ABC SoCal's `startingWage` keeps the official "about 50 percent" statement with `startingWageVerified: false` because no dollar figure exists.
- `eligibility` / `processSteps` keep the research's inline "(unverified)" caveat items (e.g. "Driver's license requirement: not stated in retrieved excerpts (unverified)") so the app can show the gap instead of silently implying there is no such requirement. The ITS JATC entry has empty arrays because nothing was retrieved. The ABC SoCal "presumably 18" guess from the research was dropped (not an official statement).
- `recruitmentStatus` rules applied with today = 2026-10-21: `OPEN` only if an official page states a window that includes today (none did); `CLOSED` when the last stated window has passed; otherwise `UNVERIFIED`.
- `durationYears` is a number (`Float?` in Prisma); ABC SoCal is stored as 4.5 (see conflict below).
- The ETI entry's `durationYears` / `classroomHours` describe the Inside Wireman program. ETI also runs Sound & Communication Installer (3 yrs), Residential Wireman (3 yrs) and the Transportation Systems (ITS) Electrician program (seeded separately as `la-county-its-electrical-jatc`). The schema has no sub-program field, so those live only here and in `sourceUrls`.

## Per-program status and unverified items

| slug | status | verified | unverified / caveats |
|---|---|---|---|
| `ibew-11-eti` | CLOSED | 5-yr Inside Wireman; 18+, HS/GED, algebra C+, SSN, photo ID; online-only application; aptitude test in Commerce; min 240 class hrs/yr; $26.00/hr start (01/26/2026 notice); 2026 windows Jan 5, Apr 6, Jul 6, Oct 5-9 all passed; address/phone/email | Driver's license, drug test, fees, oral interview step, next window; post-7/27/2026 wage schedule after the ratified 2026-2031 agreement (+$2.00/hr) |
| `ibew-441-ocett` | CLOSED | 60-month Inside Wireman; 18+, HS/GED, 2 yrs HS math incl. algebra (C), color vision, English fluency, DL + SS card, written + oral + physical + drug test; last call-in Aug 4, 2026, 2027 TBD; phone | Starting wage ("Contact Program"), classroom hours, fees, email/fax; address conflict (1261 E. Dyer Rd per DAS vs 717 S. Lyon St in older directories); whether the first/third-Wednesday walk-in schedule still applies |
| `weca` | UNVERIFIED | 18+, HS/GED; must be hired by a WECA member contractor (employer pays tuition); color ID, basic skills, multi-craft aptitude tests, interview, orientation; 2-week block classes every 5-7 months; Residential 3 yrs; phone/email | Starting wage; Commercial 5-yr term (older brochures only); Low Voltage program length; dated application window; current Riverside address; DL and drug test |
| `abc-socal` | UNVERIFIED | HS/GED, SS card, DL + K4 DMV printout, algebra transcripts; aptitude test 70%, interview 80%, orientation; 2 attempts then 1-yr wait; "about 50%" starting pay; addresses/phones/email | Program length (program page: 4.5 yrs / 8,000 OJT hrs vs 2025 application PDF: 4 yrs / 7,200 hrs); class hours 160 vs 180/yr; minimum age; drug test; fees ($50 enrollment / $125 make-up day appear in a self-pay craft-training packet and may not apply to apprentices); dated window |
| `ibew-40-neca` | CLOSED | 60 months; 18+, HS/GED, algebra C+; written + oral; address/phone; applications reopen Spring 2028 (ibew40.org news item) | Starting wage ("Contact Program"), classroom hours, fees; no program-run apply page retrieved (applyUrl is the DAS detail page) |
| `la-county-its-electrical-jatc` | UNVERIFIED | Listed in DAS LA electrician programs; a DIR apprentice prevailing-wage table exists (LA 2026-1); ETI contact | Everything else: eligibility, process, length, classroom hours, wage figures, fees, application window; the linked TSA notice is dated 01-29-24 |
| `iec-los-angeles` | omitted | - | Not found in DAS LA/OC lists |

## Official resources

- DAS home: https://www.dir.ca.gov/das/
- DAS program search: https://www.dir.ca.gov/databases/das/aigstart.asp
- DAS public-works sponsor search: https://www.dir.ca.gov/databases/das/pwaddrstart.asp
- DAS apprentice certification search: https://www.dir.ca.gov/das/appcertpw/appcertsearch.asp
- DIR apprentice prevailing wage, LA Inside Wireman 2026-1: https://www.dir.ca.gov/oprl/pwappwage/wage/26119220.html?VarWageId=26119220
- DLSE approved trainee schools: https://www.dir.ca.gov/dlse/ECU/ListOfApprovedSchools.html
- Federal apprenticeship finder: https://www.apprenticeship.gov/
- "calapprenticeship.org" could not be verified as an official state resource; use dir.ca.gov/das.

## Re-verification checklist before publishing

1. Open each program's `applyUrl` and confirm the current application window; flip `recruitmentStatus` to `OPEN` only when an official page states a window that includes the current date.
2. Confirm the ETI apprentice wage schedule after the 7/27/2026 increase and update `startingWage`.
3. Call OCETT (714) 245-9988 to confirm the Dyer Road address, wage, and 2027 call-in dates.
4. Ask ABC SoCal (714) 779-3187 which program length (4 vs 4.5 years) and which fees apply to registered apprentices.
5. Ask WECA (877) 444-9322 for apprentice starting wage and the current Riverside address.
6. Check ieci.org for any LA/OC IEC program before adding one.
