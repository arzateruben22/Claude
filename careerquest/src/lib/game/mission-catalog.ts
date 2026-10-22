/**
 * Mission catalog: which missions exist for a given day, week and campaign phase. Pure — every
 * input is passed in (`PlanInput`), so the generation rules are unit-tested by day and phase and
 * `ensureMissions` (src/lib/game/missions.ts) only has to load facts and persist the plan.
 *
 * Every mission maps to a real action and is measured by a `MissionMetric` that is recomputed from
 * persisted data (see src/lib/game/mission-metrics.ts); nothing here is ever "incremented".
 * Missions never cost XP, expired missions simply expire, and a rest day removes that day's daily
 * expectations.
 */
import type { Campaign, MissionType } from "@/generated/prisma/enums";
import { addUtcDays, dateKey, daysBetween, startOfWeekUtc } from "@/lib/dates";
import { phaseSegments, type PhaseSegment } from "@/lib/dashboard/campaign";
import { clampWorkdaysPerWeek, isScheduledWorkday } from "@/lib/game/streak";
import { XP, type XpReason } from "@/lib/game/xp-config";
import { weekTargets } from "@/lib/goals/calculator";

export const MISSION_METRICS = [
  "APPLICATIONS_DAY",
  "APPLICATIONS_WEEK",
  "FOLLOW_UPS_DUE_CLEARED",
  "FOLLOW_UPS",
  "LESSONS",
  "TRAINING_HOURS_LOGGED",
  "INTERVIEW_PREP",
  "QUIZ_PASSED",
  "ONBOARDING",
  "RESUME_VERSIONS",
  "RESUME_IMPROVED",
  "TRACKING_CONNECTED",
  "TARGET_COMPANIES",
  "APPLICATIONS_TOTAL",
  "PROGRAMS_RESEARCHED",
  "FUNDAMENTALS_LESSONS",
  "APPLICATION_DAYS",
  "INTERVIEW_PREPS_PERIOD",
  "SELF_CHECK",
  "TRAINING_MILESTONE",
  "INTERVIEWS_PERIOD",
  "OFFERS_RECORDED",
  "SALARY_PREP",
  "NEXT_PHASE_PLAN",
  "PROGRAM_APPLICATIONS",
  "SCHOOL_ENROLLED",
  "TRAINEE_REGISTERED",
  "HOURS_ENTRIES",
  "VERIFIED_HOURS",
  "EXAM_APPLIED",
  "EXAM_PASSED",
] as const;

export type MissionMetric = (typeof MISSION_METRICS)[number];

export const SKIP_REASONS = ["REST_DAY", "HIRED", "NOTHING_DUE"] as const;
export type SkipReason = (typeof SKIP_REASONS)[number];

export const SKIP_REASON_LABELS: Record<SkipReason, string> = {
  REST_DAY: "Rest day — no expectations today",
  HIRED: "Paused: you reported accepting a job",
  NOTHING_DUE: "Nothing left to follow up today",
};

export type MissionLink = { href: string; label: string };

/** Where each kind of mission is done. Kept in one place so integration can repoint routes. */
export const GAME_LINKS = {
  newApplication: { href: "/applications/new", label: "Log an application" },
  followUps: { href: "/applications?sort=followUp", label: "Open follow-ups" },
  interviews: { href: "/applications?status=INTERVIEWING", label: "Open interviews" },
  offers: { href: "/applications?status=OFFER,ACCEPTED,HIRED", label: "Open offers" },
  applications: { href: "/applications", label: "Open the tracker" },
  academy: { href: "/academy", label: "Open the Academy" },
  hours: { href: "/career-map", label: "Log work hours" },
  careerMap: { href: "/career-map", label: "Open the Career Map" },
  onboarding: { href: "/settings/onboarding", label: "Finish setup" },
  resume: { href: "/coach", label: "Work on your résumé" },
  integrations: { href: "/integrations", label: "Open Integrations" },
  targets: { href: "/discovery", label: "Open Job Discovery" },
  analytics: { href: "/analytics", label: "Open Analytics" },
  salary: { href: "/salary", label: "Open the Salary Simulator" },
  plan: { href: "/missions/campaign#next-phase", label: "Write the plan" },
} as const satisfies Record<string, MissionLink>;

