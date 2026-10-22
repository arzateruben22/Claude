# Skin Intelligence: status (October 22, 2026)

Branch `claude/lumevina-skin-intelligence`, merged with the latest `claude/landing-page-redesign-payments-mqp9sd` (no conflicts). Everything runs in demo mode as committed; nothing has been deployed to a live Supabase project, and no real client data exists anywhere.

**Overall: about 90% of the engineering is built and tested.** What remains is mostly verification against a live project, a few small features, and the human steps the directive itself requires (counsel's review, the real repeatability protocol, Evelyn's feedback, the pilot).

## Tests

| Suite | Count | What it proves |
|---|---:|---|
| Database (`tests/db`) | 29 | Migrations apply on `schema.sql`; up → down → up restores the exact schema; RLS on every table; clients can't read each other's rows; the anon key reads nothing clinical; originals, measurements, signed treatments, approved reports, consents and the audit log can't be rewritten; the job queue and rate limiter |
| Functions (`tests/functions`) | 25 | The real handlers end to end on Postgres: client isolation, staff refusal without multifactor or with the studio key, assignments, consent gates, change detection, reports, routine, recovery alerts without names, export, deletion, audit, intake, the chat's AI consent check |
| Shared logic and baseline (`tests/unit`) | 38 | Regions and head pose against MediaPipe's canonical face; wording guard; change verdicts; validators; access; evolution; reports; on-device checks fair to all ten Monk Skin Tones; the existing studio key, hours, plans, profiles, chat photos, unsubscribe tokens |
| Browser (`tests/e2e`) | 59 | Home page and dashboard unchanged and error-free; every My Skin and studio screen at 390 and 1280 px with no errors or sideways scroll; viewer slider and zoom; a report drafted, wording-checked, approved and read by the client |
| Worker (`worker/tests`) | 37 | Each measurement responds to what it claims (and not to other features); uncertainty bands; calibration; quality fair across skin tones; blur against the client's own history; registration recovers known warps; difference maps separate brightness from change; the job pipeline; repeatability statistics |
| **Total** | **188** | all passing |

## Against the directive

| Phase | Done | Not yet |
|---|---|---|
| 0 Audit | Architecture report, risks, migrations plan, costs (ARCHITECTURE-AUDIT.md) | |
| 1 Accounts and roles | Client accounts reused (same sign-in keys as the site); client / practitioner / admin; server-side authorization from the verified token; RLS everywhere; staff multifactor (TOTP); signed short-lived image links; append-only audit log; rate limits; isolation tests; fixed the dead `clients` table and the `bookings.client_id` FK failure | Multi-location tenancy (not needed for one studio; the assignment model extends to it); the existing dashboard's studio-key actions still use the key (see below) |
| 2 Skin profile | All listed fields, staff-recorded contraindications, privacy preferences, consents | |
| 3 Imaging | Phone camera with guided capture (face-landmark outline of the area, positioning coaching, focus/light/colour checks, retake prompts), uploads, microscope/dermatoscope/pro exports by file, device registry with calibration and lighting, authoritative quality checks, immutable originals | Direct USB capture (WebUSB) from a laptop; a screen for creating repeatable sites (the API exists) |
| 4 Analysis | Pores (density, size, visibility), texture (roughness, uniformity), tone, dark spots (area, contrast), redness (mean, spread), fine lines, scars (colour, texture, area); units, uncertainty, quality, calibration, algorithm version, experimental labels; "Insufficient data" instead of guesses; what photos can't measure, shown | Tuning on real photographs; median pore size is quantized (fix: sub-pixel radius) |
| 5 Skin Evolution | Timeline, slider, side by side with synchronized zoom, regions, difference maps, charts with uncertainty and the repeatability zone, treatment overlays, gallery, dated sequence with labelled transitions; any number of visits | 3D (no calibrated depth device; the data model leaves room) |
| 6 Change detection | Five verdicts against validated thresholds only; practitioner review before the client sees anything; no causes | |
| 7 Routine | Morning/night/weekly, start/stop dates, check-ins with irritation, practitioner suggestions the client accepts, purchased products offered from shop orders and studio checkouts (never assumed used), no causation | |
| 8 Scheduling | Imaging sessions attach to a booking (checked to be the same client) or stand alone; Appointments rows link to the client's skin record; follow-up dates; adverse reactions | GlossGenius appointments can't be linked (no API); booking a follow-up still happens in Appointments |
| 9 Treatment records | Every listed field, RF optional, series tracking (the ProCell package of 4), signing and amendments; settings recorded, never suggested | |
| 10 Analytics | Enrolled clients, sessions, repeat imaging, quality failure rate and reasons, review workload, follow-up completion, series progress, reports, recovery flags; operational only | Client satisfaction (no data source yet); product purchasing patterns beside imaging |
| 11 UI | All client (8), practitioner (8) and admin (7) screens, responsive, light client and dark studio in Lumevina's own palettes, reduced-motion respected | Real-device testing; Evelyn's feedback |
| 12 Privacy and security | The controls in PRIVACY-SECURITY.md, built and tested; the chat's photo path gated on AI consent; three existing anon-key exposures closed | Counsel's review, approved consent wording, retention periods, the privacy page (draft ready) |
| 13 Testing | 188 automated tests; the repeatability tooling with a synthetic dry run | The real protocol run with volunteers |
| 14 Cost | No new paid services; about $30–40/month (Supabase Pro, a small worker) | |
| 15 Execution | Milestones 1–14 | 15 (real validation) and 16 (pilot) are human steps |

