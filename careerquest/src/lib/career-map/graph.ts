/**
 * The Career Map graph: a branching map of stops (nodes) with prerequisite edges.
 *
 * Main electrician path: Beginner → Entry preparation → Electrician Trainee or Apprentice →
 * Supervised experience → Certification eligibility → California certification → Experienced
 * electrician → Specialist / Foreman / Management, with "Apprenticeship completion (journeyman)" as a
 * separate credential (one of the routes to the exam) and the CSLB C-10 contractor license branching
 * from Experienced electrician. Side branches cover elevator, commercial HVAC, industrial
 * maintenance, building engineer, construction office roles and commercial plumbing & pipefitting.
 *
 * Honesty rules enforced here (and by `validateCareerGraph` + tests):
 * - Every figure on the electrician path (hours, fees, durations, years) is copied from the seed
 *   files with the source URLs and check date of the section it came from. Missing seed data means
 *   the figure is left out, never guessed.
 * - CareerQuest's own text ("guidance") contains no figures. Side branches are descriptions only and
 *   say so (`sourcedFigures: false`).
 * - Durations are labelled estimates.
 *
 * Pure: pass in a parsed `CareerSeed` (see `load-seed.ts` for the file loader).
 */
import type { TrackKey } from "@/lib/academy/constants";
import type { CareerSeed, FeeKey, SourcedNumber, SourcedText } from "./seed";
import { ENTRY_LEVEL_TERMS } from "./jobs";
import type {
  BranchKey,
  BranchMeta,
  CareerGraph,
  CareerNodeDef,
  DocumentNeed,
  FactFlag,
  GraphEdge,
  JobMatchSpec,
  MapFact,
  MapLink,
  NodeKind,
  PrereqEdge,
} from "./types";

// ---------------------------------------------------------------------------
// Keys, branches, layout
// ---------------------------------------------------------------------------

export const CAREER_NODE_KEYS = [
  "beginner",
  "entry-prep",
  "trainee-or-apprentice",
  "supervised-experience",
  "apprenticeship-completion",
  "cert-eligibility",
  "ca-certification",
  "experienced-electrician",
  "specialist",
  "foreman",
  "management",
  "c10-license",
  "elevator-entry",
  "elevator-mechanic",
  "hvac-entry",
  "commercial-hvac",
  "industrial-entry",
  "industrial-maintenance",
  "building-entry",
  "building-engineer",
  "construction-entry",
  "project-coordinator",
  "estimator",
  "assistant-pm",
  "plumbing-entry",
  "commercial-plumbing",
] as const;
export type CareerNodeKey = (typeof CAREER_NODE_KEYS)[number];

/** The electrician main path in order (the spine used for "current position"). */
export const MAIN_PATH: CareerNodeKey[] = [
  "beginner",
  "entry-prep",
  "trainee-or-apprentice",
  "supervised-experience",
  "cert-eligibility",
  "ca-certification",
  "experienced-electrician",
];

export const ROOT_KEY: CareerNodeKey = "beginner";

export const BRANCHES: BranchMeta[] = [
  { key: "electrician", label: "Electrician path", description: "From first steps to California certification, journey-level work and beyond." },
  { key: "construction", label: "Construction office", description: "Project coordination, estimating and project management." },
  { key: "elevator", label: "Elevator", description: "Installing and servicing elevators and escalators." },
  { key: "hvac", label: "Commercial HVAC", description: "Heating, ventilation, air conditioning and refrigeration in commercial buildings." },
  { key: "industrial", label: "Industrial maintenance", description: "Keeping plant and production equipment running." },
  { key: "building", label: "Building engineer", description: "Operating and maintaining a building's systems." },
  { key: "plumbing", label: "Plumbing & pipefitting", description: "Commercial plumbing and pipe systems." },
];

export const BRANCH_LABELS: Record<BranchKey, string> = Object.fromEntries(BRANCHES.map((b) => [b.key, b.label])) as Record<BranchKey, string>;

/** Main-path lane on the map grid. */
export const MAIN_ROW = 3;

// ---------------------------------------------------------------------------
// Fact helpers
// ---------------------------------------------------------------------------

/** CareerQuest's own descriptive text. Must not contain figures. */
function guide(label: string, value: string): MapFact {
  return { label, value, basis: "guidance", sources: [], verifiedOn: null, flag: null };
}

/** A duration estimate. Pass sources whenever the text contains a figure. */
function estimate(value: string, src?: { sources: string[]; verifiedOn: string | null; flag?: FactFlag | null }): MapFact {
  return { label: "Estimate", value, basis: "estimate", sources: src?.sources ?? [], verifiedOn: src?.verifiedOn ?? null, flag: src?.flag ?? null };
}

function sourced(label: string, st: SourcedText | null | undefined, flag?: FactFlag | null): MapFact | null {
  if (!st) return null;
  return { label, value: st.text, basis: "sourced", sources: st.sources, verifiedOn: st.verifiedOn, flag: flag === undefined ? st.flag : flag };
}

function sourcedNumber(label: string, sn: SourcedNumber | null | undefined, format: (n: number) => string): MapFact | null {
  if (!sn) return null;
  return { label, value: format(sn.value), basis: "sourced", sources: sn.sources, verifiedOn: sn.verifiedOn, flag: sn.flag };
}

const compact = <T>(xs: (T | null | undefined | false)[]): T[] => xs.filter((x): x is T => Boolean(x));
const count = (n: number) => Math.round(n).toLocaleString("en-US");
const dollars = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const uniq = (xs: string[]) => [...new Set(xs)];

/** The earliest check date among several sources (the most conservative "last checked"). */
function earliest(dates: (string | null)[]): string | null {
  const ds = dates.filter((d): d is string => Boolean(d)).sort();
  return ds[0] ?? null;
}

const internal = (label: string, href: string): MapLink => ({ label, href, external: false });

