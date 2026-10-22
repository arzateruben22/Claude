# forecast-salary — hand-off notes

Builder key: `forecast-salary`. Scope: application forecasting (`/analytics/forecast`), the salary simulator (`/salary`, `/salary/compare`) and offers (`/salary/offers/**`).

## Routes

| Route | What it does |
|---|---|
| `/analytics/forecast` | Beta-Binomial forecast from the user's own tracker. `?rho=0|0.1|0.3|0.5|0.8` changes the assumed within-employer correlation (GET form on the page; any other value falls back to 0.3). |
| `/salary` | Calculator tab (client-side, live). |
| `/salary/compare` | Compare paths: (A) job now vs (B) paid apprenticeship, 5–10 years. |
| `/salary/offers` | Offer comparison (table on ≥ sm, cards on phones) plus an empty state. |
| `/salary/offers/new?applicationId=…` | New offer. The application is checked for ownership. A foreign or unknown id shows a warning and falls back to an application picker. When the application is below OFFER, a button can move it to OFFER. |
| `/salary/offers/[id]` | Offer detail: annualized breakdown, gaps to profile targets, benefits notes, negotiation helper, edit/delete, move-to-OFFER button. |
| `/salary/offers/[id]/edit` | Edit an offer (the application cannot be changed). |

`src/app/(app)/salary/layout.tsx` renders the page header and `LinkTabs` (Calculator | Compare paths | Offers). `/analytics/forecast` renders `LinkTabs` (Overview | Forecast) itself, using `ANALYTICS_TABS` from `src/components/forecast/nav.ts`.

## Forecast engine (`src/lib/forecast/`, pure except `queries.ts`)

- **`beta.ts`**:
  - `logGamma` (Lanczos), `logBeta`, `regIncBeta`/`betaCdf` (Lentz continued fraction), `betaQuantile` (bisection), `betaInterval`.
  - `probAtLeastOne(a, b, m) = 1 − B(a, b+m)/B(a, b)`, the posterior predictive.
  - `probAtLeastOneFixed`, `betaBinomialPmf`, `betaBinomialQuantile`.
- **`model.ts`**:
  - Priors: `INTERVIEW_PRIOR = Beta(1, 9)` (mean 10%, 95% prior 0.3%–34%, weight of 10 applications) and `OFFER_PRIOR = Beta(1, 49)` (mean 2%, 0.05%–7%, weight of 50 applications). The rationale is in the file header and on the page.
  - `posterior(prior, k, n, scale)`.
  - `applicationsNeeded(α, β, target)`: exact smallest m for P(≥1) ≥ target, or null beyond 100,000.
  - `thresholdRows` (50/80/90%), `predictiveRange` (central 80% beta-binomial), `chartSeries`.
  - `computeForecast(input, { rho, horizon })` and `scenarioForecast` (Hypothetical).
  - Data quality flags: `none`, `prior-dominated` (prior weight ≥ 50%), `limited` (n_eff < 30) and `usable`.
- **`clustering.ts`**: Kish design effect `DEFF = 1 + ρ(Σm²/Σm − 1)`, `n_eff = n/DEFF`. Clusters are employers (`employerId`, else the normalized company name). `DEFAULT_RHO = 0.3`, which is a stated assumption. The adjusted posterior scales k and n by n_eff/n.
- **`timing.ts`**: type-7 quantiles. Median and IQR of days to first response; the IQR needs at least 4 data points. Applications still waiting are counted (they are censored).
- **`format.ts`**: no false precision.
  - `niceRange` rounds outward: steps of 1/5/10/50/100/500, and the result is always a range.
  - `formatRate` shows whole percentages, with `<1%` and `>99%` at the ends.
  - `expectationSentence` produces the required wording: "If your current rates hold, roughly X–Y more applications would be expected to produce one interview (estimate: …50%)".
  - No function produces dates.
- **`data.ts`**: `buildForecastInput(rows, now)` reuses `classifyApplication` from `src/lib/analytics/funnel.ts`, so the stage definitions match Analytics.
- **`queries.ts`** (server-only): `getForecastData(userId)` excludes merged and archived records (same as the analytics default), caps at 5,000 rows, and uses the profile's `weeklyApplicationTarget` as the look-ahead (`horizonSource` says whether it came from the profile or the default of 25).

Threshold ranges span the independent answer and the clustering-adjusted answer, then are rounded outward. The chart shows the adjusted posterior-predictive line, a 95% band (the true rate at either end of its credible interval) and, when clustering changes the result, the independent line in a muted color. It has a legend, a visible summary and an sr-only table.

## Salary (`src/lib/salary/`)

