/**
 * Adapter architecture. Each provider is represented by an `IntegrationAdapter` that declares an honest
 * capability matrix (from the registry) and implements only the operations it really supports.
 * Calling an operation an adapter does not implement throws `NotSupportedError` (see `runOperation`).
 *
 * All network access goes through an injected `fetch` so every adapter can be tested with fakes and
 * nothing here ever reaches the network on import.
 */
import type { ApplicationObservation, IngestResult } from "@/lib/ingest/types";
import type { CapabilityMatrix, CapabilityName, IntegrationKey } from "../registry";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type IngestFn = (userId: string, observation: ApplicationObservation) => Promise<IngestResult>;

/** Raised when an adapter is asked for an operation its provider cannot do. */
export class NotSupportedError extends Error {
  readonly provider: IntegrationKey;
  readonly operation: string;
  constructor(provider: IntegrationKey, operation: string, detail?: string) {
    super(detail ?? `${provider} does not support ${operation}.`);
    this.name = "NotSupportedError";
    this.provider = provider;
    this.operation = operation;
  }
}

/** The stored grant is no longer usable (revoked, expired refresh token): the user must reconnect. */
export class IntegrationAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntegrationAuthError";
  }
}

/** A provider HTTP call failed. `status` is the HTTP status (0 for network failures). */
export class IntegrationHttpError extends Error {
  readonly status: number;
  readonly retryable: boolean;
  constructor(message: string, status: number) {
    super(message);
    this.name = "IntegrationHttpError";
    this.status = status;
    this.retryable = status === 0 || status === 429 || status >= 500;
  }
}

/** One entry of SyncRun.errors. Never contains message content, addresses or tokens. */
export type SyncIssue = {
  /** e.g. MESSAGE_FAILED, PAGE_FAILED, AUTH, RATE_LIMITED, CAP_REACHED (CAP_REACHED is informational). */
  code: string;
  message: string;
  /** Provider-side id (message id) when the issue concerns one item. */
  ref?: string;
};

export const INFO_CODES: ReadonlySet<string> = new Set(["CAP_REACHED"]);

export type SyncCounts = {
  /** Items fetched from the provider. */
  scanned: number;
  /** Items that matched an existing application (updated or already up to date). */
  matched: number;
  /** Applications created. */
  created: number;
  /** Existing applications that changed. */
  updated: number;
};

export type SyncResult = SyncCounts & {
  issues: SyncIssue[];
  /** Opaque cursor persisted on the connection for the next run. */
  cursor: string | null;
  /** True when the per-run cap stopped the run early (the cursor resumes it). */
  capped: boolean;
  /** Set when the run could not continue (auth failure, provider down). */
  fatal: { message: string; auth: boolean } | null;
};

export function emptySyncResult(cursor: string | null = null): SyncResult {
  return { scanned: 0, matched: 0, created: 0, updated: 0, issues: [], cursor, capped: false, fatal: null };
}

/** Access-token provider bound to one connection; `refresh()` forces a token refresh. */
export type TokenSource = {
  get(): Promise<string>;
  refresh(): Promise<string>;
};

export type SyncContext = {
  userId: string;
  connectionId: string;
  fetch: FetchLike;
  ingest: IngestFn;
  tokens: TokenSource;
  /** History range chosen by the user at connect time (days). */
  historyDays: number;
  /** Cursor persisted by the previous run (adapter-specific JSON), or null. */
  cursor: string | null;
  now: Date;
  /** Hard cap on items fetched per run. */
  maxItems: number;
};

/** A posting's public details. Only providers with a public postings API return these. */
export type JobDetails = {
  provider: IntegrationKey;
  /** The URL the user supplied. */
  sourceUrl: string;
  /** The API URL that produced the data. */
  apiUrl: string;
  externalId: string;
  title: string;
  company: string | null;
  location: string | null;
  department: string | null;
  employmentType: string | null;
  updatedAt: Date | null;
  /** Plain-text description (HTML converted), capped. */
  descriptionText: string | null;
  applyUrl: string | null;
  /** Always false here: these lookups have only been tested against simulated responses. */
  liveVerified: false;
};

export interface IntegrationAdapter {
  readonly provider: IntegrationKey;
  readonly capabilities: CapabilityMatrix;
  importApplications?(ctx: SyncContext): Promise<SyncResult>;
  getJobDetails?(url: string): Promise<JobDetails>;
  syncStatuses?(ctx: SyncContext): Promise<SyncResult>;
}

type OperationName = Extract<CapabilityName, "importApplications" | "getJobDetails" | "syncStatuses">;

/** True when the adapter both declares the capability and implements the operation. */
export function canRun(adapter: IntegrationAdapter, op: OperationName): boolean {
  return adapter.capabilities[op] !== "unsupported" && typeof adapter[op] === "function";
}

/** Invoke an operation, throwing NotSupportedError when the adapter cannot do it. */
export async function runOperation<K extends OperationName>(
  adapter: IntegrationAdapter,
  op: K,
  ...args: Parameters<NonNullable<IntegrationAdapter[K]>>
): Promise<Awaited<ReturnType<NonNullable<IntegrationAdapter[K]>>>> {
  const fn = adapter[op] as ((...a: unknown[]) => Promise<unknown>) | undefined;
  if (adapter.capabilities[op] === "unsupported" || typeof fn !== "function") {
    throw new NotSupportedError(adapter.provider, op);
  }
  return (await fn.apply(adapter, args)) as Awaited<ReturnType<NonNullable<IntegrationAdapter[K]>>>;
}
