/**
 * Pure, tolerant parsing of the researched seed files into the figures the Career Map needs.
 * Every figure keeps the source URLs and check date of the section it came from; anything missing
 * or malformed is simply absent (null / empty), never filled in with a guess.
 *
 * Inputs (raw JSON): data/seed/certification_facts.json, data/seed/certification_requirements.json,
 * data/seed/apprenticeship_programs.json and data/research/electrician_research.json.
 */
import type { FactFlag, MapLink } from "./types";

type Obj = Record<string, unknown>;

export type SourcedText = { text: string; sources: string[]; verifiedOn: string | null; flag: FactFlag | null };
export type SourcedNumber = { value: number; sources: string[]; verifiedOn: string | null; flag: FactFlag | null };

export type SeedClassification = {
  code: string;
  name: string;
  hours: SourcedNumber | null;
  notes: SourcedText | null;
};

export type SeedProgram = {
  slug: string;
  name: string;
  isUnion: boolean;
  durationYears: number | null;
  durationFlag: FactFlag | null;
  classroomHours: string | null;
  startingWage: string | null;
  startingWageVerified: boolean;
  fees: string | null;
  recruitmentStatus: string | null;
  applyUrl: string | null;
  website: string | null;
  sources: string[];
  verifiedOn: string | null;
};

export type CareerSeed = {
  verifiedOn: string | null;
  verificationMethod: string | null;
  mainUrl: string | null;
  classifications: SeedClassification[];
  trainee: {
    whoMustRegister: SourcedText | null;
    schoolRequirement: SourcedText | null;
    supervisionRule: SourcedText | null;
    classroomHoursPerYear: SourcedText | null;
    initialFee: SourcedText | null;
    renewal: SourcedText | null;
    pathToCertification: SourcedText | null;
    forms: MapLink[];
    sources: string[];
    verifiedOn: string | null;
  };
  fees: Partial<Record<FeeKey, SourcedNumber>> & { notes: SourcedText | null; sources: string[]; verifiedOn: string | null };
  exam: {
    questions: SourcedNumber | null;
    format: SourcedText | null;
    passingScore: SourcedText | null;
    timeLimit: SourcedText | null;
    eligibilityWindow: SourcedText | null;
    retest: SourcedText | null;
    sources: string[];
    verifiedOn: string | null;
  };
  renewal: {
    period: SourcedText | null;
    continuingEducation: SourcedText | null;
    workRequirement: SourcedText | null;
    timing: SourcedText | null;
    lapsed: SourcedText | null;
    fee: SourcedNumber | null;
    sources: string[];
    verifiedOn: string | null;
  };
  law: { whoMustBeCertified: SourcedText | null; exemptions: SourcedText[]; sources: string[]; verifiedOn: string | null };
  contractor: {
    name: string | null;
    issuedBy: SourcedText | null;
    definition: SourcedText | null;
    requirements: SourcedText[];
    fees: { label: string; text: SourcedText }[];
    bond: SourcedText | null;
    experienceYears: SourcedNumber | null;
    sources: string[];
    verifiedOn: string | null;
  };
  distinction: {
    apprenticeship: SourcedText | null;
    certification: SourcedText | null;
    license: SourcedText | null;
    summary: SourcedText | null;
  };
  /** Exam-eligibility routes from the research file, each with its own sources. */
  routes: { route: string; detail: SourcedText }[];
  wages: {
    national: SourcedText | null;
    losAngeles: SourcedText | null;
    journeyman: SourcedText | null;
    apprenticeStart: SourcedText | null;
  };
  programs: SeedProgram[];
  resources: {
    dasHome: MapLink | null;
    dasProgramSearch: MapLink | null;
    dasLosAngelesElectrician: MapLink | null;
    dasOrangeElectrician: MapLink | null;
    approvedSchools: MapLink | null;
    federalFinder: MapLink | null;
    sources: string[];
    verifiedOn: string | null;
  };
  unverifiedItems: string[];
  errors: string[];
};

