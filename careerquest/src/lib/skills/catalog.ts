/**
 * Skill tree catalog. Every skill has five levels with explicit, nested thresholds over metrics
 * computed from the user's real CareerQuest activity (see `metrics.ts`), prerequisites that form
 * the tree's edges, a plain description of what earns progress and where to do it.
 *
 * Levels describe activity inside CareerQuest. They are not credentials, licenses or proof of
 * competence, and the UI says so.
 *
 * Pure: thresholds that depend on content (lessons per Academy track) or research (the DIR hour
 * requirement) are computed from the metrics passed in.
 */
import type { TrackKey } from "@/lib/academy/constants";
import { TRACK_META } from "@/lib/academy/tracks";

export const MAX_SKILL_LEVEL = 5;

export type SkillBranch = "electrical" | "field" | "job-search";

export const SKILL_BRANCHES: { key: SkillBranch; label: string; description: string }[] = [
  { key: "electrical", label: "Electrical", description: "From Academy lessons: lessons completed and best quiz scores per track." },
  { key: "field", label: "Field", description: "Supervised on-the-job hours that are employer-verified or on an official record." },
  { key: "job-search", label: "Job search", description: "From your application tracker, résumé versions, interviews, follow-ups and offers." },
];

export type TrackMetrics = { completed: number; total: number; avgBestScore: number | null };

export type SkillMetrics = {
  tracks: Record<TrackKey, TrackMetrics>;
  /** Employer-verified + official-record hours, excluding classroom entries. */
  verifiedFieldHours: number;
  selfReportedFieldHours: number;
  /** The DIR General Electrician hour requirement from the seed (null when unavailable). */
  fieldHoursGoal: { hours: number; name: string; sources: string[]; verifiedOn: string | null } | null;
  /** Distinct positions applied to (merged duplicates once). */
  appliedPositions: number;
  resumeVersions: number;
  /** Applied applications that record which résumé version was sent. */
  applicationsWithResume: number;
  /** INTERVIEW_COMPLETED events on non-merged applications. */
  interviewsCompleted: number;
  /** Interviews with prep marked complete. */
  interviewPreps: number;
  /** Follow-ups sent (one per application per day). */
  followUps: number;
  offersRecorded: number;
  offersAccepted: number;
  /** Saved salary scenarios + completed "Prepare for salary negotiation" missions. */
  salaryPrep: number;
};

export type Requirement = { id: string; label: string; target: number; value: (m: SkillMetrics) => number; format?: "count" | "percent" | "hours" };
export type LevelDef = { mode: "all" | "any"; requirements: Requirement[] };

export type SkillDef = {
  key: string;
  title: string;
  branch: SkillBranch;
  description: string;
  /** What earns progress, in plain words. */
  earns: string;
  prerequisites: string[];
  /** Layout inside the branch: row (tier) and column. */
  tier: number;
  col: number;
  links: { label: string; href: string }[];
  /** Exactly MAX_SKILL_LEVEL nested level definitions (level 1 first). */
  levels: (m: SkillMetrics) => LevelDef[];
  /** Why the skill cannot be levelled right now (e.g. no lessons in the track), or null. */
  unavailable?: (m: SkillMetrics) => string | null;
  /** Current values to show beside the thresholds. */
  current: (m: SkillMetrics) => { label: string; value: string }[];
};

const n = (v: number) => Math.floor(v).toLocaleString("en-US");
const plural = (v: number, one: string, many = `${one}s`) => `${n(v)} ${v === 1 ? one : many}`;

function all(...requirements: Requirement[]): LevelDef {
  return { mode: "all", requirements };
}
function any(...requirements: Requirement[]): LevelDef {
  return { mode: "any", requirements };
}

/** Lesson-count thresholds for a track of `total` lessons: 1, ⅓, ⅔, all (never decreasing). */
export function trackThresholds(total: number): [number, number, number, number] {
  const t = Math.max(0, Math.floor(total));
  if (t === 0) return [1, 1, 1, 1];
  const c1 = 1;
  const c2 = Math.min(t, Math.max(c1, Math.ceil(t / 3)));
  const c3 = Math.min(t, Math.max(c2, Math.ceil((2 * t) / 3)));
  return [c1, c2, c3, t];
}

