import "server-only";
/**
 * Adapter lookup. Providers without any network capability get a "manual" adapter that implements no
 * operations, so `runOperation` raises NotSupportedError for them (their applications arrive through
 * email, the extension, file imports and manual entry instead).
 */
import { getProvider, type IntegrationKey } from "../registry";
import { gmailAdapter } from "./gmail";
import { outlookAdapter } from "./outlook";
import { createGreenhouseAdapter, createLeverAdapter } from "./postings";
import type { FetchLike, IntegrationAdapter } from "./types";

export function createManualAdapter(key: IntegrationKey): IntegrationAdapter {
  const entry = getProvider(key);
  if (!entry) throw new Error(`Unknown integration provider: ${key}`);
  return { provider: key, capabilities: entry.capabilities };
}

export function getAdapter(key: IntegrationKey, deps: { fetch?: FetchLike } = {}): IntegrationAdapter {
  const fetchFn: FetchLike = deps.fetch ?? ((input, init) => fetch(input, init));
  switch (key) {
    case "GMAIL":
      return gmailAdapter;
    case "OUTLOOK":
      return outlookAdapter;
    case "GREENHOUSE":
      return createGreenhouseAdapter(fetchFn);
    case "LEVER":
      return createLeverAdapter(fetchFn);
    default:
      // The Chrome extension pushes captures to /api/extension/*; it has no server-side pull operation.
      return createManualAdapter(key);
  }
}

export { NotSupportedError, IntegrationAuthError, IntegrationHttpError, runOperation, canRun } from "./types";
export type { IntegrationAdapter, JobDetails, SyncContext, SyncResult, SyncIssue, FetchLike } from "./types";
