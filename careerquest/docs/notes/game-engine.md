# game-engine — missions, streaks, levels, stats, achievements, campaigns

Owner key: `game-engine`. Built 2026-10-22. Everything here is recomputed from persisted, userId-scoped
data; nothing is incremented blindly, so replays, re-imports and repeated evaluations cannot double count.

## Routes (`src/app/(app)/missions/**`, LinkTabs: Today | This week | Campaign | Achievements)

| Route | What it shows |
|-------|---------------|
| `/missions` | Today's daily missions (progress bar, the reason each exists, XP reward, state as text, link to where the work is done, "I did this" for self-check missions), open weekly missions, today's XP (net ledger), streak, rest-day toggle, Career / Job Hunter / Electrician levels, campaign eyebrow. |
| `/missions/week` | Weekly missions (Mon–Sun) + 7-day activity strip (rest/active/day-off states in text) with a per-day table (applications, follow-ups, lessons, XP). |
| `/missions/campaign` | Operation Get Hired timeline (3 phases, today marker, focus lists, campaign missions incl. ones completed in an earlier run), current-phase missions, next-phase plan (Phase 3, and supportive planning copy past day N), employment card ("I accepted a job" → self-reported job + annualized salary into `PlayerStats.currentSalary`, Get Hired COMPLETED, Electrician Path continues; update / re-open), "Log a paycheck" (careerEarnings, self-reported, removable), salary targets, the $150K Electrician Path (verified vs self-reported hours, E150 milestones, links to /career-map and /academy). |
| `/missions/achievements` | Unlocked (date, "New" + motion unlock animation) and locked (progress toward the condition) cards, levels, derived stats with formula + observed inputs. Reduced motion (OS or profile) disables the animation. |

Global: `<AchievementCelebration />` (server, `src/components/game/achievement-celebration.tsx`) is mounted in
`src/app/(app)/layout.tsx` (one import + one element). It renders unseen achievements (`seenAt` null) as a
non-blocking, dismissible card (`celebration-overlay.tsx`, motion burst, reduced-motion aware); dismissing calls
`markAchievementsSeenAction(ids)`.

## Public API

- `src/lib/game/missions.ts` — `applyEventToMissions(tx, ctx)` (unchanged signature; `MissionEventContext.type`
  gained the optional value `"INTERVIEW_PREPARED"`), `ensureMissions(userId, today?)`, `ensureMissionsTx(tx, userId, now?)`,
  `evaluateMissionsTx(tx, userId, { now?, metrics?, ctx? })`, `loadGameContext`, `ensureCampaignRows`, `EVENT_METRICS`.
  `registerMissionHandler` remains as a deprecated no-op.
- `src/lib/game/achievements.ts` — `evaluateAchievements(tx, userId)` (same name/signature; returns only rows inserted
  by this call via `createManyAndReturn({ skipDuplicates: true })`), `loadAchievementFacts(db, userId, needed?)`.
  `registerAchievementEvaluator` was removed (no callers).
- `src/lib/game/xp.ts` — unchanged exports; `awardXp` now calls `touchStreak(tx, userId, activityDate)` after a new
  award that carries an activityDate (fixes review finding F4).
- `src/lib/game/streak.ts` (pure) — `computeStreak(days, { workdaysPerWeek, todayKey? })`, `isScheduledWorkday`,
  `isActiveDay`. `src/lib/game/streak-store.ts` — `touchStreak`, `recomputeStreak`.
- `src/lib/game/levels.ts` (pure) — `playerLevels`, `computeDerivedStats`, `STAT_DEFINITIONS` (formula strings shown in
  UI), `TRAINING_HOURS_GOAL = 8000`. `src/lib/game/player-stats.ts` — `refreshPlayerStats(db, userId)`, `loadStatInputs`.
- `src/lib/game/mission-catalog.ts` (pure) — `buildMissionPlan(PlanInput)`, `getHiredWindow`, `GAME_LINKS`,
  `readMissionMeta`, `PHASE_FOCUS`. `src/lib/game/achievement-catalog.ts` (pure) — `ACHIEVEMENTS`, `achievementStatus`,
  `satisfiedAchievementKeys`, `annualize`, `bestWeekWorkdays`.
- `src/lib/game/queries.ts` — `getTodayMissionsSummary(userId)`, `getTodayPageData`, `getWeekPageData`,
  `getCampaignPageData`, `getAchievementsPageData`, `getUnseenAchievements`.
- `src/lib/game/sync.ts` — `syncGameState(userId, { now?, stats?, achievements? })` (ensure → evaluate → streak →
  stats → achievements in one transaction, retried on deadlock), `runGameTransaction`.
- `src/lib/game/mutations.ts` — `setRestDay`, `checkOffMission`, `reportEmployment`, `reopenJobSearch`, `logPaycheck`,
  `removePaycheck`, `saveNextPhasePlan`, `markAchievementsSeen` (throw `GameInputError` for user-facing refusals).
- `src/lib/game/actions.ts` ("use server") — `toggleRestDayAction`, `checkOffMissionAction`, `reportEmploymentAction`,
  `reopenJobSearchAction`, `logPaycheckAction`, `removePaycheckAction`, `saveNextPhasePlanAction`
  (`(prev, formData) => ActionResult<{ message }>`), `markAchievementsSeenAction(ids)`. All: `requireUser`, 30/min rate
  limit, zod, `revalidatePath("/missions","layout")` + `/dashboard`.
