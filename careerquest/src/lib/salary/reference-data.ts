import "server-only";
import fs from "node:fs";
import path from "node:path";
import { parseWageReferences, type WageReferences } from "./reference";

/**
 * Reads the cited wage data from `data/seed/certification_facts.json`. A missing or malformed file
 * yields empty references (the UI then asks the user for their own figures); it never throws.
 */
export function loadWageReferences(seedDir = process.env.ACADEMY_SEED_DIR || path.join(process.cwd(), "data", "seed")): WageReferences {
  try {
    const raw = fs.readFileSync(path.join(seedDir, "certification_facts.json"), "utf8");
    return parseWageReferences(JSON.parse(raw));
  } catch (err) {
    console.error("salary: could not read certification_facts.json", err);
    return parseWageReferences(null);
  }
}
