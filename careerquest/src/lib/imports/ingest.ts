import "server-only";
/**
 * Production wiring of the ingestion engine for every capture path owned here (email file imports,
 * spreadsheet/URL/platform imports, mailbox syncs). Core modules take the ingest function as a
 * parameter so tests can inject fakes; only server actions and route handlers import this file.
 */
import { ingestObservation } from "@/lib/ingest/engine";
import type { IngestFn } from "./types";

export type { IngestFn };

export const defaultIngest: IngestFn = (userId, observation) => ingestObservation(userId, observation);