/** Shape of `Mission.metadata` written by the catalog (plus runtime fields like checkedAt). */
export type MissionMeta = {
  metric: MissionMetric;
  href: string | null;
  cta: string | null;
  phase: 1 | 2 | 3 | null;
  /** The user can check this mission off themselves (labelled Self-reported). */
  selfCheck: boolean;
  /** Job-search mission: paused while the user reports being employed. */
  jobHunt: boolean;
  /** Title/target follow the profile (re-synced while the mission is active). */
  syncTarget: boolean;
  /** APPLICATION_DAYS: share of workdays (0..1). */
  ratio?: number;
  /** FOLLOW_UPS_DUE_CLEARED: the applications that were due when the mission was created. */
  applicationIds?: string[];
  /** VERIFIED_HOURS milestone. */
  milestone?: number;
  /** ISO timestamp when the user checked a self-check mission off. */
  checkedAt?: string;
  skipReason?: SkipReason;
};

export type MissionSpec = {
  key: string;
  type: MissionType;
  campaign: Campaign;
  title: string;
  description: string;
  periodStart: Date;
  periodEnd: Date;
  target: number;
  xpReward: number;
  meta: MissionMeta;
};

export type PlanInput = {
  /** Today in the user's timezone (UTC-midnight). */
  today: Date;
  dailyApplicationTarget: number;
  weeklyApplicationTarget: number;
  workdaysPerWeek: number;
  campaignLengthDays: number;
  getHired: { startedAt: Date; completed: boolean };
  electricianStartedAt: Date;
  restDayToday: boolean;
  /** Rest days this week that fell on planned workdays. */
  restWorkdaysThisWeek: number;
  /** Applications with a follow-up due today or overdue. */
  followUpsDue: string[];
  /** The user logged work hours in the last 14 days. */
  loggedHoursRecently: boolean;
  /** An interview is scheduled within the next 14 days. */
  interviewWithin14Days: boolean;
  /** Academy lessons not completed yet. */
  lessonsRemaining: number;
  /** Lessons in the FUNDAMENTALS track. */
  fundamentalsTotal: number;
  /** Employer-verified + official-record hours. */
  verifiedHours: number;
  /** Exam eligibility/application/pass recorded, or 8,000 verified hours reached. */
  examStageUnlocked: boolean;
};

export const PHASE2_WORKDAY_RATIO = 0.6;
export const EXTENSION_WORKDAY_RATIO = 0.5;
export const EXTENSION_BLOCK_DAYS = 30;
export const TRAINING_MILESTONE_LESSONS = 5;
export const TRAINING_MILESTONE_HOURS = 40;
export const NEXT_PHASE_PLAN_MIN_LENGTH = 20;
export const ELECTRICIAN_HORIZON_DAYS = 3650;
export const HOURS_MILESTONES: readonly { hours: number; xp: number }[] = [
  { hours: 1000, xp: 250 },
  { hours: 2000, xp: 300 },
  { hours: 4000, xp: 400 },
  { hours: 8000, xp: 600 },
];

export const PHASE_FOCUS: Record<1 | 2 | 3, { title: string; focus: string[] }> = {
  1: {
    title: "Set up and launch",
    focus: [
      "Complete your profile and onboarding",
      "Prepare a résumé version",
      "Connect tracking (email, extension or an import)",
      "Build a target-company list",
      "Send your first applications",
      "Research apprenticeship programs",
      "Work through Electrical Fundamentals",
    ],
  },
  2: {
    title: "Build momentum",
    focus: [
      "Apply consistently on your workdays",
      "Follow up on open applications",
      "Practice for interviews",
      "Read your funnel analytics",
      "Improve your résumé from what you learn",
      "Hit a training milestone",
    ],
  },
  3: {
    title: "Convert and close",
    focus: [
      "Convert applications into interviews",
      "Keep active conversations going",
      "Evaluate offers on facts (base, hours, benefits)",
      "Prepare for salary negotiation",
      "Optimize your path",
      "Plan the next phase if you are still searching",
    ],
  },
};

