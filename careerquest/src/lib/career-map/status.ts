/**
 * Pure derivation of every Career Map stop's status from the user's real data: profile (primary
 * trade, interests, onboarding), apprenticeship program interests, certification-tracker dates,
 * verified vs self-reported work hours, Academy lesson progress, practice exams, tracked
 * applications to related roles and uploaded document kinds. A user may mark a stop themselves
 * (UserCareerNode); that mark wins and is labelled "Marked by you", while the data-derived reason
 * stays visible.
 *
 * Every status carries its evidence ("In progress because: 1,240 verified hours of 8,000") with a
 * label: Verified, Self-reported, Observed, Estimate or Marked by you.
 */
import { TRACK_META } from "@/lib/academy/tracks";
import type { TrackKey } from "@/lib/academy/constants";
import { formatDate } from "@/lib/format";
import { BRANCH_LABELS, MAIN_PATH, MAIN_ROW, topologicalOrder } from "./graph";
import { jobText, matchesJob } from "./jobs";
import { MARK_LABELS, STATUS_LABELS } from "./labels";
import type {
  BranchKey,
  CareerGraph,
  CareerMapNode,
  CareerMapView,
  CareerNodeDef,
  CareerNodeStatus,
  DocumentKindName,
  Evidence,
  NodeAction,
  NodeProgress,
  NodeStatusView,
  RelatedApplications,
  TrainingProgress,
} from "./types";

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export type ProgramInterestStatusName = "INTERESTED" | "APPLIED" | "TESTING" | "INTERVIEWING" | "WAITLISTED" | "ACCEPTED" | "DECLINED";
export type ApplicationStatusName =
  | "SAVED"
  | "PREPARING"
  | "SUBMITTED"
  | "CONFIRMED"
  | "SCREENING"
  | "INTERVIEWING"
  | "OFFER"
  | "ACCEPTED"
  | "HIRED"
  | "REJECTED"
  | "WITHDRAWN"
  | "NO_RESPONSE"
  | "CLOSED";

export type CertificationRow = {
  classification: string;
  traineeRegisteredAt: Date | null;
  traineeExpiresAt: Date | null;
  schoolEnrolled: string | null;
  examApplicationAt: Date | null;
  examEligibleAt: Date | null;
  examScheduledAt: Date | null;
  examPassedAt: Date | null;
  certifiedAt: Date | null;
  certificateExpiresAt: Date | null;
  updatedAt: Date;
};

export type HoursSummary = {
  /** Employer-verified + official-record hours, excluding classroom entries. */
  verifiedOjt: number;
  selfReportedOjt: number;
  verifiedClassroom: number;
  selfReportedClassroom: number;
  /** Verified on-the-job hours dated within the last `recentWindowDays` days. */
  recentVerifiedOjt: number;
  recentWindowDays: number;
  entryCount: number;
};

export type CareerApplicationRow = {
  id: string;
  title: string;
  category: string | null;
  company: string;
  status: ApplicationStatusName;
  /** Has an application date or a post-submission status. */
  applied: boolean;
};

export type CareerUserData = {
  now: Date;
  timezone: string;
  profile: { primaryTrade: string; careerInterests: string[]; onboardingCompletedAt: Date | null } | null;
  programs: { slug: string; name: string; status: ProgramInterestStatusName }[];
  certifications: CertificationRow[];
  hours: HoursSummary;
  lessons: { catalog: { key: string; track: TrackKey }[]; progress: { lessonKey: string; status: string; bestScore: number | null }[] };
  practiceExams: { attempts: number; passed: number; bestPercent: number | null };
  /** Most recent first. */
  applications: CareerApplicationRow[];
  documents: Partial<Record<DocumentKindName, number>>;
  overrides: { nodeKey: string; status: CareerNodeStatus; notes: string | null; updatedAt: Date }[];
};

export const PACE_WINDOW_DAYS = 84;

export { MARK_LABELS, STATUS_LABELS };

export const TRADE_BRANCH: Record<string, BranchKey> = {
  ELECTRICIAN: "electrician",
  ELEVATOR_MECHANIC: "elevator",
  COMMERCIAL_HVAC: "hvac",
  INDUSTRIAL_MAINTENANCE: "industrial",
  BUILDING_ENGINEER: "building",
  CONSTRUCTION_PROJECT_COORDINATOR: "construction",
  CONSTRUCTION_ESTIMATOR: "construction",
  ASSISTANT_PROJECT_MANAGER: "construction",
  COMMERCIAL_PLUMBING_PIPEFITTING: "plumbing",
};

const TRADE_LABELS: Record<string, string> = {
  ELECTRICIAN: "Electrician",
  ELEVATOR_MECHANIC: "Elevator mechanic",
  COMMERCIAL_HVAC: "Commercial HVAC",
  INDUSTRIAL_MAINTENANCE: "Industrial maintenance",
  BUILDING_ENGINEER: "Building engineer",
  CONSTRUCTION_PROJECT_COORDINATOR: "Construction project coordinator",
  CONSTRUCTION_ESTIMATOR: "Construction estimator",
  ASSISTANT_PROJECT_MANAGER: "Assistant project manager",
  COMMERCIAL_PLUMBING_PIPEFITTING: "Commercial plumbing & pipefitting",
  OTHER: "Other",
};