/** Average best quiz score for level 5 of a track skill. */
export const TRACK_MASTERY_SCORE = 90;

/** Field-hour brackets as fractions of the DIR General Electrician requirement. */
export const FIELD_HOUR_FRACTIONS = [1 / 8, 1 / 4, 1 / 2, 1] as const;

export function fieldThresholds(goal: number): [number, number, number, number, number] {
  return [1, ...FIELD_HOUR_FRACTIONS.map((f) => Math.round(goal * f))] as [number, number, number, number, number];
}

function trackSkill(key: string, track: TrackKey, title: string, tier: number, col: number, prerequisites: string[]): SkillDef {
  const completed = (m: SkillMetrics) => m.tracks[track]?.completed ?? 0;
  const avg = (m: SkillMetrics) => m.tracks[track]?.avgBestScore ?? 0;
  const total = (m: SkillMetrics) => m.tracks[track]?.total ?? 0;
  const lessons = (target: number, m: SkillMetrics): Requirement => ({
    id: "lessons",
    label: target >= total(m) ? `Complete all ${plural(total(m), "lesson")} in the track` : `Complete ${n(target)} of ${plural(total(m), "lesson")}`,
    target,
    value: completed,
  });
  return {
    key,
    title,
    branch: "electrical",
    description: TRACK_META[track].description,
    earns: `Completing ${TRACK_META[track].label} lessons in the Academy (pass each lesson's quiz) and your best quiz score on each.`,
    prerequisites,
    tier,
    col,
    links: [{ label: `Open ${TRACK_META[track].label} in the Academy`, href: `/academy#track-${track.toLowerCase()}` }],
    levels: (m) => {
      const [c1, c2, c3, c4] = trackThresholds(total(m));
      return [
        all(lessons(c1, m)),
        all(lessons(c2, m)),
        all(lessons(c3, m)),
        all(lessons(c4, m)),
        all(lessons(c4, m), { id: "score", label: `Average best quiz score of ${TRACK_MASTERY_SCORE}% or more across the track`, target: TRACK_MASTERY_SCORE, value: avg, format: "percent" }),
      ];
    },
    unavailable: (m) => (total(m) === 0 ? "No lessons are available in this track right now." : null),
    current: (m) => [
      { label: "Lessons completed", value: `${n(completed(m))} / ${n(total(m))}` },
      { label: "Average best quiz score", value: m.tracks[track]?.avgBestScore === null || m.tracks[track] === undefined ? "No quiz passed yet" : `${Math.round(avg(m))}%` },
    ],
  };
}

const count = (id: string, label: string, target: number, value: (m: SkillMetrics) => number, format: Requirement["format"] = "count"): Requirement => ({ id, label, target, value, format });

