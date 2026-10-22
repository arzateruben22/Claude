/**
 * "Estimated countable hours" for the General Electrician classification. Pure.
 *
 * 8 CCR 291.1 lets only so many hours per work area count toward the 8,000: residential ≤ 3,000,
 * commercial ≤ 6,000, industrial ≤ 6,000, voice/data/video ≤ 1,500, troubleshooting & maintenance
 * ≤ 1,500, underground conduit ≤ 750, finish work & fixtures ≤ 600, fire/life safety ≤ 600, stock
 * room ≤ 300 — and the hours must span two or more areas. Cap values are parsed from the seeded
 * requirement notes when present (falling back to these defaults per area).
 *
 * This is an ESTIMATE: DIR decides eligibility. Work types with no DIR area (solar PV, classroom,
 * other) are excluded rather than guessed, and lighting is counted under the stricter
 * "finish work & fixtures" cap.
 */
import type { WorkType } from "@/generated/prisma/enums";
import { roundHours } from "./constants";

export type WorkArea =
  | "RESIDENTIAL"
  | "COMMERCIAL"
  | "INDUSTRIAL"
  | "VOICE_DATA_VIDEO"
  | "TROUBLESHOOTING_MAINTENANCE"
  | "UNDERGROUND"
  | "FINISH_FIXTURES"
  | "FIRE_LIFE_SAFETY"
  | "STOCK_ROOM";

type AreaDef = { area: WorkArea; label: string; defaultCap: number; pattern: RegExp };

const AREA_DEFS: readonly AreaDef[] = [
  { area: "RESIDENTIAL", label: "Residential wiring", defaultCap: 3000, pattern: /residential wiring/i },
  { area: "COMMERCIAL", label: "Commercial wiring", defaultCap: 6000, pattern: /commercial wiring/i },
  { area: "INDUSTRIAL", label: "Industrial wiring", defaultCap: 6000, pattern: /industrial wiring/i },
  { area: "VOICE_DATA_VIDEO", label: "Voice / data / video installation", defaultCap: 1500, pattern: /voice\s*\/\s*data\s*\/\s*video/i },
  { area: "TROUBLESHOOTING_MAINTENANCE", label: "Troubleshooting & maintenance", defaultCap: 1500, pattern: /troubleshooting\s*(?:&|and)\s*maintenance/i },
  { area: "UNDERGROUND", label: "Underground conduit installation", defaultCap: 750, pattern: /underground conduit/i },
  { area: "FINISH_FIXTURES", label: "Finish work & fixtures", defaultCap: 600, pattern: /finish work\s*(?:&|and)\s*fixtures/i },
  { area: "FIRE_LIFE_SAFETY", label: "Fire / life safety", defaultCap: 600, pattern: /fire\s*\/\s*life safety/i },
  { area: "STOCK_ROOM", label: "Stock room & material handling", defaultCap: 300, pattern: /stock room/i },
];

export const WORK_AREAS: readonly WorkArea[] = AREA_DEFS.map((d) => d.area);
export const AREA_LABELS = Object.fromEntries(AREA_DEFS.map((d) => [d.area, d.label])) as Record<WorkArea, string>;
export const DEFAULT_GENERAL_CAPS = Object.fromEntries(AREA_DEFS.map((d) => [d.area, d.defaultCap])) as Record<WorkArea, number>;

/** Which DIR work area each logged work type counts toward (null = not counted in the estimate). */
export const WORK_TYPE_AREA: Record<WorkType, WorkArea | null> = {
  COMMERCIAL: "COMMERCIAL",
  RESIDENTIAL: "RESIDENTIAL",
  INDUSTRIAL: "INDUSTRIAL",
  VOICE_DATA_VIDEO: "VOICE_DATA_VIDEO",
  MAINTENANCE: "TROUBLESHOOTING_MAINTENANCE",
  LIGHTING: "FINISH_FIXTURES",
  FIRE_LIFE_SAFETY: "FIRE_LIFE_SAFETY",
  SOLAR_PV: null,
  CLASSROOM: null,
  OTHER: null,
};

export const UNMAPPED_REASONS: Partial<Record<WorkType, string>> = {
  SOLAR_PV: "No separate DIR work area; DIR decides which area it falls under.",
  CLASSROOM: "Classroom instruction is not on-the-job experience.",
  OTHER: "Not mapped to a DIR work area.",
};

export type AreaCaps = { caps: Record<WorkArea, number>; fromSeed: WorkArea[] };

/**
 * Parse "<area> max 3,000" phrases from the seeded requirement notes. Areas not found keep their
 * default; values outside 1…100,000 are ignored.
 */
export function parseAreaCaps(notes: string | null | undefined): AreaCaps {
  const caps = { ...DEFAULT_GENERAL_CAPS };
  const fromSeed: WorkArea[] = [];
  if (!notes) return { caps, fromSeed };
  for (const def of AREA_DEFS) {
    const re = new RegExp(`${def.pattern.source}[^;.]{0,60}?\\bmax(?:imum)?\\.?\\s*(\\d{1,3}(?:,\\d{3})+|\\d+)`, "i");
    const m = re.exec(notes);
    if (!m?.[1]) continue;
    const value = Number(m[1].replace(/,/g, ""));
    if (Number.isFinite(value) && value > 0 && value <= 100_000) {
      caps[def.area] = value;
      fromSeed.push(def.area);
    }
  }
  return { caps, fromSeed };
}

export type CapRow = {
  area: WorkArea;
  label: string;
  cap: number;
  capFromSeed: boolean;
  logged: number;
  countable: number;
  /** Hours above the cap that the estimate does not count. */
  excess: number;
};

export type CapEstimate = {
  rows: CapRow[];
  /** Sum over areas of min(logged, cap). */
  countable: number;
  /** All hours fed in (including unmapped work types). */
  logged: number;
  unmapped: { workType: WorkType; hours: number; reason: string }[];
  areasWithHours: number;
  /** DIR requires work in two or more listed areas. */
  meetsTwoAreaRule: boolean;
};

export function estimateCountableHours(hoursByType: Partial<Record<WorkType, number>>, caps: AreaCaps): CapEstimate {
  const loggedByArea = new Map<WorkArea, number>();
  const unmapped: CapEstimate["unmapped"] = [];
  let logged = 0;
  for (const [type, raw] of Object.entries(hoursByType) as [WorkType, number | undefined][]) {
    const hours = Number.isFinite(raw) && (raw ?? 0) > 0 ? (raw as number) : 0;
    if (hours === 0) continue;
    logged += hours;
    const area = WORK_TYPE_AREA[type];
    if (area) loggedByArea.set(area, (loggedByArea.get(area) ?? 0) + hours);
    else unmapped.push({ workType: type, hours: roundHours(hours), reason: UNMAPPED_REASONS[type] ?? "Not mapped to a DIR work area." });
  }
  const rows: CapRow[] = AREA_DEFS.map((def) => {
    const areaLogged = roundHours(loggedByArea.get(def.area) ?? 0);
    const cap = caps.caps[def.area];
    const countable = roundHours(Math.min(areaLogged, cap));
    return {
      area: def.area,
      label: def.label,
      cap,
      capFromSeed: caps.fromSeed.includes(def.area),
      logged: areaLogged,
      countable,
      excess: roundHours(Math.max(0, areaLogged - cap)),
    };
  });
  const areasWithHours = rows.filter((r) => r.logged > 0).length;
  return {
    rows,
    countable: roundHours(rows.reduce((a, r) => a + r.countable, 0)),
    logged: roundHours(logged),
    unmapped,
    areasWithHours,
    meetsTwoAreaRule: areasWithHours >= 2,
  };
}
