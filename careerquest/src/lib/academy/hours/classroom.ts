/**
 * Classroom (related instruction) milestones for the Electrician Trainee route. Pure.
 *
 * Classroom hours are logged with work type CLASSROOM and are kept OUT of the on-the-job totals
 * (the 8,000 hours are work experience). Targets are parsed from the researched seed text — DIR
 * page 2a's "720 hours of related and supplemental instruction" and 8 CCR 296.2's "at least 150
 * hours of classroom instruction … each year" — and are omitted when the text does not state them.
 */
import type { HourPoint } from "./stats";

export type ClassroomTargets = {
  /** Minimum classroom hours per year for registered trainees, or null when not in the seed. */
  annualMinimum: number | null;
  /** Total related and supplemental instruction for the trainee route, or null. */
  routeTotal: number | null;
};

const num = (s: string | undefined) => (s ? Number(s.replace(/,/g, "")) : NaN);

export function parseClassroomTargets(texts: { traineeClassroom?: string | null; traineePath?: string | null; generalNotes?: string | null }): ClassroomTargets {
  const annual = num(/at least\s+(\d[\d,]*)\s+hours of classroom/i.exec(texts.traineeClassroom ?? "")?.[1]);
  const routeText = `${texts.traineePath ?? ""} ${texts.generalNotes ?? ""}`;
  const route = num(/(\d[\d,]*)\s+hours of related and supplemental instruction/i.exec(routeText)?.[1]);
  return {
    annualMinimum: Number.isFinite(annual) && annual > 0 && annual < 10_000 ? annual : null,
    routeTotal: Number.isFinite(route) && route > 0 && route < 100_000 ? route : null,
  };
}

export const isClassroom = (p: Pick<HourPoint, "workType">) => p.workType === "CLASSROOM";

/** Split points into on-the-job work and classroom instruction. */
export function splitClassroom<T extends Pick<HourPoint, "workType">>(points: readonly T[]): { ojt: T[]; classroom: T[] } {
  const ojt: T[] = [];
  const classroom: T[] = [];
  for (const p of points) (isClassroom(p) ? classroom : ojt).push(p);
  return { ojt, classroom };
}
