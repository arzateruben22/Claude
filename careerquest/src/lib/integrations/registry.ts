/**
 * Integration registry: one entry per provider with an honest description of how applications from
 * that provider reach CareerQuest, and what the provider's adapter can actually do.
 *
 * Pure data + pure functions (no DB, no env access) so it can be imported by client components,
 * server code and tests alike. Callers pass the environment / connection facts into
 * `computeStatus`, which returns exactly one display status plus the reason for it.
 *
 * Ground truth this file encodes:
 * - Gmail / Outlook: OAuth read-only mail access. "Available" only when the OAuth client is
 *   configured on this server; "Connected" only with a real CONNECTED connection.
 * - No job board or ATS offers an authorized, applicant-facing API for a person's own application
 *   history. Their applications reach CareerQuest through confirmation emails, the Chrome extension,
 *   file exports (LinkedIn's data export) and manual entry → "Manual-only".
 * - Greenhouse and Lever publish public job-board APIs for postings only → "Experimental" job-details
 *   lookups (never live-verified from the build environment).
 * - Chrome extension: "Connected" when a non-revoked developer token was used in the last 30 days.
 */
import type { ApplicationSource, IntegrationProvider, IntegrationStatus } from "@/generated/prisma/enums";

/** Every provider shown on /integrations. UNION_PORTALS has no schema enum value (no connection rows). */
export type IntegrationKey = IntegrationProvider | "UNION_PORTALS";

export type CapabilityLevel = "supported" | "experimental" | "unsupported";

export const CAPABILITY_NAMES = [
  "importApplications",
  "getJobDetails",
  "syncStatuses",
  "matchRecords",
  "reportErrors",
] as const;
export type CapabilityName = (typeof CAPABILITY_NAMES)[number];
export type CapabilityMatrix = Record<CapabilityName, CapabilityLevel>;

export const CAPABILITY_LABELS: Record<CapabilityName, string> = {
  importApplications: "Import applications",
  getJobDetails: "Job details",
  syncStatuses: "Status updates",
  matchRecords: "Match records",
  reportErrors: "Error reporting",
};

export const CAPABILITY_DESCRIPTIONS: Record<CapabilityName, string> = {
  importApplications: "Pulls your application history into the tracker automatically.",
  getJobDetails: "Looks up a posting's title, company and location from its URL.",
  syncStatuses: "Picks up later stages (interview, rejection, offer) automatically.",
  matchRecords: "Recognizes this platform's links and mail so captures attach to the right record.",
  reportErrors: "Records sync problems on the connection so you can see what failed.",
};

export const CAPABILITY_LEVEL_LABELS: Record<CapabilityLevel, string> = {
  supported: "Supported",
  experimental: "Experimental",
  unsupported: "Not available",
};

export type IntegrationCategory = "email" | "browser" | "job_board" | "ats" | "government" | "union";

export const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  email: "Email",
  browser: "Browser",
  job_board: "Job boards",
  ats: "Applicant tracking systems",
  government: "Government",
  union: "Unions & apprenticeships",
};

export const CATEGORY_ORDER: IntegrationCategory[] = ["email", "browser", "job_board", "ats", "government", "union"];

export type ConnectMethod = "oauth_google" | "oauth_microsoft" | "extension" | null;

export type ProviderEntry = {
  key: IntegrationKey;
  name: string;
  category: IntegrationCategory;
  description: string;
  /** How applications from this provider actually get captured, in order of usefulness. */
  capture: string[];
  capabilities: CapabilityMatrix;
  connect: ConnectMethod;
  /** Platform value used on application records (null for email / browser). */
  platform: ApplicationSource | null;
  /** Honest note about verification status; shown on the card when present. */
  verificationNote: string | null;
  /** Where to go to bring this provider's applications in by hand. */
  importLinks: { label: string; href: string }[];
};

const NONE: CapabilityMatrix = {
  importApplications: "unsupported",
  getJobDetails: "unsupported",
  syncStatuses: "unsupported",
  matchRecords: "unsupported",
  reportErrors: "unsupported",
};

const EMAIL_SYNC: CapabilityMatrix = {
  importApplications: "supported",
  getJobDetails: "unsupported",
  syncStatuses: "supported",
  matchRecords: "supported",
  reportErrors: "supported",
};