## Found and fixed in the existing code along the way

* Signed-in website bookings would have failed: `bookings.client_id` references `clients`, which nothing filled (0001 fills it on sign-up and backfills).
* `reward_balances` listed every client's email and points to anyone with the public key; `flash_slots` and `notifications` had no row-level security (0010).
* Once `clients` has rows, its old `for all` policy would have let clients edit their own referral fields (0001 narrows it to read).
* Consult alerts have failed the `studio_alerts` check since the consult gate shipped (0012 adds the kind).
* The pre-visit form never reached the server (`js/intake.js` TODO; new `functions/intake`); the confirmation email's `?intake=1` link now opens it.
* Chat photos went to the AI assistant on the Send tap alone; now only with the separate AI consent.

## Engineering left (the last ~10%)

1. **Live verification** on a Supabase project with synthetic data: signed upload URLs, the MFA endpoints, PostgREST details the test stand-in imitates, the worker against real Storage. Run `deno check` on the functions (Deno isn't available in this environment).
2. A screen for **repeatable imaging sites** (API ready), and sub-pixel pore sizes.
3. **Move the existing dashboard to staff accounts** so the shared studio key can retire (the audit's top recommendation; Skin Intelligence already doesn't accept it).
4. **iOS app**: camera permission text (`NSCameraUsageDescription`) for capture inside the Capacitor app.
5. A **preview link** for Evelyn (a single-file build of My Skin and the studio in demo mode).
6. Analytics extras (satisfaction, purchases beside imaging) once there is data.

## Questions for you (when you're ready)

1. **The defaults I built on** (ARCHITECTURE-AUDIT.md §7): Evelyn is both practitioner and admin; treatment records private with a client summary; sessions attach to a booking or stand alone; analysis in Lumevina's own worker, never an AI service; phone camera and file upload first. Keep these?
2. **Other practitioners?** Anyone besides Evelyn who'll need a staff account?
3. **Counsel**: who reviews PRIVACY-SECURITY.md and the four consent texts, and decides HIPAA/CMIA and retention?
4. **Hardware**: which phone mount and light, and is a USB microscope or dermatoscope planned (which model)?
5. **Client photos between visits**: built and on. Does Evelyn want clients adding their own, or studio photos only?
6. **Merging**: fold this into the main Lumevina branch now (behind the `skin` switch, off by default), or keep it separate until the pilot?
7. **Hosting**: OK to plan Supabase Pro ($25/month) and a small worker host (Fly.io or Railway, $5–10/month)?
8. **A preview link** for Evelyn to try the demo on her phone?
