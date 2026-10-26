// Display helpers shared by the screens.
import type { CSSProperties } from "react";
export const money = (cents: number | null | undefined) =>
  cents == null ? "—" : (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 ? 2 : 0 });

export const count = (n: number | null | undefined) => (n == null ? "—" : Math.round(n).toLocaleString("en-US"));

export const compact = (n: number) => Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export const STATE_LABEL: Record<string, string> = {
  idea: "Idea", research: "Research", outline: "Outline", script: "Script", fact_check: "Fact check", storyboard: "Storyboard",
  assets: "Assets", narration: "Narration", captions: "Captions", render: "Render", quality_check: "Quality check",
  ready_for_review: "Ready for review", approved: "Approved", scheduled: "Scheduled", uploading: "Uploading", processing: "Processing",
  published: "Published", analytics: "Analytics", blocked: "Blocked", failed: "Failed", cancelled: "Cancelled",
  superseded: "Superseded", correction_needed: "Correction needed",
};
export const stateTone = (s: string) =>
  ["published", "analytics", "approved"].includes(s) ? "good" : ["blocked", "failed", "correction_needed"].includes(s) ? "bad"
    : s === "ready_for_review" ? "warn" : ["scheduled", "uploading", "processing"].includes(s) ? "info" : "";

export const PUB_LABEL: Record<string, string> = {
  planned: "Planned", ready: "Ready", handed_off: "Handed off (not yet confirmed)", owner_reported: "Uploaded (you confirmed)",
  scheduled_on_platform: "Scheduled on the platform", verified_published: "Published (verified)", failed: "Failed", cancelled: "Cancelled",
};
export const pubTone = (s: string) =>
  ["owner_reported", "verified_published"].includes(s) ? "good" : s === "scheduled_on_platform" ? "info" : s === "handed_off" ? "warn" : s === "failed" ? "bad" : "";

export const PLATFORM_LABEL = { youtube: "YouTube", tiktok: "TikTok", instagram: "Instagram" } as const;

export const PROVENANCE_LABEL: Record<string, string> = {
  unset: "Not set up", owner_entered: "Entered by you", owner_confirmed: "Confirmed by you", integration_verified: "Verified by integration",
};

export const topicStyle = (c: { color: string; colorInk: string }) =>
  ({ ["--topic" as string]: c.color, ["--topic-ink" as string]: c.colorInk }) as CSSProperties;

/** Failed gates in a delivery QA report (kits/cinema/film/qa.py), or null when no report was attached. */
export const qaFails = (qa: Record<string, unknown> | null | undefined): number | null =>
  qa && Array.isArray(qa.fails) ? qa.fails.length : null;