- **`pay.ts`**:
  - Conventions: 52 weeks and 12 months. Overtime tiers at 1.5× and 2× of the regular or hourly-equivalent rate. Hourly↔annual conversion and `payLine`.
  - `projectYears` works month by month, so apprenticeship periods can change mid-year. The raise compounds on the rate, salary or journeyman scale.
  - `computePay` gives the first-year breakdown, with base, OT 1.5×, OT 2×, bonus, gross, benefits, total comp, training and gross after training each kept separate.
  - Also: `targetGaps`, `firstYearReaching`, `overtimeScenarios` (0/5/10/15 h), `parsePercentList`, `linearSchedule`.
- **`compare.ts`**: `comparePaths(a, b, years)`.
  - The horizon is clamped to 5–10 years.
  - Path B uses a linear % schedule and switches to 100% exactly at `programMonths`.
  - Unpaid weeks reduce both regular and overtime pay. Training costs apply in years that overlap the program.
  - Returns `annualCrossoverYear`, `cumulativeCrossoverYear` (the first year B catches up after being behind), `bAheadFromStart` and `finalDiff`.
- **`forms.ts`**: the string form state and parsing for both tabs, and `scenarioInputsSchema` (`{ kind: "calculator" | "compare", version: 1, values }`), stored in `SalaryScenario.inputs`. The defaults invent no pay figures.
- **`reference.ts` + `reference-data.ts`**: parse `data/seed/certification_facts.json` → `wages`.
  - IBEW 11 journeyman rate: $65.00, effective 2026-01-26 to 2026-06-30, status "partial", taken from the key `baseHourly_Jan26_to_Jun30_2026`.
  - 40% first-period rate: $26.00, effective 2026-01-26, verified, ETI notice URL.
  - Later steps, kept as reference text only.
  - The unverified successor-agreement note.
  - Market references: LA metro May 2025 (unverified), LA May 2023 and US May 2025 (verified).
  - Anything that cannot be parsed becomes null rather than a guess. Tests pin these values to the real file.
- **`scenarios.ts`** (server-only): list, save (create or overwrite) and delete, all scoped by userId. Overwriting or deleting another user's scenario returns "not found". Each user can keep at most 50.
- **`actions.ts`** (`"use server"`): `saveScenarioAction` and `deleteScenarioAction`. They use zod and `requireUser`, the save is rate-limited to 60 per minute, and both revalidate `/salary` and `/salary/compare`.

### UI notes

- **Calculator.** Every value is blank or neutral at start: 40 h, no overtime, 0% raise. Benefits only appear in the total once the user ticks "Show total compensation". The gap cards show gross cash and base alone, the base-only hourly rate needed, and the first year a target is reached under the user's assumptions. The overtime scenarios are labeled Hypothetical.
- **Compare paths.**
  - Path B's journeyman rate and starting % are pre-filled only from the cited data. Each shows its source, effective dates, verification badge and last-checked date.
  - Today (2026-10-22) is after the cited rate period, so the page says the period has ended and shows the successor-agreement note flagged "Newer rate unverified".
  - The step increase, period length and program length are left for the user. The result stays empty until they are entered.
  - Path A can be filled from a recorded offer.
  - A "Use cited values" button restores the cited figures after edits.

## Offers (`src/lib/offers/`)

- **`schema.ts`** (zod 4):
  - The base amount is required. The period is checked for plausibility (an hourly figure over $1,000, or an annual figure under $1,000, is rejected).
  - Hours are whole numbers. Dates are `YYYY-MM-DD` and are converted in the action with `parseDateInput` in the user's timezone.
  - The benefits notes JSON is `{ health?, retirement?, pto?, other? }`; reads use `.catch({})`.