const URL_LABELS: [RegExp, string][] = [
  [/ecu_testinfo/i, "DIR: certification exam information"],
  [/cib\.pdf/i, "DIR: Candidate Information Bulletin (PDF)"],
  [/CandidateInfoBulletin/i, "DIR: Candidate Information Bulletin page"],
  [/ECU_FAQ/i, "DIR: electrician certification FAQ"],
  [/ElectricianExamOverview/i, "DIR: exam statistical overview (PDF)"],
  [/pearsonvue/i, "Pearson VUE: California electrician exams"],
  [/ECUCertforms/i, "DIR: certification forms"],
  [/ElectricalTrade_Fees/i, "DIR: certification fees"],
  [/\/t8\/291_5/i, "Title 8 §291.5: certification renewal"],
  [/\/t8\/291_1/i, "Title 8 §291.1: exam eligibility"],
  [/\/t8\/291_2/i, "Title 8 §291.2: application and exam"],
  [/\/t8\/292_0/i, "Title 8 §292.0: fees"],
  [/dlse\/ecu\/2a/i, "DIR: trainee route to certification"],
  [/dlse\/ecu\/3a/i, "DIR: apprentice route to certification"],
  [/Class=C10/i, "CSLB: C-10 Electrical classification"],
  [/experience_for_exam/i, "CSLB: experience requirements"],
  [/library\/fees/i, "CSLB: fees"],
  [/Before_Applying_For_License/i, "CSLB: before applying for a license"],
  [/Issuing_My_License/i, "CSLB: issuing your license"],
  [/industrybulletins/i, "CSLB: industry bulletin (PDF)"],
  [/electricaltrainee\.htm/i, "DIR: Electrician Trainee program"],
];