/** Career-interest option (see src/lib/validation/profile.ts) → branch. */
export const INTEREST_BRANCH: Record<string, BranchKey> = {
  Electrician: "electrician",
  "Elevator mechanic": "elevator",
  "Commercial HVAC": "hvac",
  "Industrial maintenance": "industrial",
  "Building engineer": "building",
  "Construction project coordinator": "construction",
  "Construction estimator": "construction",
  "Assistant project manager": "construction",
  "Commercial plumbing & pipefitting": "plumbing",
};

const HIRED: ReadonlySet<ApplicationStatusName> = new Set(["ACCEPTED", "HIRED"]);
const PROGRAM_IN_FLIGHT: ReadonlySet<ProgramInterestStatusName> = new Set(["APPLIED", "TESTING", "INTERVIEWING", "WAITLISTED"]);

const LINKS = {
  onboarding: { label: "Finish setup", href: "/settings/onboarding", external: false },
  academy: { label: "Open the Academy", href: "/academy", external: false },
  roadmap: { label: "Open the certification roadmap", href: "/academy/roadmap", external: false },
  programs: { label: "Open the apprenticeship directory", href: "/academy/apprenticeships", external: false },
  certification: { label: "Update your certification tracker", href: "/academy/certification", external: false },
  hours: { label: "Log work hours", href: "/academy/hours", external: false },
  exam: { label: "Take a practice exam", href: "/academy/exam", external: false },
  newApplication: { label: "Log an application", href: "/applications/new", external: false },
  discovery: { label: "Find openings in Job Discovery", href: "/discovery", external: false },
  mark: { label: "Mark this stop yourself", href: "#career-node-mark", external: false },
} as const satisfies Record<string, NodeAction>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmt = (n: number) => Math.floor(n).toLocaleString("en-US");
const plural = (n: number, one: string, many = `${one}s`) => `${fmt(n)} ${n === 1 ? one : many}`;

/** "2 years 3 months" from whole months. */
export function formatMonths(months: number): string {
  const m = Math.max(0, Math.floor(months));
  const y = Math.floor(m / 12);
  const r = m % 12;
  if (y === 0) return plural(r, "month");
  return r ? `${plural(y, "year")} ${plural(r, "month")}` : plural(y, "year");
}

