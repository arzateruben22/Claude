-- An archived channel (src/domain/channels.ts) is hidden from every screen, list and total, and nothing automatic
-- touches it. Additive and nullable: existing rows stay active (null).
ALTER TABLE "channels" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;--> statement-breakpoint
-- Body Backstage is archived (owner, 10 Nov 2026). Data only: nothing is deleted (its episodes, publications, lessons,
-- rewards and analytics stay as the backup), and Settings → Archived channels restores it.
UPDATE "channels" SET "archived_at" = now(), "updated_at" = now() WHERE "slug" = 'body' AND "archived_at" IS NULL;
