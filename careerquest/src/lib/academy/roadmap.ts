import "server-only";
import fs from "node:fs";
import path from "node:path";

/**
 * Reads the researched California certification facts (`data/seed/certification_facts.json` and
 * `certification_requirements.json`) into a display model. Every field is optional: missing or
 * malformed fields are skipped rather than breaking the page. Flags are derived from the data
 * itself ("CONFLICTING …", "UNVERIFIED", `verified: false`, the `unverifiedItems` list), so when the
 * research is re-verified the badges disappear without code changes.
 */

export type FactFlag = "conflict" | "unverified" | "partial";
export type Fact = { label: string; value: string; flag: FactFlag | null };
export type SourcedSection = { facts: Fact[]; sources: string[]; verifiedOn: string | null };

export type Classification = {
  code: string;
  name: string;
  hoursRequired: number | null;
  notes: string;
  sourceUrl: string | null;
  verifiedOn: string | null;
  flag: FactFlag | null;
};

export type FeeRow = { key: string; label: string; amount: number; flag: FactFlag | null };

export type RoadmapData = {
  verifiedOn: string | null;
  verificationMethod: string | null;
  programName: string | null;
  administeredBy: string | null;
  mainUrl: string | null;
  classifications: Classification[];
  trainee: (SourcedSection & { name: string | null; forms: { label: string; url: string }[] }) | null;
  fees: (SourcedSection & { rows: FeeRow[]; notes: string | null; currency: string }) | null;
  exam: SourcedSection | null;
  renewal: SourcedSection | null;
  law:
    | (SourcedSection & {
        exemptions: string[];
        pending: { bill: string; title: string | null; summary: string | null; status: string | null; statusNote: string | null; sourceUrl: string | null; flag: FactFlag | null } | null;
      })
    | null;
  contractor:
    | (SourcedSection & { name: string | null; requirements: string[]; feeFacts: Fact[]; bond: string | null })
    | null;
  distinction: { apprenticeship: string | null; certification: string | null; license: string | null; summary: string | null } | null;
  unverifiedItems: string[];
  errors: string[];
};

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
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
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [];
};