- `src/components/game/today-missions-card.tsx` — `<TodayMissionsCard userId? />` (server, for the dashboard),
  `TodayMissionsCardView` (pure render), re-export of `getTodayMissionsSummary`.

## Rules implemented

- **Missions** (unique `(userId, key, periodStart)`, created with ON CONFLICT DO NOTHING):
  DAILY on planned workdays (≤5/wk: Mon–Fri, 6: Mon–Sat, 7: every day) and not on rest days — `daily.apply`
  (N = dailyApplicationTarget, distinct qualified positions first applied today, merged excluded, same position never
  twice), `daily.followups` (only when due; snapshot of due ids, later-due ones join, closed/rescheduled drop off),
  `daily.lesson` (while lessons remain), `daily.hours` (only if hours were logged in the last 14 days).
  WEEKLY — `weekly.apply` (W = weeklyApplicationTarget, minus the daily target per rest workday, min 1),
  `weekly.followups` (3; one per application per day), `weekly.interview-prep` (interview within 14 days),
  `weekly.quiz`. CAMPAIGN — Get Hired phase missions (Phase 1/2/3 as specified; phases are thirds of
  `campaignLengthDays`), 30-day "next phase" blocks after day N, and ELECTRICIAN_150K milestones (program
  applications, school enrollment, trainee registration, first hours entry, verified-hours milestones 1k/2k/4k/8k
  revealed one at a time, exam steps once unlocked).
- Completion: `COMPLETED` + `completedAt`, XP once via `awardXp({ reason: MISSION_DAILY | MISSION_WEEKLY, amount:
  xpReward, dedupeKey: "xp:mission:<id>", sourceType: "Mission", activityDate: today })`, `PlayerStats.missionsCompleted`
  and `DailyActivity.missionsCompleted` +1 once (guarded by `updateMany … where status = ACTIVE`). Completed missions are
  final (deleting records later never takes mission XP back). Expired missions just expire. Rest day → today's daily
  missions `SKIPPED` (restored when undone); reported job → job-search missions `SKIPPED` (restored on re-open).
- **Anti-farming**: cumulative / self-check campaign missions are earned once ever (a campaign restart does not recreate
  them), and open missions of a superseded Get Hired window expire.
- **Streaks**: workdays with real activity (`isActiveDay`); rest days and non-workdays neither break nor extend;
  `5 − workdaysPerWeek` idle weekdays per week are forgiven when fewer than 5 are planned; today never breaks it;
  rejections are not inputs.
- **Stats** (0–100, formula shown in UI): Interview Skill = 15×attended + 10×prepped; Technical Knowledge = 60×lesson share
  + 40×avg best quiz ratio; Résumé Strength = 20/version (≤60) + 20/improvement mission (≤40); Networking = 4/follow-up
  (≤60) + 10/contact (≤40); Training Progress = verified hours ÷ 8,000.
- **Achievements**: 23 (see catalog). Applications = distinct positions (appliedAt or APPLIED event, merged excluded);
  offers verified only; hours EMPLOYER_VERIFIED + OFFICIAL_RECORD only; Fundamentals = every FUNDAMENTALS lesson in
  `data/academy/lessons/*.json` (read once, cached); Certified = certifiedAt AND a CERTIFICATE document ("self-attested
  with document"); salary = best of accepted offers and `currentSalary` (hourly × hours/week × 52).
- Locking: every game transaction first locks the user's PlayerStats row (`lockPlayer`) so mission/XP writes for one
  user serialize; page syncs retry on deadlock/serialization errors.

## How to test

```bash
npx vitest run tests/unit/game-*.test.ts   # 6 files, 96 tests (game-db uses careerquest_test)
npx eslint src/lib/game src/components/game "src/app/(app)/missions" "src/app/(app)/layout.tsx" tests/unit/game-*.test.ts
npx tsc --noEmit
```

Manual: open `/missions` (missions are created on first view), log two applications at `/applications/new` with a
daily target of 2 → the daily mission completes and a celebration card for "First Application" appears on the
next render; toggle the rest day; on `/missions/campaign` report a job, log a paycheck, re-open the search.

## Known gaps / dependencies

- Résumé versions have no management page yet; `GAME_LINKS.resume` points to `/coach`. Repoint it when a résumé
  manager exists; that module should call `applyEventToMissions(tx, { type: "RESUME_UPDATED", … })`.
- Target companies (`/discovery`), integrations/imports (`/integrations`), salary scenarios (`/salary`), program
  interests / work hours / certification (`/academy/apprenticeships`, `/academy/hours`, `/academy/certification`) are
  built by other modules. Missions measure their tables directly; if those writers call `applyEventToMissions`
  (`PROFILE_UPDATED`, `WORK_HOURS_LOGGED`) + `evaluateAchievements` in their transaction, progress updates immediately,
  otherwise on the next missions/dashboard view.
- Mission sync happens on page views of `/missions/*` and on the dashboard card (writes are idempotent).
- The celebration is in the shared layout, which is not re-rendered on plain client navigation; it appears after the
  next server action/refresh/hard navigation.
- No XP is awarded for the self-reported employment card or paychecks (offer/acceptance XP stays with verified tracker
  records).