export const SKILLS: SkillDef[] = [
  trackSkill("electrical.fundamentals", "FUNDAMENTALS", "Electrical fundamentals", 0, 0, []),
  trackSkill("electrical.safety", "SAFETY", "Safety", 0, 1, []),
  trackSkill("electrical.systems", "SYSTEMS", "Systems", 1, 0, ["electrical.fundamentals"]),
  trackSkill("electrical.installation", "INSTALLATION", "Installation", 1, 1, ["electrical.fundamentals", "electrical.safety"]),
  trackSkill("electrical.code", "CODE", "Code / NEC", 2, 1, ["electrical.installation"]),
  trackSkill("electrical.exam-prep", "EXAM_PREP", "Exam prep", 3, 0, ["electrical.code", "electrical.systems"]),
  {
    key: "field.supervised-hours",
    title: "Supervised field hours",
    branch: "field",
    description: "On-the-job hours under supervision, logged in CareerQuest and verified by an employer letter or an official record.",
    earns:
      "Verified on-the-job hours (employer-verified or official record). Self-reported and classroom hours are shown but do not count. Brackets are fractions of the DIR General Electrician hour requirement.",
    prerequisites: ["electrical.safety"],
    tier: 0,
    col: 0,
    links: [
      { label: "Log work hours", href: "/academy/hours" },
      { label: "See supervised experience on the Career Map", href: "/career-map?node=supervised-experience" },
    ],
    levels: (m) => {
      const goal = m.fieldHoursGoal?.hours ?? 0;
      const t = fieldThresholds(goal);
      const v = (x: SkillMetrics) => x.verifiedFieldHours;
      const label = (h: number, i: number) =>
        i === 0 ? "Log your first verified field hour" : `${n(h)} verified field hours${i === 4 && m.fieldHoursGoal ? ` (the ${m.fieldHoursGoal.name} requirement)` : ""}`;
      return t.map((h, i) => all(count("hours", label(h, i), h, v, "hours")));
    },
    unavailable: (m) => (m.fieldHoursGoal ? null : "The DIR hour requirement could not be loaded from the research data, so field brackets are unavailable."),
    current: (m) => [
      { label: "Verified field hours", value: n(m.verifiedFieldHours) },
      { label: "Self-reported (not counted)", value: n(m.selfReportedFieldHours) },
    ],
  },
  {
    key: "jobs.applications",
    title: "Applications",
    branch: "job-search",
    description: "Applying consistently to positions that fit your targets.",
    earns: "Distinct positions you have applied to in the tracker. Re-applying to the same position or merged duplicates count once.",
    prerequisites: [],
    tier: 0,
    col: 0,
    links: [
      { label: "Log an application", href: "/applications/new" },
      { label: "Open the tracker", href: "/applications" },
    ],
    levels: () =>
      [1, 10, 25, 50, 100].map((t) => all(count("applied", t === 1 ? "Apply to your first position" : `Apply to ${n(t)} distinct positions`, t, (m) => m.appliedPositions))),
    current: (m) => [{ label: "Distinct positions applied to", value: n(m.appliedPositions) }],
  },
  {
    key: "jobs.resume",
    title: "Résumé",
    branch: "job-search",
    description: "Keeping résumé versions tailored to the roles you target and tracking which one you sent.",
    earns: "Saved résumé versions, and applications that record which résumé version you sent.",
    prerequisites: [],
    tier: 0,
    col: 1,
    links: [
      { label: "Work on your résumé with the coach", href: "/coach" },
      { label: "Record the résumé on an application", href: "/applications" },
    ],
    levels: () => {
      const versions = (t: number) => count("versions", t === 1 ? "Save a résumé version" : `Save ${n(t)} résumé versions`, t, (m) => m.resumeVersions);
      const sent = (t: number) => count("sent", `Send ${n(t)} applications with a recorded résumé version`, t, (m) => m.applicationsWithResume);
      return [all(versions(1)), all(versions(2)), all(versions(3)), all(versions(3), sent(10)), all(versions(5), sent(25))];
    },
    current: (m) => [
      { label: "Résumé versions", value: n(m.resumeVersions) },
      { label: "Applications with a recorded résumé", value: n(m.applicationsWithResume) },
    ],
  },
  {
    key: "jobs.interviewing",
    title: "Interviewing",
    branch: "job-search",
    description: "Preparing for interviews and getting through them.",
    earns: "Interviews you attended (recorded as completed in the tracker) and interviews where you marked prep complete. Outcomes never count against you.",
    prerequisites: ["jobs.applications", "jobs.resume"],
    tier: 1,
    col: 0,
    links: [{ label: "Open interviews in the tracker", href: "/applications?status=INTERVIEWING" }],
    levels: () => {
      const preps = (t: number) => count("preps", t === 1 ? "Complete an interview prep" : `Complete ${n(t)} interview preps`, t, (m) => m.interviewPreps);
      const done = (t: number) => count("interviews", t === 1 ? "Complete an interview" : `Complete ${n(t)} interviews`, t, (m) => m.interviewsCompleted);
      return [any(preps(1), done(1)), all(preps(1), done(1)), all(preps(3), done(3)), all(preps(5), done(5)), all(preps(8), done(10))];
    },
    current: (m) => [
      { label: "Interviews completed", value: n(m.interviewsCompleted) },
      { label: "Interview preps completed", value: n(m.interviewPreps) },
    ],
  },
  {
    key: "jobs.networking",
    title: "Networking & follow-ups",
    branch: "job-search",
    description: "Following up with employers and recruiters so applications do not go quiet.",
    earns: "Follow-ups recorded in the tracker, counted once per application per day.",
    prerequisites: ["jobs.applications"],
    tier: 1,
    col: 1,
    links: [{ label: "Open follow-ups", href: "/applications?sort=followUp" }],
    levels: () => [1, 5, 15, 30, 60].map((t) => all(count("followups", t === 1 ? "Send your first follow-up" : `Send ${n(t)} follow-ups`, t, (m) => m.followUps))),
    current: (m) => [{ label: "Follow-ups sent", value: n(m.followUps) }],
  },
  {
    key: "jobs.negotiation",
    title: "Negotiation",
    branch: "job-search",
    description: "Preparing for pay conversations and comparing offers on facts.",
    earns:
      "Salary preparation (a saved Salary Simulator scenario or the completed \"Prepare for salary negotiation\" mission), offers recorded on applications and offers you accepted.",
    prerequisites: ["jobs.interviewing"],
    tier: 2,
    col: 0,
    links: [
      { label: "Open the Salary Simulator", href: "/salary" },
      { label: "Open offers in the tracker", href: "/applications?status=OFFER,ACCEPTED,HIRED" },
    ],
    levels: () => {
      const prep = count("prep", "Prepare for salary negotiation (save a salary scenario or finish the prep mission)", 1, (m) => m.salaryPrep);
      const offers = (t: number) => count("offers", t === 1 ? "Record an offer" : `Record ${n(t)} offers to compare`, t, (m) => m.offersRecorded);
      const accepted = count("accepted", "Accept an offer", 1, (m) => m.offersAccepted);
      return [any(prep, offers(1)), all(offers(1)), all(offers(1), prep), all(offers(2), prep), all(offers(2), prep, accepted)];
    },
    current: (m) => [
      { label: "Salary preparation", value: m.salaryPrep > 0 ? "Done" : "Not yet" },
      { label: "Offers recorded", value: n(m.offersRecorded) },
      { label: "Offers accepted", value: n(m.offersAccepted) },
    ],
  },
];

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