- **`math.ts`**: `annualizeOffer` returns:
  - the base (guaranteed);
  - `overtimeExpected` (the user's expected weekly OT at 1.5×, labeled not guaranteed);
  - the annual bonus and the one-time signing bonus;
  - benefits (the user's estimate);
  - `cashRecurring`, `totalComp` and `totalCompYear1`.

  `offerGaps` gives the gap from the base and from total comp to each target. `bestIndex` finds the best offer for a measure.
- **`service.ts`** (server-only):
  - `createOffer` checks that the application belongs to the user inside a transaction and throws `OfferApplicationNotFoundError` otherwise.
  - `updateOffer` and `deleteOffer` match `{ id, userId }`. Getters are user-scoped.
  - `listOfferCandidates`, `offerPrefill` (period from the application; the amount only when the posting gave a single figure, otherwise the posted range is shown as a hint), `getSalaryTargets` and `targetList`.
  - `isBelowOffer(status)`: rank below OFFER, which includes closed statuses so a rejected application can be reopened.
  - `moveApplicationToOffer` calls `changeStatus(userId, id, { status: "OFFER", note }, "USER", true)`.
  - Recording an offer never changes the status by itself.
- **`actions.ts`** (`"use server"`):
  - `createOfferAction` redirects to `/salary/offers/[id]`.
  - `updateOfferAction` redirects to the detail page.
  - `deleteOfferAction` writes an `offer.delete` audit entry and redirects to `/salary/offers`.
  - `moveToOfferStageAction` shows a toast with any XP awarded by the service.
  - The writes are rate-limited (60 per minute).

**Negotiation helper (client).** It builds a talking-points template only from the user's own offer numbers and the counter they type, and has a copy button. Nothing is ever sent.

- The market reference defaults to "My own research", with low/high/source fields the user fills in.
- The other options are only the cited electrician references (SOC 47-2111). Each shows its source, a verification badge (the LA May 2025 figures say Unverified), the last-checked date and a caveat that the data are regional and occupation-wide.

## How to test

```
npx vitest run tests/unit/forecast-*.test.ts tests/unit/salary-*.test.ts tests/unit/offers-*.test.ts
```

| File | Covers |
|---|---|
| `forecast-math.test.ts` | Special functions against closed forms (I_x(1,b), I_0.5(2,3)=11/16, Beta(1,9) quantiles); the posterior for 8/100 → Beta(9,101); predictive m/(β+m) giving 9/36/81 and 981; monotonic thresholds and ranges; design effect (Σm²/Σm, equal clusters 2.2, singletons 1); ρ parsing; quartiles; formatting and wording; computeForecast (no dates); scenario 7/16/22; buildForecastInput. |
| `forecast-db.test.ts` | Real query, user-scoped: excludes archived records and other users, merges "Acme Electric" and "ACME Electric, Inc." into one cluster, horizon from the profile. |
| `forecast-render.test.ts` | Page states (empty with scenario mode, usable, prior-dominated, ρ option) and every section. Asserts no dates and no promises. |
| `salary-pay.test.ts` | 52-week annualization, hourly↔annual, OT tiers ($81,340 example), salary OT on the hourly equivalent, training-year windows, compounding raises, gaps, OT scenarios, apprenticeship schedule ($46,800 then $104,000; starting year and raises), crossover (annual year 3, cumulative year 4, final difference +$61,000), no-crossover, B ahead from the start, unpaid weeks, horizon clamp, form parsing, scenario JSON. |
| `salary-reference.test.ts` | Parses the real `certification_facts.json` (65 / 40% / 26.00, dates, sources, status) and falls back gracefully on malformed input. |
| `salary-db.test.ts` | Scenario CRUD ownership and invalid JSON being skipped. |
| `salary-render.test.ts` | Blank calculator, filled calculator (benefits excluded until the total-compensation view), apprenticeship, cited pre-fill with dates, comparison, offers table and cards, breakdown, negotiation template, offer form, offers page. |
| `offers-math.test.ts` | Annualization, gaps, best offer, form schema edge cases. |
| `offers-db.test.ts` | Offer ownership (create on a foreign application, then get/update/delete/list as another user), prefill, targets, and the move to OFFER: history `SUBMITTED→OFFER` with source USER and verified, an `OFFER_RECEIVED` event, refused once at OFFER, refused for another user, and a reopened REJECTED application. |

Results on 2026-10-22: 9 files, 87 tests, all pass. `npx tsc --noEmit` shows no errors in these paths. `npx eslint` on all owned paths and tests is clean.

## Known gaps and limits

- Non-independence is modelled only for employer clustering. Résumé, season and job-board effects are explained but not modelled; the page says the adjusted figures still lean optimistic. ρ is an assumption the user can change, not an estimate.
- Unanswered recent applications count as "no interview yet". The page flags how many are within the pending window (the observed upper quartile of response times, or 14 days, clamped to 7–60 days), but the model does not adjust for that censoring.
- The cited IBEW 11 rate's period ended on 2026-06-30. The successor rate (about $67.00 from 2026-07-27) is unverified in the research, so it is shown as a note and not pre-filled. When the research JSON is updated with a new `baseHourly_<Mon><d>_to_<Mon><d>_<yyyy>` key, the parser picks the latest end date automatically.
- Market references cover electricians only. For any other role the helper asks for the user's own research.
- No browser run was possible here (the brief forbids `next dev`/`next build`), so all UI is verified with `react-dom/server` render tests. The charts render an empty `ResponsiveContainer` on the server and draw on the client.
- The theme's dark chart tokens (`--chart-1`/`--chart-2`) fall outside the dataviz lightness band, though separation and contrast pass. They live in `globals.css`, which I do not own.

## External dependencies

None. No network calls are made. The wage data come from the seed JSON in the repository.