export function isHttpUrl(u: unknown): u is string {
  if (typeof u !== "string") return false;
  try {
    const url = new URL(u);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

const urls = (o: Obj | null | undefined, k = "sourceUrls"): string[] => [...new Set(strings(o, k).filter(isHttpUrl))];

/** Flag a fact from its own wording. */
export function flagFor(text: string | null | undefined, verified?: unknown): FactFlag | null {
  if (text && /\bCONFLICTING\b/i.test(text)) return "conflict";
  if (text && /\bUNVERIFIED\b/.test(text)) return "unverified";
  if (verified === false) return "unverified";
  if (typeof verified === "string" && /partial/i.test(verified)) return "partial";
  if (typeof verified === "string" && /unverified|false/i.test(verified)) return "unverified";
  return null;
}

function fact(label: string, value: string | null, flag?: FactFlag | null): Fact | null {
  return value ? { label, value, flag: flag === undefined ? flagFor(value) : flag } : null;
}

const compact = <T>(xs: (T | null)[]): T[] => xs.filter((x): x is T => x !== null);

const FEE_LABELS: Record<string, { label: string; hint?: string }> = {
  applicationFee: { label: "Certification application" },
  examFee: { label: "Certification exam" },
  reExamFee: { label: "Re-examination" },
  renewalFee: { label: "Renewal (every 3 years)" },
  lapsedExpiredRenewalFee: { label: "Lapsed / expired renewal", hint: "lapsed" },
  replacementCardFee: { label: "Replacement card", hint: "replacement card" },
  traineeRegistrationFee: { label: "Electrician Trainee registration" },
  traineeRenewalFee: { label: "Trainee annual renewal" },
  combinedInitialCost: { label: "Typical initial cost (application + exam)" },
};

function humanize(key: string): string {
  const words = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function buildRoadmap(factsRaw: unknown, requirementsRaw: unknown, errors: string[] = []): RoadmapData {
  const f = isObj(factsRaw) ? factsRaw : {};
  const unverifiedItems = strings(f, "unverifiedItems");
  const mentionedAsUnverified = (hint: string) => unverifiedItems.some((i) => i.toLowerCase().includes(hint.toLowerCase()));

  // Classifications
  const classifications: Classification[] = (Array.isArray(requirementsRaw) ? requirementsRaw : [])
    .filter(isObj)
    .map((c) => {
      const name = str(c, "name") ?? str(c, "code") ?? "Classification";
      return {
        code: str(c, "code") ?? name,
        name,
        hoursRequired: num(c, "hoursRequired"),
        notes: str(c, "notes") ?? "",
        sourceUrl: isHttpUrl(c.sourceUrl) ? c.sourceUrl : null,
        verifiedOn: str(c, "verifiedOn"),
        flag: mentionedAsUnverified(`${name} hours`) ? ("unverified" as const) : null,
      };
    });

  // Trainee route
  const t = obj(f, "trainee");
  const forms = obj(t, "forms");
  const formLabels: Record<string, string> = {
    newRegistration: "New registration form",
    renewal: "Renewal form",
    definitionPage: "Trainee program page",
    traineeDefinitionPage: "Trainee definition",
  };
  const trainee = t
    ? {
        name: str(t, "name"),
        facts: compact([
          fact("Who must register", str(t, "whoMustRegister")),
          fact("School requirement", str(t, "schoolRequirement")),
          fact("Supervision", str(t, "supervisionRule")),
          fact("Classroom hours", str(t, "classroomHoursPerYear")),
          fact("Registration fee", str(t, "initialFee")),
          fact("Renewal", str(t, "renewal")),
          fact("Path to certification", str(t, "pathToCertification")),
        ]),
        forms: forms
          ? Object.entries(forms)
              .filter(([, u]) => isHttpUrl(u))
              .map(([k, u]) => ({ label: formLabels[k] ?? humanize(k), url: u as string }))
          : [],
        sources: urls(t),
        verifiedOn: str(t, "verifiedOn"),
      }
    : null;

  // Fees
  const fe = obj(f, "fees");
  const fees = fe
    ? {
        currency: str(fe, "currency") ?? "USD",
        notes: str(fe, "notes"),
        rows: Object.entries(fe)
          .filter(([, v]) => typeof v === "number" && Number.isFinite(v))
          .map(([k, v]) => {
            const meta = FEE_LABELS[k];
            return {
              key: k,
              label: meta?.label ?? humanize(k),
              amount: v as number,
              flag: meta?.hint && mentionedAsUnverified(meta.hint) ? ("unverified" as const) : null,
            };
          }),
        facts: [],
        sources: urls(fe),
        verifiedOn: str(fe, "verifiedOn"),
      }
    : null;

  // Exam
  const e = obj(f, "exam");
  const firstTime = num(e, "firstTimePassRate2023");
  const repeat = num(e, "repeatPassRate2023");
  const passRates =
    firstTime !== null || repeat !== null
      ? [firstTime !== null ? `first-time ${firstTime}%` : null, repeat !== null ? `repeat ${repeat}%` : null].filter(Boolean).join(", ") +
        " (2023)" +
        (str(e, "passRateNote") ? `. ${str(e, "passRateNote")}` : "")
      : str(e, "passRateNote");
  const exam = e
    ? {
        facts: compact([
          fact(
            "Exam provider",
            str(e, "provider") ? `${str(e, "provider")}${str(e, "providerChangeEffective") ? ` (change effective ${str(e, "providerChangeEffective")})` : ""}` : null,
          ),
          fact("Questions", num(e, "questions") !== null ? String(num(e, "questions")) : null),
          fact("Format", str(e, "format")),
          fact("Passing score", str(e, "passingScore"), flagFor(str(e, "passingScore"), e.passingScoreVerified)),
          fact("Time limit", str(e, "timeLimit")),
          fact("Eligibility window", str(e, "eligibilityWindow")),
          fact("Retest", str(e, "retest")),
          fact("Pass rates", passRates),
        ]),
        sources: urls(e),
        verifiedOn: str(e, "verifiedOn"),
      }
    : null;

  // Renewal
  const r = obj(f, "renewal");
  const renewal = r
    ? {
        facts: compact([
          fact("Renewal period", str(r, "period")),
          fact("Continuing education", str(r, "continuingEducation")),
          fact("Work requirement", str(r, "workRequirement")),
          fact("Renewal fee", num(r, "fee") !== null ? `$${num(r, "fee")}` : null),
          fact("Timing", str(r, "timing")),
          fact("Lapsed certification", str(r, "lapsed")),
        ]),
        sources: urls(r),
        verifiedOn: str(r, "verifiedOn"),
      }
    : null;

  // The law
  const l = obj(f, "law");
  const p = obj(l, "pendingLegislation");
  const law = l
    ? {
        facts: compact([
          fact("Statute", str(l, "statute")),
          fact("History", str(l, "history")),
          fact("What it requires", str(l, "summary")),
          fact("Who must be certified", str(l, "whoMustBeCertified")),
        ]),
        exemptions: strings(l, "exemptions"),
        pending:
          p && str(p, "bill")
            ? {
                bill: str(p, "bill")!,
                title: str(p, "title"),
                summary: str(p, "summary"),
                status: str(p, "status"),
                statusNote: str(p, "statusNote"),
                sourceUrl: isHttpUrl(p.sourceUrl) ? p.sourceUrl : null,
                flag: flagFor(str(p, "status")),
              }
            : null,
        sources: urls(l),
        verifiedOn: str(l, "verifiedOn"),
      }
    : null;

  // CSLB C-10
  const c = obj(f, "contractorLicense");
  const cFees = obj(c, "fees");
  const contractorFeeLabels: Record<string, string> = {
    originalApplicationFee: "Application fee",
    initialLicenseFee: "Initial license fee",
    renewal: "Renewal",
    fingerprinting: "Fingerprinting",
    examFees: "Exam fees",
  };
  const contractor = c
    ? {
        name: str(c, "name"),
        facts: compact([fact("Issued by", str(c, "issuedBy")), fact("Scope", str(c, "definition"))]),
        requirements: strings(c, "requirements"),
        feeFacts: cFees
          ? compact(
              Object.entries(cFees).map(([k, v]) =>
                typeof v === "string" && v.trim()
                  ? { label: contractorFeeLabels[k] ?? humanize(k), value: v.trim(), flag: /not retrieved/i.test(v) ? ("unverified" as const) : flagFor(v) }
                  : null,
              ),
            )
          : [],
        bond: str(c, "bond"),
        sources: urls(c),
        verifiedOn: str(c, "verifiedOn"),
      }
    : null;

  const d = obj(c, "distinction");
  const distinction = d
    ? {
        apprenticeship: str(d, "apprenticeshipCompletion"),
        certification: str(d, "dirCertification"),
        license: str(d, "c10License"),
        summary: str(d, "summary"),
      }
    : null;

  return {
    verifiedOn: str(f, "verifiedOn"),
    verificationMethod: str(f, "verificationMethod"),
    programName: str(f, "programName"),
    administeredBy: str(f, "administeredBy"),
    mainUrl: isHttpUrl(f.mainUrl) ? f.mainUrl : null,
    classifications,
    trainee,
    fees,
    exam,
    renewal,
    law,
    contractor,
    distinction,
    unverifiedItems,
    errors,
  };
}

function readJsonFile(file: string, errors: string[]): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    errors.push(`${path.basename(file)} could not be read (${err instanceof Error ? err.message : String(err)}).`);
    return null;
  }
}

/** Read the seed files fresh on every call (they are small and may be corrected at any time). */
export function loadRoadmap(seedDir = process.env.ACADEMY_SEED_DIR || path.join(process.cwd(), "data", "seed")): RoadmapData {
  const errors: string[] = [];
  const facts = readJsonFile(path.join(seedDir, "certification_facts.json"), errors);
  const requirements = readJsonFile(path.join(seedDir, "certification_requirements.json"), errors);
  return buildRoadmap(facts, requirements, errors);
}
