import "server-only";
import fs from "node:fs";
import path from "node:path";
import { parseCareerSeed, type CareerSeed } from "./seed";

/**
 * Reads the researched seed files fresh on each call (they are small and may be corrected at any
 * time). A missing or invalid file is reported in `errors` and leaves its figures out of the map.
 */
function readJson(file: string, errors: string[]): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    errors.push(`${path.basename(file)} could not be read (${err instanceof Error ? err.message : String(err)}).`);
    return null;
  }
}

export function careerDataRoot(): string {
  return process.env.CAREER_MAP_DATA_DIR || path.join(process.cwd(), "data");
}

export function loadCareerSeed(dataDir = careerDataRoot()): CareerSeed {
  const errors: string[] = [];
  const seedDir = path.join(dataDir, "seed");
  return parseCareerSeed(
    {
      facts: readJson(path.join(seedDir, "certification_facts.json"), errors),
      requirements: readJson(path.join(seedDir, "certification_requirements.json"), errors),
      programs: readJson(path.join(seedDir, "apprenticeship_programs.json"), errors),
      research: readJson(path.join(dataDir, "research", "electrician_research.json"), errors),
    },
    errors,
  );
}
