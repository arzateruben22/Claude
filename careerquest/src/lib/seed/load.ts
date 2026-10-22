/**
 * Reads the reference-data seed files from disk. Relative imports only (used by prisma/seed.ts via
 * tsx and by the app). Missing or malformed files produce error messages, never exceptions.
 */
import fs from "node:fs";
import path from "node:path";
import { parseCertificationSeeds, parseProgramSeeds, type CertificationRow, type ProgramRow } from "./schema";

export const PROGRAMS_FILE = "apprenticeship_programs.json";
export const REQUIREMENTS_FILE = "certification_requirements.json";

/** Default seed directory: `<cwd>/data/seed` (npm scripts and Next both run from the project root). */
export function defaultSeedDir(): string {
  return path.resolve(process.cwd(), "data", "seed");
}

function readJson(file: string): { value: unknown; error: string | null } {
  try {
    return { value: JSON.parse(fs.readFileSync(file, "utf8")) as unknown, error: null };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { value: null, error: `${path.basename(file)}: ${reason}` };
  }
}

export type LoadedPrograms = { rows: ProgramRow[]; errors: string[]; warnings: string[] };
export type LoadedRequirements = { rows: CertificationRow[]; errors: string[] };

export function loadProgramSeeds(dir = defaultSeedDir()): LoadedPrograms {
  const { value, error } = readJson(path.join(dir, PROGRAMS_FILE));
  if (error) return { rows: [], errors: [error], warnings: [] };
  return parseProgramSeeds(value);
}

export function loadRequirementSeeds(dir = defaultSeedDir()): LoadedRequirements {
  const { value, error } = readJson(path.join(dir, REQUIREMENTS_FILE));
  if (error) return { rows: [], errors: [error] };
  return parseCertificationSeeds(value);
}
