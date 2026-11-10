-- Packaging (src/domain/packaging.ts): each episode's and long video's packaging.json, as the importer read it. Additive
-- and nullable: nothing changes until the next import finds a packaging.json.
ALTER TABLE "episodes" ADD COLUMN IF NOT EXISTS "packaging" jsonb;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "packaging" jsonb;
