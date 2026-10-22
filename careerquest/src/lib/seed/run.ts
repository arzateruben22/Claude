/**
 * Idempotent reference-data seed: upserts `ApprenticeshipProgram` by slug and
 * `CertificationRequirement` by code. Never touches user data and never deletes rows (a program
 * dropped from the JSON keeps its row so users' saved interests survive). Relative imports only.
 */
import type { PrismaClient } from "../../generated/prisma/client";
import { defaultSeedDir, loadProgramSeeds, loadRequirementSeeds } from "./load";

export type SeedCounts = {
  programs: { created: number; updated: number; total: number };
  requirements: { created: number; updated: number; total: number };
  errors: string[];
  warnings: string[];
};

export type SeedOptions = { dataDir?: string; log?: (line: string) => void };

export async function seedReferenceData(db: PrismaClient, opts: SeedOptions = {}): Promise<SeedCounts> {
  const dir = opts.dataDir ?? defaultSeedDir();
  const log = opts.log ?? (() => undefined);
  const programs = loadProgramSeeds(dir);
  const requirements = loadRequirementSeeds(dir);
  const errors = [...programs.errors, ...requirements.errors];
  const warnings = [...programs.warnings];

  const counts = await db.$transaction(async (tx) => {
    const existingSlugs = new Set(
      (await tx.apprenticeshipProgram.findMany({ where: { slug: { in: programs.rows.map((r) => r.slug) } }, select: { slug: true } })).map(
        (r) => r.slug,
      ),
    );
    for (const row of programs.rows) {
      await tx.apprenticeshipProgram.upsert({ where: { slug: row.slug }, create: row, update: row });
    }
    const existingCodes = new Set(
      (await tx.certificationRequirement.findMany({ where: { code: { in: requirements.rows.map((r) => r.code) } }, select: { code: true } })).map(
        (r) => r.code,
      ),
    );
    for (const row of requirements.rows) {
      await tx.certificationRequirement.upsert({ where: { code: row.code }, create: row, update: row });
    }
    return {
      programs: {
        created: programs.rows.filter((r) => !existingSlugs.has(r.slug)).length,
        updated: programs.rows.filter((r) => existingSlugs.has(r.slug)).length,
        total: await tx.apprenticeshipProgram.count(),
      },
      requirements: {
        created: requirements.rows.filter((r) => !existingCodes.has(r.code)).length,
        updated: requirements.rows.filter((r) => existingCodes.has(r.code)).length,
        total: await tx.certificationRequirement.count(),
      },
    };
  });

  for (const w of warnings) log(`warning: ${w}`);
  for (const e of errors) log(`skipped: ${e}`);
  log(
    `ApprenticeshipProgram: ${programs.rows.length} upserted (${counts.programs.created} created, ${counts.programs.updated} updated); ${counts.programs.total} in table.`,
  );
  log(
    `CertificationRequirement: ${requirements.rows.length} upserted (${counts.requirements.created} created, ${counts.requirements.updated} updated); ${counts.requirements.total} in table.`,
  );
  return { ...counts, errors, warnings };
}
