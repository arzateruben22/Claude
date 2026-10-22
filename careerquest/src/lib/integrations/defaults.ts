import "server-only";
/** Production dependencies for syncs (real fetch, real ingestion engine, process env). */
import { defaultIngest } from "@/lib/imports/ingest";
import { readIntegrationEnv, type ServerIntegrationEnv } from "./env";
import type { SyncDeps } from "./sync";

export function productionSyncDeps(env: ServerIntegrationEnv = readIntegrationEnv()): SyncDeps {
  return { ingest: defaultIngest, env, fetch: (input, init) => fetch(input, init) };
}
