/**
 * Pure match scoring for the ingestion engine and the duplicate scanner.
 *
 * A score answers "is this evidence (or this other record) about the same position as that
 * application?" on a 0..1 scale calibrated against INGEST_THRESHOLDS:
 *   ≥ MATCH_SURE (0.9)      same position; safe to apply automatically (with a margin over the runner-up)
 *   ≥ MATCH_POSSIBLE (0.65) maybe the same position; ask the user
 *   below                   different position
 *
 * Deterministic signals come first (explicit choice, requisition + company, identical posting URL,
 * a linked email thread, a source link with the same URL). Otherwise a fuzzy score is built from
 * company similarity (≥ 0.85 required), title similarity, location agreement and date proximity,
 * with penalties for conflicting requisition ids or different postings on the same site.
 *
 * No I/O: safe for client components and unit tests.
 */
import type { ApplicationSource } from "@/generated/prisma/enums";
import {
  normalizeCompany,
  normalizeTitle,
  normalizeUrl,
  similarity,
} from "@/lib/applications/normalize";
import { INGEST_THRESHOLDS } from "./types";

/** What the scorer compares: an observation, a capture, or an existing application. */
export type MatchSubject = {
  /** `normalizeCompany()` output. */
  normalizedCompany: string | null;
  /** `normalizeTitle()` output. */
  normalizedTitle: string | null;
  location: string | null;
  requisition: string | null;
  /** `normalizeUrl()` output. */
  normalizedUrl: string | null;
  platform: ApplicationSource | null;
  /** When the evidence was observed, or when the application was applied to / created. */
  date: Date | null;
};

/** Facts the caller established with a query (they cannot be derived from two subjects). */
export type MatchContext = {
  /** The user (or producer on the user's behalf) explicitly picked this application. */
  explicit?: boolean;
  /** Another message in the same email thread is already linked to this application. */
  threadLinked?: boolean;
  /** One of the application's source links has the same normalized URL. */
  sourceLinkMatch?: boolean;
};

export type MatchSignalKey =
  | "explicit"
  | "requisition"
  | "url"
  | "thread"
  | "source_link"
  | "company"
  | "title"
  | "location"
  | "date"
  | "requisition_conflict"
  | "url_conflict";

export type MatchSignalEffect = "strong" | "positive" | "neutral" | "negative";

export type MatchSignal = { key: MatchSignalKey; label: string; effect: MatchSignalEffect };

export type MatchScore = {
  score: number;
  signals: MatchSignal[];
  /** True when a deterministic signal (not fuzzy similarity) decided the score. */
  deterministic: boolean;
};

export const DETERMINISTIC_SCORES = {
  EXPLICIT: 1,
  REQUISITION_SAME_COMPANY: 1,
  REQUISITION_SIMILAR_COMPANY: 0.96,
  URL: 0.98,
  THREAD: 0.97,
  SOURCE_LINK: 0.97,
} as const;

/** Fuzzy matching requires at least this company similarity. */
export const COMPANY_MIN_SIMILARITY = 0.85;
/** Fuzzy scores never reach the deterministic band. */
export const FUZZY_CAP = 0.96;
/** A sure match must beat the runner-up by at least this much. */
export const MATCH_MARGIN = 0.1;

const FUZZY = {
  BASE: 0.3,
  COMPANY_WEIGHT: 0.2,
  TITLE_WEIGHT: 0.45,
  /** Title term when one side has no title (never enough for a sure match on its own). */
  TITLE_UNKNOWN: 0.18,
  LOCATION_SAME: 0.03,
  LOCATION_DIFFERENT: -0.25,
  DATE_CLOSE: 0.02,
  DATE_FAR: -0.07,
  DATE_VERY_FAR: -0.15,
  REQUISITION_CONFLICT: -0.35,
  URL_CONFLICT: -0.1,
} as const;

const DAY_MS = 86_400_000;