export type RequirementView = { id: string; label: string; current: number; target: number; met: boolean; format: NonNullable<Requirement["format"]> };
export type LevelView = { level: number; mode: "all" | "any"; met: boolean; requirements: RequirementView[] };

export type SkillView = {
  key: string;
  title: string;
  branch: SkillBranch;
  description: string;
  earns: string;
  tier: number;
  col: number;
  links: { label: string; href: string }[];
  prerequisites: { key: string; title: string; level: number }[];
  level: number;
  maxLevel: number;
  /** 0..1 toward the next level (1 at max level). */
  progressToNext: number;
  /** level × 100 + % toward the next level (0–500); stored in UserSkill.xp. Not ledger XP. */
  points: number;
  levels: LevelView[];
  next: LevelView | null;
  /** Level 0 with an unstarted prerequisite: a hint to start there first (activity still counts). */
  locked: boolean;
  unavailable: string | null;
  current: { label: string; value: string }[];
};

function evalLevel(def: LevelDef, m: SkillMetrics, level: number): LevelView {
  const requirements = def.requirements.map((r) => {
    const current = Math.max(0, r.value(m));
    return { id: r.id, label: r.label, current, target: r.target, met: current >= r.target, format: r.format ?? "count" };
  });
  const met = def.mode === "all" ? requirements.every((r) => r.met) : requirements.some((r) => r.met);
  return { level, mode: def.mode, met, requirements };
}

function fraction(l: LevelView): number {
  const parts = l.requirements.map((r) => (r.target <= 0 ? 1 : Math.min(1, r.current / r.target)));
  if (!parts.length) return 0;
  return l.mode === "all" ? Math.min(...parts) : Math.max(...parts);
}

