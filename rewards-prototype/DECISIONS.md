# Decision log

What was decided, what is only a placeholder, and what is waiting for the owner.
Newest decisions at the top of each section.

## A. Waiting for the owner — nothing here is final

These are defaults chosen so the prototype can run. Each is one setting or one seed
value away from being changed; none is baked into the schema.

| # | Topic | Placeholder in use | Where it lives |
|---|---|---|---|
| A1 | Tier names, XP thresholds and art for the five evolution stages | "Stage 1"–"Stage 5" at 0 / 100 / 250 / 500 / 1000 XP, placeholder art keys | `tiers` table; `PUT /api/admin/tiers` |
| A2 | Points and XP per task | 25 points for either sample task; 25 XP for feedback, 40 XP for a creative submission | `task_types`; admin screen |
| A3 | Monthly cap per member and monthly budget for the group | 300 and 750 points | `settings` |
| A4 | Daily submission limit, minimum feedback length | 5 per day, 80 characters | `settings` |
| A5 | Time zone that defines "a month" and "a day" | `America/Los_Angeles` | `settings` |
| A6 | Leaderboard ordering | by total points, then XP | `settings` (`points` or `xp`) |
| A7 | Avatar photos | none; `avatar_key: "placeholder"` | waiting for authorised photos |
| A8 | Stack and hosting | Node + built-in SQLite, runs locally only | see `docs/ARCHITECTURE.md` §2 |
| A9 | Google Cloud project, OAuth client, authorised YouTube channels | none — dev sign-in and mock platform data only | environment variables when they exist |
| A10 | Terms and privacy notice | none written | needed before any real YouTube API use (`docs/PLATFORM_CAPABILITIES.md` §2) |

## B. Choices that change how the product behaves — please confirm or overrule

**B1. Likes and comments earn nothing, by construction.**
The original idea rewarded likes and comments. Platforms prohibit incentivised
engagement, and the brief rules it out, so the prototype goes further than "we chose
not to": there is no data path from an engagement number to the ledger, and the admin
screens refuse task names, descriptions and reasons that describe engagement or money.
Rewardable things are contributions: private written feedback, original creative work,
approved challenges.

**B2. "Constructive feedback" is private and in-app — not a public comment.**
Feedback is typed into the dashboard and read by the admin. It is deliberately not a
YouTube/TikTok comment: rewarding a public comment would be rewarding engagement.

**B3. The admin account should not be one of the three members.**
Nobody can credit themselves: an admin attached to a member can neither approve that
member's submissions nor give them a bonus, a positive adjustment or an un-deduction
(database-enforced). With a single admin who is also a member, that member's
submissions could never be approved. So either the admin account is separate from the
members (what the sample data does), or there are two admins. **Owner's call.**

**B4. "Earned" grows only through an approved submission.**
A manual adjustment can take points away from either bucket but can add them only to
the *bonus* bucket, so the "earned" figure always means "reviewed contributions". Every
credit of any kind counts toward the monthly cap and budget. If a cap blocks something
the admin wants, the admin raises the cap (audit-logged); nothing is silently reduced
and there is no per-entry override switch.

**B5. A member sees very little of another member.**
Totals, tier, rank and a short public activity line ("Constructive feedback · 25
points") for approved items. Not shown to other members: pending, rejected or withdrawn
submissions, evidence, review notes, deduction reasons, e-mail addresses.

**B6. Erasing a member also blanks other members' feedback about that member's videos.**
That text is about the erased person's work. The other members keep their points; only
the wording goes. The erased member's videos are removed (or kept as an anonymous
archived placeholder if someone else's approved submission still points at one).

**B7. Platform numbers are displayed, never scored.**
View/like/comment totals appear in their own labelled block with source and time, and
are dropped after 30 days. They never feed points, XP, tiers or rank — both because of
B1 and because YouTube's API terms restrict building derived scores from API data.

**B8. TikTok is manual-review only.**
The official TikTok APIs give a small private app no way to attest who liked, commented
on or owns a video, and TikTok's app review reportedly refuses private-use apps.

**B9. Linking a YouTube channel will store only the channel id and the consent time.**
No access or refresh token is kept. Unlinking deletes both immediately. (The linking
flow itself is not built yet — it needs A9.)

**B10. The cash idea is archived, not implemented.**
The original 50/50 deferred-plus-bonus payout brainstorm is recorded here only so that
nobody rebuilds it by accident. There is no currency, payout, interest or redemption
anywhere in the code.

## C. Engineering decisions (for whoever continues the work)

| # | Decision | Why |
|---|---|---|
| C1 | Correctness promises are enforced by database constraints and triggers; application checks only give nicer messages. | A second code path or a bug cannot break a promise. |
| C2 | A claim becomes approved only by its ledger award being inserted; revoked only by that award being reversed. | "Approved" and "exactly one award" cannot drift apart. |
| C3 | Balances are never stored; always `SUM` over the ledger. | Nothing to reconcile. |
| C4 | A ledger entry's month is fixed when written; a reversal carries its target's month. | Changing the time zone, or correcting late, never rewrites cap history. |
| C5 | Rollback-journal mode, not WAL; `secure_delete` on; erasure tombstones replayed at boot. | An erased person must not remain readable in side files or come back from a backup. |
| C6 | Sessions record the sign-in mode that created them; dev sign-in needs a per-start code and refuses a database that has seen Google sign-ins. | A preview link or tunnel in front of a dev server must not hand out accounts. |
| C7 | Security posture follows `APP_ORIGIN`; the two mode switches have no defaults. | A forgotten environment variable must stop the boot, not quietly weaken it. |
| C8 | Audit detail holds ids, enums and numbers only; reasons stay on the ledger entry or claim. | The audit trail must survive an erasure without holding personal content. |
| C9 | An integrity self-check runs at boot and after every erasure. | Some invariants span rows and tables; constraints cannot state them. |
| C10 | Mock adapters label every result as simulated; "live" answers "not connected" until real adapters exist. | Never show a guess as a platform fact. |

## D. Things to know

- **This folder is in a public repository**, while the product is described as private.
  Nothing secret is here (no credentials, no real data, no photos), but before real
  accounts, photos or a Google client are added it should move to a private repository.
- The platform research (`docs/PLATFORM_CAPABILITIES.md`) could only read Google's
  machine-readable API description directly. Policy pages, TikTok's docs and the
  sign-in guides were seen through search excerpts because the build environment blocks
  those sites. Every statement there carries an evidence tier; tier-B items should be
  re-checked on the real pages before a live API is switched on.
- Nothing has been tested against a live YouTube, TikTok or Google sign-in service.

## E. Questions still open from the handoff

1. Where is the second project's source archive, and has its owner authorised work on it?
   (It was not provided to this session; no work on it has started.)
2. Which Google Cloud project and which YouTube channel accounts will be used?
3. Are there approved photos for the three avatars?
4. What hosting, and what monthly budget, are authorised?