export const FEE_KEYS = [
  "applicationFee",
  "examFee",
  "reExamFee",
  "renewalFee",
  "lapsedExpiredRenewalFee",
  "replacementCardFee",
  "traineeRegistrationFee",
  "traineeRenewalFee",
  "combinedInitialCost",
] as const;
export type FeeKey = (typeof FEE_KEYS)[number];

export type RawCareerSeed = { facts: unknown; requirements: unknown; programs: unknown; research: unknown };

// ---------------------------------------------------------------------------
// Small accessors
// ---------------------------------------------------------------------------

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

export function isHttpUrl(u: unknown): u is string {
  if (typeof u !== "string") return false;
  try {
    const url = new URL(u);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

const str = (o: Obj | null | undefined, k: string): string | null => {
  const v = o?.[k];
  return typeof v === "string" && v.trim() ? v.trim() : null;
};
const num = (o: Obj | null | undefined, k: string): number | null => {
  const v = o?.[k];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};
const obj = (o: Obj | null | undefined, k: string): Obj | null => (isObj(o?.[k]) ? (o![k] as Obj) : null);
const strings = (o: Obj | null | undefined, k: string): string[] => {
  const v = o?.[k];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((s) => s.trim()) : [];
};
const urlList = (o: Obj | null | undefined, k = "sourceUrls"): string[] => [...new Set(strings(o, k).filter(isHttpUrl))];
const dateStr = (o: Obj | null | undefined, k = "verifiedOn"): string | null => {
  const v = str(o, k);
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
};

/** Flag a fact from its own wording (or an explicit `verified` field). */
export function flagFromText(text: string | null | undefined, verified?: unknown): FactFlag | null {
  if (text && /\bCONFLICTING\b|\bconflicts?\b/i.test(text)) return "conflict";
  if (text && /\bUNVERIFIED\b|not retrieved/i.test(text)) return "unverified";
  if (verified === false) return "unverified";
  if (typeof verified === "string" && /partial/i.test(verified)) return "partial";
  if (typeof verified === "string" && /unverified|false/i.test(verified)) return "unverified";
  return null;
}

function sText(text: string | null, sources: string[], verifiedOn: string | null, flag?: FactFlag | null): SourcedText | null {
  if (!text) return null;
  return { text, sources, verifiedOn, flag: flag === undefined ? flagFromText(text) : flag };
}

function sNum(value: number | null, sources: string[], verifiedOn: string | null, flag: FactFlag | null = null): SourcedNumber | null {
  return value === null ? null : { value, sources, verifiedOn, flag };
}

function link(label: string, url: unknown): MapLink | null {
  return isHttpUrl(url) ? { label, href: url, external: true } : null;
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

/** "At least four years of experience …" → 4. Digits or number words; null when absent. */
export function parseExperienceYears(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+years?\s+of\s+(?:[\w-]+\s+)?experience/i.exec(text);
  if (!m) return null;
  const raw = m[1]!.toLowerCase();
  const n = /^\d+$/.test(raw) ? Number(raw) : NUMBER_WORDS[raw];
  return n !== undefined && Number.isFinite(n) && n > 0 ? n : null;
}

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

export function parseCareerSeed(raw: RawCareerSeed, errors: string[] = []): CareerSeed {
  const f = isObj(raw.facts) ? raw.facts : {};
  const research = isObj(raw.research) ? raw.research : {};
  const topVerified = dateStr(f);
  const unverifiedItems = strings(f, "unverifiedItems");
  const mentionedAsUnverified = (hint: string) => unverifiedItems.some((i) => i.toLowerCase().includes(hint.toLowerCase()));

  // Classifications
  const classifications: SeedClassification[] = (Array.isArray(raw.requirements) ? raw.requirements : []).filter(isObj).flatMap((c) => {
    const code = str(c, "code");
    if (!code) return [];
    const sources = [str(c, "sourceUrl"), str(c, "regulationUrl")].filter(isHttpUrl);
    const verifiedOn = dateStr(c);
    const hours = num(c, "hoursRequired");
    const name = str(c, "name") ?? code;
    return [
      {
        code,
        name,
        hours: hours !== null && hours > 0 && sources.length ? sNum(hours, sources, verifiedOn, mentionedAsUnverified(`${name} hours`) ? "unverified" : null) : null,
        notes: sources.length ? sText(str(c, "notes"), sources, verifiedOn, null) : null,
      },
    ];
  });

  // Trainee
  const t = obj(f, "trainee");
  const tSources = urlList(t);
  const tVerified = dateStr(t) ?? topVerified;
  const tText = (k: string) => (tSources.length ? sText(str(t, k), tSources, tVerified) : null);
  const forms = obj(t, "forms");
  const formLabels: Record<string, string> = {
    newRegistration: "Electrician Trainee registration form (DIR)",
    renewal: "Electrician Trainee renewal form (DIR)",
    definitionPage: "Electrician Trainee program page (DIR)",
    traineeDefinitionPage: "Electrician Trainee definition (DIR)",
  };

  // Fees
  const fe = obj(f, "fees");
  const feSources = urlList(fe);
  const feVerified = dateStr(fe) ?? topVerified;
  const feeFlag = (k: FeeKey): FactFlag | null => {
    if (k === "lapsedExpiredRenewalFee" && mentionedAsUnverified("lapsed/expired renewal fee")) return "unverified";
    if (k === "replacementCardFee" && mentionedAsUnverified("replacement card fee")) return "unverified";
    return null;
  };
  const fees: CareerSeed["fees"] = { notes: feSources.length ? sText(str(fe, "notes"), feSources, feVerified, null) : null, sources: feSources, verifiedOn: feVerified };
  if (feSources.length) {
    for (const k of FEE_KEYS) {
      const v = num(fe, k);
      if (v !== null && v >= 0) fees[k] = { value: v, sources: feSources, verifiedOn: feVerified, flag: feeFlag(k) };
    }
  }

  // Exam
  const e = obj(f, "exam");
  const eSources = urlList(e);
  const eVerified = dateStr(e) ?? topVerified;
  const eText = (k: string, flag?: FactFlag | null) => (eSources.length ? sText(str(e, k), eSources, eVerified, flag) : null);
  const passing = str(e, "passingScore");

  // Renewal
  const r = obj(f, "renewal");
  const rSources = urlList(r);
  const rVerified = dateStr(r) ?? topVerified;
  const rText = (k: string) => (rSources.length ? sText(str(r, k), rSources, rVerified) : null);

  // Law
  const l = obj(f, "law");
  const lSources = urlList(l);
  const lVerified = dateStr(l) ?? topVerified;

  // Contractor license
  const c = obj(f, "contractorLicense");
  const cSources = urlList(c);
  const cVerified = dateStr(c) ?? topVerified;
  const cText = (v: string | null) => (cSources.length ? sText(v, cSources, cVerified) : null);
  const cRequirements = cSources.length ? strings(c, "requirements").map((x) => sText(x, cSources, cVerified)!) : [];
  const cFeesObj = obj(c, "fees");
  const contractorFeeLabels: Record<string, string> = {
    originalApplicationFee: "CSLB application fee",
    initialLicenseFee: "Initial license fee",
    renewal: "License renewal",
    fingerprinting: "Fingerprinting",
    examFees: "Exam fees",
  };
  const cFees = cSources.length && cFeesObj
    ? Object.entries(cFeesObj).flatMap(([k, v]) =>
        typeof v === "string" && v.trim()
          ? [{ label: contractorFeeLabels[k] ?? k, text: sText(v.trim(), cSources, cVerified, /not retrieved/i.test(v) ? "unverified" : flagFromText(v))! }]
          : [],
      )
    : [];
  const yearsReq = cRequirements.find((x) => parseExperienceYears(x.text) !== null) ?? null;
  const d = obj(c, "distinction");

  // Research: exam routes + resources
  const rc = obj(research, "certification");
  const researchVerified = dateStr(research) ?? topVerified;
  const routes = (Array.isArray(rc?.alternativeRoutes) ? (rc!.alternativeRoutes as unknown[]) : []).filter(isObj).flatMap((x) => {
    const route = str(x, "route");
    const detail = str(x, "detail");
    if (!route || !detail) return [];
    const sources = urlList(x);
    const flag = flagFromText(detail, x.verified);
    // A route without any source is kept only as an explicit "unverified" warning.
    return [{ route, detail: { text: detail, sources, verifiedOn: researchVerified, flag: sources.length ? flag : "unverified" } as SourcedText }];
  });
  const res = obj(research, "apprenticeshipResources");
  const resVerified = dateStr(res) ?? researchVerified;

  // Wages
  const w = obj(f, "wages");
  const wVerified = dateStr(w) ?? topVerified;
  const nat = obj(w, "national2025");
  const la = obj(w, "losAngeles2025");
  const jw = obj(w, "ibewLocal11Journeyman");
  const ap = obj(w, "apprenticeStart");
  const national = (() => {
    const annual = num(nat, "medianAnnual");
    const hourly = num(nat, "medianHourly");
    const sources = urlList(nat);
    if (annual === null || !sources.length) return null;
    return sText(
      `U.S. median for electricians (${str(nat, "source") ?? "BLS"}): ${money(annual)} a year${hourly !== null ? ` (${money(hourly)} an hour)` : ""}.`,
      sources,
      wVerified,
      flagFromText(null, nat?.verified),
    );
  })();
  const losAngeles = (() => {
    const annual = num(la, "medianAnnual");
    const hourly = num(la, "medianHourly");
    const sources = urlList(la);
    if (annual === null || !sources.length) return null;
    return sText(
      `${str(la, "area") ?? "Los Angeles area"} median: ${money(annual)} a year${hourly !== null ? ` (${money(hourly)} an hour)` : ""}.`,
      sources,
      wVerified,
      flagFromText(null, la?.verified),
    );
  })();
  const journeyman = (() => {
    const sources = urlList(jw);
    if (!jw || !sources.length) return null;
    const rates = Object.entries(jw)
      .filter(([k, v]) => k.startsWith("baseHourly_") && typeof v === "number" && Number.isFinite(v))
      .map(([k, v]) => `${money(v as number)}/hr (${k.slice("baseHourly_".length).replace(/_to_/g, " – ").replace(/_/g, " ")})`);
    if (!rates.length) return null;
    return sText(`${str(jw, "classification") ?? "IBEW Local 11 journeyman"} base rate: ${rates.join("; ")}.`, sources, wVerified, flagFromText(null, jw.verified));
  })();
  const apprenticeStart = (() => {
    const sources = urlList(ap);
    const text = str(ap, "ibew11InsideWireman");
    if (!text || !sources.length) return null;
    return sText(`IBEW Local 11 inside wireman apprentice: ${text}`, sources, wVerified, flagFromText(text.replace(/\bVERIFIED\b\.?/g, ""), ap?.verified === "partial" ? null : ap?.verified));
  })();

  // Programs
  const programs: SeedProgram[] = (Array.isArray(raw.programs) ? raw.programs : []).filter(isObj).flatMap((p) => {
    const slug = str(p, "slug");
    const name = str(p, "name");
    if (!slug || !name) return [];
    const note = str(p, "recruitmentNote") ?? "";
    const duration = num(p, "durationYears");
    return [
      {
        slug,
        name,
        isUnion: p.isUnion === true,
        durationYears: duration !== null && duration > 0 ? duration : null,
        durationFlag: /length conflicts|conflicting/i.test(note) ? "conflict" : null,
        classroomHours: str(p, "classroomHours"),
        startingWage: str(p, "startingWage"),
        startingWageVerified: p.startingWageVerified === true,
        fees: str(p, "fees"),
        recruitmentStatus: str(p, "recruitmentStatus"),
        applyUrl: isHttpUrl(p.applyUrl) ? p.applyUrl : null,
        website: isHttpUrl(p.website) ? p.website : null,
        sources: urlList(p),
        verifiedOn: dateStr(p),
      },
    ];
  });

  return {
    verifiedOn: topVerified,
    verificationMethod: str(f, "verificationMethod"),
    mainUrl: isHttpUrl(f.mainUrl) ? f.mainUrl : null,
    classifications,
    trainee: {
      whoMustRegister: tText("whoMustRegister"),
      schoolRequirement: tText("schoolRequirement"),
      supervisionRule: tText("supervisionRule"),
      classroomHoursPerYear: tText("classroomHoursPerYear"),
      initialFee: tText("initialFee"),
      renewal: tText("renewal"),
      pathToCertification: tText("pathToCertification"),
      forms: forms
        ? Object.entries(forms).flatMap(([k, u]) => {
            const l2 = link(formLabels[k] ?? k, u);
            return l2 ? [l2] : [];
          })
        : [],
      sources: tSources,
      verifiedOn: tVerified,
    },
    fees,
    exam: {
      questions: eSources.length ? sNum(num(e, "questions"), eSources, eVerified) : null,
      format: eText("format"),
      passingScore: eText("passingScore", flagFromText(passing, e?.passingScoreVerified)),
      timeLimit: eText("timeLimit"),
      eligibilityWindow: eText("eligibilityWindow"),
      retest: eText("retest"),
      sources: eSources,
      verifiedOn: eVerified,
    },
    renewal: {
      period: rText("period"),
      continuingEducation: rText("continuingEducation"),
      workRequirement: rText("workRequirement"),
      timing: rText("timing"),
      lapsed: rText("lapsed"),
      fee: rSources.length ? sNum(num(r, "fee"), rSources, rVerified) : null,
      sources: rSources,
      verifiedOn: rVerified,
    },
    law: {
      whoMustBeCertified: lSources.length ? sText(str(l, "whoMustBeCertified"), lSources, lVerified) : null,
      exemptions: lSources.length ? strings(l, "exemptions").map((x) => sText(x, lSources, lVerified)!) : [],
      sources: lSources,
      verifiedOn: lVerified,
    },
    contractor: {
      name: str(c, "name"),
      issuedBy: cText(str(c, "issuedBy")),
      definition: cText(str(c, "definition")),
      requirements: cRequirements,
      fees: cFees,
      bond: cText(str(c, "bond")),
      experienceYears: yearsReq ? sNum(parseExperienceYears(yearsReq.text), yearsReq.sources, yearsReq.verifiedOn) : null,
      sources: cSources,
      verifiedOn: cVerified,
    },
    distinction: {
      apprenticeship: cText(str(d, "apprenticeshipCompletion")),
      certification: cText(str(d, "dirCertification")),
      license: cText(str(d, "c10License")),
      summary: cText(str(d, "summary")),
    },
    routes,
    wages: { national, losAngeles, journeyman, apprenticeStart },
    programs,
    resources: {
      dasHome: link("Division of Apprenticeship Standards (DAS)", res?.dasHome),
      dasProgramSearch: link("DAS apprenticeship program search", res?.dasProgramSearch),
      dasLosAngelesElectrician: link("DAS electrician programs — Los Angeles County", res?.dasProgramSearchLosAngelesElectrician),
      dasOrangeElectrician: link("DAS electrician programs — Orange County", res?.dasProgramSearchOrangeElectrician),
      approvedSchools: link("DIR list of approved electrician trainee schools", res?.dlseApprovedTraineeSchools),
      federalFinder: link("Apprenticeship.gov program finder", res?.federalApprenticeshipFinder),
      sources: [res?.dasHome, res?.dasProgramSearch].filter(isHttpUrl),
      verifiedOn: resVerified,
    },
    unverifiedItems,
    errors,
  };
}