export function evaluateSkill(def: SkillDef, m: SkillMetrics): Omit<SkillView, "prerequisites" | "locked"> {
  const unavailable = def.unavailable?.(m) ?? null;
  const levels = def.levels(m).slice(0, MAX_SKILL_LEVEL).map((l, i) => evalLevel(l, m, i + 1));
  let level = 0;
  if (!unavailable) {
    for (const l of levels) {
      if (!l.met) break;
      level = l.level;
    }
  }
  const next = level < MAX_SKILL_LEVEL && !unavailable ? (levels[level] ?? null) : null;
  const progressToNext = level >= MAX_SKILL_LEVEL ? 1 : next ? fraction(next) : 0;
  return {
    key: def.key,
    title: def.title,
    branch: def.branch,
    description: def.description,
    earns: def.earns,
    tier: def.tier,
    col: def.col,
    links: def.links,
    level,
    maxLevel: MAX_SKILL_LEVEL,
    progressToNext,
    points: Math.min(MAX_SKILL_LEVEL * 100, level * 100 + (level >= MAX_SKILL_LEVEL ? 0 : Math.floor(progressToNext * 100))),
    levels,
    next,
    unavailable,
    current: def.current(m),
  };
}

export function computeSkills(m: SkillMetrics, defs: SkillDef[] = SKILLS): SkillView[] {
  const evaluated = new Map(defs.map((d) => [d.key, evaluateSkill(d, m)]));
  return defs.map((d) => {
    const e = evaluated.get(d.key)!;
    const prerequisites = d.prerequisites.map((k) => ({ key: k, title: evaluated.get(k)?.title ?? k, level: evaluated.get(k)?.level ?? 0 }));
    return { ...e, prerequisites, locked: e.level === 0 && prerequisites.some((p) => p.level === 0) };
  });
}

/** Structural checks for the catalog (used by tests): unique keys, known prerequisites, no cycles, five levels. */
export function validateSkillCatalog(defs: SkillDef[], sample: SkillMetrics): string[] {
  const issues: string[] = [];
  const keys = new Set<string>();
  for (const d of defs) {
    if (keys.has(d.key)) issues.push(`Duplicate skill key "${d.key}".`);
    keys.add(d.key);
  }
  for (const d of defs) {
    for (const p of d.prerequisites) if (!keys.has(p)) issues.push(`"${d.key}" lists unknown prerequisite "${p}".`);
    if (d.levels(sample).length !== MAX_SKILL_LEVEL) issues.push(`"${d.key}" does not define exactly ${MAX_SKILL_LEVEL} levels.`);
  }
  const visiting = new Set<string>();
  const done = new Set<string>();
  const byKey = new Map(defs.map((d) => [d.key, d]));
  const visit = (k: string): boolean => {
    if (done.has(k)) return true;
    if (visiting.has(k)) return false;
    visiting.add(k);
    for (const p of byKey.get(k)?.prerequisites ?? []) if (!visit(p)) return false;
    visiting.delete(k);
    done.add(k);
    return true;
  };
  for (const d of defs) if (!visit(d.key)) {
    issues.push("The skill prerequisites contain a cycle.");
    break;
  }
  const positions = new Set<string>();
  for (const d of defs) {
    const pos = `${d.branch}:${d.tier}:${d.col}`;
    if (positions.has(pos)) issues.push(`"${d.key}" overlaps another skill in ${d.branch}.`);
    positions.add(pos);
  }
  return issues;
}

export function emptySkillMetrics(): SkillMetrics {
  const empty = { completed: 0, total: 0, avgBestScore: null };
  return {
    tracks: { FUNDAMENTALS: { ...empty }, SAFETY: { ...empty }, INSTALLATION: { ...empty }, SYSTEMS: { ...empty }, CODE: { ...empty }, EXAM_PREP: { ...empty } },
    verifiedFieldHours: 0,
    selfReportedFieldHours: 0,
    fieldHoursGoal: null,
    appliedPositions: 0,
    resumeVersions: 0,
    applicationsWithResume: 0,
    interviewsCompleted: 0,
    interviewPreps: 0,
    followUps: 0,
    offersRecorded: 0,
    offersAccepted: 0,
    salaryPrep: 0,
  };
}