/** Boards whose posting URLs normalizeUrl() reduces to a stable job id. */
const BOARD_WITH_URL_IDS: CapabilityMatrix = { ...NONE, matchRecords: "supported" };
/** Platforms matched only by generic URL normalization and sender-domain recognition. */
const GENERIC_MATCH: CapabilityMatrix = { ...NONE, matchRecords: "experimental" };
const PUBLIC_POSTINGS_API: CapabilityMatrix = {
  ...NONE,
  getJobDetails: "experimental",
  matchRecords: "supported",
  reportErrors: "experimental",
};

const EMAIL_CAPTURE = "Confirmation and status emails (Gmail/Outlook sync, or .eml/.mbox file import)";
const EXTENSION_CAPTURE = "Chrome extension on the job page — you confirm before anything is saved";
const MANUAL_CAPTURE = "Manual entry in the tracker";
const URL_CAPTURE = "Paste posting links on the Job URLs import tab";

const EMAIL_IMPORT_LINK = { label: "Import email files", href: "/applications/import" };
const URL_IMPORT_LINK = { label: "Import job URLs", href: "/applications/import/urls" };
const NEW_APPLICATION_LINK = { label: "Add manually", href: "/applications/new" };
const MANUAL_LINKS = [EMAIL_IMPORT_LINK, NEW_APPLICATION_LINK];

const NOT_LIVE_VERIFIED_EMAIL =
  "Built against the provider's documented API and tested with simulated responses; it has not been verified against a live account from the build environment.";

