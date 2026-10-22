/**
 * Level tracks and derived 0–100 player stats. Pure: the formulas here are the single source of
 * truth for both `refreshPlayerStats` (which persists them) and the UI (which shows them).
 */
import { levelFromXp } from "@/lib/game/xp-config";

export type LevelTrackKey = "CAREER" | "JOB_HUNTER" | "ELECTRICIAN";

export type LevelTrack = {
  key: LevelTrackKey;
  label: string;
  description: string;
  xp: number;
  level: number;
  /** XP at which the current level started. */
  current: number;
  /** XP needed to reach the next level. */
  next: number;
  /** 0..1 progress toward the next level. */
  progress: number;
};

const TRACK_META: Record<LevelTrackKey, { label: string; description: string }> = {
  CAREER: { label: "Career", description: "Every XP you have earned, across all tracks." },
  JOB_HUNTER: { label: "Job Hunter", description: "Applications, follow-ups, interview prep, interviews and offers." },
  ELECTRICIAN: { label: "Electrician", description: "Academy lessons, practice exams, logged work hours and certification steps." },
};

export function playerLevels(stats: { totalXp: number; jobHunterXp: number; electricianXp: number }): LevelTrack[] {
  const entries: [LevelTrackKey, number][] = [
    ["CAREER", stats.totalXp],
    ["JOB_HUNTER", stats.jobHunterXp],
    ["ELECTRICIAN", stats.electricianXp],
  ];
  return entries.map(([key, raw]) => {
    const xp = Math.max(0, Math.floor(raw || 0));
    const lvl = levelFromXp(xp);
    return { key, ...TRACK_META[key], xp, level: lvl.level, current: lvl.current, next: lvl.next, progress: lvl.progress };
  });
}

// ---------------------------------------------------------------------------
// Derived stats
// ---------------------------------------------------------------------------

/** Hours used as the 100 % mark for Training Progress (California General Electrician requirement). */
export const TRAINING_HOURS_GOAL = 8000;

export type StatInputs = {
  /** Interviews marked attended. */
  interviewsAttended: number;
  /** Interviews with prep marked complete. */
  interviewsPrepped: number;
  /** Academy lessons completed. */
  lessonsCompleted: number;
  /** Lessons available in the Academy. */
  totalLessons: number;
  /** Best score ratio (0..1) per quiz the user attempted. */
  quizBestRatios: number[];
  /** Résumé versions saved. */
  resumeVersions: number;
  /** Completed résumé-improvement missions. */
  resumeImprovementMissions: number;
  /** Follow-ups sent (one per application per day). */
  followUps: number;
  /** Recruiter / hiring contacts saved. */
  recruiterContacts: number;
  /** Employer-verified + official-record work hours. */
  verifiedHours: number;
};

export type DerivedStats = {
  interviewSkill: number;
  technicalKnowledge: number;
  resumeStrength: number;
  networking: number;
  trainingProgress: number;
};

export type StatKey = keyof DerivedStats;

export type StatDefinition = {
  key: StatKey;
  label: string;
  /** Human-readable formula shown next to the stat. */
  formula: string;
  /** The observed inputs, in words, for the "how this was calculated" line. */
  explain: (i: StatInputs) => string;
};

const clamp100 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const safe = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export function averageQuizRatio(ratios: readonly number[]): number {
  const valid = ratios.filter((r) => Number.isFinite(r)).map((r) => Math.max(0, Math.min(1, r)));
  if (valid.length === 0) return 0;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

export function computeDerivedStats(i: StatInputs): DerivedStats {
  const lessonsPart = i.totalLessons > 0 ? 60 * Math.min(1, safe(i.lessonsCompleted) / i.totalLessons) : 0;
  return {
    interviewSkill: clamp100(15 * safe(i.interviewsAttended) + 10 * safe(i.interviewsPrepped)),
    technicalKnowledge: clamp100(lessonsPart + 40 * averageQuizRatio(i.quizBestRatios)),
    resumeStrength: clamp100(Math.min(60, 20 * safe(i.resumeVersions)) + Math.min(40, 20 * safe(i.resumeImprovementMissions))),
    networking: clamp100(Math.min(60, 4 * safe(i.followUps)) + Math.min(40, 10 * safe(i.recruiterContacts))),
    trainingProgress: Math.max(0, Math.min(100, Math.floor((100 * safe(i.verifiedHours)) / TRAINING_HOURS_GOAL))),
  };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const STAT_DEFINITIONS: StatDefinition[] = [
  {
    key: "interviewSkill",
    label: "Interview Skill",
    formula: "15 × interviews attended + 10 × interviews prepped (max 100)",
    explain: (i) => `${plural(i.interviewsAttended, "interview")} attended, ${plural(i.interviewsPrepped, "prep")} completed`,
  },
  {
    key: "technicalKnowledge",
    label: "Technical Knowledge",
    formula: "60 × share of Academy lessons completed + 40 × average best quiz score",
    explain: (i) =>
      `${i.lessonsCompleted} of ${i.totalLessons} lessons, ${
        i.quizBestRatios.length ? `average best quiz score ${Math.round(averageQuizRatio(i.quizBestRatios) * 100)} %` : "no quizzes attempted"
      }`,
  },
  {
    key: "resumeStrength",
    label: "Résumé Strength",
    formula: "20 per résumé version (max 60) + 20 per résumé-improvement mission (max 40)",
    explain: (i) => `${plural(i.resumeVersions, "résumé version")}, ${plural(i.resumeImprovementMissions, "improvement mission")}`,
  },
  {
    key: "networking",
    label: "Networking",
    formula: "4 per follow-up (max 60) + 10 per recruiter contact (max 40)",
    explain: (i) => `${plural(i.followUps, "follow-up")}, ${plural(i.recruiterContacts, "recruiter contact")}`,
  },
  {
    key: "trainingProgress",
    label: "Training Progress",
    formula: `verified work hours ÷ ${TRAINING_HOURS_GOAL.toLocaleString("en-US")} × 100`,
    explain: (i) =>
      `${Math.floor(i.verifiedHours).toLocaleString("en-US")} employer-verified or official-record hours (self-reported hours are not counted)`,
  },
];
