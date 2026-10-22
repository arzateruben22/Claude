import type { EventSource, RecordOrigin } from "@/generated/prisma/enums";

/**
 * Attribution for records created from a capture path. Pure; safe to import anywhere.
 * MANUAL / MOBILE are things the user typed or tapped themselves (USER); every machine path is
 * attributed to its producer so the record is never presented as user-confirmed.
 */
export const ORIGIN_EVENT_SOURCE: Record<RecordOrigin, EventSource> = {
  MANUAL: "USER",
  MOBILE: "USER",
  EMAIL: "EMAIL",
  EXTENSION: "EXTENSION",
  CSV_IMPORT: "IMPORT",
  URL_IMPORT: "IMPORT",
  PLATFORM_API: "PLATFORM_API",
  SYSTEM: "SYSTEM",
};

export type CreateAttributionOptions = {
  /** Overrides the source derived from the origin. */
  source?: EventSource;
  /** Defaults to `source === "USER"`: only the user's own entry is verified without evidence. */
  verified?: boolean;
  /** Evidence row backing the creation (attached to the history row and the creation events). */
  evidenceId?: string | null;
};

export type CreateAttribution = {
  source: EventSource;
  verified: boolean;
  evidenceId: string | null;
};

export function attributionForOrigin(
  origin: RecordOrigin,
  opts: CreateAttributionOptions = {},
): CreateAttribution {
  const source = opts.source ?? ORIGIN_EVENT_SOURCE[origin];
  return {
    source,
    verified: opts.verified ?? source === "USER",
    evidenceId: opts.evidenceId ?? null,
  };
}
