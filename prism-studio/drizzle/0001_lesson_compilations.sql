ALTER TABLE "lessons" ADD COLUMN "name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "video_sha256" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "thumbnail_path" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "chapters" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "qa" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "approved_hash" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "post_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "reported_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;