// ---------------------------------------------------------------------------
// Field comparisons
// ---------------------------------------------------------------------------

/** Requisition ids compared without case or punctuation ("R-2026-01844" = "r202601844"). */
export function normalizeRequisition(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s.length >= 3 ? s : null;
}

/**
 * Similarity of two normalized company names (0..1). Equal names score 1; otherwise bigram Dice,
 * raised to 0.88 when the shorter name (≥ 2 words) is a leading part of the longer one
 * ("southland electrical" / "southland electrical jatc"), which is close but never "sure" alone.
 */
export function companySimilarity(a: string | null | undefined, b: string | null | undefined): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  let s = similarity(a, b);
  const at = a.split(" ").filter(Boolean);
  const bt = b.split(" ").filter(Boolean);
  const [short, long] = at.length <= bt.length ? [at, bt] : [bt, at];
  if (short.length >= 2 && short.every((t, i) => long[i] === t)) s = Math.max(s, 0.88);
  return Math.min(1, s);
}

const LEVEL_TOKEN = /^(i|ii|iii|iv|v|1|2|3|4|5)$/;

function levelOf(title: string): string | null {
  const tokens = title.split(" ").filter(Boolean);
  const last = tokens[tokens.length - 1];
  return last && tokens.length > 1 && LEVEL_TOKEN.test(last) ? last : null;
}

const sortedTokens = (s: string) => s.split(" ").filter(Boolean).sort().join(" ");

/**
 * Similarity of two normalized titles (0..1), insensitive to word order. Different explicit levels
 * ("electrician i" vs "electrician ii") are different jobs and score at most 0.6.
 */
export function titleSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  let s = Math.max(similarity(a, b), sortedTokens(a) === sortedTokens(b) ? 0.97 : similarity(sortedTokens(a), sortedTokens(b)));
  const la = levelOf(a);
  const lb = levelOf(b);
  if (la && lb && la !== lb) s = Math.min(s, 0.6);
  return Math.min(1, s);
}

const STATE_WORDS =
  /\b(ca|calif|california|usa|us|united states|nv|nevada|az|arizona|or|oregon|wa|washington|tx|texas|ny|new york)\b/g;

