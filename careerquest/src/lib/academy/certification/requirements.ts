import "server-only";
import { prisma } from "@/lib/db";
import { isHttpUrl } from "@/lib/seed/schema";
import { loadRequirementSeeds } from "@/lib/seed/load";
import { DEFAULT_CLASSIFICATION, FALLBACK_GENERAL_HOURS } from "@/lib/academy/hours/constants";

/**
 * DIR certification classifications. Read from the seeded `CertificationRequirement` table; when the
 * table is empty (seed not run yet) the same validated `data/seed` file is read directly, and the
 * page says so. Never invents a requirement: if neither source has GENERAL, the 8,000-hour fallback
 * is returned flagged `source: "fallback"` (shown as unverified, with no verification date).
 */

export type RequirementView = {
  code: string;
  name: string;
  hoursRequired: number;
  notes: string | null;
  sourceUrl: string | null;
  /** "YYYY-MM-DD" (the seed's calendar day), or null when never verified. */
  verifiedOnKey: string | null;
  source: "database" | "seed-file" | "fallback";
};

const ORDER = ["GENERAL", "RESIDENTIAL", "FIRE_LIFE_SAFETY", "VOICE_DATA_VIDEO", "NON_RESIDENTIAL_LIGHTING"];

function sortByOrder(a: RequirementView, b: RequirementView): number {
  const ia = ORDER.indexOf(a.code);
  const ib = ORDER.indexOf(b.code);
  return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.name.localeCompare(b.name);
}

export async function listRequirements(): Promise<RequirementView[]> {
  const rows = await prisma.certificationRequirement.findMany();
  if (rows.length > 0) {
    return rows
      .map((r) => ({
        code: r.code,
        name: r.name,
        hoursRequired: r.hoursRequired,
        notes: r.notes,
        sourceUrl: isHttpUrl(r.sourceUrl) ? r.sourceUrl : null,
        verifiedOnKey: r.verifiedOn ? r.verifiedOn.toISOString().slice(0, 10) : null,
        source: "database" as const,
      }))
      .sort(sortByOrder);
  }
  const seeds = loadRequirementSeeds();
  if (seeds.errors.length) console.warn("certification requirements seed file:", seeds.errors.join(" | "));
  return seeds.rows
    .map((r) => ({
      code: r.code,
      name: r.name,
      hoursRequired: r.hoursRequired,
      notes: r.notes,
      sourceUrl: r.sourceUrl,
      verifiedOnKey: r.verifiedOn ? r.verifiedOn.toISOString().slice(0, 10) : null,
      source: "seed-file" as const,
    }))
    .sort(sortByOrder);
}

export function fallbackGeneral(): RequirementView {
  return {
    code: DEFAULT_CLASSIFICATION,
    name: "General Electrician",
    hoursRequired: FALLBACK_GENERAL_HOURS,
    notes: null,
    sourceUrl: null,
    verifiedOnKey: null,
    source: "fallback",
  };
}

/** One classification (default GENERAL). Unknown codes resolve to null; GENERAL never does. */
export async function getRequirement(code: string = DEFAULT_CLASSIFICATION, all?: RequirementView[]): Promise<RequirementView | null> {
  const list = all ?? (await listRequirements());
  const found = list.find((r) => r.code === code);
  if (found) return found;
  return code === DEFAULT_CLASSIFICATION ? fallbackGeneral() : null;
}
