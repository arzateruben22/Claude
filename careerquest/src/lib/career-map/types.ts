/**
 * Career Map types shared by the pure graph/status modules, the server service and the client
 * explorer. Everything here is serializable (no Dates, no functions) so it can cross the RSC
 * boundary as-is.
 */
import type { TrackKey } from "@/lib/academy/constants";

/** Mirrors the Prisma `NodeStatus` enum. */
export const CAREER_NODE_STATUSES = ["LOCKED", "AVAILABLE", "IN_PROGRESS", "COMPLETED"] as const;
export type CareerNodeStatus = (typeof CAREER_NODE_STATUSES)[number];

/** Statuses a user may set on a stop themselves ("marked by you"). */
export const MARKABLE_STATUSES = ["AVAILABLE", "IN_PROGRESS", "COMPLETED"] as const;
export type MarkableStatus = (typeof MARKABLE_STATUSES)[number];

export type BranchKey = "electrician" | "elevator" | "hvac" | "industrial" | "building" | "construction" | "plumbing";

/** start = where everyone begins; stage = a phase of the main path; credential = something an
 * organisation issues (program completion, DIR certification, CSLB license); role = a job;
 * entry = a way into a side branch. */
export type NodeKind = "start" | "stage" | "credential" | "role" | "entry";

/**
 * sourced  — copied from `data/seed/*.json` / `data/research/*` with its source URLs and check date.
 * estimate — a duration estimate; when it contains a number it is derived from sourced figures.
 * guidance — CareerQuest's own descriptive text. It never contains figures (enforced by tests).
 */
export type FactBasis = "sourced" | "estimate" | "guidance";
export type FactFlag = "unverified" | "conflict" | "partial";

export type MapFact = {
  label: string;
  value: string;
  basis: FactBasis;
  sources: string[];
  verifiedOn: string | null;
  flag: FactFlag | null;
};

export type MapLink = { label: string; href: string; external: boolean };

/** required = the step must be done first; typical = the usual order, never blocks. */
export type PrereqEdge = { from: string; kind: "required" | "typical"; satisfiedBy: "completed" | "started" };

/** Prisma DocumentKind values a document need can be matched against. */
export type DocumentKindName = "RESUME" | "CERTIFICATE" | "PAY_STUB" | "HOURS_VERIFICATION" | "TRAINEE_CARD" | "OFFER_LETTER" | "OTHER";
export type DocumentNeed = { label: string; docKind: DocumentKindName | null };

/** Case-insensitive phrase matching on "<position title> <job category>". */
export type JobMatchSpec = { include: string[]; require?: string[]; exclude?: string[] };

export type CareerNodeDef = {
  key: string;
  title: string;
  branch: BranchKey;
  kind: NodeKind;
  /** Grid position on the map (column = stage, row = lane). */
  col: number;
  row: number;
  /** Guidance text (no figures). */
  summary: string;
  /** For credentials: what it is and what it does NOT grant (sourced from the seed distinction). */
  credentialFacts: MapFact[];
  requirements: MapFact[];
  duration: MapFact | null;
  costs: MapFact[];
  documents: DocumentNeed[];
  relevantJobs: { titles: string[]; match: JobMatchSpec | null; searchQuery: string | null };
  trainingTracks: TrackKey[];
  /** Observed pay data with sources — never a promise of pay. */
  payReference: MapFact[];
  entryRoutes: string[];
  resources: MapLink[];
  prerequisites: PrereqEdge[];
  /** "any": one satisfied required prerequisite unlocks the stop (alternative routes). */
  prereqMode: "all" | "any";
  /** False for side branches: descriptions only, no researched figures. */
  sourcedFigures: boolean;
};

export type GraphEdge = { from: string; to: string; kind: "required" | "typical" };

export type BranchMeta = { key: BranchKey; label: string; description: string };

export type CareerGraph = {
  nodes: CareerNodeDef[];
  edges: GraphEdge[];
  branches: BranchMeta[];
  /** Apprenticeship completion vs DIR certification vs CSLB C-10 license. */
  distinction: MapFact[];
  /** DIR classification hours (from certification_requirements.json). */
  classifications: { code: string; name: string; hours: number | null; sources: string[]; verifiedOn: string | null }[];
  /** CSLB journey-level experience in years, parsed from the seed requirement text. */
  c10ExperienceYears: number | null;
  seed: { verifiedOn: string | null; verificationMethod: string | null; errors: string[]; unverifiedCount: number };
};

// ---------------------------------------------------------------------------
// Status (derived per user)
// ---------------------------------------------------------------------------

export type EvidenceLabel = "Verified" | "Self-reported" | "Observed" | "Estimate" | "Marked by you";
export type Evidence = { label: EvidenceLabel; text: string };

export type NodeProgress = { value: number; max: number; label: string; basis: EvidenceLabel };
export type TrainingProgress = { key: string; label: string; completed: number; total: number; href: string };
export type NodeAction = { label: string; href: string; external: boolean };

export type RelatedApplications = {
  applied: number;
  interviewing: number;
  offers: number;
  hired: number;
  examples: { title: string; company: string; status: string }[];
  href: string | null;
};

export type NodeStatusView = {
  key: string;
  /** Effective status (the user's mark when present, otherwise derived from data). */
  status: CareerNodeStatus;
  /** What the data alone says. */
  derivedStatus: CareerNodeStatus;
  override: { status: CareerNodeStatus; notes: string | null; markedAt: string } | null;
  /** e.g. "In progress because: 1,240 verified hours of 8,000". */
  reason: string;
  /** The data-derived reason (differs from `reason` when the user marked the stop). */
  derivedReason: string;
  evidence: Evidence[];
  /** Informational lines (what CareerQuest can and cannot see for this stop). */
  notes: string[];
  progress: NodeProgress | null;
  training: TrainingProgress[];
  applications: RelatedApplications;
  documentsOnFile: { label: string; onFile: boolean | null }[];
  /** A user-specific duration estimate (always labelled Estimate). */
  durationEstimate: Evidence | null;
  /** First entry is the next recommended action. */
  actions: NodeAction[];
  blockedBy: { key: string; title: string }[];
  /** The node's branch is the user's primary trade or on their interest list. */
  interest: "primary" | "interest" | null;
};

export type CareerMapNode = CareerNodeDef & { state: NodeStatusView };

export type CareerMapView = {
  nodes: CareerMapNode[];
  edges: GraphEdge[];
  branches: BranchMeta[];
  distinction: MapFact[];
  currentKey: string | null;
  focusBranch: BranchKey;
  counts: Record<CareerNodeStatus, number>;
  seed: CareerGraph["seed"];
  issues: string[];
};