export const PROVIDERS: readonly ProviderEntry[] = [
  {
    key: "GMAIL",
    name: "Gmail",
    category: "email",
    description:
      "Read-only access to job-related mail. Confirmations, interview invitations, rejections and offers update your tracker; job alerts and unfinished applications never count as submissions.",
    capture: [
      "Read-only sync of job-related email (known job-board and ATS senders, or subjects about applications, interviews, offers and assessments)",
      "Or upload .eml/.mbox files without connecting",
    ],
    capabilities: EMAIL_SYNC,
    connect: "oauth_google",
    platform: null,
    verificationNote: NOT_LIVE_VERIFIED_EMAIL,
    importLinks: [EMAIL_IMPORT_LINK],
  },
  {
    key: "OUTLOOK",
    name: "Outlook",
    category: "email",
    description:
      "Read-only access to Outlook.com or Microsoft 365 mail through Microsoft Graph. Only job-related messages are processed and stored.",
    capture: [
      "Read-only sync of job-related email through Microsoft Graph",
      "Or upload .eml/.mbox files without connecting",
    ],
    capabilities: EMAIL_SYNC,
    connect: "oauth_microsoft",
    platform: null,
    verificationNote: NOT_LIVE_VERIFIED_EMAIL,
    importLinks: [EMAIL_IMPORT_LINK],
  },
  {
    key: "CHROME_EXTENSION",
    name: "Chrome extension",
    category: "browser",
    description:
      "Saves postings and records submissions on the job sites you already use. It only records an application after you confirm it.",
    capture: [
      "Save a posting from its page",
      "Detects application confirmation pages and asks you to confirm",
      "Captures are matched to existing records or queued for your review",
    ],
    capabilities: {
      importApplications: "supported",
      getJobDetails: "supported",
      syncStatuses: "unsupported",
      matchRecords: "supported",
      reportErrors: "unsupported",
    },
    connect: "extension",
    platform: null,
    verificationNote:
      "Page readers follow each site's current layout; when a site changes, captures fall back to asking you for the details.",
    importLinks: [],
  },
  {
    key: "INDEED",
    name: "Indeed",
    category: "job_board",
    description: "Indeed has no API for a job seeker's own application history.",
    capture: [EMAIL_CAPTURE, EXTENSION_CAPTURE, URL_CAPTURE, MANUAL_CAPTURE],
    capabilities: BOARD_WITH_URL_IDS,
    connect: null,
    platform: "INDEED",
    verificationNote: null,
    importLinks: [...MANUAL_LINKS, URL_IMPORT_LINK],
  },
  {
    key: "LINKEDIN",
    name: "LinkedIn",
    category: "job_board",
    description:
      "LinkedIn offers no applicant API, but its account data export includes a Job Applications.csv you can import.",
    capture: [
      "Data export: Job Applications.csv (Platform exports tab)",
      EMAIL_CAPTURE,
      EXTENSION_CAPTURE,
      MANUAL_CAPTURE,
    ],
    capabilities: BOARD_WITH_URL_IDS,
    connect: null,
    platform: "LINKEDIN",
    verificationNote: null,
    importLinks: [{ label: "Import LinkedIn export", href: "/applications/import/exports" }, ...MANUAL_LINKS],
  },
  {
    key: "GLASSDOOR",
    name: "Glassdoor",
    category: "job_board",
    description: "Glassdoor has no API for a job seeker's own application history.",
    capture: [EMAIL_CAPTURE, EXTENSION_CAPTURE, URL_CAPTURE, MANUAL_CAPTURE],
    capabilities: BOARD_WITH_URL_IDS,
    connect: null,
    platform: "GLASSDOOR",
    verificationNote: null,
    importLinks: MANUAL_LINKS,
  },
  {
    key: "ZIPRECRUITER",
    name: "ZipRecruiter",
    category: "job_board",
    description: "ZipRecruiter has no API for a job seeker's own application history.",
    capture: [EMAIL_CAPTURE, EXTENSION_CAPTURE, URL_CAPTURE, MANUAL_CAPTURE],
    capabilities: BOARD_WITH_URL_IDS,
    connect: null,
    platform: "ZIPRECRUITER",
    verificationNote: null,
    importLinks: MANUAL_LINKS,
  },
  {
    key: "WORKDAY",
    name: "Workday",
    category: "ats",
    description:
      "Each employer runs its own Workday site with a separate candidate account; there is no candidate-facing API across employers.",
    capture: [EMAIL_CAPTURE, EXTENSION_CAPTURE, URL_CAPTURE, MANUAL_CAPTURE],
    capabilities: BOARD_WITH_URL_IDS,
    connect: null,
    platform: "WORKDAY",
    verificationNote: null,
    importLinks: MANUAL_LINKS,
  },
  {
    key: "GREENHOUSE",
    name: "Greenhouse",
    category: "ats",
    description:
      "Greenhouse's public job-board API exposes postings only. CareerQuest can look up a posting's details from its URL; your applications still come from confirmation emails.",
    capture: [EMAIL_CAPTURE, EXTENSION_CAPTURE, URL_CAPTURE, MANUAL_CAPTURE],
    capabilities: PUBLIC_POSTINGS_API,
    connect: null,
    platform: "GREENHOUSE",
    verificationNote:
      "Job-details lookups use boards-api.greenhouse.io and were tested with simulated responses only; they have not been verified live.",
    importLinks: MANUAL_LINKS,
  },
  {
    key: "LEVER",
    name: "Lever",
    category: "ats",
    description:
      "Lever's public postings API exposes postings only. CareerQuest can look up a posting's details from its URL; your applications still come from confirmation emails.",
    capture: [EMAIL_CAPTURE, EXTENSION_CAPTURE, URL_CAPTURE, MANUAL_CAPTURE],
    capabilities: PUBLIC_POSTINGS_API,
    connect: null,
    platform: "LEVER",
    verificationNote:
      "Job-details lookups use api.lever.co and were tested with simulated responses only; they have not been verified live.",
    importLinks: MANUAL_LINKS,
  },
  {
    key: "SMARTRECRUITERS",
    name: "SmartRecruiters",
    category: "ats",
    description: "No applicant-facing API for your own applications.",
    capture: [EMAIL_CAPTURE, EXTENSION_CAPTURE, MANUAL_CAPTURE],
    capabilities: GENERIC_MATCH,
    connect: null,
    platform: "SMARTRECRUITERS",
    verificationNote: null,
    importLinks: MANUAL_LINKS,
  },
  {
    key: "ICIMS",
    name: "iCIMS",
    category: "ats",
    description: "Each employer runs its own iCIMS portal; there is no applicant-facing API across employers.",
    capture: [EMAIL_CAPTURE, EXTENSION_CAPTURE, MANUAL_CAPTURE],
    capabilities: GENERIC_MATCH,
    connect: null,
    platform: "ICIMS",
    verificationNote: null,
    importLinks: MANUAL_LINKS,
  },
  {
    key: "ADP",
    name: "ADP",
    category: "ats",
    description:
      "ADP recruiting sites have no applicant-facing API. ADP payroll and HR mail is deliberately not read by the email sync.",
    capture: [EMAIL_CAPTURE, EXTENSION_CAPTURE, MANUAL_CAPTURE],
    capabilities: GENERIC_MATCH,
    connect: null,
    platform: "ADP",
    verificationNote: null,
    importLinks: MANUAL_LINKS,
  },
  {
    key: "GOVERNMENTJOBS",
    name: "GovernmentJobs",
    category: "government",
    description: "GovernmentJobs (NEOGOV) has no API for an applicant's own applications.",
    capture: [EMAIL_CAPTURE, EXTENSION_CAPTURE, MANUAL_CAPTURE],
    capabilities: GENERIC_MATCH,
    connect: null,
    platform: "GOVERNMENTJOBS",
    verificationNote: null,
    importLinks: MANUAL_LINKS,
  },
  {
    key: "USAJOBS",
    name: "USAJOBS",
    category: "government",
    description:
      "USAJOBS' public API covers job announcements, not your applications. Application status lives in your USAJOBS account.",
    capture: [EMAIL_CAPTURE, EXTENSION_CAPTURE, MANUAL_CAPTURE],
    capabilities: GENERIC_MATCH,
    connect: null,
    platform: "USAJOBS",
    verificationNote: null,
    importLinks: MANUAL_LINKS,
  },
  {
    key: "UNION_PORTALS",
    name: "Union & JATC portals",
    category: "union",
    description:
      "IBEW locals, JATCs and other apprenticeship offices run their own portals and paper processes; none offers an API.",
    capture: [EMAIL_CAPTURE, MANUAL_CAPTURE],
    capabilities: GENERIC_MATCH,
    connect: null,
    platform: "UNION_PORTAL",
    verificationNote: null,
    importLinks: MANUAL_LINKS,
  },
];

