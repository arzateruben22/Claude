import "server-only";
import type { Tx } from "@/lib/game/xp";
import { dateFromKey, dateKey, startOfWeekUtc } from "@/lib/dates";
import {
  ACHIEVEMENTS,
  bestWeekWorkdays,
  satisfiedAchievementKeys,
  type AchievementFacts,
  type FactKey,
} from "@/lib/game/achievement-catalog";
import { appliedDayKeys, bestAnnualizedSalary, countDistinctAppliedPositions, safeTimezone, verifiedHoursTotal } from "@/lib/game/facts";
import { fundamentalsLessonKeys } from "@/lib/game/lessons-index";
import { isScheduledWorkday } from "@/lib/game/streak";

export type UnlockedAchievement = { key: string; unlockedAt: Date };

const ALL_FACTS: ReadonlySet<FactKey> = new Set(ACHIEVEMENTS.flatMap((a) => a.facts));

export const EMPTY_FACTS: AchievementFacts = {
  distinctApplications: 0,
  recruiterResponses: 0,
  interviews: 0,
  verifiedOffers: 0,
  careerEarnings: 0,
  acceptedPrograms: 0,
  verifiedHours: 0,
  fundamentalsCompleted: 0,
  fundamentalsTotal: 0,
  certifiedWithDocument: false,
  annualizedSalary: null,
  bestWeekWorkdays: 0,
  longestStreak: 0,
};

/**
 * Snapshot of the persisted data achievements are judged on. Only the facts in `needed` are
 * queried (evaluation skips facts that only unlocked achievements depend on).
 */
export async function loadAchievementFacts(db: Tx, userId: string, needed: ReadonlySet<FactKey> = ALL_FACTS): Promise<AchievementFacts> {
  const facts: AchievementFacts = { ...EMPTY_FACTS };
  const want = (k: FactKey) => needed.has(k);
  // Thunks run sequentially: queries share one interactive-transaction connection.
  const jobs: (() => Promise<void>)[] = [];

  if (want("distinctApplications")) {
    jobs.push(() => countDistinctAppliedPositions(db, userId).then((n) => void (facts.distinctApplications = n)));
  }
  if (want("recruiterResponses")) {
    jobs.push(() =>
      db.applicationEvent
        .count({ where: { userId, type: "RECRUITER_RESPONSE", application: { mergedIntoId: null } } })
        .then((n) => void (facts.recruiterResponses = n)),
    );
  }
  if (want("interviews")) {
    jobs.push(() =>
      db.application
        .count({
          where: {
            userId,
            mergedIntoId: null,
            OR: [{ interviews: { some: {} } }, { events: { some: { type: { in: ["INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED"] } } } }],
          },
        })
        .then((n) => void (facts.interviews = n)),
    );
  }
  if (want("verifiedOffers")) {
    jobs.push(() =>
      db.applicationEvent
        .count({ where: { userId, type: "OFFER_RECEIVED", verified: true, application: { mergedIntoId: null } } })
        .then((n) => void (facts.verifiedOffers = n)),
    );
  }
  if (want("careerEarnings") || want("longestStreak")) {
    jobs.push(() =>
      db.playerStats
        .findUnique({ where: { userId }, select: { careerEarnings: true, currentStreak: true, longestStreak: true } })
        .then((s) => {
          facts.careerEarnings = s ? Number(s.careerEarnings.toString()) : 0;
          facts.longestStreak = s ? Math.max(s.currentStreak, s.longestStreak) : 0;
        }),
    );
  }
  if (want("acceptedPrograms")) {
    jobs.push(() => db.userProgramInterest.count({ where: { userId, status: "ACCEPTED" } }).then((n) => void (facts.acceptedPrograms = n)));
  }
  if (want("verifiedHours")) {
    jobs.push(() => verifiedHoursTotal(db, userId).then((n) => void (facts.verifiedHours = n)));
  }
  if (want("fundamentalsCompleted") || want("fundamentalsTotal")) {
    const keys = fundamentalsLessonKeys();
    facts.fundamentalsTotal = keys.length;
    if (keys.length) {
      jobs.push(() =>
        db.lessonProgress
          .count({ where: { userId, status: "COMPLETED", lessonKey: { in: keys } } })
          .then((n) => void (facts.fundamentalsCompleted = n)),
      );
    }
  }
  if (want("certifiedWithDocument")) {
    jobs.push(async () => {
      const c = await db.certificationStatus.count({ where: { userId, certifiedAt: { not: null } } });
      const d = c > 0 ? await db.document.count({ where: { userId, kind: "CERTIFICATE" } }) : 0;
      facts.certifiedWithDocument = c > 0 && d > 0;
    });
  }
  if (want("annualizedSalary")) {
    jobs.push(() => bestAnnualizedSalary(db, userId).then((n) => void (facts.annualizedSalary = n)));
  }
  if (want("bestWeekWorkdays")) {
    jobs.push(async () => {
      const profile = await db.userProfile.findUnique({ where: { userId }, select: { timezone: true, workdaysPerWeek: true } });
      const keys = await appliedDayKeys(db, userId, safeTimezone(profile?.timezone));
      const wpw = profile?.workdaysPerWeek ?? 5;
      facts.bestWeekWorkdays = bestWeekWorkdays(
        keys,
        (k) => isScheduledWorkday(dateFromKey(k), wpw),
        (k) => dateKey(startOfWeekUtc(dateFromKey(k))),
      );
    });
  }
  for (const job of jobs) await job();
  return facts;
}

/**
 * Evaluate achievement conditions against persisted data and unlock any newly satisfied ones.
 * Idempotent: inserts use ON CONFLICT DO NOTHING on (userId, achievementKey), so re-evaluation,
 * replays and concurrent evaluations never double-unlock, and only rows actually inserted by this
 * call are returned.
 */
export async function evaluateAchievements(tx: Tx, userId: string): Promise<UnlockedAchievement[]> {
  const have = new Set(
    (await tx.userAchievement.findMany({ where: { userId }, select: { achievementKey: true } })).map((r) => r.achievementKey),
  );
  const locked = ACHIEVEMENTS.filter((a) => !have.has(a.key));
  if (locked.length === 0) return [];
  const needed = new Set<FactKey>(locked.flatMap((a) => a.facts));
  const facts = await loadAchievementFacts(tx, userId, needed);
  const keys = satisfiedAchievementKeys(facts, locked);
  if (keys.length === 0) return [];
  const unlockedAt = new Date();
  const rows = await tx.userAchievement.createManyAndReturn({
    data: keys.map((achievementKey) => ({ userId, achievementKey, unlockedAt })),
    skipDuplicates: true,
    select: { achievementKey: true, unlockedAt: true },
  });
  return rows.map((r) => ({ key: r.achievementKey, unlockedAt: r.unlockedAt }));
}
