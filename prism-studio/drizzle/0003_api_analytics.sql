CREATE TABLE "metric_pulls" (
	"publication_id" uuid PRIMARY KEY NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_outcome" text DEFAULT '' NOT NULL,
	"last_error" text DEFAULT '' NOT NULL,
	"pulls" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "metric_snapshots" ADD COLUMN "utc_day" date;--> statement-breakpoint
ALTER TABLE "metric_pulls" ADD CONSTRAINT "metric_pulls_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "metrics_api_daily" ON "metric_snapshots" USING btree ("publication_id","metric","utc_day") WHERE "metric_snapshots"."source" = 'api';