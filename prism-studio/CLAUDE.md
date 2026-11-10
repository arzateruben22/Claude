# Prism Studio: notes for Claude

- **The database is the source of truth.** These markdown files are developer memory only. Never put business
  facts (accounts, money, numbers) in code or docs.
- **Rules live in `src/domain/`.** Screens and actions call the domain; they don't reimplement its rules. Each rule
  that can go wrong has a test in `tests/`. Add one when you add a rule.
- **Never** store platform passwords, recovery codes or 2-step codes. Never invent account-specific links: only
  official generic links, or ones built from an ID the owner entered (`youtubeStudioFor`).
- **Publishing is manual.** Opening, downloading, sharing or copying never marks anything published; only
  the owner's "Uploaded" buttons (owner-reported) or a verified integration does. Nothing posts by itself; the buttons
  only record what the owner did. One publication record per destination.
- **Uploaded buttons (owner's decision, 9 Nov 2026):** the owner posts by hand and presses "Uploaded on YouTube & TikTok" /
  "Uploaded on Instagram"; that records owner-reported posts (audit-logged, undoable). Approvals are no longer part of the UI.
  Long videos have the same button, "Uploaded on YouTube" (10 Nov 2026: `LessonUploadedControl`, `markLessonUploaded` /
  `undoLessonUploaded`): any real, built lesson, no approval; published = the owner pressed it; Undo → ready_for_review.
- **Video clearing (owner's request):** once both Uploaded buttons have stood 3 days (`VIDEO_CLEAR_GRACE_DAYS`), the worker's
  hourly `cleanup_uploaded_media` job erases that episode's `out/*.mp4` from the server and sets `episodes.video_cleared_at`
  (`src/domain/media-cleanup.ts`). Covers, captions and text stay; the importer keeps cleared episodes as they are;
  media-push skips their videos. Never inside a git checkout or a read-only mirror. Compilations are never touched.
- **Archived channels (owner's request, 10 Nov 2026: Body Backstage, `drizzle/0008`):** `channels.archived_at` set =
  hidden from every screen, list and total, and skipped by everything automatic (schedule, publish, notifications,
  analytics pulls, video cleanup, importer, media push). Paused is different (nothing planned, still shown). Never query
  `channels` or iterate `CHANNELS` for a screen or job: use `activeChannels()` / `onActiveChannel(col)` /
  `activeChannelBySlug()` in `src/domain/channels.ts` (an archived channel's pages 404). Nothing is deleted; the seed
  never un-archives; Settings → Archived channels → Restore (audit-logged) brings it back. Costs keep counting its real
  spend in the studio total (its entries stay listed, read-only). The wall re-balances (`rigLayout`, src/lib/rig.ts).
- **Uploaded seasons are archived (owner's request, 10 Nov 2026):** a season is uploaded once every real (non-demo,
  not cancelled) episode stands on both Uploaded buttons and every built long video of it is marked uploaded
  (`src/domain/season-archive.ts`, using `episodeUploaded` from publications.ts, the buttons' one done test). Derived,
  never stored: an Undo brings it back. It leaves every working view for Library → Archived seasons (read-only; its
  episode pages say so) but keeps counting in analytics, totals, earnings and rewards. Never list a channel's episodes,
  posts, series or lessons for a working screen or job without `onWorkingSeason` / `seriesOnWorkingSeason` /
  `lessonOnWorkingSeason` (screens: `workingSeasons()` in src/lib/data.ts, cached per request). Planning never places
  its posts (a slot one holds counts as free); the importer keeps its render and posts as they are.
- **Packaging (owner's rule, 10 Nov 2026; films/channels/PACKAGING.md, `drizzle/0009`):** the importer reads
  `epNN/out/packaging.json` and `compilations/<name>/packaging.json` with zod (`src/domain/packaging.ts`: forgiving, a bad
  or missing file never fails an import, the stored one is kept) into `episodes.packaging` / `lessons.packaging`. The
  winner title is the YouTube title exactly (`buildMetadata`'s `packagingTitle`, no "| Channel · No." suffix; TikTok and
  Instagram unchanged); a new or changed winner reaches an existing export or lesson title (approval lapses) unless it is
  already on YouTube, and the same packaging again keeps the owner's edits. The "Title & thumbnail" card
  (`PackagingCard`) shows it on the episode page, the Lessons tab and the long-video card; scores are always labelled
  creative judgments, not CTR predictions. The worker image carries zod for this (Dockerfile).
- **Money:** Prism never moves money. Personal rewards are owner-funded, reserved only within the funded balance
  and the monthly cap, under a row lock. Demo or estimated numbers never create or reserve a reward. Production
  budgets are separate, and paid generation stays off without one.
- **Demo data** is always labelled DEMO (or SIMULATED) on screen and never counts as real progress.
- Times are stored in UTC and shown in the studio timezone (`src/domain/time.ts`, DST-safe).
- **Connectors** (`src/integrations/`) are pure API clients with injected `fetch`; the studio decides what/when to publish (`src/domain/publish.ts`). Only a platform's own "published" answer verifies a publication. Tokens are sealed; never log them.
- Raw SQL: drizzle expands a JS array parameter into a parenthesised list. Write `col in ${arr}`, never `= any(${arr})`.
- Verify with `npm run typecheck && npm test && npx next build`, then click through at 390 px and desktop.
