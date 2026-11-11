-- A pushed long video's description.md as the importer last read it (sha256), so a corrected file is picked up while the
-- owner's own edit of the description is kept (registerCompilation, src/domain/lessons.ts). Additive, with a default:
-- existing lessons start with no record ("") and are treated conservatively until their next import records one.
ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "imported_description_sha" text DEFAULT '' NOT NULL;