function labelForUrl(url: string): string {
  for (const [re, label] of URL_LABELS) if (re.test(url)) return label;
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.length > 1 ? u.pathname : ""}`;
  } catch {
    return url;
  }
}

function linksFrom(urls: string[], only?: RegExp[]): MapLink[] {
  const picked = only ? urls.filter((u) => only.some((re) => re.test(u))) : urls;
  return uniq(picked).map((u) => ({ label: labelForUrl(u), href: u, external: true }));
}

const docs = (...items: [string, DocumentNeed["docKind"]?][]): DocumentNeed[] => items.map(([label, kind]) => ({ label, docKind: kind ?? null }));

const ENTRY = [...ENTRY_LEVEL_TERMS];

type NodeInput = {
  key: CareerNodeKey;
  title: string;
  branch: BranchKey;
  kind: NodeKind;
  col: number;
  row: number;
  summary: string;
  credentialFacts?: (MapFact | null)[];
  requirements?: (MapFact | null)[];
  duration?: MapFact | null;
  costs?: (MapFact | null)[];
  documents?: DocumentNeed[];
  jobs?: { titles: string[]; match: JobMatchSpec | null; searchQuery: string | null };
  trainingTracks?: TrackKey[];
  payReference?: (MapFact | null)[];
  entryRoutes?: string[];
  resources?: (MapLink | null)[];
  prerequisites?: PrereqEdge[];
  prereqMode?: "all" | "any";
  sourcedFigures?: boolean;
};

function node(n: NodeInput): CareerNodeDef {
  return {
    key: n.key,
    title: n.title,
    branch: n.branch,
    kind: n.kind,
    col: n.col,
    row: n.row,
    summary: n.summary,
    credentialFacts: compact(n.credentialFacts ?? []),
    requirements: compact(n.requirements ?? []),
    duration: n.duration ?? null,
    costs: compact(n.costs ?? []),
    documents: n.documents ?? [],
    relevantJobs: n.jobs ?? { titles: [], match: null, searchQuery: null },
    trainingTracks: n.trainingTracks ?? [],
    payReference: compact(n.payReference ?? []),
    entryRoutes: n.entryRoutes ?? [],
    resources: compact(n.resources ?? []),
    prerequisites: n.prerequisites ?? [],
    prereqMode: n.prereqMode ?? "all",
    sourcedFigures: n.sourcedFigures ?? true,
  };
}

const req = (from: CareerNodeKey, satisfiedBy: PrereqEdge["satisfiedBy"] = "completed"): PrereqEdge => ({ from, kind: "required", satisfiedBy });
const typical = (from: CareerNodeKey): PrereqEdge => ({ from, kind: "typical", satisfiedBy: "completed" });

/** Shown on stops without researched figures. */
export const UNSOURCED_NOTE = "CareerQuest has no researched figures for this stop yet — descriptions only. Confirm requirements, pay and costs with programs and employers.";

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export function buildCareerGraph(seed: CareerSeed): CareerGraph {
  const t = seed.trainee;
  const fees = seed.fees;
  const exam = seed.exam;
  const renewal = seed.renewal;
  const contractor = seed.contractor;
  const res = seed.resources;
  const general = seed.classifications.find((c) => c.code === "GENERAL") ?? null;
  const specialties = seed.classifications.filter((c) => c.code !== "GENERAL");

  // Apprenticeship program lengths (sourced per program).
  const withDuration = seed.programs.filter((p) => p.durationYears !== null && p.sources.length > 0);
  const durations = withDuration.map((p) => p.durationYears!);
  const programLength: MapFact | null = withDuration.length
    ? estimate(
        `Registered apprenticeship programs in the directory list program lengths of ${
          Math.min(...durations) === Math.max(...durations) ? Math.min(...durations) : `${Math.min(...durations)} to ${Math.max(...durations)}`
        } years${withDuration.some((p) => p.durationFlag) ? " (one program's stated length conflicts between its own sources)" : ""}.`,
        {
          sources: uniq(withDuration.flatMap((p) => p.sources)),
          verifiedOn: earliest(withDuration.map((p) => p.verifiedOn)),
          flag: withDuration.some((p) => p.durationFlag) ? "conflict" : null,
        },
      )
    : null;
  const programDurationFacts = withDuration.map((p) =>
    sourced(`${p.name}`, { text: `Program length: ${p.durationYears} years.`, sources: p.sources, verifiedOn: p.verifiedOn, flag: p.durationFlag }),
  );

  // Program recruitment and fees.
  const programSources = uniq(seed.programs.flatMap((p) => p.sources));
  const programVerified = earliest(seed.programs.map((p) => p.verifiedOn));
  const closed = seed.programs.filter((p) => p.recruitmentStatus === "CLOSED");
  const recruitment: MapFact | null = seed.programs.length && programSources.length
    ? estimate(
        `${closed.length} of ${seed.programs.length} apprenticeship programs in the directory were closed to new applications when last checked; the others had no verified application window. Windows open and close on each program's own schedule.`,
        { sources: programSources, verifiedOn: programVerified, flag: closed.length < seed.programs.length ? "unverified" : null },
      )
    : null;
  const recruitmentFacts = seed.programs
    .filter((p) => p.sources.length)
    .map((p) =>
      sourced(p.name, {
        text: `${p.isUnion ? "Union" : "Non-union"} program. Recruitment status: ${(p.recruitmentStatus ?? "unverified").toLowerCase()} as of ${p.verifiedOn ?? "the last check"}.`,
        sources: p.sources,
        verifiedOn: p.verifiedOn,
        flag: p.recruitmentStatus === "UNVERIFIED" || !p.recruitmentStatus ? "unverified" : null,
      }),
    );
  const programsWithFees = seed.programs.filter((p) => p.fees && p.sources.length);
  const programsWithoutFees = seed.programs.filter((p) => !p.fees);
  const programFeeFacts: (MapFact | null)[] = [
    ...programsWithFees.map((p) => sourced(`${p.name}: fees`, { text: p.fees!, sources: p.sources, verifiedOn: p.verifiedOn, flag: null })),
    programsWithoutFees.length && programSources.length
      ? sourced(
          "Apprenticeship program fees",
          {
            text: `Not retrieved for ${programsWithoutFees.map((p) => p.name).join("; ")}. Ask each program before applying.`,
            sources: uniq(programsWithoutFees.flatMap((p) => p.sources)),
            verifiedOn: earliest(programsWithoutFees.map((p) => p.verifiedOn)),
            flag: "unverified",
          },
          "unverified",
        )
      : null,
  ];
  const eligibilityNote: MapFact | null = programSources.length
    ? {
        label: "Program eligibility",
        value:
          "Each program sets its own rules. Programs in the directory commonly ask for proof of education, completed algebra coursework, identification and an aptitude test, and some add an interview, a drug test or a driver's license. Read each program's list in the apprenticeship directory.",
        basis: "sourced",
        sources: programSources,
        verifiedOn: programVerified,
        flag: null,
      }
    : null;

  const classificationHours = (c: (typeof seed.classifications)[number], suffix: string) =>
    sourcedNumber(`${c.name}`, c.hours, (n) => `${count(n)} hours ${suffix}`);

  const fee = (label: string, k: FeeKey) => sourcedNumber(label, fees[k], dollars);

  const routeFacts = seed.routes.map((r) => ({
    label: r.route,
    value: r.detail.text,
    basis: "sourced" as const,
    sources: r.detail.sources,
    verifiedOn: r.detail.verifiedOn,
    flag: r.detail.flag,
  }));
  const apprenticeRoute = routeFacts.find((r) => /apprenticeship/i.test(r.label)) ?? null;

  const experienceYears = contractor.experienceYears?.value ?? null;
  const dirMain: MapLink | null = seed.mainUrl ? { label: "DIR: Electrician Certification Program", href: seed.mainUrl, external: true } : null;
  const roadmap = internal("CareerQuest certification roadmap", "/academy/roadmap");
  const directory = internal("CareerQuest apprenticeship directory", "/academy/apprenticeships");

  // Side branches are descriptions only.
  const noFigures = guide("Researched figures", UNSOURCED_NOTE);
  const noCosts = guide("Costs", "No researched cost figures for this stop. Ask programs and employers what they charge or cover.");
  const varies = estimate("Varies by program and employer — CareerQuest has no researched duration for this stop.");
  const apprenticeshipSearch = [res.dasProgramSearch, res.federalFinder];

  const nodes: CareerNodeDef[] = [
    // ----------------------------------------------------------------- main path
    node({
      key: "beginner",
      title: "Beginner",
      branch: "electrician",
      kind: "start",
      col: 0,
      row: MAIN_ROW,
      summary:
        "Where every path starts: pick a direction, learn what the trade involves and set up CareerQuest so your applications, study and hours are tracked.",
      requirements: [guide("What you need", "No credential is needed to start. Choose your primary trade and interests in your profile so the map and missions follow them.")],
      duration: estimate("Self-paced."),
      costs: [guide("Costs", "Nothing is required to explore the trade.")],
      trainingTracks: ["FUNDAMENTALS", "SAFETY"],
      resources: [roadmap, res.dasHome, res.federalFinder],
    }),
    node({
      key: "entry-prep",
      title: "Entry preparation",
      branch: "electrician",
      kind: "stage",
      col: 1,
      row: MAIN_ROW,
      summary:
        "Get ready to apply: research registered apprenticeship programs and their recruitment windows, meet their eligibility rules and build basic electrical knowledge.",
      requirements: [eligibilityNote, sourced("Trainee route: school enrollment", t.schoolRequirement), ...recruitmentFacts],
      duration: recruitment ?? estimate("Depends on when programs open recruitment — check each program's window."),
      costs: programFeeFacts,
      documents: docs(
        ["High school diploma, GED or college degree"],
        ["Proof of a completed algebra course (most listed programs ask for it)"],
        ["Government-issued photo ID"],
        ["Social Security card or number"],
        ["Résumé for helper jobs and program applications", "RESUME"],
      ),
      jobs: {
        titles: ["Electrical helper", "Pre-apprentice", "Electrical material handler"],
        match: { include: ["electric"], require: ["helper", "pre-apprentice", "preapprentice", "material handler", "laborer"] },
        searchQuery: "helper",
      },
      trainingTracks: ["FUNDAMENTALS", "SAFETY"],
      resources: [directory, res.dasLosAngelesElectrician, res.dasOrangeElectrician, res.dasProgramSearch, res.federalFinder],
      prerequisites: [typical("beginner")],
    }),
    node({
      key: "trainee-or-apprentice",
      title: "Electrician Trainee or Apprentice",
      branch: "electrician",
      kind: "stage",
      col: 2,
      row: MAIN_ROW,
      summary:
        "Before certification there are two legal ways to do electrical work for a C-10 contractor: register with DIR as an Electrician Trainee while enrolled in an approved school, or be accepted into a registered apprenticeship.",
      requirements: [
        sourced("Who must register as a trainee", t.whoMustRegister),
        sourced("School requirement", t.schoolRequirement),
        sourced("Supervision", t.supervisionRule),
        sourced("Classroom hours", t.classroomHoursPerYear),
        sourced("Trainee registration renewal", t.renewal),
        sourced("Registered apprentices", seed.law.exemptions.find((e) => /apprentice/i.test(e.text)) ?? null),
      ],
      duration: programLength ?? estimate("Depends on the route; the trainee route has no fixed length."),
      costs: [
        fee("Electrician Trainee registration (DIR)", "traineeRegistrationFee"),
        fee("Annual trainee renewal (DIR)", "traineeRenewalFee"),
        guide("Approved-school tuition", "Varies by school and is not part of CareerQuest's research."),
        ...programFeeFacts,
      ],
      documents: docs(
        ["Proof of enrollment and school number (trainee route)"],
        ["Electrician Trainee registration card", "TRAINEE_CARD"],
        ["Apprenticeship acceptance or registration letter"],
      ),
      jobs: {
        titles: ["Apprentice electrician", "Electrician trainee", "Inside wireman apprentice"],
        match: { include: ["electric", "wireman", "wire man"], require: ["apprentice", "trainee"], exclude: ["pre-apprentice", "preapprentice"] },
        searchQuery: "apprentice",
      },
      trainingTracks: ["SAFETY", "INSTALLATION"],
      payReference: [sourced("Apprentice starting pay (observed)", seed.wages.apprenticeStart)],
      resources: [...t.forms, res.approvedSchools, directory, res.dasProgramSearch],
      prerequisites: [typical("entry-prep")],
    }),
    node({
      key: "supervised-experience",
      title: "Supervised experience",
      branch: "electrician",
      kind: "stage",
      col: 3,
      row: MAIN_ROW,
      summary:
        "Build on-the-job hours under supervision — as a registered trainee working beside a certified electrician, or inside your apprenticeship — and keep proof so every hour can be verified.",
      requirements: [
        ...(general ? [classificationHours(general, "of on-the-job work")] : []),
        ...specialties.map((c) => classificationHours(c, "of on-the-job work")),
        sourced("Trainee route to the exam", t.pathToCertification),
        general?.notes ? { ...sourced("How General Electrician hours are counted", general.notes)!, flag: null } : null,
        guide(
          "How CareerQuest counts",
          "Verified hours (employer-verified or official record) count toward progress; self-reported hours are shown separately. CareerQuest does not apply DIR's per-work-area caps, so compare your mix of work with the caps above.",
        ),
      ],
      duration: estimate("Depends on how many verified hours you work. Your personal pace estimate appears here once verified hours are logged."),
      costs: [
        fee("Annual trainee renewal (DIR)", "traineeRenewalFee"),
        guide("Classes", "Trainees also pay for approved-school classes; tuition varies by school and is not part of CareerQuest's research."),
      ],
      documents: docs(["Employer letters or official records verifying your hours", "HOURS_VERIFICATION"], ["Pay stubs for the hours you worked", "PAY_STUB"]),
      jobs: {
        titles: ["Apprentice electrician", "Electrician trainee"],
        match: { include: ["electric", "wireman", "wire man"], require: ["apprentice", "trainee"], exclude: ["pre-apprentice", "preapprentice"] },
        searchQuery: "apprentice",
      },
      trainingTracks: ["INSTALLATION", "SYSTEMS"],
      resources: [
        internal("CareerQuest work-hours log", "/academy/hours"),
        ...(general ? linksFrom(general.hours?.sources ?? []).map((l) => ({ ...l, label: "DIR: General Electrician hour requirements" })) : []),
        ...linksFrom(t.sources, [/electricaltrainee\.htm/i]),
      ],
      prerequisites: [req("trainee-or-apprentice")],
    }),
    node({
      key: "apprenticeship-completion",
      title: "Apprenticeship completion (journeyman)",
      branch: "electrician",
      kind: "credential",
      col: 3,
      row: MAIN_ROW + 1,
      summary:
        "Finishing a registered apprenticeship is a credential from your training program. It is one route to the certification exam, but on its own it does not make you a DIR-certified electrician or a licensed contractor.",
      credentialFacts: [sourced("What it is", seed.distinction.apprenticeship)],
      requirements: [apprenticeRoute, ...programDurationFacts],
      duration: programLength ?? estimate("Set by your program."),
      costs: programFeeFacts,
      documents: docs(["Program completion certificate or letter"]),
      trainingTracks: ["CODE", "EXAM_PREP"],
      resources: [directory, res.dasProgramSearch, ...linksFrom(apprenticeRoute?.sources ?? [])],
      prerequisites: [req("trainee-or-apprentice")],
    }),
    node({
      key: "cert-eligibility",
      title: "Certification eligibility",
      branch: "electrician",
      kind: "stage",
      col: 4,
      row: MAIN_ROW,
      summary: "Qualify for the California electrician certification exam through one of the routes DIR recognizes, then apply to DIR.",
      requirements: routeFacts,
      duration: exam.eligibilityWindow ? { ...sourced("Exam window", exam.eligibilityWindow)!, label: "Estimate", basis: "estimate" } : null,
      costs: [fee("Certification application", "applicationFee"), fee("Certification exam", "examFee"), fee("Typical initial cost (application + exam)", "combinedInitialCost")],
      documents: docs(
        ["Verification of your on-the-job hours from each employer", "HOURS_VERIFICATION"],
        ["Approved-curriculum transcript (trainee route)"],
        ["Apprenticeship completion certificate (apprenticeship route)"],
        ["DIR certification application"],
      ),
      trainingTracks: ["EXAM_PREP"],
      resources: [dirMain, internal("CareerQuest certification tracker", "/academy/certification"), ...linksFrom(fees.sources, [/ECUCertforms/i]), ...linksFrom(routeFacts.flatMap((r) => r.sources), [/291_2/i, /dlse\/ecu\/2a/i])],
      prerequisites: [req("supervised-experience"), req("apprenticeship-completion")],
      prereqMode: "any",
    }),
    node({
      key: "ca-certification",
      title: "California certification (DIR)",
      branch: "electrician",
      kind: "credential",
      col: 5,
      row: MAIN_ROW,
      summary:
        "The state worker credential required to do electrician work for a C-10 contractor. You earn it by passing the DIR exam and keep it by renewing on schedule.",
      credentialFacts: [sourced("What it is", seed.distinction.certification)],
      requirements: [
        sourcedNumber("Exam questions", exam.questions, (n) => `${count(n)} multiple-choice questions (General Electrician exam).`),
        sourced("Exam format", exam.format),
        sourced("Passing score", exam.passingScore),
        sourced("Time limit", exam.timeLimit),
        sourced("Retest", exam.retest),
        sourced("Who must be certified", seed.law.whoMustBeCertified),
      ],
      duration: renewal.period ? { ...sourced("Certification period", renewal.period)!, label: "Estimate", basis: "estimate" } : null,
      costs: [fee("Certification exam", "examFee"), fee("Re-examination", "reExamFee"), fee("Renewal", "renewalFee")],
      documents: docs(["Certification card", "CERTIFICATE"]),
      trainingTracks: ["CODE", "EXAM_PREP"],
      resources: [internal("CareerQuest practice exams", "/academy/exam"), dirMain, ...linksFrom(exam.sources, [/ecu_testinfo/i, /cib\.pdf/i, /pearsonvue/i, /ECU_FAQ/i])],
      prerequisites: [req("cert-eligibility")],
    }),
    node({
      key: "experienced-electrician",
      title: "Experienced electrician (journey level)",
      branch: "electrician",
      kind: "stage",
      col: 6,
      row: MAIN_ROW,
      summary:
        "Work at journey level as a certified electrician, keep the certification current and build the experience that specialist, foreman and contractor roles look for.",
      requirements: [
        sourced("Continuing education", renewal.continuingEducation),
        sourced("Work requirement for renewal", renewal.workRequirement),
        sourced("Renewal timing", renewal.timing),
        sourced("Lapsed certification", renewal.lapsed),
      ],
      duration: estimate("Open-ended — this stage lasts as long as you work at journey level."),
      costs: [fee("Certification renewal", "renewalFee"), fee("Lapsed or expired renewal", "lapsedExpiredRenewalFee"), fee("Replacement card", "replacementCardFee")],
      documents: docs(["Continuing-education completion records"], ["Record of hours worked since your last renewal", "HOURS_VERIFICATION"]),
      jobs: {
        titles: ["Journeyman electrician", "Certified general electrician", "Inside wireman"],
        match: {
          include: ["electrician", "wireman", "wire man"],
          exclude: [...ENTRY, "foreman", "supervisor", "superintendent", "manager", "estimator", "lead"],
        },
        searchQuery: "electrician",
      },
      payReference: [
        sourced("U.S. median pay (observed)", seed.wages.national),
        sourced("Los Angeles area median pay (observed)", seed.wages.losAngeles),
        sourced("Union journeyman scale (observed)", seed.wages.journeyman),
      ],
      trainingTracks: ["SYSTEMS", "CODE"],
      resources: [roadmap, ...linksFrom(renewal.sources, [/ECU_FAQ/i, /291_5/i])],
      prerequisites: [req("ca-certification")],
    }),
    node({
      key: "specialist",
      title: "Specialist",
      branch: "electrician",
      kind: "role",
      col: 7,
      row: MAIN_ROW - 1,
      summary:
        "Go deep in one area such as controls, fire/life safety, voice-data-video, lighting or solar. California also certifies narrower classifications, each with its own hour requirement.",
      requirements: [
        ...specialties.map((c) => classificationHours(c, "of qualifying work for this DIR classification")),
        guide("Employer requirements", "Employers set their own requirements for specialist roles; CareerQuest has no researched figures for them."),
      ],
      duration: estimate("Varies by specialty and employer."),
      costs: [guide("Costs", "No researched cost figures for specialist roles.")],
      jobs: {
        titles: ["Controls technician", "Fire alarm technician", "Low-voltage / voice-data-video technician", "Solar PV installer", "Lighting technician"],
        match: {
          include: ["fire alarm", "fire life safety", "low voltage", "solar", "photovoltaic", "instrumentation", "controls", "plc", "voice data", "vdv", "lighting technician", "electrical technician"],
          exclude: ENTRY,
        },
        searchQuery: "technician",
      },
      trainingTracks: ["SYSTEMS"],
      resources: specialties.flatMap((c) => linksFrom(c.hours?.sources ?? []).map((l) => ({ ...l, label: `DIR: ${c.name} requirements` }))),
      prerequisites: [req("experienced-electrician", "started")],
    }),
    node({
      key: "foreman",
      title: "Foreman",
      branch: "electrician",
      kind: "role",
      col: 7,
      row: MAIN_ROW,
      summary: "Lead a crew on site: plan the day's work, coordinate materials and people, and keep the work safe and to code.",
      requirements: [guide("Requirements", "Set by each employer. CareerQuest has no researched figures for foreman roles.")],
      duration: estimate("Varies by employer."),
      costs: [guide("Costs", "No required fees researched for this role.")],
      jobs: {
        titles: ["Electrical foreman", "General foreman", "Lead electrician"],
        match: { include: ["electric", "wireman"], require: ["foreman", "lead"] },
        searchQuery: "foreman",
      },
      trainingTracks: ["SAFETY", "CODE"],
      sourcedFigures: false,
      prerequisites: [req("experienced-electrician", "started")],
    }),
    node({
      key: "management",
      title: "Management",
      branch: "electrician",
      kind: "role",
      col: 7,
      row: MAIN_ROW + 1,
      summary: "Run projects or a department at an electrical contractor: superintendent, project manager or estimator roles.",
      requirements: [guide("Requirements", "Set by each employer. CareerQuest has no researched figures for management roles.")],
      duration: estimate("Varies by employer."),
      costs: [guide("Costs", "No required fees researched for this role.")],
      jobs: {
        titles: ["Electrical superintendent", "Electrical project manager", "Electrical estimator"],
        match: { include: ["electric"], require: ["superintendent", "project manager", "manager", "estimator", "director"] },
        searchQuery: "electrical",
      },
      sourcedFigures: false,
      prerequisites: [req("experienced-electrician", "started"), typical("foreman")],
    }),
    node({
      key: "c10-license",
      title: "CSLB C-10 Contractor License",
      branch: "electrician",
      kind: "credential",
      col: 7,
      row: MAIN_ROW + 2,
      summary:
        "A business license from the Contractors State License Board that lets you bid and contract for electrical work yourself. It is separate from DIR certification: a C-10 contractor must still employ certified electricians, registered apprentices or supervised registered trainees.",
      credentialFacts: [sourced("What it is", seed.distinction.license), sourced("How the three credentials differ", seed.distinction.summary)],
      requirements: contractor.requirements.map((r, i) => sourced(i === 0 ? "Experience" : "Requirement", r)),
      duration:
        experienceYears !== null && contractor.experienceYears
          ? estimate(`Plan on at least ${experienceYears} years of journey-level (or higher) experience before applying — CSLB's experience requirement.`, {
              sources: contractor.experienceYears.sources,
              verifiedOn: contractor.experienceYears.verifiedOn,
            })
          : null,
      costs: [...contractor.fees.map((f) => sourced(f.label, f.text)), sourced("Contractor's bond", contractor.bond)],
      documents: docs(
        ["Certified record of your journey-level experience"],
        ["Live Scan fingerprinting receipt"],
        ["Contractor's bond (or cashier's check alternative)"],
        ["Workers' compensation certificate or exemption"],
      ),
      trainingTracks: ["CODE"],
      resources: linksFrom(contractor.sources),
      prerequisites: [req("experienced-electrician", "started")],
    }),

    // ----------------------------------------------------------------- side branches
    ...sideBranch({
      branch: "elevator",
      row: 1,
      entry: {
        key: "elevator-entry",
        title: "Elevator apprenticeship entry",
        summary: "Elevator work is usually entered through a registered elevator apprenticeship or a helper role with an elevator contractor.",
        routes: ["Registered elevator-constructor apprenticeship (union or employer-sponsored)", "Helper role with an elevator installation or service contractor"],
        match: { include: ["elevator", "escalator"], require: ENTRY },
        titles: ["Elevator apprentice", "Elevator helper"],
      },
      roles: [
        {
          key: "elevator-mechanic",
          title: "Elevator mechanic",
          summary: "Installs, maintains and repairs elevators, escalators and lifts. Electrical knowledge transfers directly to the controls side of the work.",
          match: { include: ["elevator", "escalator"], exclude: ENTRY },
          titles: ["Elevator mechanic", "Elevator service technician", "Elevator installer"],
          tracks: ["FUNDAMENTALS", "SAFETY", "SYSTEMS"],
          search: "elevator",
        },
      ],
    }),
    ...sideBranch({
      branch: "hvac",
      row: 2,
      entry: {
        key: "hvac-entry",
        title: "HVAC training entry",
        summary: "Commercial HVAC careers usually start through a registered HVAC or refrigeration apprenticeship, a trade-school program or an installer-helper job.",
        routes: ["Registered HVAC / refrigeration apprenticeship", "Trade-school HVAC program", "Installer helper or trainee with a mechanical contractor"],
        match: { include: ["hvac", "refrigeration", "air conditioning", "heating"], require: ENTRY },
        titles: ["HVAC apprentice", "HVAC helper", "HVAC installer trainee"],
      },
      roles: [
        {
          key: "commercial-hvac",
          title: "Commercial HVAC technician",
          summary: "Installs and services heating, ventilation, air-conditioning and refrigeration equipment in commercial buildings. Certifications may apply (for example for refrigerant handling); confirm with programs and employers.",
          match: { include: ["hvac", "refrigeration", "air conditioning", "heating"], exclude: ENTRY },
          titles: ["Commercial HVAC technician", "HVAC service technician", "Refrigeration technician"],
          tracks: ["FUNDAMENTALS", "SAFETY", "SYSTEMS"],
          search: "hvac",
        },
      ],
    }),
    ...sideBranch({
      branch: "industrial",
      row: 4,
      entry: {
        key: "industrial-entry",
        title: "Maintenance entry",
        summary: "Industrial maintenance is usually entered as a maintenance helper or apprentice in a plant, through a registered maintenance or millwright apprenticeship, or from a trade-school program.",
        routes: ["Maintenance helper or apprentice at a plant", "Registered industrial maintenance or millwright apprenticeship", "Trade-school maintenance program"],
        match: { include: ["industrial maintenance", "maintenance mechanic", "maintenance technician", "maintenance electrician", "plant maintenance", "millwright"], require: ENTRY },
        titles: ["Maintenance helper", "Maintenance apprentice", "Millwright apprentice"],
      },
      roles: [
        {
          key: "industrial-maintenance",
          title: "Industrial maintenance technician",
          summary: "Keeps production equipment running across electrical, mechanical, hydraulic and control systems. Academy fundamentals and safety apply directly.",
          match: { include: ["industrial maintenance", "maintenance mechanic", "maintenance technician", "maintenance electrician", "plant maintenance", "millwright"], exclude: ENTRY },
          titles: ["Industrial maintenance technician", "Maintenance electrician", "Maintenance mechanic"],
          tracks: ["FUNDAMENTALS", "SAFETY", "SYSTEMS"],
          search: "maintenance",
        },
      ],
    }),
    ...sideBranch({
      branch: "building",
      row: 5,
      entry: {
        key: "building-entry",
        title: "Building operations entry",
        summary: "Building engineers often start as building-maintenance helpers or facilities technicians, or through a stationary-engineer apprenticeship.",
        routes: ["Building maintenance helper or facilities technician", "Stationary engineer apprenticeship", "Trade-school facilities or HVAC program"],
        match: { include: ["building engineer", "stationary engineer", "building maintenance", "facilities technician", "facility technician", "facilities engineer"], require: ENTRY },
        titles: ["Building engineer assistant", "Facilities technician trainee"],
      },
      roles: [
        {
          key: "building-engineer",
          title: "Building engineer",
          summary: "Operates and maintains a building's mechanical, electrical and plumbing systems, such as HVAC equipment, boilers, chillers and electrical distribution.",
          match: { include: ["building engineer", "stationary engineer", "chief engineer", "operating engineer", "facilities engineer", "facility engineer"], exclude: ENTRY },
          titles: ["Building engineer", "Stationary engineer", "Facilities engineer"],
          tracks: ["FUNDAMENTALS", "SAFETY", "SYSTEMS"],
          search: "engineer",
        },
      ],
    }),
    ...sideBranch({
      branch: "construction",
      row: 0,
      entry: {
        key: "construction-entry",
        title: "Construction office entry",
        summary: "Construction office careers often start as a project assistant, document controller or field-engineer intern, or after construction-management coursework.",
        routes: ["Project assistant or document control at a contractor", "Field engineer or construction intern", "Construction-management coursework"],
        match: { include: ["project assistant", "construction assistant", "document control", "field engineer", "construction intern", "project administrator"] },
        titles: ["Project assistant", "Document control specialist", "Field engineer"],
      },
      roles: [
        {
          key: "project-coordinator",
          title: "Construction project coordinator",
          summary: "Keeps projects organized: submittals, RFIs, schedules, purchase orders and communication between the field, office and clients.",
          match: { include: ["project coordinator"] },
          titles: ["Construction project coordinator", "Project coordinator"],
          tracks: [],
          search: "coordinator",
        },
        {
          key: "estimator",
          title: "Estimator",
          summary: "Prices work from plans and specifications: quantity takeoffs, labor and material costs and bid preparation. Trade knowledge, such as reading electrical plans, helps.",
          match: { include: ["estimator"] },
          titles: ["Construction estimator", "Electrical estimator", "Assistant estimator"],
          tracks: ["INSTALLATION"],
          search: "estimator",
          chain: true,
        },
        {
          key: "assistant-pm",
          title: "Assistant project manager",
          summary: "Supports the project manager on budget, schedule, subcontractors and change orders, as a step toward running projects.",
          match: { include: ["assistant project manager", "asst project manager", "apm"] },
          titles: ["Assistant project manager"],
          tracks: [],
          search: "project manager",
          chain: true,
        },
      ],
    }),
    ...sideBranch({
      branch: "plumbing",
      row: 6,
      entry: {
        key: "plumbing-entry",
        title: "Plumbing & pipefitting entry",
        summary: "Commercial plumbing and pipefitting are usually entered through a registered apprenticeship (union or merit shop) or a helper role with a plumbing or mechanical contractor.",
        routes: ["Registered plumbing / pipefitting apprenticeship", "Helper with a plumbing or mechanical contractor"],
        match: { include: ["plumb", "pipefitter", "pipe fitter", "steamfitter", "pipefitting", "sprinkler fitter"], require: ENTRY },
        titles: ["Plumbing apprentice", "Pipefitter helper"],
      },
      roles: [
        {
          key: "commercial-plumbing",
          title: "Commercial plumber / pipefitter",
          summary: "Installs and maintains water, drain, gas and process piping in commercial and industrial buildings.",
          match: { include: ["plumb", "pipefitter", "pipe fitter", "steamfitter", "pipefitting", "sprinkler fitter"], exclude: ENTRY },
          titles: ["Commercial plumber", "Pipefitter", "Steamfitter"],
          tracks: ["SAFETY"],
          search: "plumb",
        },
      ],
    }),
  ];

  function sideBranch(spec: {
    branch: BranchKey;
    row: number;
    entry: { key: CareerNodeKey; title: string; summary: string; routes: string[]; match: JobMatchSpec; titles: string[] };
    roles: { key: CareerNodeKey; title: string; summary: string; match: JobMatchSpec; titles: string[]; tracks: TrackKey[]; search: string; chain?: boolean }[];
  }): CareerNodeDef[] {
    const out: CareerNodeDef[] = [
      node({
        key: spec.entry.key,
        title: spec.entry.title,
        branch: spec.branch,
        kind: "entry",
        col: 1,
        row: spec.row,
        summary: spec.entry.summary,
        requirements: [noFigures],
        duration: varies,
        costs: [noCosts],
        documents: docs(["Résumé", "RESUME"], ["High school diploma or equivalent (commonly requested; confirm with each program)"]),
        jobs: { titles: spec.entry.titles, match: spec.entry.match, searchQuery: spec.entry.titles[0]?.split(" ")[0]?.toLowerCase() ?? null },
        trainingTracks: ["SAFETY"],
        entryRoutes: spec.entry.routes,
        resources: apprenticeshipSearch,
        prerequisites: [typical("beginner")],
        sourcedFigures: false,
      }),
    ];
    let prev: CareerNodeKey = spec.entry.key;
    spec.roles.forEach((r, i) => {
      out.push(
        node({
          key: r.key,
          title: r.title,
          branch: spec.branch,
          kind: "role",
          col: 2 + i,
          row: spec.row,
          summary: r.summary,
          requirements: [noFigures],
          duration: varies,
          costs: [noCosts],
          documents: docs(["Résumé", "RESUME"]),
          jobs: { titles: r.titles, match: r.match, searchQuery: r.search },
          trainingTracks: r.tracks,
          resources: apprenticeshipSearch,
          prerequisites: [r.chain ? typical(prev) : req(prev, "started")],
          sourcedFigures: false,
        }),
      );
      prev = r.key;
    });
    return out;
  }

  const edges: GraphEdge[] = nodes.flatMap((n) => n.prerequisites.map((p) => ({ from: p.from, to: n.key, kind: p.kind })));

  const distinction = compact([
    sourced("Apprenticeship completion", seed.distinction.apprenticeship),
    sourced("DIR electrician certification", seed.distinction.certification),
    sourced("CSLB C-10 contractor license", seed.distinction.license),
  ]);

  return {
    nodes,
    edges,
    branches: BRANCHES,
    distinction,
    classifications: seed.classifications.map((c) => ({
      code: c.code,
      name: c.name,
      hours: c.hours?.value ?? null,
      sources: c.hours?.sources ?? [],
      verifiedOn: c.hours?.verifiedOn ?? null,
    })),
    c10ExperienceYears: experienceYears,
    seed: {
      verifiedOn: seed.verifiedOn,
      verificationMethod: seed.verificationMethod,
      errors: seed.errors,
      unverifiedCount: seed.unverifiedItems.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Integrity
// ---------------------------------------------------------------------------

/** Identifiers that contain digits but are names, not figures (license classes like C-10). */
const IDENTIFIERS = /\bC-\d+\b/g;

export function containsFigure(text: string): boolean {
  return /\d/.test(text.replace(IDENTIFIERS, ""));
}

export function allFacts(n: CareerNodeDef): MapFact[] {
  return [...n.credentialFacts, ...n.requirements, ...(n.duration ? [n.duration] : []), ...n.costs, ...n.payReference];
}

/** Prerequisite-first order (Kahn). Returns null when the graph has a cycle. */
export function topologicalOrder(nodes: Pick<CareerNodeDef, "key" | "prerequisites">[]): string[] | null {
  const keys = new Set(nodes.map((n) => n.key));
  const indegree = new Map(nodes.map((n) => [n.key, n.prerequisites.filter((p) => keys.has(p.from)).length]));
  const children = new Map<string, string[]>();
  for (const n of nodes) for (const p of n.prerequisites) if (keys.has(p.from)) children.set(p.from, [...(children.get(p.from) ?? []), n.key]);
  const queue = nodes.filter((n) => indegree.get(n.key) === 0).map((n) => n.key);
  const order: string[] = [];
  while (queue.length) {
    const k = queue.shift()!;
    order.push(k);
    for (const c of children.get(k) ?? []) {
      const d = (indegree.get(c) ?? 0) - 1;
      indegree.set(c, d);
      if (d === 0) queue.push(c);
    }
  }
  return order.length === nodes.length ? order : null;
}

/**
 * Structural and honesty checks. Returns human-readable issues (empty = valid):
 * unknown/duplicate keys, cycles, unreachable stops, overlapping positions, figures without a source
 * and check date, and figures inside CareerQuest's own text.
 */
export function validateCareerGraph(graph: Pick<CareerGraph, "nodes">): string[] {
  const issues: string[] = [];
  const keys = new Set<string>();
  for (const n of graph.nodes) {
    if (keys.has(n.key)) issues.push(`Duplicate node key "${n.key}".`);
    keys.add(n.key);
  }
  const positions = new Map<string, string>();
  for (const n of graph.nodes) {
    for (const p of n.prerequisites) {
      if (!keys.has(p.from)) issues.push(`"${n.key}" lists unknown prerequisite "${p.from}".`);
      if (p.from === n.key) issues.push(`"${n.key}" lists itself as a prerequisite.`);
    }
    if (n.prereqMode === "any" && n.prerequisites.filter((p) => p.kind === "required").length < 2) {
      issues.push(`"${n.key}" uses prereqMode "any" without alternative required prerequisites.`);
    }
    const pos = `${n.col}:${n.row}`;
    if (positions.has(pos)) issues.push(`"${n.key}" overlaps "${positions.get(pos)}" at column ${n.col}, row ${n.row}.`);
    positions.set(pos, n.key);

    if (containsFigure(n.summary)) issues.push(`"${n.key}" summary contains a figure; figures must come from sourced facts.`);
    for (const f of allFacts(n)) {
      const where = `"${n.key}" › ${f.label}`;
      if (containsFigure(f.value) || containsFigure(f.label)) {
        if (f.basis === "guidance") issues.push(`${where}: guidance text contains a figure.`);
        if (!f.sources.length) issues.push(`${where}: figure without a source URL.`);
        if (!f.verifiedOn) issues.push(`${where}: figure without a check date.`);
      }
      if (f.basis === "sourced" && !f.sources.length && f.flag !== "unverified") issues.push(`${where}: sourced fact without a source URL must be flagged unverified.`);
      for (const s of f.sources) if (!/^https?:\/\//.test(s)) issues.push(`${where}: invalid source URL "${s}".`);
    }
    if (!n.sourcedFigures) {
      for (const f of allFacts(n)) if (containsFigure(f.value)) issues.push(`"${n.key}" is marked descriptions-only but shows a figure (${f.label}).`);
    }
  }
  if (!topologicalOrder(graph.nodes)) issues.push("The prerequisite graph has a cycle.");

  // Every stop must be reachable from the start.
  const children = new Map<string, string[]>();
  for (const n of graph.nodes) for (const p of n.prerequisites) children.set(p.from, [...(children.get(p.from) ?? []), n.key]);
  const seen = new Set<string>([ROOT_KEY]);
  const stack = [ROOT_KEY as string];
  while (stack.length) {
    const k = stack.pop()!;
    for (const c of children.get(k) ?? []) {
      if (seen.has(c)) continue;
      seen.add(c);
      stack.push(c);
    }
  }
  for (const n of graph.nodes) if (!seen.has(n.key)) issues.push(`"${n.key}" cannot be reached from "${ROOT_KEY}".`);
  return issues;
}

/** Map dimensions in grid units. */
export function gridSize(nodes: Pick<CareerNodeDef, "col" | "row">[]): { cols: number; rows: number } {
  return { cols: Math.max(0, ...nodes.map((n) => n.col)) + 1, rows: Math.max(0, ...nodes.map((n) => n.row)) + 1 };
}
