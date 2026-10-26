# Decisions

| Date | Decision | Why |
|---|---|---|
| 2026-10-24 | Next.js 16 (App Router, server actions, `proxy.ts`) + PostgreSQL + Drizzle; one worker process | One deployable app; Postgres gives row locks, `SKIP LOCKED` queues and unique-index idempotency |
| 2026-10-24 | Owner-only auth: a scrypt passphrase plus an HMAC session cookie (30 days) | One owner; no third-party auth needed for Stage A. The proxy checks every route, and each action checks again |
| 2026-10-24 | Manual publishing first, through the Upload Desk | Platform APIs need app review and verified accounts (Stage C); manual is safe and works today |
| 2026-10-24 | Approval = hash of the exact export plus the destination | "Approved" must describe exactly what will be posted, to exactly where |
| 2026-10-24 | One publication record per (episode, destination) | A YouTube upload must never mark TikTok or Instagram |
| 2026-10-24 | Achievements are unique per (rule, scope, demo) | Retries, re-imports and cross-posts can't unlock twice |
| 2026-10-24 | Rewards are reserved under a lock on the settings row, within the funded balance and monthly cap | Two workers can't spend the same money; nothing is reserved until the owner configures a cap |
| 2026-10-24 | Only API, CSV or owner-confirmed views count; a downward revision flags the evidence | Estimates and demo numbers must never unlock money |
| 2026-10-24 | Evolution needs real, reviewed work; the owner presses Evolve; the reveal plays once | Progress should feel earned, and never happen behind the owner's back |
| 2026-10-25 | Celebrations come from unseen achievements in the database, not from the form that caused them | The form may unmount in the same render (the task leaves the desk) |
| 2026-10-25 | Missed slots move to the next free day for that destination (never two a day) | No catch-up bursts |
| 2026-10-25 | Captions (.srt) come from the film's own word timings (film.json) | The burned-in captions and the uploaded captions match exactly |
| 2026-10-25 | Media is served only for allow-listed keys (`films:` inside `films/`, `media:` inside MEDIA_ROOT) | No path traversal; .env and source files are unreachable |
| 2026-10-26 | Production budgets are monthly rows that carry forward until replaced; costs are recorded, never paid | One place to see spend against a plan; history stays correct when a budget changes. Prism never moves money, and the reward ledger is never touched |
| 2026-10-26 | Estimates and voided entries never count as spent; no currency conversion (other-currency costs keep paid generation off that month) | Only real, recorded spend uses budget room; Prism can't know an exchange rate, so it refuses to guess |
| 2026-10-26 | Paid generation needs the Settings switch, a channel budget with room, and room in the studio-wide budget when one is set | A studio-wide budget is a ceiling, never permission on its own |
| 2026-10-26 | "Show demo data" only changes what lists show; counting queries filter `is_demo` themselves | The switch can never make demo data count toward progress, rewards, XP, achievements or analytics totals |
| 2026-10-26 | API analytics: one `metric_snapshots` row per (post, metric, UTC day), upserted through a partial unique index; manual and CSV rows are untouched | Re-running a pull (retries, Refresh now, two workers) can never double a number; history keeps one point per day |
| 2026-10-26 | Pull cadence daily for 30 days after publication, then weekly, counted from the last attempt (`metric_pulls`), success or not | Numbers move fast early and slowly later; a failing post waits for its next period instead of looping |
| 2026-10-26 | An auth failure marks the connection expired, dead-letters that job, and stops all pulls from it until reconnected | One failed call, not a retry storm; the owner sees "needs reconnecting" on Analytics and Accounts |
| 2026-10-26 | Only verified publications are pulled (never simulated or demo); Stop external actions pauses pulls | Only a platform's own post id identifies the post; the stop switch means Prism doesn't call the platforms at all |
| 2026-10-25 | Default posting windows are provisional (YouTube 09:00, TikTok 12:00, Instagram 11:30/18:30, staggered 20 min per channel) | Not claimed to be optimal; analytics will decide |