export const INTEGRATION_KEYS: readonly IntegrationKey[] = PROVIDERS.map((p) => p.key);

const BY_KEY = new Map<string, ProviderEntry>(PROVIDERS.map((p) => [p.key, p]));

export function getProvider(key: string): ProviderEntry | null {
  return BY_KEY.get(key) ?? null;
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export type DisplayStatus = "Connected" | "Available" | "Experimental" | "Manual-only" | "Unsupported";
export const DISPLAY_STATUSES: readonly DisplayStatus[] = ["Connected", "Available", "Experimental", "Manual-only", "Unsupported"];

/** The environment variables that decide whether OAuth providers can be offered. */
export type IntegrationEnv = {
  GOOGLE_CLIENT_ID?: string | null;
  GOOGLE_CLIENT_SECRET?: string | null;
  MICROSOFT_CLIENT_ID?: string | null;
  MICROSOFT_CLIENT_SECRET?: string | null;
  MICROSOFT_TENANT?: string | null;
  APP_URL?: string | null;
};

export type ConnectionSnapshot = {
  status: IntegrationStatus;
  accountEmail: string | null;
  lastError?: string | null;
};

export type StatusInput = {
  env: IntegrationEnv;
  /** The provider's most relevant connection (see pickPrimaryConnection), or null. */
  connection: ConnectionSnapshot | null;
  /** Most recent use of a non-revoked, unexpired developer token (Chrome extension only). */
  extensionTokenUsage: { lastUsedAt: Date | null } | null;
  now?: Date;
};

export type StatusResult = { status: DisplayStatus; reason: string };

export const EXTENSION_ACTIVE_DAYS = 30;
const DAY_MS = 86_400_000;

const filled = (v: string | null | undefined) => typeof v === "string" && v.trim().length > 0;

export type OAuthKey = "GMAIL" | "OUTLOOK";

/** Why an OAuth provider cannot be offered, or null when it is fully configured. */
export function oauthConfigProblem(provider: OAuthKey, env: IntegrationEnv): string | null {
  const [id, secret] =
    provider === "GMAIL"
      ? [env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET]
      : [env.MICROSOFT_CLIENT_ID, env.MICROSOFT_CLIENT_SECRET];
  if (!filled(id) || !filled(secret)) return "OAuth client not configured — import .eml/.mbox files instead";
  if (!filled(env.APP_URL)) return "APP_URL is not set, so no OAuth redirect address can be built — import .eml/.mbox files instead";
  return null;
}

export function oauthConfigured(provider: OAuthKey, env: IntegrationEnv): boolean {
  return oauthConfigProblem(provider, env) === null;
}

/** Prefer a CONNECTED connection, then one needing attention, then anything else (input order). */
export function pickPrimaryConnection<T extends { status: IntegrationStatus }>(connections: readonly T[]): T | null {
  const rank: Record<IntegrationStatus, number> = { CONNECTED: 0, NEEDS_REAUTH: 1, ERROR: 2, DISCONNECTED: 3 };
  let best: T | null = null;
  for (const c of connections) {
    if (!best || rank[c.status] < rank[best.status]) best = c;
  }
  return best;
}

function daysAgoPhrase(then: Date, now: Date): string {
  const days = Math.floor((now.getTime() - then.getTime()) / DAY_MS);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

const MANUAL_REASONS: Partial<Record<IntegrationKey, string>> = {
  INDEED: "Indeed offers no applicant API — confirmation emails, the Chrome extension and manual entry capture your applications.",
  LINKEDIN:
    "LinkedIn offers no applicant API — import its data export (Job Applications.csv), confirmation emails, or use the Chrome extension.",
  GLASSDOOR: "Glassdoor offers no applicant API — confirmation emails, the Chrome extension and manual entry capture your applications.",
  ZIPRECRUITER:
    "ZipRecruiter offers no applicant API — confirmation emails, the Chrome extension and manual entry capture your applications.",
  WORKDAY: "No cross-employer candidate API — Workday confirmation emails and the Chrome extension capture your applications.",
  SMARTRECRUITERS: "No applicant API — confirmation emails, the Chrome extension and manual entry capture your applications.",
  ICIMS: "No applicant API — iCIMS confirmation emails and the Chrome extension capture your applications.",
  ADP: "No applicant API — ADP recruiting emails and the Chrome extension capture your applications.",
  GOVERNMENTJOBS: "No applicant API — GovernmentJobs confirmation emails and manual entry capture your applications.",
  USAJOBS: "USAJOBS' API lists announcements only — confirmation emails and manual entry capture your applications.",
  UNION_PORTALS: "Union and JATC portals have no API — log steps manually; their emails are captured when they mention your application.",
};

/**
 * The single display status for a provider. Never returns "Connected" without a real CONNECTED
 * connection (or, for the extension, a developer token actually used in the last 30 days).
 */
export function computeStatus(provider: IntegrationKey | string, input: StatusInput): StatusResult {
  const entry = getProvider(provider);
  if (!entry) return { status: "Unsupported", reason: "CareerQuest has no integration for this provider." };
  const now = input.now ?? new Date();

  switch (entry.key) {
    case "GMAIL":
    case "OUTLOOK": {
      const problem = oauthConfigProblem(entry.key, input.env);
      const conn = input.connection;
      if (problem) {
        const suffix =
          conn?.status === "CONNECTED" ? " (your saved connection cannot sync until the OAuth client is configured again)" : "";
        return { status: "Manual-only", reason: problem + suffix };
      }
      if (conn?.status === "CONNECTED") {
        return { status: "Connected", reason: conn.accountEmail ? `Connected as ${conn.accountEmail}` : "Connected" };
      }
      if (conn?.status === "NEEDS_REAUTH") {
        return { status: "Available", reason: "Access expired or was revoked — reconnect to resume syncing." };
      }
      if (conn?.status === "ERROR") {
        return {
          status: "Available",
          reason: `The connection stopped working${conn.lastError ? ` (${conn.lastError})` : ""} — reconnect to resume syncing.`,
        };
      }
      return { status: "Available", reason: "Ready to connect with read-only access to job-related email." };
    }
    case "CHROME_EXTENSION": {
      const last = input.extensionTokenUsage?.lastUsedAt ?? null;
      if (last && now.getTime() - last.getTime() <= EXTENSION_ACTIVE_DAYS * DAY_MS) {
        return { status: "Connected", reason: `A developer token was used by the extension ${daysAgoPhrase(last, now)}.` };
      }
      if (input.extensionTokenUsage) {
        return {
          status: "Available",
          reason: last
            ? `No extension activity in the last ${EXTENSION_ACTIVE_DAYS} days — check the extension's settings, or create a new token in Settings → Developer tokens.`
            : "You have a developer token, but the extension has not used it yet — enter it in the extension's settings (extension/README.md).",
        };
      }
      return {
        status: "Available",
        reason: "Create a token in Settings → Developer tokens, then load the extension and enter it (see extension/README.md).",
      };
    }
    case "GREENHOUSE":
      return {
        status: "Experimental",
        reason: "The public job-board API exposes postings only: job details by URL work in tests but are not live-verified. Applications come from confirmation emails.",
      };
    case "LEVER":
      return {
        status: "Experimental",
        reason: "The public postings API exposes postings only: job details by URL work in tests but are not live-verified. Applications come from confirmation emails.",
      };
    default:
      return { status: "Manual-only", reason: MANUAL_REASONS[entry.key] ?? "No applicant API — use email capture, the extension or manual entry." };
  }
}

// ---------------------------------------------------------------------------
// OAuth consent copy (shared by the consent dialog and the notes)
// ---------------------------------------------------------------------------

export const HISTORY_DAY_OPTIONS = [30, 90, 180, 365] as const;
export type HistoryDays = (typeof HISTORY_DAY_OPTIONS)[number];
export const DEFAULT_HISTORY_DAYS: HistoryDays = 90;

export function isHistoryDays(n: unknown): n is HistoryDays {
  return typeof n === "number" && (HISTORY_DAY_OPTIONS as readonly number[]).includes(n);
}

export type ConsentCopy = {
  provider: OAuthKey;
  title: string;
  scopes: { scope: string; meaning: string }[];
  reads: string[];
  stores: string[];
  retention: string[];
  disconnect: string[];
};

export const CONSENT: Record<OAuthKey, ConsentCopy> = {
  GMAIL: {
    provider: "GMAIL",
    title: "Connect Gmail (read-only)",
    scopes: [
      { scope: "openid email", meaning: "Your Google account's email address, so the connection is labeled correctly." },
      {
        scope: "https://www.googleapis.com/auth/gmail.readonly",
        meaning:
          "Read messages. This is the narrowest Gmail permission that can read message bodies; CareerQuest cannot send, delete, label or change anything.",
      },
    ],
    reads: [
      "Only messages matching a narrow search: known job-board and applicant-tracking senders, or subjects mentioning an application, interview, offer or assessment, within the history range you pick.",
      "At most 500 messages per sync run.",
    ],
    stores: [
      "Your access and refresh tokens, encrypted (AES-256-GCM).",
      "For job-related messages only: sender, subject, date, a short masked excerpt and the details extracted from it. Messages classified as unrelated are skipped and not stored.",
      "The full text only for messages waiting in your review queue (links stripped of query strings, at most 8 KB); it is cleared once you review them.",
    ],
    retention: [
      "Email records stay until you delete them or your account. Disconnecting can also delete every email record this connection imported.",
      "Applications created from email stay in your tracker; delete them there if you want.",
    ],
    disconnect: [
      "Disconnect here at any time: CareerQuest revokes the token with Google and deletes it.",
      "You can also remove access at myaccount.google.com/permissions.",
    ],
  },
  OUTLOOK: {
    provider: "OUTLOOK",
    title: "Connect Outlook (read-only)",
    scopes: [
      { scope: "offline_access", meaning: "Keep syncing without asking you to sign in every hour (a refresh token)." },
      { scope: "Mail.Read", meaning: "Read your mail. CareerQuest cannot send, delete, move or change anything." },
      { scope: "User.Read", meaning: "Your account's email address, so the connection is labeled correctly." },
    ],
    reads: [
      "Messages received within the history range you pick, at most 500 per sync run. Only messages from known job-board and applicant-tracking senders, or with subjects about an application, interview, offer or assessment, are processed; everything else is discarded immediately.",
    ],
    stores: [
      "Your access and refresh tokens, encrypted (AES-256-GCM).",
      "For job-related messages only: sender, subject, date, a short masked excerpt and the details extracted from it.",
      "The full text only for messages waiting in your review queue (at most 8 KB); it is cleared once you review them.",
    ],
    retention: [
      "Email records stay until you delete them or your account. Disconnecting can also delete every email record this connection imported.",
      "Applications created from email stay in your tracker; delete them there if you want.",
    ],
    disconnect: [
      "Disconnect here at any time: CareerQuest deletes its tokens. Microsoft has no per-app token revocation call, so also remove the app at account.live.com/consent/Manage (personal accounts) or myapps.microsoft.com (work or school).",
    ],
  },
};
