// Prism Studio's durable state. Every business fact lives here (the repo's *.md files are developer memory only).
// Times are stored in UTC (timestamptz); the display timezone is a studio setting (America/Los_Angeles by default).
// Money is integer cents. Demo rows carry is_demo = true and never reserve real rewards or count as real progress.
import { sql } from "drizzle-orm";
import {
  pgTable, pgEnum, uuid, text, integer, boolean, timestamp, jsonb, real, uniqueIndex, index, primaryKey, bigint, date, check,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updated = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const topicEnum = pgEnum("topic", ["skincare", "physics", "body", "space", "whatif"]);
export const platformEnum = pgEnum("platform", ["youtube", "tiktok", "instagram"]);
export const automationEnum = pgEnum("automation_mode", ["draft", "approved", "autopilot"]);
export const publishMethodEnum = pgEnum("publish_method", ["manual", "api", "provider"]);
export const provenanceEnum = pgEnum("provenance", ["unset", "owner_entered", "owner_confirmed", "integration_verified"]);
export const episodeStateEnum = pgEnum("episode_state", [
  "idea", "research", "outline", "script", "fact_check", "storyboard", "assets", "narration", "captions", "render",
  "quality_check", "ready_for_review", "approved", "scheduled", "uploading", "processing", "published", "analytics",
  "blocked", "failed", "cancelled", "superseded", "correction_needed",
]);
export const pubStatusEnum = pgEnum("publication_status", [
  "planned", "ready", "handed_off", "owner_reported", "scheduled_on_platform", "verified_published", "failed", "cancelled",
]);
export const jobStatusEnum = pgEnum("job_status", ["queued", "running", "succeeded", "failed", "cancelled", "dead", "blocked"]);
export const metricSourceEnum = pgEnum("metric_source", ["api", "csv", "manual", "estimate", "demo"]);
export const rewardStatusEnum = pgEnum("reward_status", ["pending_funding", "reserved", "claimed", "released"]);
export const ledgerKindEnum = pgEnum("ledger_kind", ["allocation", "adjustment", "reservation", "release", "claim"]);
export const challengeTierEnum = pgEnum("challenge_tier", ["intro", "series", "advanced", "masterwork", "optional"]);
export const challengeStatusEnum = pgEnum("challenge_status", ["locked", "active", "completed"]);

// ── studio ──────────────────────────────────────────────────────────────────
export const studioSettings = pgTable("studio_settings", {
  id: integer("id").primaryKey().default(1),           // a single row
  name: text("name").notNull().default("Prism Studio"),
  timezone: text("timezone").notNull().default("America/Los_Angeles"),
  instagramDaily: integer("instagram_daily").notNull().default(2),
  shortsPerChannelDaily: integer("shorts_per_channel_daily").notNull().default(1),
  bufferDays: integer("buffer_days").notNull().default(3),
  lessonBundleSize: integer("lesson_bundle_size").notNull().default(6),
  globalPause: boolean("global_pause").notNull().default(false),
  stopExternalActions: boolean("stop_external_actions").notNull().default(false),
  missedSlotPolicy: text("missed_slot_policy").notNull().default("reschedule"),   // reschedule, never a catch-up burst
  celebrationSound: boolean("celebration_sound").notNull().default(false),
  lowPowerArt: boolean("low_power_art").notNull().default(false),
  paidGenerationEnabled: boolean("paid_generation_enabled").notNull().default(false),
  showDemo: boolean("show_demo").notNull().default(false),    // off: demo rows are hidden; on: shown, labelled DEMO, never counted
  updatedAt: updated(),
});

// ── channels and their publishing destinations ─────────────────────────────
export const channels = pgTable("channels", {
  id: id(),
  slug: text("slug").notNull().unique(),
  topic: topicEnum("topic").notNull().unique(),
  name: text("name").notNull(),
  nameProvisional: boolean("name_provisional").notNull().default(true),
  tagline: text("tagline").notNull().default(""),
  color: text("color").notNull(),            // the topic colour (UI + Instagram brand guide)
  colorInk: text("color_ink").notNull(),     // a text-safe shade of it
  label: text("label").notNull(),            // the Instagram topic label ("PHYSICS")
  voice: jsonb("voice").$type<{ narrator: string; provider: string; settings?: Record<string, unknown>; pronunciation?: Record<string, string> }>().notNull(),
  editorial: jsonb("editorial").$type<Editorial>().notNull(),
  filmsPath: text("films_path"),             // films/channels/<x> in the films repo, when the channel has one
  automationMode: automationEnum("automation_mode").notNull().default("draft"),
  paused: boolean("paused").notNull().default(false),
  sort: integer("sort").notNull().default(0),
  createdAt: created(),
  updatedAt: updated(),
});
export type Editorial = { audience: string; tone: string; visualGrammar: string; claimStandards: string; examples: string[]; avoid: string[] };

export const destinations = pgTable("destinations", {
  id: id(),
  platform: platformEnum("platform").notNull(),
  channelId: uuid("channel_id").references(() => channels.id, { onDelete: "cascade" }),   // null = the shared Instagram
  shared: boolean("shared").notNull().default(false),
  displayName: text("display_name").notNull().default(""),
  handle: text("handle").notNull().default(""),
  platformAccountId: text("platform_account_id").notNull().default(""),
  avatarUrl: text("avatar_url").notNull().default(""),
  profileUrl: text("profile_url").notNull().default(""),
  studioUrl: text("studio_url").notNull().default(""),
  uploadUrl: text("upload_url").notNull().default(""),
  loginHelpUrl: text("login_help_url").notNull().default(""),
  publishMethod: publishMethodEnum("publish_method").notNull().default("manual"),
  provenance: provenanceEnum("provenance").notNull().default("unset"),
  lastConfirmedAt: timestamp("last_confirmed_at", { withTimezone: true }),
  selectionNote: text("selection_note").notNull().default(""),
  email: text("email").notNull().default(""),          // owner-private
  paused: boolean("paused").notNull().default(false),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [uniqueIndex("destinations_channel_platform").on(t.channelId, t.platform), index("destinations_platform").on(t.platform)]);

export const connections = pgTable("connections", {      // OAuth / provider grants (Stage C); a saved URL is NOT a connection
  id: id(),
  destinationId: uuid("destination_id").references(() => destinations.id, { onDelete: "cascade" }).notNull(),
  kind: text("kind").notNull(),             // "youtube_oauth", "instagram_graph", "provider:<name>"
  scopes: text("scopes").array().notNull().default(sql`'{}'::text[]`),
  verifiedAccountId: text("verified_account_id").notNull().default(""),
  tokenCipher: text("token_cipher"),        // encrypted server-side; never sent to the client
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  status: text("status").notNull().default("disconnected"),   // connected, expired, revoked, error
  capabilities: jsonb("capabilities").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: created(),
  updatedAt: updated(),
});

// ── series, seasons, episodes ───────────────────────────────────────────────
export const series = pgTable("series", {
  id: id(),
  channelId: uuid("channel_id").references(() => channels.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  objective: text("objective").notNull().default(""),
  audience: text("audience").notNull().default(""),
  prerequisites: text("prerequisites").notNull().default(""),
  status: text("status").notNull().default("planning"),   // planning, active, complete
  isDemo: boolean("is_demo").notNull().default(false),
  sort: integer("sort").notNull().default(0),
  createdAt: created(),
});

export const seasons = pgTable("seasons", {
  id: id(),
  seriesId: uuid("series_id").references(() => series.id, { onDelete: "cascade" }).notNull(),
  number: integer("number").notNull(),
  title: text("title").notNull().default(""),
}, (t) => [uniqueIndex("seasons_series_number").on(t.seriesId, t.number)]);

export const episodeCounters = pgTable("episode_counters", {
  channelId: uuid("channel_id").references(() => channels.id, { onDelete: "cascade" }).primaryKey(),
  nextNumber: integer("next_number").notNull().default(1),
});

export const episodes = pgTable("episodes", {
  id: id(),
  channelId: uuid("channel_id").references(() => channels.id, { onDelete: "cascade" }).notNull(),
  seriesId: uuid("series_id").references(() => series.id, { onDelete: "set null" }),
  seasonId: uuid("season_id").references(() => seasons.id, { onDelete: "set null" }),
  number: integer("number").notNull(),              // channel-wide episode number, allocated transactionally
  seriesOrder: integer("series_order"),
  title: text("title").notNull(),
  question: text("question").notNull().default(""),   // the hook question
  objective: text("objective").notNull().default(""),
  state: episodeStateEnum("state").notNull().default("idea"),
  script: text("script").notNull().default(""),
  storyboard: jsonb("storyboard").$type<{ beat: string; picture: string; seconds?: number; vo?: string }[]>().notNull().default([]),
  captionsSrt: text("captions_srt").notNull().default(""),
  revisionNotes: text("revision_notes").notNull().default(""),
  durationS: real("duration_s"),
  filmsPath: text("films_path"),                     // films/channels/<x>/epNN for imported episodes
  tags: jsonb("tags").$type<Record<string, string>>().notNull().default({}),   // creative choices (hook, pace, style…)
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [uniqueIndex("episodes_channel_number").on(t.channelId, t.number), index("episodes_state").on(t.state)]);

export const sources = pgTable("sources", {
  id: id(),
  episodeId: uuid("episode_id").references(() => episodes.id, { onDelete: "cascade" }).notNull(),
  claimKey: text("claim_key").notNull().default(""),   // c1, c2… from claims.json
  claim: text("claim").notNull(),
  sentence: text("sentence").notNull().default(""),
  url: text("url").notNull().default(""),
  publisher: text("publisher").notNull().default(""),
  title: text("title").notNull().default(""),
  retrievedAt: text("retrieved_at").notNull().default(""),
  verifiedVia: text("verified_via").notNull().default(""),   // "page", "search excerpt"
  evidence: text("evidence").notNull().default("established"),   // established, preliminary, estimate, assumption
  uncertainty: text("uncertainty").notNull().default(""),
  status: text("status").notNull().default("ok"),            // ok, needs-wording, unresolved
  reviewerOk: boolean("reviewer_ok").notNull().default(false),
});

// a rendered version of an episode, and its per-platform exports (each with its own metadata)
export const versions = pgTable("versions", {
  id: id(),
  episodeId: uuid("episode_id").references(() => episodes.id, { onDelete: "cascade" }).notNull(),
  versionNo: integer("version_no").notNull(),
  label: text("label").notNull().default(""),
  videoPath: text("video_path").notNull(),           // media key (relative to the storage root) or films-repo path
  posterPath: text("poster_path").notNull().default(""),
  srtPath: text("srt_path").notNull().default(""),
  width: integer("width"), height: integer("height"), durationS: real("duration_s"),
  sha256: text("sha256").notNull(),
  qa: jsonb("qa").$type<Record<string, unknown>>().notNull().default({}),
  superseded: boolean("superseded").notNull().default(false),
  createdAt: created(),
}, (t) => [uniqueIndex("versions_episode_no").on(t.episodeId, t.versionNo)]);

export const platformExports = pgTable("platform_exports", {
  id: id(),
  versionId: uuid("version_id").references(() => versions.id, { onDelete: "cascade" }).notNull(),
  platform: platformEnum("platform").notNull(),
  filePath: text("file_path").notNull(),
  fileSha256: text("file_sha256").notNull(),
  title: text("title").notNull().default(""),
  caption: text("caption").notNull().default(""),
  hashtags: text("hashtags").notNull().default(""),
  coverPath: text("cover_path").notNull().default(""),
  disclosures: jsonb("disclosures").$type<{ aiVoice?: boolean; aiVisuals?: boolean; branded?: boolean; notes?: string }>().notNull().default({}),
  postingNotes: text("posting_notes").notNull().default(""),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [uniqueIndex("exports_version_platform").on(t.versionId, t.platform)]);

// an approval binds one exact export (file + metadata) to one destination, by content hash
export const approvals = pgTable("approvals", {
  id: id(),
  episodeId: uuid("episode_id").references(() => episodes.id, { onDelete: "cascade" }).notNull(),
  exportId: uuid("export_id").references(() => platformExports.id, { onDelete: "cascade" }).notNull(),
  destinationId: uuid("destination_id").references(() => destinations.id, { onDelete: "cascade" }).notNull(),
  contentHash: text("content_hash").notNull(),
  approvedAt: timestamp("approved_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokedReason: text("revoked_reason"),
}, (t) => [index("approvals_export").on(t.exportId)]);

export const reviewNotes = pgTable("review_notes", {
  id: id(),
  episodeId: uuid("episode_id").references(() => episodes.id, { onDelete: "cascade" }).notNull(),
  versionId: uuid("version_id").references(() => versions.id, { onDelete: "set null" }),
  kind: text("kind").notNull(),          // edit_request, hold, note
  body: text("body").notNull(),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: created(),
});

// one record per destination: YouTube success never marks TikTok or Instagram
export const publications = pgTable("publications", {
  id: id(),
  episodeId: uuid("episode_id").references(() => episodes.id, { onDelete: "cascade" }).notNull(),
  destinationId: uuid("destination_id").references(() => destinations.id, { onDelete: "cascade" }).notNull(),
  exportId: uuid("export_id").references(() => platformExports.id, { onDelete: "set null" }),
  kind: text("kind").notNull().default("short"),    // short, lesson, instagram
  status: pubStatusEnum("status").notNull().default("planned"),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  originalSlot: timestamp("original_slot", { withTimezone: true }),
  handedOffAt: timestamp("handed_off_at", { withTimezone: true }),
  reportedAt: timestamp("reported_at", { withTimezone: true }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  postUrl: text("post_url").notNull().default(""),
  postId: text("post_id").notNull().default(""),
  evidence: text("evidence").notNull().default("none"),   // none, owner_reported, api_verified
  method: publishMethodEnum("method").notNull().default("manual"),
  simulated: boolean("simulated").notNull().default(false),
  note: text("note").notNull().default(""),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [
  uniqueIndex("publications_episode_destination").on(t.episodeId, t.destinationId),
  index("publications_scheduled").on(t.scheduledFor),
]);

export const blackouts = pgTable("blackouts", {
  id: id(),
  channelId: uuid("channel_id").references(() => channels.id, { onDelete: "cascade" }),     // null = global
  destinationId: uuid("destination_id").references(() => destinations.id, { onDelete: "cascade" }),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  note: text("note").notNull().default(""),
});

export const publishingWindows = pgTable("publishing_windows", {    // provisional local-time slots per platform
  id: id(),
  platform: platformEnum("platform").notNull(),
  channelId: uuid("channel_id").references(() => channels.id, { onDelete: "cascade" }),
  localTime: text("local_time").notNull(),     // "HH:MM" in the studio timezone
  provisional: boolean("provisional").notNull().default(true),
});

// ── lessons (expanded YouTube) ──────────────────────────────────────────────
export const lessons = pgTable("lessons", {
  id: id(),
  channelId: uuid("channel_id").references(() => channels.id, { onDelete: "cascade" }).notNull(),
  seriesId: uuid("series_id").references(() => series.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  organizingQuestion: text("organizing_question").notNull().default(""),
  outline: jsonb("outline").$type<{ part: string; episodeId?: string; seconds?: number; note?: string }[]>().notNull().default([]),
  state: episodeStateEnum("state").notNull().default("outline"),
  videoPath: text("video_path").notNull().default(""),
  name: text("name").notNull().default(""),                  // vol01, vol02… (the compilation's folder name)
  videoSha256: text("video_sha256").notNull().default(""),
  thumbnailPath: text("thumbnail_path").notNull().default(""),
  chapters: text("chapters").notNull().default(""),          // YouTube chapters, ready to paste
  description: text("description").notNull().default(""),    // ready to paste: chapters, sources, AI label
  qa: jsonb("qa").$type<Record<string, unknown>>().notNull().default({}),
  approvedHash: text("approved_hash").notNull().default(""), // sha256(video, title, description) at approval
  postUrl: text("post_url").notNull().default(""),
  reportedAt: timestamp("reported_at", { withTimezone: true }),
  isTestFixture: boolean("is_test_fixture").notNull().default(false),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: created(),
  updatedAt: updated(),
});
export const lessonEpisodes = pgTable("lesson_episodes", {          // a consumed bundle: an episode joins one lesson
  lessonId: uuid("lesson_id").references(() => lessons.id, { onDelete: "cascade" }).notNull(),
  episodeId: uuid("episode_id").references(() => episodes.id, { onDelete: "cascade" }).notNull().unique(),
  position: integer("position").notNull(),
}, (t) => [primaryKey({ columns: [t.lessonId, t.episodeId] })]);

// ── jobs (durable queue with leases) ───────────────────────────────────────
export const jobs = pgTable("jobs", {
  id: id(),
  type: text("type").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  status: jobStatusEnum("status").notNull().default("queued"),
  channelId: uuid("channel_id").references(() => channels.id, { onDelete: "set null" }),   // fair queue key
  priority: integer("priority").notNull().default(0),
  runAfter: timestamp("run_after", { withTimezone: true }).notNull().defaultNow(),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  leaseUntil: timestamp("lease_until", { withTimezone: true }),
  heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }),
  lockedBy: text("locked_by"),
  progress: real("progress"),
  message: text("message").notNull().default(""),
  idempotencyKey: text("idempotency_key").unique(),
  result: jsonb("result").$type<Record<string, unknown>>(),
  error: text("error"),
  cancelRequested: boolean("cancel_requested").notNull().default(false),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [index("jobs_ready").on(t.status, t.runAfter)]);

// ── analytics ───────────────────────────────────────────────────────────────
export const metricSnapshots = pgTable("metric_snapshots", {
  id: id(),
  publicationId: uuid("publication_id").references(() => publications.id, { onDelete: "cascade" }).notNull(),
  metric: text("metric").notNull(),           // views, avg_view_duration_s, likes, … (unavailable = no row, never 0)
  value: real("value").notNull(),
  unit: text("unit").notNull().default("count"),
  definition: text("definition").notNull().default(""),
  periodStart: timestamp("period_start", { withTimezone: true }),
  periodEnd: timestamp("period_end", { withTimezone: true }),
  ageHours: real("age_hours"),
  retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull().defaultNow(),
  source: metricSourceEnum("source").notNull(),
  status: text("status").notNull().default("ok"),        // ok, revised, flagged
  supersedes: uuid("supersedes"),
}, (t) => [index("metrics_pub_metric").on(t.publicationId, t.metric)]);

export const experiments = pgTable("experiments", {
  id: id(),
  channelId: uuid("channel_id").references(() => channels.id, { onDelete: "cascade" }).notNull(),
  hypothesis: text("hypothesis").notNull(),
  change: text("change").notNull(),
  metric: text("metric").notNull(),
  minSample: integer("min_sample").notNull().default(6),
  window: text("window").notNull().default("7d"),
  status: text("status").notNull().default("proposed"),   // proposed, running, retained, revised, discarded
  evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: created(),
});
export const learnings = pgTable("learnings", {
  id: id(),
  channelId: uuid("channel_id").references(() => channels.id, { onDelete: "cascade" }).notNull(),
  finding: text("finding").notNull(),
  confidence: text("confidence").notNull().default("low"),
  evidence: text("evidence").notNull().default(""),
  counterexamples: text("counterexamples").notNull().default(""),
  decision: text("decision").notNull().default(""),
  createdAt: created(),
});

// ── milestones, achievements and personal rewards ──────────────────────────
export const milestoneRules = pgTable("milestone_rules", {
  id: id(),
  key: text("key").notNull().unique(),             // "1m_club", "first_published", …
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  kind: text("kind").notNull(),                    // single_post_views, combined_views, first_published, series_lesson
  threshold: bigint("threshold", { mode: "number" }),
  scope: text("scope").notNull().default("studio"),   // studio (once ever) or channel (once per channel)
  rewardCents: integer("reward_cents"),             // null = cosmetic only (badge/XP)
  xp: integer("xp").notNull().default(0),
  badge: text("badge").notNull().default("ring"),
  enabled: boolean("enabled").notNull().default(true),
  sort: integer("sort").notNull().default(0),
});

export const achievementEvents = pgTable("achievement_events", {
  id: id(),
  ruleId: uuid("rule_id").references(() => milestoneRules.id, { onDelete: "cascade" }).notNull(),
  scopeKey: text("scope_key").notNull(),            // "studio" or the channel id: the once-only guard
  isDemo: boolean("is_demo").notNull().default(false),
  channelId: uuid("channel_id").references(() => channels.id, { onDelete: "set null" }),
  episodeId: uuid("episode_id").references(() => episodes.id, { onDelete: "set null" }),
  publicationId: uuid("publication_id").references(() => publications.id, { onDelete: "set null" }),
  snapshotId: uuid("snapshot_id").references(() => metricSnapshots.id, { onDelete: "set null" }),
  evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
  evidenceStatus: text("evidence_status").notNull().default("ok"),   // ok, flagged (metric revised)
  achievedAt: timestamp("achieved_at", { withTimezone: true }).notNull().defaultNow(),
  seenAt: timestamp("seen_at", { withTimezone: true }),
}, (t) => [uniqueIndex("achievement_once").on(t.ruleId, t.scopeKey, t.isDemo)]);

export const rewardSettings = pgTable("reward_settings", {
  id: integer("id").primaryKey().default(1),
  monthlyCapCents: integer("monthly_cap_cents"),   // null = unconfigured: nothing is ever reserved
  updatedAt: updated(),
});

export const rewards = pgTable("rewards", {
  id: id(),
  achievementEventId: uuid("achievement_event_id").references(() => achievementEvents.id, { onDelete: "cascade" }).notNull().unique(),
  amountCents: integer("amount_cents").notNull(),
  status: rewardStatusEnum("status").notNull().default("pending_funding"),
  description: text("description").notNull().default(""),
  reservedAt: timestamp("reserved_at", { withTimezone: true }),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  note: text("note").notNull().default(""),
  createdAt: created(),
});

export const rewardLedger = pgTable("reward_ledger", {
  id: id(),
  kind: ledgerKindEnum("kind").notNull(),
  amountCents: integer("amount_cents").notNull(),   // positive numbers; the kind gives the direction
  rewardId: uuid("reward_id").references(() => rewards.id, { onDelete: "set null" }),
  month: text("month").notNull(),                   // "YYYY-MM" in the studio timezone
  note: text("note").notNull().default(""),
  createdAt: created(),
});

// ── the Living Studio: XP, creations, challenges, evolutions ───────────────
export const xpEvents = pgTable("xp_events", {
  id: id(),
  channelId: uuid("channel_id").references(() => channels.id, { onDelete: "cascade" }).notNull(),
  kind: text("kind").notNull(),
  amount: integer("amount").notNull(),
  idempotencyKey: text("idempotency_key").notNull().unique(),   // "publish:<episode>", "challenge:<id>", …
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: created(),
});

export const creations = pgTable("creations", {
  channelId: uuid("channel_id").references(() => channels.id, { onDelete: "cascade" }).primaryKey(),
  creationKey: text("creation_key").notNull(),
  name: text("name").notNull(),
  form: integer("form").notNull().default(1),
  branch: text("branch"),                          // "a" | "b" | null (chosen at form 3)
  ascended: boolean("ascended").notNull().default(false),
  cosmetics: jsonb("cosmetics").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: updated(),
});

export const challenges = pgTable("challenges", {
  id: id(),
  channelId: uuid("channel_id").references(() => channels.id, { onDelete: "cascade" }).notNull(),
  key: text("key").notNull(),
  tier: challengeTierEnum("tier").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  requirement: jsonb("requirement").$type<{ check: string; count?: number; note?: string }>().notNull(),
  status: challengeStatusEnum("status").notNull().default("locked"),
  activeOptional: boolean("active_optional").notNull().default(false),
  evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (t) => [uniqueIndex("challenges_channel_key").on(t.channelId, t.key)]);

export const evolutions = pgTable("evolutions", {
  id: id(),
  channelId: uuid("channel_id").references(() => channels.id, { onDelete: "cascade" }).notNull(),
  toForm: integer("to_form").notNull(),             // 2…5, or 6 for the Ascended appearance
  eligibleAt: timestamp("eligible_at", { withTimezone: true }).notNull().defaultNow(),
  evolvedAt: timestamp("evolved_at", { withTimezone: true }),
  seenAt: timestamp("seen_at", { withTimezone: true }),
  evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
}, (t) => [uniqueIndex("evolutions_once").on(t.channelId, t.toForm)]);

// ── onboarding checklist ───────────────────────────────────────────────────
export const onboarding = pgTable("onboarding", {
  id: id(),
  channelId: uuid("channel_id").references(() => channels.id, { onDelete: "cascade" }),   // null = shared Instagram / studio
  item: text("item").notNull(),        // email, youtube, tiktok, handles, links, upload_test, instagram
  done: boolean("done").notNull().default(false),
  doneAt: timestamp("done_at", { withTimezone: true }),
}, (t) => [uniqueIndex("onboarding_item").on(t.channelId, t.item)]);

// ── costs (production budgets: separate from personal rewards; Prism records costs, it never pays or moves money) ──
// A production budget is monthly, studio-wide or for one channel. A row applies from its month on, until a later row
// for the same scope replaces it (cap null = no budget from that month).
export const budgets = pgTable("budgets", {
  id: id(),
  scope: text("scope").notNull(),           // studio, channel
  scopeKey: text("scope_key").notNull().default("studio"),   // "studio" or the channel id: one row per scope per month
  channelId: uuid("channel_id").references(() => channels.id, { onDelete: "cascade" }),
  month: text("month").notNull().default(""),   // "YYYY-MM" in the studio timezone
  capCents: integer("cap_cents"),           // null = no budget from this month on
  currency: text("currency").notNull().default("USD"),
  concurrency: integer("concurrency"),
  note: text("note").notNull().default(""),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [
  uniqueIndex("budgets_scope_month").on(t.scopeKey, t.month),
  check("budgets_scope_ok", sql`(${t.scope} = 'studio' and ${t.channelId} is null and ${t.scopeKey} = 'studio') or (${t.scope} = 'channel' and ${t.channelId} is not null and ${t.scopeKey} = ${t.channelId}::text)`),
  check("budgets_cap_ok", sql`${t.capCents} is null or ${t.capCents} >= 0`),
]);
// One cost entry. An estimate (source "estimate") keeps its amount in estimate_cents and never counts as spent; an
// actual cost keeps it in actual_cents. Voided entries stay for the record and count for nothing.
export const costLedger = pgTable("cost_ledger", {
  id: id(),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
  channelId: uuid("channel_id").references(() => channels.id, { onDelete: "set null" }),
  episodeId: uuid("episode_id").references(() => episodes.id, { onDelete: "set null" }),
  category: text("category").notNull(),     // voice, visuals, music, research, render, storage, software, publishing, other
  description: text("description").notNull().default(""),   // what it was
  provider: text("provider").notNull().default("local"),     // who was paid (owner-entered), or the job's provider
  source: text("source").notNull().default("manual"),        // manual (owner-recorded actual), estimate
  currency: text("currency").notNull().default("USD"),
  estimateCents: integer("estimate_cents").notNull().default(0),
  actualCents: integer("actual_cents"),
  incurredOn: date("incurred_on", { mode: "string" }).notNull().default(sql`CURRENT_DATE`),   // a calendar day in the studio timezone
  reserved: boolean("reserved").notNull().default(false),
  note: text("note").notNull().default(""),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
  voidReason: text("void_reason").notNull().default(""),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [
  index("cost_ledger_incurred").on(t.incurredOn),
  check("cost_ledger_amount_ok", sql`(${t.source} = 'estimate' and ${t.actualCents} is null and ${t.estimateCents} >= 0) or (${t.source} <> 'estimate' and ${t.actualCents} is not null and ${t.actualCents} >= 0)`),
]);

// ── audit ──────────────────────────────────────────────────────────────────
export const auditLog = pgTable("audit_log", {
  id: id(),
  actor: text("actor").notNull(),           // owner, worker, system
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull().default(""),
  detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: created(),
}, (t) => [index("audit_created").on(t.createdAt)]);
