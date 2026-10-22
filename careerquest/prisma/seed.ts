/**
 * Reference-data seed (`npm run db:seed` → `tsx prisma/seed.ts`).
 *
 * Upserts the apprenticeship directory and the DIR certification requirements from `data/seed/`.
 * Idempotent (safe to run any number of times) and never creates, changes or deletes user data.
 * tsx does not resolve the "@/" alias, so everything here is imported relatively, and the client is
 * built with the pg adapter exactly like `src/lib/db.ts`.
 *
 * Test database: `npx dotenv -e .env.test -- tsx prisma/seed.ts`
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { seedReferenceData } from "../src/lib/seed/run";

async function main(): Promise<number> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env (or pass an env file with dotenv -e).");
    return 1;
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }), log: ["error"] });
  try {
    const result = await seedReferenceData(prisma, { log: (line) => console.log(`[seed] ${line}`) });
    if (result.programs.total === 0 && result.requirements.total === 0) {
      console.error("[seed] Nothing was seeded. Check data/seed/*.json.");
      return 1;
    }
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err: unknown) => {
    console.error("[seed] failed:", err);
    process.exitCode = 1;
  });