export function missionXpReason(type: MissionType): XpReason {
  return type === "DAILY" ? "MISSION_DAILY" : "MISSION_WEEKLY";
}

const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

function isMetric(v: unknown): v is MissionMetric {
  return typeof v === "string" && (MISSION_METRICS as readonly string[]).includes(v);
}

function isSkipReason(v: unknown): v is SkipReason {
  return typeof v === "string" && (SKIP_REASONS as readonly string[]).includes(v);
}

/** Parse `Mission.metadata` defensively (rows can predate fields or be edited by hand). */
export function readMissionMeta(value: unknown): MissionMeta {
  const o = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const phase = o.phase === 1 || o.phase === 2 || o.phase === 3 ? o.phase : null;
  const meta: MissionMeta = {
    metric: isMetric(o.metric) ? o.metric : "SELF_CHECK",
    href: typeof o.href === "string" && o.href.startsWith("/") ? o.href : null,
    cta: typeof o.cta === "string" ? o.cta : null,
    phase,
    selfCheck: o.selfCheck === true,
    jobHunt: o.jobHunt === true,
    syncTarget: o.syncTarget === true,
  };
  if (typeof o.ratio === "number" && o.ratio > 0 && o.ratio <= 1) meta.ratio = o.ratio;
  if (Array.isArray(o.applicationIds)) meta.applicationIds = o.applicationIds.filter((x): x is string => typeof x === "string").slice(0, 200);
  if (typeof o.milestone === "number" && o.milestone > 0) meta.milestone = o.milestone;
  if (typeof o.checkedAt === "string" && !Number.isNaN(Date.parse(o.checkedAt))) meta.checkedAt = o.checkedAt;
  if (isSkipReason(o.skipReason)) meta.skipReason = o.skipReason;
  return meta;
}

/** JSON written to Mission.metadata (undefined fields dropped). */
export function missionMetaJson(meta: MissionMeta): Record<string, string | number | boolean | string[] | null> {
  const out: Record<string, string | number | boolean | string[] | null> = {};
  for (const [k, v] of Object.entries(meta)) if (v !== undefined) out[k] = v as string | number | boolean | string[] | null;
  return out;
}