/** City-level key for a free-text location ("Anaheim, CA 92801" → "anaheim"); null when unusable. */
export function locationKey(loc: string | null | undefined): string | null {
  if (!loc) return null;
  const cleaned = loc
    .toLowerCase()
    .replace(/\b\d{5}(?:-\d{4})?\b/g, " ")
    .replace(/\b(hybrid|on-?site|in-?person|remote|work from home|wfh|anywhere)\b/g, " ");
  const segment = cleaned
    .split(/,|\||\s[-–—]\s|\(|\)|\//)
    .map((s) => s.replace(STATE_WORDS, " ").replace(/[^a-z]/g, ""))
    .find((s) => s.length >= 3);
  return segment ?? null;
}

export type LocationAgreement = "same" | "different" | "unknown";

export function locationAgreement(a: string | null | undefined, b: string | null | undefined): LocationAgreement {
  const ka = locationKey(a);
  const kb = locationKey(b);
  if (!ka || !kb) return "unknown";
  return ka === kb || ka.includes(kb) || kb.includes(ka) ? "same" : "different";
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const short = (s: string, max = 40) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/** Score how likely `a` and `b` describe the same position. Symmetric except for labels. */
export function scoreMatch(a: MatchSubject, b: MatchSubject, ctx: MatchContext = {}): MatchScore {
  const signals: MatchSignal[] = [];
  let det = 0;
  const push = (key: MatchSignalKey, label: string, effect: MatchSignalEffect) =>
    signals.push({ key, label, effect });

  const compSim = companySimilarity(a.normalizedCompany, b.normalizedCompany);
  const reqA = normalizeRequisition(a.requisition);
  const reqB = normalizeRequisition(b.requisition);
  const reqEqual = Boolean(reqA && reqB && reqA === reqB);
  const reqConflict = Boolean(reqA && reqB && reqA !== reqB);
  const urlEqual = Boolean(a.normalizedUrl && b.normalizedUrl && a.normalizedUrl === b.normalizedUrl);
  const hostA = a.normalizedUrl ? hostOf(a.normalizedUrl) : null;
  const urlConflict = Boolean(
    a.normalizedUrl && b.normalizedUrl && !urlEqual && hostA && hostA === hostOf(b.normalizedUrl),
  );

  if (ctx.explicit) {
    det = Math.max(det, DETERMINISTIC_SCORES.EXPLICIT);
    push("explicit", "Chosen by you", "strong");
  }
  if (reqEqual && compSim === 1) {
    det = Math.max(det, DETERMINISTIC_SCORES.REQUISITION_SAME_COMPANY);
    push("requisition", `Same requisition ${short(a.requisition ?? "", 30)}`, "strong");
  } else if (reqEqual && compSim >= COMPANY_MIN_SIMILARITY) {
    det = Math.max(det, DETERMINISTIC_SCORES.REQUISITION_SIMILAR_COMPANY);
    push("requisition", `Same requisition ${short(a.requisition ?? "", 30)} at a similar company name`, "strong");
  }
  if (urlEqual) {
    det = Math.max(det, DETERMINISTIC_SCORES.URL);
    push("url", "Same posting link", "strong");
  }
  if (ctx.threadLinked) {
    det = Math.max(det, DETERMINISTIC_SCORES.THREAD);
    push("thread", "Same email thread as a message already linked to this record", "strong");
  }
  if (ctx.sourceLinkMatch && !urlEqual) {
    det = Math.max(det, DETERMINISTIC_SCORES.SOURCE_LINK);
    push("source_link", "Posting link already saved on this record", "strong");
  }

  let fuzzy = 0;
  if (a.normalizedCompany && b.normalizedCompany) {
    if (compSim >= COMPANY_MIN_SIMILARITY) {
      push("company", compSim === 1 ? "Same company" : `Company name ${pct(compSim)} similar`, "positive");
      const c = (compSim - COMPANY_MIN_SIMILARITY) / (1 - COMPANY_MIN_SIMILARITY);
      let titleTerm: number;
      if (a.normalizedTitle && b.normalizedTitle) {
        const ts = titleSimilarity(a.normalizedTitle, b.normalizedTitle);
        titleTerm = FUZZY.TITLE_WEIGHT * ts * ts;
        push(
          "title",
          ts === 1 ? "Same job title" : `Job title ${pct(ts)} similar`,
          ts >= 0.9 ? "positive" : ts >= 0.7 ? "neutral" : "negative",
        );
      } else {
        titleTerm = FUZZY.TITLE_UNKNOWN;
        push("title", "Job title missing on one side", "neutral");
      }
      let s = FUZZY.BASE + FUZZY.COMPANY_WEIGHT * c + titleTerm;

      const loc = locationAgreement(a.location, b.location);
      if (loc === "same") {
        s += FUZZY.LOCATION_SAME;
        push("location", "Same location", "positive");
      } else if (loc === "different") {
        s += FUZZY.LOCATION_DIFFERENT;
        push("location", `Different location (${short(a.location ?? "", 24)} vs ${short(b.location ?? "", 24)})`, "negative");
      }

      if (a.date && b.date) {
        const days = Math.round(Math.abs(a.date.getTime() - b.date.getTime()) / DAY_MS);
        if (days <= 21) {
          s += FUZZY.DATE_CLOSE;
          push("date", days === 0 ? "Same day" : `${days} day${days === 1 ? "" : "s"} apart`, "positive");
        } else if (days > 365) {
          s += FUZZY.DATE_VERY_FAR;
          push("date", `${days} days apart`, "negative");
        } else if (days > 180) {
          s += FUZZY.DATE_FAR;
          push("date", `${days} days apart`, "negative");
        }
      }
      if (reqConflict) s += FUZZY.REQUISITION_CONFLICT;
      if (urlConflict) s += FUZZY.URL_CONFLICT;
      fuzzy = Math.min(FUZZY_CAP, clamp01(s));
    } else {
      push("company", `Different company (${pct(compSim)} similar)`, "negative");
    }
  }
  if (reqConflict) {
    push("requisition_conflict", `Different requisitions (${short(a.requisition ?? "", 20)} vs ${short(b.requisition ?? "", 20)})`, "negative");
  }
  if (urlConflict) push("url_conflict", "Different postings on the same site", "negative");

  const score = round3(Math.max(det, fuzzy));
  return { score, signals, deterministic: det > 0 && det >= fuzzy };
}

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------

export type ApplicationLike = {
  normalizedCompany: string;
  normalizedTitle: string;
  location: string | null;
  requisitionNumber: string | null;
  normalizedUrl: string | null;
  source: ApplicationSource;
  appliedAt: Date | null;
  createdAt: Date;
};

export function subjectFromApplication(app: ApplicationLike): MatchSubject {
  return {
    normalizedCompany: app.normalizedCompany || null,
    normalizedTitle: app.normalizedTitle || null,
    location: app.location,
    requisition: app.requisitionNumber,
    normalizedUrl: app.normalizedUrl,
    platform: app.source,
    date: app.appliedAt ?? app.createdAt,
  };
}

export type PartialFields = {
  company?: string | null;
  title?: string | null;
  location?: string | null;
  requisitionId?: string | null;
  postingUrl?: string | null;
  platform?: ApplicationSource | null;
  observedAt?: Date | null;
};

/** Normalize raw observation/capture fields into a subject. */
export function subjectFromPartial(p: PartialFields): MatchSubject {
  const company = p.company?.trim();
  const title = p.title?.trim();
  return {
    normalizedCompany: company ? normalizeCompany(company) : null,
    normalizedTitle: title ? normalizeTitle(title) || null : null,
    location: p.location?.trim() || null,
    requisition: p.requisitionId?.trim() || null,
    normalizedUrl: normalizeUrl(p.postingUrl ?? null),
    platform: p.platform ?? null,
    date: p.observedAt ?? null,
  };
}

// ---------------------------------------------------------------------------
// Decision
// ---------------------------------------------------------------------------

export type ScoredCandidate = { applicationId: string; score: number };

export type MatchDecision =
  | { outcome: "match"; applicationId: string; score: number; candidateIds: string[] }
  | { outcome: "review"; candidateIds: string[]; topScore: number }
  | { outcome: "none"; candidateIds: string[] };

/**
 * Turn scored candidates into a decision: a sure top candidate that beats the runner-up by
 * MATCH_MARGIN is a match; anything else at or above MATCH_POSSIBLE needs the user's review.
 */
export function decideMatch(
  candidates: ReadonlyArray<ScoredCandidate>,
  t: { sure: number; possible: number; margin: number } = {
    sure: INGEST_THRESHOLDS.MATCH_SURE,
    possible: INGEST_THRESHOLDS.MATCH_POSSIBLE,
    margin: MATCH_MARGIN,
  },
): MatchDecision {
  const sorted = [...candidates].sort((x, y) => y.score - x.score);
  const top = sorted[0];
  const plausible = sorted.filter((c) => c.score >= t.possible).map((c) => c.applicationId).slice(0, 5);
  if (!top || top.score < t.possible) return { outcome: "none", candidateIds: [] };
  const runnerUp = sorted[1]?.score ?? 0;
  if (top.score >= t.sure && round3(top.score - runnerUp) >= t.margin) {
    return { outcome: "match", applicationId: top.applicationId, score: top.score, candidateIds: plausible };
  }
  return { outcome: "review", candidateIds: plausible, topScore: top.score };
}
