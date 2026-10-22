/**
 * Position identity used for counting applications in missions and achievements. It mirrors the
 * `positionFingerprint` used for submission XP (`src/lib/events/record-event.ts`): the same
 * normalized company + normalized title + location is one position, so applying to the same job
 * twice, or deleting and re-creating it, never counts twice.
 */
export function normalizeLocationKey(location: string | null | undefined): string {
  return (location ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function positionKey(a: { normalizedCompany: string; normalizedTitle: string; location: string | null }): string {
  return `${a.normalizedCompany}|${a.normalizedTitle}|${normalizeLocationKey(a.location)}`;
}

/** Count distinct positions in a list of applications. */
export function countDistinctPositions(rows: readonly { normalizedCompany: string; normalizedTitle: string; location: string | null }[]): number {
  return new Set(rows.map(positionKey)).size;
}