function meta(metric: MissionMetric, link: MissionLink | null, extra: Partial<MissionMeta> = {}): MissionMeta {
  return {
    metric,
    href: link?.href ?? null,
    cta: link?.label ?? null,
    phase: null,
    selfCheck: false,
    jobHunt: false,
    syncTarget: false,
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Campaign windows
// ---------------------------------------------------------------------------

export type CampaignWindow = { phase: 1 | 2 | 3 | null; start: Date; end: Date; block: number | null };

/**
 * The Operation Get Hired window that contains `today`: a phase (1–3) during the campaign, or a
 * 30-day "next phase" block after it. Null before the campaign starts.
 */
export function getHiredWindow(startedAt: Date, today: Date, lengthDays: number): CampaignWindow | null {
  const length = Math.max(3, Math.floor(lengthDays) || 90);
  const day = daysBetween(startedAt, today) + 1;
  if (day < 1) return null;
  if (day <= length) {
    const seg = phaseSegments(length).find((p) => day >= p.startDay && day <= p.endDay) as PhaseSegment;
    return { phase: seg.index, start: addUtcDays(startedAt, seg.startDay - 1), end: addUtcDays(startedAt, seg.endDay - 1), block: null };
  }
  const block = Math.floor((day - length - 1) / EXTENSION_BLOCK_DAYS);
  const start = addUtcDays(startedAt, length + block * EXTENSION_BLOCK_DAYS);
  return { phase: null, start, end: addUtcDays(start, EXTENSION_BLOCK_DAYS - 1), block };
}

/** Planned workdays in [start, end], excluding rest days. */
export function plannedWorkdays(start: Date, end: Date, workdaysPerWeek: number, restKeys: ReadonlySet<string> = new Set()): number {
  let n = 0;
  for (let d = start; d.getTime() <= end.getTime(); d = addUtcDays(d, 1)) {
    if (isScheduledWorkday(d, workdaysPerWeek) && !restKeys.has(dateKey(d))) n += 1;
  }
  return n;
}

/** Target for an "apply on X % of workdays" mission. Rest days shrink it; never below 1. */
export function applicationDaysTarget(start: Date, end: Date, workdaysPerWeek: number, ratio: number, restKeys: ReadonlySet<string> = new Set()): number {
  return Math.max(1, Math.ceil(ratio * plannedWorkdays(start, end, workdaysPerWeek, restKeys)));
}

/** This week's application target after rest days (daily target removed per rest workday). */
export function weeklyApplicationTarget(input: Pick<PlanInput, "dailyApplicationTarget" | "weeklyApplicationTarget" | "workdaysPerWeek" | "restWorkdaysThisWeek">): {
  base: number;
  target: number;
} {
  const t = weekTargets({
    dailyApplicationTarget: input.dailyApplicationTarget,
    workdaysPerWeek: input.workdaysPerWeek,
    weeklyApplicationTarget: input.weeklyApplicationTarget,
  });
  const reduction = Math.max(0, t.dailyTarget) * Math.max(0, input.restWorkdaysThisWeek);
  return { base: t.weeklyTarget, target: t.weeklyTarget > 0 ? Math.max(1, t.weeklyTarget - reduction) : 0 };
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

function dailyMissions(i: PlanInput): MissionSpec[] {
  const wpw = clampWorkdaysPerWeek(i.workdaysPerWeek);
  if (!isScheduledWorkday(i.today, wpw) || i.restDayToday) return [];
  const base = { type: "DAILY" as const, campaign: "GET_HIRED" as const, periodStart: i.today, periodEnd: i.today, xpReward: XP.MISSION_DAILY };
  const out: MissionSpec[] = [];
  const hired = i.getHired.completed;
  const n = Math.max(0, Math.floor(i.dailyApplicationTarget || 0));
  if (!hired && n > 0) {
    out.push({
      ...base,
      key: "daily.apply",
      title: `Submit ${n} qualified ${plural(n, "application")}`,
      description: `Your daily target is ${n} (Settings → Campaign). Counts distinct qualified positions marked as applied today; the same position never counts twice.`,
      target: n,
      meta: meta("APPLICATIONS_DAY", GAME_LINKS.newApplication, { jobHunt: true, syncTarget: true }),
    });
  }
  if (!hired && i.followUpsDue.length > 0) {
    const c = i.followUpsDue.length;
    out.push({
      ...base,
      key: "daily.followups",
      title: "Clear today's follow-ups",
      description: `${c} ${plural(c, "application has a follow-up", "applications have follow-ups")} due today or overdue. Log each follow-up on its application; rescheduled or closed ones drop off the list.`,
      target: c,
      meta: meta("FOLLOW_UPS_DUE_CLEARED", GAME_LINKS.followUps, { jobHunt: true, applicationIds: i.followUpsDue.slice(0, 200) }),
    });
  }
  if (i.lessonsRemaining > 0) {
    out.push({
      ...base,
      campaign: "ELECTRICIAN_150K",
      key: "daily.lesson",
      title: "Complete an Academy lesson",
      description: "Steady study for the $150K Electrician Path. Any Academy lesson you complete today counts.",
      target: 1,
      meta: meta("LESSONS", GAME_LINKS.academy),
    });
  }
  if (i.loggedHoursRecently) {
    out.push({
      ...base,
      campaign: "ELECTRICIAN_150K",
      key: "daily.hours",
      title: "Log your training hours",
      description: "You logged work hours in the last 14 days, so keeping the log current is part of today. Any entry logged today counts (self-reported until verified).",
      target: 1,
      meta: meta("TRAINING_HOURS_LOGGED", GAME_LINKS.hours),
    });
  }
  return out;
}

function weeklyMissions(i: PlanInput): MissionSpec[] {
  const weekStart = startOfWeekUtc(i.today);
  const base = { type: "WEEKLY" as const, campaign: "GET_HIRED" as const, periodStart: weekStart, periodEnd: addUtcDays(weekStart, 6), xpReward: XP.MISSION_WEEKLY };
  const out: MissionSpec[] = [];
  const hired = i.getHired.completed;
  if (!hired) {
    const w = weeklyApplicationTarget(i);
    if (w.target > 0) {
      const restNote =
        w.target < w.base
          ? ` Your weekly target is ${w.base}; ${i.restWorkdaysThisWeek} rest ${plural(i.restWorkdaysThisWeek, "day")} this week lowered it.`
          : ` Your weekly target is ${w.base} (Settings → Campaign).`;
      out.push({
        ...base,
        key: "weekly.apply",
        title: `Submit ${w.target} ${plural(w.target, "application")} this week`,
        description: `Distinct qualified positions marked as applied Monday–Sunday.${restNote}`,
        target: w.target,
        meta: meta("APPLICATIONS_WEEK", GAME_LINKS.newApplication, { jobHunt: true, syncTarget: true }),
      });
    }
    out.push({
      ...base,
      key: "weekly.followups",
      title: "Complete 3 follow-ups",
      description: "Follow-ups keep applications alive. Counts one follow-up per application per day.",
      target: 3,
      meta: meta("FOLLOW_UPS", GAME_LINKS.followUps, { jobHunt: true }),
    });
    if (i.interviewWithin14Days) {
      out.push({
        ...base,
        key: "weekly.interview-prep",
        title: "Prepare for your interview",
        description: "You have an interview in the next 14 days. Mark prep complete on the interview in the tracker once you have researched the company and practiced answers.",
        target: 1,
        meta: meta("INTERVIEW_PREP", GAME_LINKS.interviews, { jobHunt: true }),
      });
    }
  }
  out.push({
    ...base,
    campaign: "ELECTRICIAN_150K",
    key: "weekly.quiz",
    title: "Pass a practice quiz",
    description: "Quizzes lock in what you studied. Any Academy quiz you pass this week counts.",
    target: 1,
    meta: meta("QUIZ_PASSED", GAME_LINKS.academy),
  });
  return out;
}

type CampaignDef = {
  key: string;
  title: string;
  description: string;
  metric: MissionMetric;
  target: number;
  xp: number;
  link: MissionLink | null;
  extra?: Partial<MissionMeta>;
};

function phaseDefs(phase: 1 | 2 | 3, i: PlanInput): CampaignDef[] {
  if (phase === 1) {
    const defs: CampaignDef[] = [
      { key: "gh.p1.onboarding", title: "Complete onboarding", description: "Your targets, regions and pathway drive every mission and projection.", metric: "ONBOARDING", target: 1, xp: 50, link: GAME_LINKS.onboarding },
      { key: "gh.p1.resume", title: "Add a résumé version", description: "Save at least one résumé version so applications can record which one you sent.", metric: "RESUME_VERSIONS", target: 1, xp: 50, link: GAME_LINKS.resume },
      { key: "gh.p1.tracking", title: "Connect tracking or run an import", description: "Connect an email account or the browser extension, or import a CSV / email export, so applications are captured automatically.", metric: "TRACKING_CONNECTED", target: 1, xp: 75, link: GAME_LINKS.integrations },
      { key: "gh.p1.targets", title: "Build a target-company list of 10", description: "Ten employers you would be glad to work for give your search a direction.", metric: "TARGET_COMPANIES", target: 10, xp: 75, link: GAME_LINKS.targets },
      { key: "gh.p1.apps25", title: "Reach 25 applications", description: "Distinct positions you have applied to (merged duplicates count once).", metric: "APPLICATIONS_TOTAL", target: 25, xp: 150, link: GAME_LINKS.newApplication },
      { key: "gh.p1.programs", title: "Research 3 apprenticeship programs", description: "Save three programs from the apprenticeship directory to compare requirements and recruitment windows.", metric: "PROGRAMS_RESEARCHED", target: 3, xp: 100, link: GAME_LINKS.careerMap, extra: { jobHunt: false } },
    ];
    if (i.fundamentalsTotal > 0) {
      defs.push({ key: "gh.p1.fundamentals", title: "Finish the Electrical Fundamentals track", description: "Complete every lesson in the Fundamentals track of the Academy.", metric: "FUNDAMENTALS_LESSONS", target: i.fundamentalsTotal, xp: 200, link: GAME_LINKS.academy, extra: { jobHunt: false, syncTarget: true } });
    }
    return defs;
  }
  if (phase === 2) {
    return [
      { key: "gh.p2.consistency", title: "Apply on 60 % of your workdays", description: "Consistency beats bursts. Counts days in this phase with at least one application; rest days lower the target.", metric: "APPLICATION_DAYS", target: 1, xp: 200, link: GAME_LINKS.newApplication, extra: { ratio: PHASE2_WORKDAY_RATIO } },
      { key: "gh.p2.followups", title: "Send 10 follow-ups", description: "Follow-ups during this phase (one per application per day).", metric: "FOLLOW_UPS", target: 10, xp: 150, link: GAME_LINKS.followUps },
      { key: "gh.p2.preps", title: "Complete 2 interview preps", description: "Mark prep complete on interviews in the tracker. Practice counts even before an interview is booked once one is scheduled.", metric: "INTERVIEW_PREPS_PERIOD", target: 2, xp: 150, link: GAME_LINKS.interviews },
      { key: "gh.p2.analytics", title: "Review your funnel analytics", description: "Look at where applications stall (responses, screenings, interviews) and note one change to try. Check it off yourself when done.", metric: "SELF_CHECK", target: 1, xp: 50, link: GAME_LINKS.analytics, extra: { selfCheck: true } },
      { key: "gh.p2.resume", title: "Improve your résumé", description: "Save a new or updated résumé version during this phase.", metric: "RESUME_IMPROVED", target: 1, xp: 75, link: GAME_LINKS.resume },
      { key: "gh.p2.training", title: "Hit a training milestone", description: `Any one of: ${TRAINING_MILESTONE_LESSONS} Academy lessons, a passed quiz or practice exam, or ${TRAINING_MILESTONE_HOURS} logged work hours during this phase.`, metric: "TRAINING_MILESTONE", target: 1, xp: 150, link: GAME_LINKS.academy, extra: { jobHunt: false } },
    ];
  }
  return [
    { key: "gh.p3.interviews", title: "Turn applications into 2 interviews", description: "Interviews scheduled or held during this phase. Outcomes are never held against you.", metric: "INTERVIEWS_PERIOD", target: 2, xp: 200, link: GAME_LINKS.interviews },
    { key: "gh.p3.conversations", title: "Keep 5 conversations active", description: "Follow-ups sent during this phase keep recruiters and hiring managers engaged.", metric: "FOLLOW_UPS", target: 5, xp: 100, link: GAME_LINKS.followUps },
    { key: "gh.p3.offer", title: "Evaluate an offer", description: "Record an offer's base pay, hours and benefits on its application so you can compare it on facts. Stays open until you have one — no pressure.", metric: "OFFERS_RECORDED", target: 1, xp: 150, link: GAME_LINKS.offers },
    { key: "gh.p3.salary", title: "Prepare for salary negotiation", description: "Save a scenario in the Salary Simulator, or check this off yourself after researching pay for your target roles.", metric: "SALARY_PREP", target: 1, xp: 100, link: GAME_LINKS.salary, extra: { selfCheck: true } },
    { key: "gh.p3.plan", title: "Write your next-phase plan", description: "A short plan for what you will change or keep doing after day 90 if you are still searching.", metric: "NEXT_PHASE_PLAN", target: 1, xp: 100, link: GAME_LINKS.plan },
  ];
}

function extensionDefs(): CampaignDef[] {
  return [
    { key: "gh.next.plan", title: "Refresh your next-phase plan", description: "Update your plan for the next 30 days: what is working, what to change, which paths to try.", metric: "NEXT_PHASE_PLAN", target: 1, xp: 75, link: GAME_LINKS.plan },
    { key: "gh.next.consistency", title: "Apply on half of your workdays", description: "A sustainable pace for the long haul. Rest days lower the target.", metric: "APPLICATION_DAYS", target: 1, xp: 150, link: GAME_LINKS.newApplication, extra: { ratio: EXTENSION_WORKDAY_RATIO } },
  ];
}

function getHiredMissions(i: PlanInput): MissionSpec[] {
  if (i.getHired.completed) return [];
  const w = getHiredWindow(i.getHired.startedAt, i.today, i.campaignLengthDays);
  if (!w) return [];
  const defs = w.phase ? phaseDefs(w.phase, i) : extensionDefs();
  return defs.map((d) => {
    const ratio = d.extra?.ratio;
    const target = d.metric === "APPLICATION_DAYS" && ratio ? applicationDaysTarget(w.start, w.end, i.workdaysPerWeek, ratio) : d.target;
    return {
      key: d.key,
      type: "CAMPAIGN" as const,
      campaign: "GET_HIRED" as const,
      title: d.title,
      description: d.description,
      periodStart: w.start,
      periodEnd: w.end,
      target,
      xpReward: d.xp,
      meta: meta(d.metric, d.link, { phase: w.phase, jobHunt: true, ...d.extra }),
    };
  });
}

function electricianMissions(i: PlanInput): MissionSpec[] {
  const start = i.electricianStartedAt;
  const base = { type: "CAMPAIGN" as const, campaign: "ELECTRICIAN_150K" as const, periodStart: start, periodEnd: addUtcDays(start, ELECTRICIAN_HORIZON_DAYS) };
  const defs: CampaignDef[] = [
    { key: "e150.apply-program", title: "Apply to an apprenticeship program", description: "Mark a program as applied in the apprenticeship directory once you have submitted its application.", metric: "PROGRAM_APPLICATIONS", target: 1, xp: 200, link: GAME_LINKS.careerMap },
    { key: "e150.apply-3", title: "Apply to 3 apprenticeship programs", description: "Programs open and close recruitment on their own schedules; applying to several improves your odds.", metric: "PROGRAM_APPLICATIONS", target: 3, xp: 200, link: GAME_LINKS.careerMap },
    { key: "e150.school", title: "Enroll in a state-approved electrician school", description: "Self-reported on your certification tracker. California trainee registration requires enrollment in an approved program.", metric: "SCHOOL_ENROLLED", target: 1, xp: 150, link: GAME_LINKS.careerMap },
    { key: "e150.trainee", title: "Register as an Electrician Trainee", description: "Self-reported registration date on your certification tracker (California DIR). This is a game milestone, not a license.", metric: "TRAINEE_REGISTERED", target: 1, xp: 250, link: GAME_LINKS.careerMap },
    { key: "e150.hours-log", title: "Start your work-hours log", description: "Log your first work-hour entry. Keep pay stubs or employer letters so hours can be verified later.", metric: "HOURS_ENTRIES", target: 1, xp: 50, link: GAME_LINKS.hours },
  ];
  for (const m of HOURS_MILESTONES) {
    defs.push({
      key: `e150.hours-${m.hours}`,
      title: `Reach ${m.hours.toLocaleString("en-US")} verified hours`,
      description: "Counts employer-verified and official-record hours only; self-reported hours are tracked but not counted here.",
      metric: "VERIFIED_HOURS",
      target: m.hours,
      xp: m.xp,
      link: GAME_LINKS.hours,
      extra: { milestone: m.hours },
    });
    // Show one open milestone at a time: stop after the first one not reached yet.
    if (i.verifiedHours < m.hours) break;
  }
  if (i.examStageUnlocked) {
    defs.push(
      { key: "e150.exam-apply", title: "Apply for the certification exam", description: "Self-reported exam application date on your certification tracker.", metric: "EXAM_APPLIED", target: 1, xp: 300, link: GAME_LINKS.careerMap },
      { key: "e150.exam-pass", title: "Pass the certification exam", description: "Self-reported exam pass date. Certification itself is shown only with a certificate document.", metric: "EXAM_PASSED", target: 1, xp: 500, link: GAME_LINKS.careerMap },
    );
  }
  return defs.map((d) => ({
    ...base,
    key: d.key,
    title: d.title,
    description: d.description,
    target: d.target,
    xpReward: d.xp,
    meta: meta(d.metric, d.link, d.extra),
  }));
}

/** Every mission that should exist for the current day, week and campaign windows. */
export function buildMissionPlan(i: PlanInput): MissionSpec[] {
  return [...dailyMissions(i), ...weeklyMissions(i), ...getHiredMissions(i), ...electricianMissions(i)];
}
