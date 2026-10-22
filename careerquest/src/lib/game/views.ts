/**
 * Serializable view models for the missions UI (safe to pass to client components). Pure.
 */
import type { Campaign, MissionStatus, MissionType } from "@/generated/prisma/enums";
import { dateKey } from "@/lib/dates";
import { readMissionMeta, type MissionMetric, type SkipReason } from "@/lib/game/mission-catalog";
import type { LevelTrack } from "@/lib/game/levels";
import type { AchievementIcon, AchievementTier } from "@/lib/game/achievement-catalog";

export type MissionView = {
  id: string;
  key: string;
  title: string;
  description: string;
  type: MissionType;
  campaign: Campaign;
  status: MissionStatus;
  progress: number;
  target: number;
  xpReward: number;
  periodStartKey: string;
  periodEndKey: string;
  /** ISO timestamp. */
  completedAt: string | null;
  href: string | null;
  cta: string | null;
  metric: MissionMetric;
  phase: 1 | 2 | 3 | null;
  selfCheck: boolean;
  checkedAt: string | null;
  skipReason: SkipReason | null;
  /** Progress relies on something the user reported about themselves. */
  selfReported: boolean;
};

const SELF_REPORTED_METRICS: ReadonlySet<MissionMetric> = new Set<MissionMetric>([
  "SELF_CHECK",
  "SCHOOL_ENROLLED",
  "TRAINEE_REGISTERED",
  "EXAM_APPLIED",
  "EXAM_PASSED",
  "NEXT_PHASE_PLAN",
]);

export type MissionRowLike = {
  id: string;
  key: string;
  title: string;
  description: string;
  type: MissionType;
  campaign: Campaign;
  status: MissionStatus;
  progress: number;
  target: number;
  xpReward: number;
  periodStart: Date;
  periodEnd: Date;
  completedAt: Date | null;
  metadata: unknown;
};

export function toMissionView(row: MissionRowLike): MissionView {
  const meta = readMissionMeta(row.metadata);
  return {
    id: row.id,
    key: row.key,
    title: row.title,
    description: row.description,
    type: row.type,
    campaign: row.campaign,
    status: row.status,
    progress: row.progress,
    target: row.target,
    xpReward: row.xpReward,
    periodStartKey: dateKey(row.periodStart),
    periodEndKey: dateKey(row.periodEnd),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    href: meta.href,
    cta: meta.cta,
    metric: meta.metric,
    phase: meta.phase,
    selfCheck: meta.selfCheck,
    checkedAt: meta.checkedAt ?? null,
    skipReason: meta.skipReason ?? null,
    selfReported: SELF_REPORTED_METRICS.has(meta.metric) || (meta.metric === "SALARY_PREP" && Boolean(meta.checkedAt)),
  };
}

const STATUS_ORDER: Record<MissionStatus, number> = { ACTIVE: 0, COMPLETED: 1, SKIPPED: 2, EXPIRED: 3 };

/** Active first (closest to done first), then completed, skipped, expired. */
export function sortMissions(list: MissionView[]): MissionView[] {
  return [...list].sort((a, b) => {
    const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (s !== 0) return s;
    const ra = a.target > 0 ? a.progress / a.target : 0;
    const rb = b.target > 0 ? b.progress / b.target : 0;
    return rb - ra;
  });
}

export type StreakView = { current: number; longest: number; lastActiveKey: string | null };

export type TodayMissionsSummary = {
  todayKey: string;
  timezone: string;
  isWorkday: boolean;
  restDay: boolean;
  hired: boolean;
  daily: MissionView[];
  weekly: MissionView[];
  streak: StreakView;
  /** Net XP recorded today (ledger, revocations included). */
  todayXp: number;
  dailyDone: number;
  dailyTotal: number;
};

export type WeekDayView = {
  key: string;
  weekday: string;
  dateLabel: string;
  isToday: boolean;
  isFuture: boolean;
  workday: boolean;
  restDay: boolean;
  applications: number;
  followUps: number;
  lessons: number;
  xp: number;
  missions: number;
  active: boolean;
};

export type LevelsView = LevelTrack[];

export type PhaseView = {
  index: 1 | 2 | 3;
  name: string;
  title: string;
  startDay: number;
  endDay: number;
  startKey: string;
  endKey: string;
  state: "done" | "current" | "upcoming";
  focus: string[];
  missions: MissionView[];
};

export type AchievementCardView = {
  key: string;
  title: string;
  description: string;
  icon: AchievementIcon;
  tier: AchievementTier;
  condition: string;
  label: string | null;
  unlocked: boolean;
  /** ISO timestamp. */
  unlockedAt: string | null;
  /** Unlocked but not acknowledged yet (drives the unlock animation). */
  fresh: boolean;
  current: number;
  target: number;
  ratio: number;
};

export type UnseenAchievement = {
  id: string;
  key: string;
  title: string;
  description: string;
  icon: AchievementIcon;
  tier: AchievementTier;
  unlockedAt: string;
};
