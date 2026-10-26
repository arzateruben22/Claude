CREATE TYPE "public"."automation_mode" AS ENUM('draft', 'approved', 'autopilot');--> statement-breakpoint
CREATE TYPE "public"."challenge_status" AS ENUM('locked', 'active', 'completed');--> statement-breakpoint
CREATE TYPE "public"."challenge_tier" AS ENUM('intro', 'series', 'advanced', 'masterwork', 'optional');--> statement-breakpoint
CREATE TYPE "public"."episode_state" AS ENUM('idea', 'research', 'outline', 'script', 'fact_check', 'storyboard', 'assets', 'narration', 'captions', 'render', 'quality_check', 'ready_for_review', 'approved', 'scheduled', 'uploading', 'processing', 'published', 'analytics', 'blocked', 'failed', 'cancelled', 'superseded', 'correction_needed');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'succeeded', 'failed', 'cancelled', 'dead', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."ledger_kind" AS ENUM('allocation', 'adjustment', 'reservation', 'release', 'claim');--> statement-breakpoint
CREATE TYPE "public"."metric_source" AS ENUM('api', 'csv', 'manual', 'estimate', 'demo');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('youtube', 'tiktok', 'instagram');--> statement-breakpoint
CREATE TYPE "public"."provenance" AS ENUM('unset', 'owner_entered', 'owner_confirmed', 'integration_verified');--> statement-breakpoint
CREATE TYPE "public"."publication_status" AS ENUM('planned', 'ready', 'handed_off', 'owner_reported', 'scheduled_on_platform', 'verified_published', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."publish_method" AS ENUM('manual', 'api', 'provider');--> statement-breakpoint
CREATE TYPE "public"."reward_status" AS ENUM('pending_funding', 'reserved', 'claimed', 'released');--> statement-breakpoint
CREATE TYPE "public"."topic" AS ENUM('skincare', 'physics', 'body', 'space', 'whatif');--> statement-breakpoint
CREATE TABLE "achievement_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"scope_key" text NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"channel_id" uuid,
	"episode_id" uuid,
	"publication_id" uuid,
	"snapshot_id" uuid,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"evidence_status" text DEFAULT 'ok' NOT NULL,
	"achieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"seen_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"episode_id" uuid NOT NULL,
	"export_id" uuid NOT NULL,
	"destination_id" uuid NOT NULL,
	"content_hash" text NOT NULL,
	"approved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text DEFAULT '' NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blackouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid,
	"destination_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"note" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"channel_id" uuid,
	"cap_cents" integer NOT NULL,
	"concurrency" integer
);
--> statement-breakpoint
CREATE TABLE "challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"key" text NOT NULL,
	"tier" "challenge_tier" NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"requirement" jsonb NOT NULL,
	"status" "challenge_status" DEFAULT 'locked' NOT NULL,
	"active_optional" boolean DEFAULT false NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"topic" "topic" NOT NULL,
	"name" text NOT NULL,
	"name_provisional" boolean DEFAULT true NOT NULL,
	"tagline" text DEFAULT '' NOT NULL,
	"color" text NOT NULL,
	"color_ink" text NOT NULL,
	"label" text NOT NULL,
	"voice" jsonb NOT NULL,
	"editorial" jsonb NOT NULL,
	"films_path" text,
	"automation_mode" "automation_mode" DEFAULT 'draft' NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channels_slug_unique" UNIQUE("slug"),
	CONSTRAINT "channels_topic_unique" UNIQUE("topic")
);
--> statement-breakpoint
CREATE TABLE "connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"destination_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"scopes" text[] DEFAULT '{}'::text[] NOT NULL,
	"verified_account_id" text DEFAULT '' NOT NULL,
	"token_cipher" text,
	"expires_at" timestamp with time zone,
	"status" text DEFAULT 'disconnected' NOT NULL,
	"capabilities" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid,
	"channel_id" uuid,
	"category" text NOT NULL,
	"provider" text DEFAULT 'local' NOT NULL,
	"estimate_cents" integer DEFAULT 0 NOT NULL,
	"actual_cents" integer,
	"reserved" boolean DEFAULT false NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creations" (
	"channel_id" uuid PRIMARY KEY NOT NULL,
	"creation_key" text NOT NULL,
	"name" text NOT NULL,
	"form" integer DEFAULT 1 NOT NULL,
	"branch" text,
	"ascended" boolean DEFAULT false NOT NULL,
	"cosmetics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "destinations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" "platform" NOT NULL,
	"channel_id" uuid,
	"shared" boolean DEFAULT false NOT NULL,
	"display_name" text DEFAULT '' NOT NULL,
	"handle" text DEFAULT '' NOT NULL,
	"platform_account_id" text DEFAULT '' NOT NULL,
	"avatar_url" text DEFAULT '' NOT NULL,
	"profile_url" text DEFAULT '' NOT NULL,
	"studio_url" text DEFAULT '' NOT NULL,
	"upload_url" text DEFAULT '' NOT NULL,
	"login_help_url" text DEFAULT '' NOT NULL,
	"publish_method" "publish_method" DEFAULT 'manual' NOT NULL,
	"provenance" "provenance" DEFAULT 'unset' NOT NULL,
	"last_confirmed_at" timestamp with time zone,
	"selection_note" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "episode_counters" (
	"channel_id" uuid PRIMARY KEY NOT NULL,
	"next_number" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "episodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"series_id" uuid,
	"season_id" uuid,
	"number" integer NOT NULL,
	"series_order" integer,
	"title" text NOT NULL,
	"question" text DEFAULT '' NOT NULL,
	"objective" text DEFAULT '' NOT NULL,
	"state" "episode_state" DEFAULT 'idea' NOT NULL,
	"script" text DEFAULT '' NOT NULL,
	"storyboard" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"captions_srt" text DEFAULT '' NOT NULL,
	"revision_notes" text DEFAULT '' NOT NULL,
	"duration_s" real,
	"films_path" text,
	"tags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evolutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"to_form" integer NOT NULL,
	"eligible_at" timestamp with time zone DEFAULT now() NOT NULL,
	"evolved_at" timestamp with time zone,
	"seen_at" timestamp with time zone,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experiments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"hypothesis" text NOT NULL,
	"change" text NOT NULL,
	"metric" text NOT NULL,
	"min_sample" integer DEFAULT 6 NOT NULL,
	"window" text DEFAULT '7d' NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"channel_id" uuid,
	"priority" integer DEFAULT 0 NOT NULL,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"lease_until" timestamp with time zone,
	"heartbeat_at" timestamp with time zone,
	"locked_by" text,
	"progress" real,
	"message" text DEFAULT '' NOT NULL,
	"idempotency_key" text,
	"result" jsonb,
	"error" text,
	"cancel_requested" boolean DEFAULT false NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "learnings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"finding" text NOT NULL,
	"confidence" text DEFAULT 'low' NOT NULL,
	"evidence" text DEFAULT '' NOT NULL,
	"counterexamples" text DEFAULT '' NOT NULL,
	"decision" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_episodes" (
	"lesson_id" uuid NOT NULL,
	"episode_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "lesson_episodes_lesson_id_episode_id_pk" PRIMARY KEY("lesson_id","episode_id"),
	CONSTRAINT "lesson_episodes_episode_id_unique" UNIQUE("episode_id")
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"series_id" uuid,
	"title" text NOT NULL,
	"organizing_question" text DEFAULT '' NOT NULL,
	"outline" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"state" "episode_state" DEFAULT 'outline' NOT NULL,
	"video_path" text DEFAULT '' NOT NULL,
	"is_test_fixture" boolean DEFAULT false NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metric_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publication_id" uuid NOT NULL,
	"metric" text NOT NULL,
	"value" real NOT NULL,
	"unit" text DEFAULT 'count' NOT NULL,
	"definition" text DEFAULT '' NOT NULL,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"age_hours" real,
	"retrieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" "metric_source" NOT NULL,
	"status" text DEFAULT 'ok' NOT NULL,
	"supersedes" uuid
);
--> statement-breakpoint
CREATE TABLE "milestone_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"kind" text NOT NULL,
	"threshold" bigint,
	"scope" text DEFAULT 'studio' NOT NULL,
	"reward_cents" integer,
	"xp" integer DEFAULT 0 NOT NULL,
	"badge" text DEFAULT 'ring' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "milestone_rules_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "onboarding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid,
	"item" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"done_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "platform_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"file_path" text NOT NULL,
	"file_sha256" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"hashtags" text DEFAULT '' NOT NULL,
	"cover_path" text DEFAULT '' NOT NULL,
	"disclosures" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"posting_notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"episode_id" uuid NOT NULL,
	"destination_id" uuid NOT NULL,
	"export_id" uuid,
	"kind" text DEFAULT 'short' NOT NULL,
	"status" "publication_status" DEFAULT 'planned' NOT NULL,
	"scheduled_for" timestamp with time zone,
	"original_slot" timestamp with time zone,
	"handed_off_at" timestamp with time zone,
	"reported_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"post_url" text DEFAULT '' NOT NULL,
	"post_id" text DEFAULT '' NOT NULL,
	"evidence" text DEFAULT 'none' NOT NULL,
	"method" "publish_method" DEFAULT 'manual' NOT NULL,
	"simulated" boolean DEFAULT false NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publishing_windows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" "platform" NOT NULL,
	"channel_id" uuid,
	"local_time" text NOT NULL,
	"provisional" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"episode_id" uuid NOT NULL,
	"version_id" uuid,
	"kind" text NOT NULL,
	"body" text NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reward_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "ledger_kind" NOT NULL,
	"amount_cents" integer NOT NULL,
	"reward_id" uuid,
	"month" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reward_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"monthly_cap_cents" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"achievement_event_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"status" "reward_status" DEFAULT 'pending_funding' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"reserved_at" timestamp with time zone,
	"claimed_at" timestamp with time zone,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rewards_achievement_event_id_unique" UNIQUE("achievement_event_id")
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"series_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"title" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"title" text NOT NULL,
	"objective" text DEFAULT '' NOT NULL,
	"audience" text DEFAULT '' NOT NULL,
	"prerequisites" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'planning' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"episode_id" uuid NOT NULL,
	"claim_key" text DEFAULT '' NOT NULL,
	"claim" text NOT NULL,
	"sentence" text DEFAULT '' NOT NULL,
	"url" text DEFAULT '' NOT NULL,
	"publisher" text DEFAULT '' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"retrieved_at" text DEFAULT '' NOT NULL,
	"verified_via" text DEFAULT '' NOT NULL,
	"evidence" text DEFAULT 'established' NOT NULL,
	"uncertainty" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'ok' NOT NULL,
	"reviewer_ok" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "studio_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"name" text DEFAULT 'Prism Studio' NOT NULL,
	"timezone" text DEFAULT 'America/Los_Angeles' NOT NULL,
	"instagram_daily" integer DEFAULT 2 NOT NULL,
	"shorts_per_channel_daily" integer DEFAULT 1 NOT NULL,
	"buffer_days" integer DEFAULT 3 NOT NULL,
	"lesson_bundle_size" integer DEFAULT 6 NOT NULL,
	"global_pause" boolean DEFAULT false NOT NULL,
	"stop_external_actions" boolean DEFAULT false NOT NULL,
	"missed_slot_policy" text DEFAULT 'reschedule' NOT NULL,
	"celebration_sound" boolean DEFAULT false NOT NULL,
	"low_power_art" boolean DEFAULT false NOT NULL,
	"paid_generation_enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"episode_id" uuid NOT NULL,
	"version_no" integer NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"video_path" text NOT NULL,
	"poster_path" text DEFAULT '' NOT NULL,
	"srt_path" text DEFAULT '' NOT NULL,
	"width" integer,
	"height" integer,
	"duration_s" real,
	"sha256" text NOT NULL,
	"qa" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"superseded" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xp_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount" integer NOT NULL,
	"idempotency_key" text NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "xp_events_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "achievement_events" ADD CONSTRAINT "achievement_events_rule_id_milestone_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."milestone_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "achievement_events" ADD CONSTRAINT "achievement_events_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "achievement_events" ADD CONSTRAINT "achievement_events_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "achievement_events" ADD CONSTRAINT "achievement_events_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "achievement_events" ADD CONSTRAINT "achievement_events_snapshot_id_metric_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."metric_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_export_id_platform_exports_id_fk" FOREIGN KEY ("export_id") REFERENCES "public"."platform_exports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blackouts" ADD CONSTRAINT "blackouts_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blackouts" ADD CONSTRAINT "blackouts_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_ledger" ADD CONSTRAINT "cost_ledger_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_ledger" ADD CONSTRAINT "cost_ledger_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creations" ADD CONSTRAINT "creations_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "destinations" ADD CONSTRAINT "destinations_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_counters" ADD CONSTRAINT "episode_counters_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evolutions" ADD CONSTRAINT "evolutions_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learnings" ADD CONSTRAINT "learnings_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_episodes" ADD CONSTRAINT "lesson_episodes_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_episodes" ADD CONSTRAINT "lesson_episodes_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_snapshots" ADD CONSTRAINT "metric_snapshots_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding" ADD CONSTRAINT "onboarding_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_exports" ADD CONSTRAINT "platform_exports_version_id_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_export_id_platform_exports_id_fk" FOREIGN KEY ("export_id") REFERENCES "public"."platform_exports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_windows" ADD CONSTRAINT "publishing_windows_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_notes" ADD CONSTRAINT "review_notes_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_notes" ADD CONSTRAINT "review_notes_version_id_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_ledger" ADD CONSTRAINT "reward_ledger_reward_id_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."rewards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_achievement_event_id_achievement_events_id_fk" FOREIGN KEY ("achievement_event_id") REFERENCES "public"."achievement_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series" ADD CONSTRAINT "series_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "versions" ADD CONSTRAINT "versions_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "achievement_once" ON "achievement_events" USING btree ("rule_id","scope_key","is_demo");--> statement-breakpoint
