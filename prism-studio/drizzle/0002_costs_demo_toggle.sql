ALTER TABLE "budgets" ALTER COLUMN "cap_cents" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "scope_key" text DEFAULT 'studio' NOT NULL;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "month" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "currency" text DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "note" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_ledger" ADD COLUMN "episode_id" uuid;--> statement-breakpoint
ALTER TABLE "cost_ledger" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_ledger" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_ledger" ADD COLUMN "currency" text DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_ledger" ADD COLUMN "incurred_on" date DEFAULT CURRENT_DATE NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_ledger" ADD COLUMN "voided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cost_ledger" ADD COLUMN "void_reason" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_ledger" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "studio_settings" ADD COLUMN "show_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_ledger" ADD CONSTRAINT "cost_ledger_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "budgets_scope_month" ON "budgets" USING btree ("scope_key","month");--> statement-breakpoint
CREATE INDEX "cost_ledger_incurred" ON "cost_ledger" USING btree ("incurred_on");--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_scope_ok" CHECK (("budgets"."scope" = 'studio' and "budgets"."channel_id" is null and "budgets"."scope_key" = 'studio') or ("budgets"."scope" = 'channel' and "budgets"."channel_id" is not null and "budgets"."scope_key" = "budgets"."channel_id"::text));--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_cap_ok" CHECK ("budgets"."cap_cents" is null or "budgets"."cap_cents" >= 0);--> statement-breakpoint
ALTER TABLE "cost_ledger" ADD CONSTRAINT "cost_ledger_amount_ok" CHECK (("cost_ledger"."source" = 'estimate' and "cost_ledger"."actual_cents" is null and "cost_ledger"."estimate_cents" >= 0) or ("cost_ledger"."source" <> 'estimate' and "cost_ledger"."actual_cents" is not null and "cost_ledger"."actual_cents" >= 0));