/** Whole calendar months from `a` to `b`. */
export function monthsBetween(a: Date, b: Date): number {
  let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

const before = (d: Date | null, now: Date) => d !== null && d.getTime() <= now.getTime();

type Ctx = {
  graph: CareerGraph;
  data: CareerUserData;
  now: Date;
  date: (d: Date) => string;
  byKey: Map<string, CareerNodeDef>;
  tracks: Map<TrackKey, { completed: number; total: number; avgBest: number | null }>;
  /** The certification row the user is pursuing (General first, else most recently updated). */
  cert: CertificationRow | null;
  validCerts: CertificationRow[];
  expiredCerts: CertificationRow[];
  requiredHours: { hours: number; name: string } | null;
  classificationName: (code: string) => string;
  accepted: CareerUserData["programs"];
  inFlight: CareerUserData["programs"];
  traineeValid: CertificationRow | null;
  traineeExpired: CertificationRow | null;
  school: string | null;
  appsFor: (key: string) => CareerApplicationRow[];
  primaryBranch: BranchKey | null;
  interestBranches: Set<BranchKey>;
};

type Signals = {
  completed: Evidence[];
  inProgress: Evidence[];
  /** Activity (e.g. applications) that counts as "in progress" only when the stop is not locked. */
  soft: Evidence[];
  context: Evidence[];
  notes: string[];
  progress?: NodeProgress | null;
  durationEstimate?: Evidence | null;
};

const empty = (): Signals => ({ completed: [], inProgress: [], soft: [], context: [], notes: [] });

function buildCtx(graph: CareerGraph, data: CareerUserData): Ctx {
  const now = data.now;
  const date = (d: Date) => formatDate(d, { month: "short", day: "numeric", year: "numeric", timeZone: data.timezone });
  const byKey = new Map(graph.nodes.map((n) => [n.key, n]));

  // Lesson progress per track.
  const progress = new Map(data.lessons.progress.map((p) => [p.lessonKey, p]));
  const tracks = new Map<TrackKey, { completed: number; total: number; avgBest: number | null }>();
  for (const l of data.lessons.catalog) {
    const t = tracks.get(l.track) ?? { completed: 0, total: 0, avgBest: null };
    t.total += 1;
    if (progress.get(l.key)?.status === "COMPLETED") t.completed += 1;
    tracks.set(l.track, t);
  }

  const known = new Set(graph.classifications.map((c) => c.code));
  const certs = [...data.certifications].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  const cert = certs.find((c) => c.classification === "GENERAL") ?? certs.find((c) => known.has(c.classification)) ?? certs[0] ?? null;
  const validCerts = certs.filter((c) => before(c.certifiedAt, now) && (!c.certificateExpiresAt || c.certificateExpiresAt.getTime() >= now.getTime()));
  const expiredCerts = certs.filter((c) => c.certifiedAt && c.certificateExpiresAt && c.certificateExpiresAt.getTime() < now.getTime());
  const reqClass = graph.classifications.find((c) => c.code === (cert && known.has(cert.classification) ? cert.classification : "GENERAL"));
  const requiredHours = reqClass?.hours ? { hours: reqClass.hours, name: reqClass.name } : null;
  const classificationName = (code: string) => graph.classifications.find((c) => c.code === code)?.name ?? code.replace(/_/g, " ").toLowerCase();

  const traineeRows = certs.filter((c) => before(c.traineeRegisteredAt, now));
  const traineeValid = traineeRows.find((c) => !c.traineeExpiresAt || c.traineeExpiresAt.getTime() >= now.getTime()) ?? null;
  const traineeExpired = traineeValid ? null : (traineeRows.find((c) => c.traineeExpiresAt && c.traineeExpiresAt.getTime() < now.getTime()) ?? null);
  const school = certs.map((c) => c.schoolEnrolled?.trim()).find((s): s is string => Boolean(s)) ?? null;

  const appCache = new Map<string, CareerApplicationRow[]>();
  const texts = data.applications.map((a) => ({ a, text: jobText(a.title, a.category) }));
  const appsFor = (key: string) => {
    let hit = appCache.get(key);
    if (!hit) {
      const spec = byKey.get(key)?.relevantJobs.match ?? null;
      hit = spec ? texts.filter((x) => matchesJob(x.text, spec)).map((x) => x.a) : [];
      appCache.set(key, hit);
    }
    return hit;
  };

  const primaryBranch = data.profile ? (TRADE_BRANCH[data.profile.primaryTrade] ?? null) : null;
  const interestBranches = new Set((data.profile?.careerInterests ?? []).map((i) => INTEREST_BRANCH[i]).filter((b): b is BranchKey => Boolean(b)));

  return {
    graph,
    data,
    now,
    date,
    byKey,
    tracks,
    cert,
    validCerts,
    expiredCerts,
    requiredHours,
    classificationName,
    accepted: data.programs.filter((p) => p.status === "ACCEPTED"),
    inFlight: data.programs.filter((p) => PROGRAM_IN_FLIGHT.has(p.status)),
    traineeValid,
    traineeExpired,
    school,
    appsFor,
    primaryBranch,
    interestBranches,
  };
}

const hiredEvidence = (apps: CareerApplicationRow[]): Evidence[] =>
  apps.filter((a) => HIRED.has(a.status)).slice(0, 2).map((a) => ({ label: "Observed", text: `Hired: ${a.title} at ${a.company} (from your application tracker)` }));

function appliedEvidence(apps: CareerApplicationRow[], what: string): Evidence[] {
  const applied = apps.filter((a) => a.applied);
  if (!applied.length) return [];
  const interviewing = applied.filter((a) => a.status === "INTERVIEWING").length;
  const offers = applied.filter((a) => a.status === "OFFER").length;
  const extra = [interviewing ? `${interviewing} interviewing` : null, offers ? `${plural(offers, "offer")}` : null].filter(Boolean).join(", ");
  return [{ label: "Observed", text: `Applied to ${plural(applied.length, what)}${extra ? ` (${extra})` : ""} in your tracker` }];
}

function programList(programs: CareerUserData["programs"]): string {
  const names = programs.slice(0, 3).map((p) => p.name);
  return names.join("; ") + (programs.length > 3 ? ` and ${programs.length - 3} more` : "");
}

/** The user entered the electrician trade (registration, acceptance, hire or later credentials). */
function enteredTrade(c: Ctx): boolean {
  return Boolean(
    c.traineeValid ||
      c.accepted.length ||
      hiredEvidence(c.appsFor("trainee-or-apprentice")).length ||
      c.data.hours.verifiedOjt > 0 ||
      c.data.certifications.some((r) => r.examEligibleAt || r.examPassedAt || r.certifiedAt),
  );
}

// ---------------------------------------------------------------------------
// Per-stop rules
// ---------------------------------------------------------------------------

function roleSignals(c: Ctx, key: string, what: string): Signals {
  const s = empty();
  const apps = c.appsFor(key);
  s.completed.push(...hiredEvidence(apps));
  s.soft.push(...appliedEvidence(apps, what));
  return s;
}

function sideEntrySignals(c: Ctx, n: CareerNodeDef): Signals {
  const s = empty();
  const apps = c.appsFor(n.key);
  s.completed.push(...hiredEvidence(apps));
  s.inProgress.push(...appliedEvidence(apps, "related entry-level role"));
  // Being hired into (or applying to) the branch's role level also means you have started it.
  const roles = c.graph.nodes.filter((x) => x.branch === n.branch && x.kind === "role");
  for (const r of roles) s.completed.push(...hiredEvidence(c.appsFor(r.key)));
  const roleApps = [...new Set(roles.flatMap((r) => c.appsFor(r.key)))];
  s.inProgress.push(...appliedEvidence(roleApps, `${BRANCH_LABELS[n.branch].toLowerCase()} role`));
  if (c.primaryBranch === n.branch && c.data.profile) {
    s.inProgress.push({ label: "Self-reported", text: `Your primary trade is ${TRADE_LABELS[c.data.profile.primaryTrade] ?? c.data.profile.primaryTrade} (Settings)` });
  }
  return s;
}

const RULES: Record<string, (c: Ctx, n: CareerNodeDef) => Signals> = {
  beginner(c) {
    const s = empty();
    const p = c.data.profile;
    if (p?.onboardingCompletedAt) {
      s.completed.push({
        label: "Self-reported",
        text: `Onboarding completed on ${c.date(p.onboardingCompletedAt)} with ${TRADE_LABELS[p.primaryTrade] ?? p.primaryTrade} as your primary trade`,
      });
    }
    if (enteredTrade(c)) s.completed.push({ label: "Observed", text: "You already have progress on later steps of the electrician path" });
    const lessons = [...c.tracks.values()].reduce((a, t) => a + t.completed, 0);
    if (lessons) s.inProgress.push({ label: "Observed", text: `${plural(lessons, "Academy lesson")} completed` });
    if (c.data.applications.length) s.inProgress.push({ label: "Observed", text: `${plural(c.data.applications.length, "application")} in your tracker` });
    if (!p?.onboardingCompletedAt) s.notes.push("Finish onboarding to record your primary trade and interests.");
    return s;
  },

  "entry-prep"(c) {
    const s = empty();
    for (const p of c.accepted) s.completed.push({ label: "Self-reported", text: `Accepted into ${p.name} (apprenticeship directory)` });
    if (c.traineeValid) s.completed.push({ label: "Self-reported", text: `Registered as an Electrician Trainee on ${c.date(c.traineeValid.traineeRegisteredAt!)}` });
    s.completed.push(...hiredEvidence(c.appsFor("trainee-or-apprentice")));
    if (c.data.programs.length) {
      s.inProgress.push({
        label: "Self-reported",
        text: `${plural(c.data.programs.length, "apprenticeship program")} saved${c.inFlight.length ? `, ${c.inFlight.length} with an application in progress` : ""}`,
      });
    }
    if (c.school) s.inProgress.push({ label: "Self-reported", text: `Enrolled at ${c.school} (certification tracker)` });
    const f = c.tracks.get("FUNDAMENTALS");
    const sa = c.tracks.get("SAFETY");
    const done = (f?.completed ?? 0) + (sa?.completed ?? 0);
    if (done) s.inProgress.push({ label: "Observed", text: `${fmt(done)} of ${fmt((f?.total ?? 0) + (sa?.total ?? 0))} Fundamentals and Safety lessons completed` });
    s.inProgress.push(...appliedEvidence(c.appsFor("entry-prep"), "helper or pre-apprentice role"));
    s.inProgress.push(...appliedEvidence(c.appsFor("trainee-or-apprentice"), "apprentice or trainee job"));
    return s;
  },

  "trainee-or-apprentice"(c) {
    const s = empty();
    if (c.traineeValid) {
      const r = c.traineeValid;
      s.completed.push({
        label: "Self-reported",
        text: `Registered as an Electrician Trainee on ${c.date(r.traineeRegisteredAt!)}${r.traineeExpiresAt ? ` (registration runs to ${c.date(r.traineeExpiresAt)})` : ""}`,
      });
    }
    for (const p of c.accepted) s.completed.push({ label: "Self-reported", text: `Accepted into ${p.name} (apprenticeship directory)` });
    s.completed.push(...hiredEvidence(c.appsFor("trainee-or-apprentice")));
    if (!s.completed.length && c.traineeExpired) {
      s.inProgress.push({ label: "Self-reported", text: `Your Electrician Trainee registration expired on ${c.date(c.traineeExpired.traineeExpiresAt!)} — renew it to keep working as a trainee` });
    }
    if (c.school) s.inProgress.push({ label: "Self-reported", text: `Enrolled at ${c.school} (certification tracker)` });
    if (c.inFlight.length) {
      s.inProgress.push({ label: "Self-reported", text: `${plural(c.inFlight.length, "program application")} in progress: ${programList(c.inFlight)}` });
    }
    s.inProgress.push(...appliedEvidence(c.appsFor("trainee-or-apprentice"), "apprentice or trainee job"));
    if (!s.completed.length && (c.data.hours.verifiedOjt > 0 || c.data.hours.selfReportedOjt > 0)) {
      s.notes.push("You have logged work hours, but no trainee registration or program acceptance is recorded. Add it on your certification tracker or in the apprenticeship directory.");
    }
    return s;
  },

  "supervised-experience"(c) {
    const s = empty();
    const h = c.data.hours;
    const req = c.requiredHours;
    if (req) {
      s.progress = { value: h.verifiedOjt, max: req.hours, label: `${fmt(h.verifiedOjt)} of ${fmt(req.hours)} verified hours (${req.name})`, basis: "Verified" };
      if (h.verifiedOjt >= req.hours) s.completed.push({ label: "Verified", text: `${fmt(h.verifiedOjt)} verified hours of ${fmt(req.hours)} required (${req.name})` });
      else if (h.verifiedOjt > 0) s.inProgress.push({ label: "Verified", text: `${fmt(h.verifiedOjt)} verified hours of ${fmt(req.hours)} (${req.name})` });
    } else {
      if (h.verifiedOjt > 0) s.inProgress.push({ label: "Verified", text: `${fmt(h.verifiedOjt)} verified hours logged` });
      s.notes.push("The hour requirement could not be loaded from the research data, so progress cannot be measured.");
    }
    if (h.selfReportedOjt > 0) {
      const e: Evidence = { label: "Self-reported", text: `${fmt(h.selfReportedOjt)} self-reported hours are logged but do not count until they are verified` };
      if (h.verifiedOjt > 0) s.context.push(e);
      else s.inProgress.push({ label: "Self-reported", text: `${fmt(h.selfReportedOjt)} self-reported hours logged; none verified yet` });
    }
    const classroom = h.verifiedClassroom + h.selfReportedClassroom;
    if (classroom > 0) s.context.push({ label: h.selfReportedClassroom > 0 ? "Self-reported" : "Verified", text: `${fmt(classroom)} classroom hours logged (classroom time is not on-the-job experience)` });
    if (req && h.recentVerifiedOjt > 0 && h.verifiedOjt < req.hours) {
      const weeks = h.recentWindowDays / 7;
      const perWeek = h.recentVerifiedOjt / weeks;
      const remainingWeeks = Math.ceil((req.hours - h.verifiedOjt) / perWeek);
      s.durationEstimate = {
        label: "Estimate",
        text: `About ${plural(remainingWeeks, "week")} (${(remainingWeeks / 52).toFixed(1)} years) to reach ${fmt(req.hours)} at your recent verified pace of ${perWeek.toFixed(1)} hours a week over the last ${fmt(weeks)} weeks. Your pace will change; this is not a schedule.`,
      };
    }
    s.notes.push("Academy lessons and workshop simulations are study, not qualifying field experience.");
    return s;
  },

  "apprenticeship-completion"(c) {
    const s = empty();
    for (const p of c.accepted) s.inProgress.push({ label: "Self-reported", text: `Accepted into ${p.name} — completion is confirmed by your program` });
    s.inProgress.push(...hiredEvidence(c.appsFor("trainee-or-apprentice")).map((e) => ({ ...e, text: `${e.text} — an apprenticeship in progress` })));
    s.notes.push("CareerQuest has no record for apprenticeship completion. Mark this stop yourself when your program confirms you completed it.");
    return s;
  },

  "cert-eligibility"(c) {
    const s = empty();
    for (const r of c.data.certifications) {
      const name = c.classificationName(r.classification);
      const d = r.examEligibleAt ?? r.examScheduledAt ?? r.examPassedAt ?? r.certifiedAt;
      if (d) {
        const what = r.examEligibleAt ? "Eligibility notice recorded" : r.examScheduledAt ? "Exam scheduled" : r.examPassedAt ? "Exam passed" : "Certified";
        s.completed.push({ label: "Self-reported", text: `${what} on ${c.date(d)} (${name}, certification tracker)` });
      } else if (r.examApplicationAt) {
        s.inProgress.push({ label: "Self-reported", text: `Exam application submitted on ${c.date(r.examApplicationAt)} (${name}); waiting for the eligibility notice` });
      }
    }
    return s;
  },

  "ca-certification"(c) {
    const s = empty();
    for (const r of c.validCerts) {
      s.completed.push({
        label: "Self-reported",
        text: `Certified as ${c.classificationName(r.classification)} on ${c.date(r.certifiedAt!)}${r.certificateExpiresAt ? `, valid to ${c.date(r.certificateExpiresAt)}` : ""} (certification tracker)`,
      });
    }
    if (!s.completed.length) {
      for (const r of c.expiredCerts) {
        s.inProgress.push({ label: "Self-reported", text: `Your ${c.classificationName(r.classification)} certification expired on ${c.date(r.certificateExpiresAt!)} — renewal needed` });
      }
      for (const r of c.data.certifications) {
        const name = c.classificationName(r.classification);
        if (r.examPassedAt && !r.certifiedAt) s.inProgress.push({ label: "Self-reported", text: `Exam passed on ${c.date(r.examPassedAt)} (${name}); certification date not recorded yet` });
        else if (r.examScheduledAt && !r.examPassedAt) s.inProgress.push({ label: "Self-reported", text: `Exam scheduled for ${c.date(r.examScheduledAt)} (${name})` });
        else if (r.examEligibleAt && !r.examScheduledAt && !r.examPassedAt && !r.certifiedAt) {
          s.inProgress.push({ label: "Self-reported", text: `Eligibility notice received on ${c.date(r.examEligibleAt)} (${name}); schedule the exam` });
        }
      }
    }
    if (s.completed.length) {
      const docs = c.data.documents.CERTIFICATE ?? 0;
      s.context.push(
        docs > 0
          ? { label: "Self-reported", text: `${plural(docs, "certificate document")} uploaded (CareerQuest does not verify documents)` }
          : { label: "Self-reported", text: "No certificate document uploaded yet — keep a copy on file" },
      );
    }
    const pe = c.data.practiceExams;
    if (pe.attempts > 0) {
      s.context.push({
        label: "Observed",
        text: `Practice exams: ${plural(pe.attempts, "attempt")}, ${fmt(pe.passed)} passed${pe.bestPercent !== null ? `, best score ${pe.bestPercent}%` : ""} (CareerQuest practice, not the DIR exam)`,
      });
    }
    return s;
  },

  "experienced-electrician"(c) {
    const s = empty();
    const first = [...c.validCerts].sort((a, b) => a.certifiedAt!.getTime() - b.certifiedAt!.getTime())[0];
    if (first) {
      s.inProgress.push({
        label: "Estimate",
        text: `Certified since ${c.date(first.certifiedAt!)}: about ${formatMonths(monthsBetween(first.certifiedAt!, c.now))} at journey level (estimated from your certification date)`,
      });
    }
    // A hire counts once certification is recorded (the stop is locked until then).
    s.soft.push(...hiredEvidence(c.appsFor("experienced-electrician")).map((e) => ({ ...e, text: e.text.replace(/^Hired:/, "Working as") })));
    s.context.push(...appliedEvidence(c.appsFor("experienced-electrician"), "journey-level role"));
    s.notes.push("This stage has no finish line in CareerQuest data. Mark it yourself if you consider it complete.");
    return s;
  },

  specialist(c) {
    const s = roleSignals(c, "specialist", "specialist role");
    for (const r of c.validCerts.filter((x) => x.classification !== "GENERAL")) {
      s.completed.unshift({ label: "Self-reported", text: `Certified as ${c.classificationName(r.classification)} on ${c.date(r.certifiedAt!)} (certification tracker)` });
    }
    return s;
  },

  foreman: (c) => roleSignals(c, "foreman", "foreman or lead role"),
  management: (c) => roleSignals(c, "management", "management role"),

  "c10-license"(c) {
    const s = empty();
    const years = c.graph.c10ExperienceYears;
    const first = [...c.validCerts].sort((a, b) => a.certifiedAt!.getTime() - b.certifiedAt!.getTime())[0];
    if (years && first) {
      const months = monthsBetween(first.certifiedAt!, c.now);
      s.progress = {
        value: Math.min(months, years * 12),
        max: years * 12,
        label: `${formatMonths(months)} of ${plural(years, "year")} since your certification date`,
        basis: "Estimate",
      };
      s.context.push({
        label: "Estimate",
        text: `About ${formatMonths(months)} of journey-level time since your certification date, of the ${plural(years, "year")} CSLB asks for. CSLB counts documented experience; this is only an estimate.`,
      });
    }
    s.notes.push("CareerQuest has no record for contractor licenses. Mark this stop yourself once CSLB issues your license.");
    return s;
  },
};

function rulesFor(c: Ctx, n: CareerNodeDef): Signals {
  const rule = RULES[n.key];
  if (rule) return rule(c, n);
  if (n.kind === "entry") return sideEntrySignals(c, n);
  return roleSignals(c, n.key, "related role");
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function firstExternal(n: CareerNodeDef, re: RegExp): NodeAction | null {
  const l = n.resources.find((r) => r.external && re.test(r.href));
  return l ? { label: l.label, href: l.href, external: true } : null;
}

function actionsFor(c: Ctx, n: CareerNodeDef, status: CareerNodeStatus, apps: RelatedApplications): NodeAction[] {
  const out: (NodeAction | null)[] = [];
  const h = c.data.hours;
  switch (n.key) {
    case "beginner":
      if (!c.data.profile?.onboardingCompletedAt) out.push(LINKS.onboarding);
      out.push({ ...LINKS.academy, label: "Start the Electrical Fundamentals track" }, LINKS.roadmap);
      break;
    case "entry-prep":
      if (!c.data.programs.length) out.push({ ...LINKS.programs, label: "Research apprenticeship programs" });
      else if (!c.inFlight.length && !c.accepted.length) out.push({ ...LINKS.programs, label: "Check program windows and apply" });
      if ((c.tracks.get("FUNDAMENTALS")?.completed ?? 0) < (c.tracks.get("FUNDAMENTALS")?.total ?? 0)) out.push({ ...LINKS.academy, label: "Continue Electrical Fundamentals" });
      out.push(LINKS.newApplication, LINKS.programs);
      break;
    case "trainee-or-apprentice":
      if (c.traineeExpired && status !== "COMPLETED") {
        out.push(firstExternal(n, /Renew/i), LINKS.certification);
      } else if (status === "COMPLETED") {
        out.push(LINKS.hours, LINKS.certification);
      } else {
        if (c.school && !c.traineeValid) out.push(firstExternal(n, /NEWRegistration/i), LINKS.certification);
        out.push({ ...LINKS.programs, label: "Apply to apprenticeship programs" }, firstExternal(n, /ListOfApprovedSchools/i), LINKS.newApplication, LINKS.certification);
      }
      break;
    case "supervised-experience":
      if (status === "COMPLETED") out.push({ ...LINKS.certification, label: "Record your exam application" });
      if (h.selfReportedOjt > 0) out.push({ ...LINKS.hours, label: "Get your self-reported hours verified" });
      out.push(LINKS.hours);
      break;
    case "apprenticeship-completion":
      out.push(status === "COMPLETED" ? { ...LINKS.certification, label: "Record your exam application" } : LINKS.mark, LINKS.programs);
      break;
    case "cert-eligibility":
      if (status === "COMPLETED") out.push(LINKS.exam, LINKS.certification);
      else if (status === "IN_PROGRESS") out.push({ ...LINKS.certification, label: "Record your eligibility notice" });
      else if (status === "AVAILABLE") out.push(firstExternal(n, /electricaltrade/i), { ...LINKS.certification, label: "Record your exam application" });
      else out.push(LINKS.hours, LINKS.roadmap);
      break;
    case "ca-certification":
      if (status === "COMPLETED") out.push({ ...LINKS.roadmap, label: "Plan your renewal" });
      else if (c.expiredCerts.length) out.push({ ...LINKS.roadmap, label: "Review renewal requirements" }, LINKS.certification);
      else out.push(LINKS.exam, { ...LINKS.academy, label: "Study the Exam prep track" }, LINKS.certification);
      break;
    case "experienced-electrician":
      out.push({ ...LINKS.roadmap, label: "Review renewal requirements" }, LINKS.discovery, LINKS.newApplication);
      break;
    case "c10-license":
      out.push(firstExternal(n, /Class=C10/i) ?? firstExternal(n, /cslb/i), LINKS.mark);
      break;
    default:
      if (n.kind === "entry") out.push(firstExternal(n, /aigstart/i), LINKS.newApplication, LINKS.discovery);
      else out.push(LINKS.newApplication, LINKS.discovery);
  }
  if (apps.href && (apps.applied > 0 || apps.hired > 0)) out.push({ label: "See related applications", href: apps.href, external: false });
  const seen = new Set<string>();
  return out.filter((a): a is NodeAction => {
    if (!a || seen.has(a.href)) return false;
    seen.add(a.href);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Derivation
// ---------------------------------------------------------------------------

function relatedApplications(c: Ctx, n: CareerNodeDef): RelatedApplications {
  const apps = c.appsFor(n.key);
  const q = n.relevantJobs.searchQuery;
  return {
    applied: apps.filter((a) => a.applied).length,
    interviewing: apps.filter((a) => a.status === "INTERVIEWING").length,
    offers: apps.filter((a) => a.status === "OFFER").length,
    hired: apps.filter((a) => HIRED.has(a.status)).length,
    examples: apps.slice(0, 3).map((a) => ({ title: a.title, company: a.company, status: a.status })),
    href: q ? `/applications?q=${encodeURIComponent(q)}` : null,
  };
}

function training(c: Ctx, n: CareerNodeDef): TrainingProgress[] {
  return n.trainingTracks.flatMap((t) => {
    const p = c.tracks.get(t);
    if (!p || p.total === 0) return [];
    return [{ key: t, label: TRACK_META[t]?.label ?? t, completed: p.completed, total: p.total, href: "/academy" }];
  });
}

export function deriveCareerMap(graph: CareerGraph, data: CareerUserData): CareerMapView {
  const c = buildCtx(graph, data);
  const order = topologicalOrder(graph.nodes) ?? graph.nodes.map((n) => n.key);
  const overrides = new Map(data.overrides.map((o) => [o.nodeKey, o]));
  const effective = new Map<string, CareerNodeStatus>();
  const views = new Map<string, NodeStatusView>();

  for (const key of order) {
    const n = c.byKey.get(key);
    if (!n) continue;
    const s = rulesFor(c, n);

    const required = n.prerequisites.filter((p) => p.kind === "required" && c.byKey.has(p.from));
    const satisfied = (p: (typeof required)[number]) => {
      const st = effective.get(p.from);
      return p.satisfiedBy === "started" ? st === "IN_PROGRESS" || st === "COMPLETED" : st === "COMPLETED";
    };
    const unmet = required.filter((p) => !satisfied(p));
    const met = required.filter(satisfied);
    const locked = required.length > 0 && (n.prereqMode === "any" ? met.length === 0 : unmet.length > 0);

    let derived: CareerNodeStatus;
    let derivedReason: string;
    const title = (k: string) => c.byKey.get(k)?.title ?? k;
    if (s.completed.length) {
      derived = "COMPLETED";
      derivedReason = `Completed because: ${s.completed[0]!.text}`;
    } else if (s.inProgress.length || (s.soft.length && !locked)) {
      derived = "IN_PROGRESS";
      derivedReason = `In progress because: ${(s.inProgress[0] ?? s.soft[0])!.text}`;
    } else if (locked) {
      derived = "LOCKED";
      const names = unmet.map((p) => title(p.from));
      derivedReason =
        n.prereqMode === "any"
          ? `Locked until one of these is completed: ${names.join(" or ")}`
          : `Locked because: ${names.join(", ")} ${unmet.length > 1 ? "are" : "is"} not ${unmet.every((p) => p.satisfiedBy === "started") ? "started" : "completed"} yet`;
    } else {
      derived = "AVAILABLE";
      derivedReason = met.length
        ? `Available because: ${met.map((p) => title(p.from)).join(" and ")} ${met.every((p) => p.satisfiedBy === "started") ? "has started" : met.length > 1 ? "are completed" : "is completed"}`
        : "Available: nothing blocks this step";
    }

    const o = overrides.get(key);
    const status = o ? o.status : derived;
    effective.set(key, status);

    const evidence: Evidence[] = [];
    if (o) {
      evidence.push({
        label: "Marked by you",
        text: `You marked this stop ${MARK_LABELS[o.status]} on ${c.date(o.updatedAt)}${o.notes ? ` — “${o.notes}”` : ""}. Your mark changes your map only; it is not a credential.`,
      });
    }
    evidence.push(...s.completed, ...s.inProgress, ...s.soft, ...s.context);

    const apps = relatedApplications(c, n);
    const interest: NodeStatusView["interest"] =
      c.primaryBranch === n.branch ? "primary" : c.interestBranches.has(n.branch) ? "interest" : null;
    if (interest === "interest" && n.branch !== "electrician" && n.kind === "entry") s.notes.push(`${BRANCH_LABELS[n.branch]} is on your interest list (Settings).`);

    views.set(key, {
      key,
      status,
      derivedStatus: derived,
      override: o ? { status: o.status, notes: o.notes, markedAt: o.updatedAt.toISOString() } : null,
      reason: o ? `Marked by you: ${MARK_LABELS[o.status]}` : derivedReason,
      derivedReason,
      evidence,
      notes: s.notes,
      progress: s.progress ?? null,
      training: training(c, n),
      applications: apps,
      documentsOnFile: n.documents.map((d) => ({ label: d.label, onFile: d.docKind ? (data.documents[d.docKind] ?? 0) > 0 : null })),
      durationEstimate: s.durationEstimate ?? null,
      actions: actionsFor(c, n, status, apps),
      blockedBy: locked && !o ? unmet.map((p) => ({ key: p.from, title: title(p.from) })) : [],
      interest,
    });
  }

  const nodes: CareerMapNode[] = graph.nodes.map((n) => ({ ...n, state: views.get(n.key)! }));
  const focusBranch: BranchKey = c.primaryBranch ?? "electrician";
  const counts: Record<CareerNodeStatus, number> = { LOCKED: 0, AVAILABLE: 0, IN_PROGRESS: 0, COMPLETED: 0 };
  for (const n of nodes) counts[n.state.status] += 1;

  return {
    nodes,
    edges: graph.edges,
    branches: graph.branches,
    distinction: graph.distinction,
    currentKey: currentPosition(nodes, focusBranch),
    focusBranch,
    counts,
    seed: graph.seed,
    issues: [],
  };
}

/**
 * "You are here": on the focus branch (the user's primary trade), the furthest stop in progress;
 * otherwise the first stop that is available; otherwise the last completed one. On the electrician
 * branch the main spine (MAIN_PATH) is used, plus its forks once Experienced electrician has
 * started.
 */
export function currentPosition(nodes: CareerMapNode[], branch: BranchKey): string | null {
  let onBranch: CareerMapNode[];
  if (branch === "electrician") {
    const spine = new Set<string>(MAIN_PATH);
    const experienced = nodes.find((n) => n.key === "experienced-electrician")?.state.status;
    const forksOpen = experienced === "IN_PROGRESS" || experienced === "COMPLETED";
    const forks = new Set(nodes.filter((n) => n.branch === "electrician" && n.prerequisites.some((p) => p.from === "experienced-electrician")).map((n) => n.key));
    onBranch = nodes.filter((n) => spine.has(n.key) || (forksOpen && forks.has(n.key)));
  } else {
    onBranch = nodes.filter((n) => n.branch === branch);
  }
  onBranch.sort((a, b) => a.col - b.col || Math.abs(a.row - MAIN_ROW) - Math.abs(b.row - MAIN_ROW));
  if (!onBranch.length) return null;
  const inProgress = onBranch.filter((n) => n.state.status === "IN_PROGRESS");
  if (inProgress.length) return inProgress[inProgress.length - 1]!.key;
  const available = onBranch.find((n) => n.state.status === "AVAILABLE");
  if (available) return available.key;
  // Everything done: the furthest completed stop on the spine (forks are optional directions).
  const completed = onBranch.filter((n) => n.state.status === "COMPLETED");
  const spineDone = branch === "electrician" ? completed.filter((n) => (MAIN_PATH as string[]).includes(n.key)) : completed;
  const pool = spineDone.length ? spineDone : completed;
  return pool.length ? pool[pool.length - 1]!.key : onBranch[0]!.key;
}