CREATE INDEX "approvals_export" ON "approvals" USING btree ("export_id");--> statement-breakpoint
CREATE INDEX "audit_created" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "challenges_channel_key" ON "challenges" USING btree ("channel_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "destinations_channel_platform" ON "destinations" USING btree ("channel_id","platform");--> statement-breakpoint
CREATE INDEX "destinations_platform" ON "destinations" USING btree ("platform");--> statement-breakpoint
CREATE UNIQUE INDEX "episodes_channel_number" ON "episodes" USING btree ("channel_id","number");--> statement-breakpoint
CREATE INDEX "episodes_state" ON "episodes" USING btree ("state");--> statement-breakpoint
CREATE UNIQUE INDEX "evolutions_once" ON "evolutions" USING btree ("channel_id","to_form");--> statement-breakpoint
CREATE INDEX "jobs_ready" ON "jobs" USING btree ("status","run_after");--> statement-breakpoint
CREATE INDEX "metrics_pub_metric" ON "metric_snapshots" USING btree ("publication_id","metric");--> statement-breakpoint
CREATE UNIQUE INDEX "onboarding_item" ON "onboarding" USING btree ("channel_id","item");--> statement-breakpoint
CREATE UNIQUE INDEX "exports_version_platform" ON "platform_exports" USING btree ("version_id","platform");--> statement-breakpoint
CREATE UNIQUE INDEX "publications_episode_destination" ON "publications" USING btree ("episode_id","destination_id");--> statement-breakpoint
CREATE INDEX "publications_scheduled" ON "publications" USING btree ("scheduled_for");--> statement-breakpoint
CREATE UNIQUE INDEX "seasons_series_number" ON "seasons" USING btree ("series_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "versions_episode_no" ON "versions" USING btree ("episode_id","version_no");