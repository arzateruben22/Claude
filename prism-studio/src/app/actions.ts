"use server";
// Every mutation the screens can make. Each action re-checks the owner's session (the proxy already did), validates
// its input with zod, calls the domain layer, and revalidates the screens that show the result.
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import * as S from "@/db/schema";
import { audit, DomainError, settings } from "@/domain/core";
import { editExport, transitionEpisode, type EpisodeState } from "@/domain/episodes";
import { approve } from "@/domain/approvals";
import { markHandedOff, markUploaded, undoUploaded } from "@/domain/publications";
import { addFunding, claimReward, recordMetric, releaseReward, setMonthlyCap } from "@/domain/rewards";
import { chooseCosmetic, completeChallenge, evolve, markEvolutionSeen, onPublicationReported } from "@/domain/living";
import { planDays, unschedule } from "@/domain/schedule";
import { enqueue, requestCancel, retry } from "@/domain/jobs";
import { addCost, editCost, paidSwitch, parseMoney, setBudget, voidCost, type CostInput } from "@/domain/costs";
import { localDate, zonedTimeToUtc } from "@/domain/time";
import { attemptSignIn, clientKey, safeNextPath, SignInThrottle } from "@/domain/signin";
import { checkPasswordAsync } from "@/lib/auth";
import { COOKIE, DEVICE_COOKIE, makeDeviceMark, makeSession, verifyDeviceMark } from "@/lib/session";
import { requireOwner } from "@/lib/owner";
import { PLATFORM_LABEL } from "@/lib/format";

export type Result = { ok: boolean; message: string; data?: Record<string, unknown> } | null;
const ok = (message: string, data?: Record<string, unknown>): Result => ({ ok: true, message, data });
const fail = (e: unknown): Result => ({ ok: false, message: e instanceof DomainError || e instanceof z.ZodError ? (e instanceof z.ZodError ? e.issues[0]?.message ?? "check the form" : e.message) : (console.error(e), "Something went wrong. Nothing was changed.") });

async function run(fn: () => Promise<Result>): Promise<Result> {
  try { await requireOwner(); return await fn(); } catch (e) { return fail(e); }
}
const refresh = (...paths: string[]) => { for (const p of ["/", ...paths]) revalidatePath(p); };
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

// ── sign in / out ──────────────────────────────────────────────────────────
// one throttle per web process (globalThis: survives dev reloads); the rules and the audit entries are in the domain
const g = globalThis as unknown as { __prismSignIn?: SignInThrottle };
const throttle = () => (g.__prismSignIn ??= new SignInThrottle());
export async function signIn(_: Result, fd: FormData): Promise<Result> {
  const h = await headers(), jar = await cookies();
  const r = await attemptSignIn({
    throttle: throttle(),
    client: clientKey(h.get("x-forwarded-for"), h.get("x-real-ip")),
    knownDevice: await verifyDeviceMark(jar.get(DEVICE_COOKIE)?.value).catch(() => false),   // signed in here before: past the studio-wide ceiling
    passphrase: str(fd, "passphrase"),   // trimmed, as before (phone keyboards add a trailing space)
    check: (p) => checkPasswordAsync(p),
    audit: (action, detail) => audit(db(), action === "auth.sign_in" ? "owner" : "system", action, "owner", "", detail),
  });
  if (!r.ok) return { ok: false, message: r.message };
  const secure = process.env.NODE_ENV === "production";
  const s = await makeSession(), m = await makeDeviceMark();
  jar.set(COOKIE, s.value, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: s.maxAge });
  jar.set(DEVICE_COOKIE, m.value, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: m.maxAge });
  redirect(safeNextPath(str(fd, "next")));   // a path on this site only: no //host, /\host or /<tab>/host
}

export async function signOut() {
  (await cookies()).delete(COOKIE);
  redirect("/login");
}

// ── episodes, review and approvals ─────────────────────────────────────────
export async function moveEpisode(_: Result, fd: FormData) {
  return run(async () => {
    const id = z.string().uuid().parse(fd.get("episodeId")), to = str(fd, "to") as EpisodeState;
    const r = await transitionEpisode(db(), id, to);
    refresh(`/episodes/${id}`, "/review");
    return ok(`Moved to ${r.to.replace(/_/g, " ")}.`);
  });
}

const exportSchema = z.object({
  exportId: z.string().uuid(),
  title: z.string().max(100, "YouTube titles are at most 100 characters"),
  caption: z.string().max(2200, "Captions are at most 2,200 characters"),
  hashtags: z.string().max(400),
  postingNotes: z.string().max(20000, "Posting notes are at most 20,000 characters"),   // the sources thread can run to several 2,200-character comments
});
export async function saveExport(_: Result, fd: FormData) {
  return run(async () => {
    const v = exportSchema.parse(Object.fromEntries(["exportId", "title", "caption", "hashtags", "postingNotes"].map((k) => [k, str(fd, k)])));
    const aiVoice = fd.get("aiVoice") === "on", aiVisuals = fd.get("aiVisuals") === "on", branded = fd.get("branded") === "on";
    const [x] = await db().select().from(S.platformExports).where(eq(S.platformExports.id, v.exportId));
    const r = await editExport(db(), v.exportId, { title: v.title, caption: v.caption, hashtags: v.hashtags, postingNotes: v.postingNotes, disclosures: { ...(x?.disclosures ?? {}), aiVoice, aiVisuals, branded } });
    refresh("/review", "/upload");
    return ok(r.revoked ? `Saved. ${r.revoked} approval${r.revoked > 1 ? "s" : ""} no longer matched and ${r.revoked > 1 ? "were" : "was"} withdrawn: approve again.` : "Saved.");
  });
}

export async function approveExport(_: Result, fd: FormData) {
  return run(async () => {
    const exportId = z.string().uuid().parse(fd.get("exportId")), destinationId = z.string().uuid().parse(fd.get("destinationId"));
    const a = await approve(db(), { exportId, destinationId });
    // the episode is approved once each of its own channel's destinations has a live approval
    const [e] = await db().select().from(S.episodes).where(eq(S.episodes.id, a.episodeId));
    const dests = await db().select().from(S.destinations).where(eq(S.destinations.channelId, e.channelId));
    const live = await db().select().from(S.approvals).where(and(eq(S.approvals.episodeId, e.id), isNull(S.approvals.revokedAt)));
    if (e.state === "ready_for_review" && dests.every((d) => live.some((l) => l.destinationId === d.id))) await transitionEpisode(db(), e.id, "approved");
    await db().update(S.publications).set({ status: "ready", updatedAt: new Date() })
      .where(and(eq(S.publications.episodeId, e.id), eq(S.publications.destinationId, destinationId), eq(S.publications.status, "planned")));
    refresh(`/episodes/${e.id}`, "/review", "/upload");
    return ok("Approved this exact video and text for that account.");
  });
}

export async function withdrawApproval(_: Result, fd: FormData) {
  return run(async () => {
    const id = z.string().uuid().parse(fd.get("approvalId"));
    const [a] = await db().update(S.approvals).set({ revokedAt: new Date(), revokedReason: "withdrawn by owner" }).where(and(eq(S.approvals.id, id), isNull(S.approvals.revokedAt))).returning();
    if (a) {
      await db().update(S.episodes).set({ state: "ready_for_review", updatedAt: new Date() }).where(and(eq(S.episodes.id, a.episodeId), eq(S.episodes.state, "approved")));
      await audit(db(), "owner", "approval.withdraw", "approval", id);
    }
    refresh("/review", "/upload");
    return ok("Approval withdrawn.");
  });
}

export async function addNote(_: Result, fd: FormData) {
  return run(async () => {
    const episodeId = z.string().uuid().parse(fd.get("episodeId"));
    const kind = z.enum(["edit_request", "hold", "note"]).parse(fd.get("kind"));
    const body = z.string().min(2, "Write the note first").max(4000).parse(str(fd, "body"));
    const [cur] = await db().select().from(S.versions).where(and(eq(S.versions.episodeId, episodeId), eq(S.versions.superseded, false)));
    await db().insert(S.reviewNotes).values({ episodeId, versionId: cur?.id ?? null, kind, body });
    if (kind === "hold") {
      const [e] = await db().select().from(S.episodes).where(eq(S.episodes.id, episodeId));
      if (e && !["blocked", "cancelled", "superseded"].includes(e.state)) await transitionEpisode(db(), episodeId, "blocked");
    }
    refresh(`/episodes/${episodeId}`, "/review");
    return ok(kind === "hold" ? "On hold: the episode is blocked until you move it back." : "Note added.");
  });
}

export async function resolveNote(fd: FormData) {
  await requireOwner();
  const id = z.string().uuid().parse(fd.get("noteId"));
  const [n] = await db().update(S.reviewNotes).set({ resolved: true }).where(eq(S.reviewNotes.id, id)).returning();
  if (n) refresh(`/episodes/${n.episodeId}`);
}

export async function toggleSource(fd: FormData) {
  await requireOwner();
  const id = z.string().uuid().parse(fd.get("sourceId"));
  const [s] = await db().select().from(S.sources).where(eq(S.sources.id, id));
  if (!s) return;
  await db().update(S.sources).set({ reviewerOk: !s.reviewerOk }).where(eq(S.sources.id, id));
  refresh(`/episodes/${s.episodeId}`);
}

// ── Upload Desk ────────────────────────────────────────────────────────────
/** Download, share or open: the owner took the materials to the platform. Not a publication. */
export async function handedOff(publicationId: string): Promise<Result> {
  return run(async () => {
    await markHandedOff(db(), z.string().uuid().parse(publicationId));
    revalidatePath("/upload");
    return ok("Handed off. Mark it uploaded once it's live.");
  });
}

export async function reportUploaded(_: Result, fd: FormData) {
  return run(async () => {
    const id = z.string().uuid().parse(fd.get("publicationId"));
    const [p] = await db().select().from(S.publications).where(eq(S.publications.id, id));
    if (!p) throw new DomainError("not_found", "task not found");
    if (!p.exportId) throw new DomainError("no_export", "this task has no export yet");
    const { currentApproval } = await import("@/domain/approvals");
    if (!(await currentApproval(db(), p.exportId, p.destinationId))) throw new DomainError("not_approved", "Approve this exact video and text for this account first (Review).");
    if (fd.get("confirmAccount") !== "on") throw new DomainError("confirm", "Tick the box to confirm which account you posted to.");
    const when = str(fd, "scheduledAt");
    const s = await settings(db());
    const scheduledOnPlatformFor = when ? zonedTimeToUtc(when.slice(0, 10), when.slice(11, 16), s.timezone) : null;
    await markUploaded(db(), id, { postUrl: str(fd, "postUrl") || undefined, scheduledOnPlatformFor });
    await onPublicationReported(db(), id);
    refresh("/upload", "/calendar", "/analytics", `/episodes/${p.episodeId}`);
    return ok(scheduledOnPlatformFor ? "Recorded as scheduled on the platform." : "Recorded as uploaded. Nice.");
  });
}

export async function undoReport(_: Result, fd: FormData) {
  return run(async () => {
    const r = await undoUploaded(db(), z.string().uuid().parse(fd.get("publicationId")));
    refresh("/upload", "/calendar");
    return r ? ok("Undone: back on the desk.") : { ok: false, message: "Only an owner report can be undone." };
  });
}

// ── calendar ───────────────────────────────────────────────────────────────
export async function planWeek(_: Result, fd: FormData) {
  return run(async () => {
    const days = z.coerce.number().int().min(1).max(21).parse(fd.get("days") ?? 7);
    const s = await settings(db());
    const n = await planDays(db(), localDate(new Date(), s.timezone), days);
    refresh("/calendar", "/upload");
    return ok(n ? `Placed ${n} upload task${n > 1 ? "s" : ""} on the calendar.` : "Nothing to place: every open slot is filled or the backlog is empty.");
  });
}

export async function unplan(fd: FormData) {
  await requireOwner();
  await unschedule(db(), z.string().uuid().parse(fd.get("publicationId")));
  refresh("/calendar", "/upload");
}

export async function addBlackout(_: Result, fd: FormData) {
  return run(async () => {
    const s = await settings(db());
    const from = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start date").parse(str(fd, "from"));
    const to = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick an end date").parse(str(fd, "to"));
    if (to < from) throw new DomainError("dates", "The end date is before the start date.");
    const { addDays } = await import("@/domain/time");
    await db().insert(S.blackouts).values({ startsAt: zonedTimeToUtc(from, "00:00", s.timezone), endsAt: zonedTimeToUtc(addDays(to, 1), "00:00", s.timezone), note: str(fd, "note") });
    refresh("/calendar");
    return ok("Blackout added: nothing is planned in it.");
  });
}

// ── accounts and onboarding ────────────────────────────────────────────────
const OFFICIAL_HOSTS = /^(www\.|m\.)?(youtube\.com|studio\.youtube\.com|tiktok\.com|instagram\.com|business\.facebook\.com|facebook\.com)$/i;
const httpsOfficial = z.string().max(300).refine((s) => {
  if (!s) return true;
  try { const u = new URL(s); return u.protocol === "https:" && OFFICIAL_HOSTS.test(u.hostname); } catch { return false; }
}, "Links must be https links on youtube.com, tiktok.com, instagram.com or facebook.com");

export async function saveDestination(_: Result, fd: FormData) {
  return run(async () => {
    const id = z.string().uuid().parse(fd.get("destinationId"));
    const v = z.object({
      displayName: z.string().max(80), handle: z.string().max(40).regex(/^@?[\w.]*$/, "Handles use letters, numbers, _ and ."),
      platformAccountId: z.string().max(60), profileUrl: httpsOfficial, studioUrl: httpsOfficial, uploadUrl: httpsOfficial,
      email: z.union([z.literal(""), z.string().email("That email doesn't look right")]), selectionNote: z.string().max(300),
    }).parse(Object.fromEntries(["displayName", "handle", "platformAccountId", "profileUrl", "studioUrl", "uploadUrl", "email", "selectionNote"].map((k) => [k, str(fd, k)])));
    const handle = v.handle ? (v.handle.startsWith("@") ? v.handle : `@${v.handle}`) : "";
    const confirm = fd.get("confirm") === "on";
    await db().update(S.destinations).set({ ...v, handle, provenance: confirm ? "owner_confirmed" : (handle || v.profileUrl ? "owner_entered" : "unset"), lastConfirmedAt: confirm ? new Date() : undefined, updatedAt: new Date() }).where(eq(S.destinations.id, id));
    await audit(db(), "owner", "destination.save", "destination", id, { handle, confirm });
    refresh("/connections", "/upload");
    return ok(confirm ? "Saved and confirmed." : "Saved. Confirm it once you've checked the account is right.");
  });
}

export async function toggleOnboarding(fd: FormData) {
  await requireOwner();
  const id = z.string().uuid().parse(fd.get("id"));
  const [o] = await db().select().from(S.onboarding).where(eq(S.onboarding.id, id));
  if (!o) return;
  await db().update(S.onboarding).set({ done: !o.done, doneAt: o.done ? null : new Date() }).where(eq(S.onboarding.id, id));
  refresh("/connections");
}

// ── analytics ──────────────────────────────────────────────────────────────
export async function addMetric(_: Result, fd: FormData) {
  return run(async () => {
    const publicationId = z.string().uuid().parse(fd.get("publicationId"));
    const metric = z.enum(["views", "avg_view_duration_s", "likes", "comments", "shares", "followers_gained"]).parse(fd.get("metric"));
    const value = z.coerce.number({ message: "Enter a number" }).min(0).parse(str(fd, "value").replace(/[, ]/g, ""));
    const source = z.enum(["manual", "estimate", "demo"]).parse(fd.get("source") ?? "manual");
    const r = await recordMetric(db(), { publicationId, metric, value, source, definition: source === "manual" ? "owner-confirmed from the platform's analytics" : source });
    const titles = r.unlocked.length ? (await db().select().from(S.milestoneRules)).filter((m) => r.unlocked.some((u) => u.ruleId === m.id)).map((m) => m.title) : [];
    refresh("/analytics", "/rewards");
    return ok(titles.length ? `Logged. Unlocked: ${titles.join(", ")}${source === "demo" ? " (demo)" : ""}.` : "Logged.");
  });
}

/** "Refresh now": queue an API pull of this post's numbers (verified posts on a connected account only). */
export async function refreshMetrics(_: Result, fd: FormData) {
  return run(async () => {
    const publicationId = z.string().uuid().parse(fd.get("publicationId"));
    const { requestPull } = await import("@/domain/api-analytics");
    const r = await requestPull(db(), publicationId);
    const [p] = await db().select({ episodeId: S.publications.episodeId }).from(S.publications).where(eq(S.publications.id, publicationId));
    refresh("/analytics", "/queue", ...(p ? [`/episodes/${p.episodeId}`] : []));
    const name = PLATFORM_LABEL[r.platform];
    return ok(r.created ? `Queued: the worker asks ${name} now. The numbers appear here once it answers.`
      : r.status === "queued" ? "Already queued."
      : r.status === "just_pulled" ? `Just refreshed: ${name} answered less than a minute ago. Press again in a minute for another pull.`
      : `A refresh less than a minute ago didn't get numbers (see the pull status). Press again in a minute.`);
  });
}

/** CSV with a header row: post_url (or publication_id), metric, value[, source]. */
export async function importCsv(_: Result, fd: FormData) {
  return run(async () => {
    const text = str(fd, "csv");
    const [head, ...lines] = text.split(/\r?\n/).filter((l) => l.trim());
    if (!head) throw new DomainError("empty", "Paste a CSV with a header row.");
    const cols = head.split(",").map((c) => c.trim().toLowerCase());
    const at = (k: string) => cols.indexOf(k);
    if ((at("post_url") < 0 && at("publication_id") < 0) || at("metric") < 0 || at("value") < 0) throw new DomainError("header", "The header needs post_url (or publication_id), metric and value.");
    const pubs = await db().select().from(S.publications);
    let n = 0; const skipped: string[] = [];
    for (const [i, line] of lines.entries()) {
      const cells = line.split(",").map((c) => c.trim());
      const p = at("publication_id") >= 0 ? pubs.find((x) => x.id === cells[at("publication_id")]) : pubs.find((x) => x.postUrl && x.postUrl === cells[at("post_url")]);
      const value = Number(cells[at("value")]?.replace(/[ _]/g, ""));
      if (!p || !Number.isFinite(value)) { skipped.push(`row ${i + 2}`); continue; }
      await recordMetric(db(), { publicationId: p.id, metric: cells[at("metric")], value, source: "csv", definition: "imported from a platform CSV export" });
      n++;
    }
    refresh("/analytics", "/rewards");
    return ok(`Imported ${n} row${n === 1 ? "" : "s"}${skipped.length ? `; skipped ${skipped.join(", ")} (no matching post or not a number)` : ""}.`);
  });
}

// ── rewards ────────────────────────────────────────────────────────────────
const dollars = z.coerce.number({ message: "Enter an amount" }).min(0).max(1_000_000).transform((v) => Math.round(v * 100));
export async function saveCap(_: Result, fd: FormData) {
  return run(async () => {
    const raw = str(fd, "cap");
    await setMonthlyCap(db(), raw === "" ? null : dollars.parse(raw));
    refresh("/rewards");
    return ok(raw === "" ? "Monthly cap cleared: nothing will be reserved." : "Monthly cap saved.");
  });
}
export async function fund(_: Result, fd: FormData) {
  return run(async () => {
    const cents = dollars.parse(str(fd, "amount"));
    await addFunding(db(), { amountCents: cents, note: str(fd, "note") });
    refresh("/rewards");
    return ok("Recorded. This only tracks money you set aside yourself; Prism never moves money.");
  });
}
export async function claim(_: Result, fd: FormData) {
  return run(async () => {
    await claimReward(db(), z.string().uuid().parse(fd.get("rewardId")), { description: str(fd, "description"), note: str(fd, "note") });
    refresh("/rewards");
    return ok("Enjoy it. Recorded as claimed.");
  });
}
export async function release(_: Result, fd: FormData) {
  return run(async () => {
    await releaseReward(db(), z.string().uuid().parse(fd.get("rewardId")), str(fd, "note") || "released by owner");
    refresh("/rewards");
    return ok("Released back to the budget.");
  });
}
export async function seeAchievementIds(ids: string[]) {
  await requireOwner();
  const valid = z.array(z.string().uuid()).max(50).parse(ids);
  if (valid.length) await db().update(S.achievementEvents).set({ seenAt: new Date() }).where(and(inArray(S.achievementEvents.id, valid), isNull(S.achievementEvents.seenAt)));
  refresh("/rewards");
}
export async function seeAchievements() {
  await requireOwner();
  await db().update(S.achievementEvents).set({ seenAt: new Date() }).where(isNull(S.achievementEvents.seenAt));
  refresh("/rewards");
}

// ── the living studio ──────────────────────────────────────────────────────
export async function finishChallenge(_: Result, fd: FormData) {
  return run(async () => {
    const id = z.string().uuid().parse(fd.get("challengeId"));
    const c = await completeChallenge(db(), id, { note: str(fd, "note"), by: "owner" });
    const [ch] = await db().select().from(S.channels).where(eq(S.channels.id, c.channelId));
    refresh(`/evolution/${ch.slug}`, `/channels/${ch.slug}`);
    return ok("Challenge complete.");
  });
}
export async function toggleQuest(fd: FormData) {
  await requireOwner();
  const id = z.string().uuid().parse(fd.get("challengeId"));
  const [c] = await db().select().from(S.challenges).where(eq(S.challenges.id, id));
  if (!c || c.tier !== "optional" || c.status === "completed") return;
  await db().update(S.challenges).set({ activeOptional: !c.activeOptional, status: c.activeOptional ? "locked" : "active" }).where(eq(S.challenges.id, id));
  const [ch] = await db().select().from(S.channels).where(eq(S.channels.id, c.channelId));
  refresh(`/evolution/${ch.slug}`);
}
export async function evolveNow(_: Result, fd: FormData) {
  return run(async () => {
    const channelId = z.string().uuid().parse(fd.get("channelId"));
    const branch = fd.get("branch") ? z.enum(["a", "b"]).parse(fd.get("branch")) : undefined;
    const r = await evolve(db(), channelId, { branch, ascend: fd.get("ascend") === "1" });
    const [ch] = await db().select().from(S.channels).where(eq(S.channels.id, channelId));
    refresh(`/evolution/${ch.slug}`, `/channels/${ch.slug}`);
    return ok(r.toForm === 6 ? "Ascended." : `Evolved to form ${r.toForm}.`, { toForm: r.toForm, from: r.from });
  });
}
export async function seenEvolution(id: string) {
  await requireOwner();
  await markEvolutionSeen(db(), z.string().uuid().parse(id));
  revalidatePath("/");
}
export async function saveCosmetics(_: Result, fd: FormData) {
  return run(async () => {
    const channelId = z.string().uuid().parse(fd.get("channelId"));
    await chooseCosmetic(db(), channelId, { motion: z.enum(["full", "reduced", "static"]).parse(fd.get("motion") ?? "full") });
    refresh();
    return ok("Saved.");
  });
}

// ── channels, settings, jobs ───────────────────────────────────────────────
export async function saveChannel(_: Result, fd: FormData) {
  return run(async () => {
    const id = z.string().uuid().parse(fd.get("channelId"));
    const v = z.object({ name: z.string().min(2).max(60), tagline: z.string().max(160), automationMode: z.enum(["draft", "approved", "autopilot"]) })
      .parse({ name: str(fd, "name"), tagline: str(fd, "tagline"), automationMode: str(fd, "automationMode") || "draft" });
    if (v.automationMode === "autopilot") throw new DomainError("autopilot", "Autopilot needs a connected, verified publishing integration (Stage C). Every destination is manual today.");
    await db().update(S.channels).set({ name: v.name, tagline: v.tagline, automationMode: v.automationMode, nameProvisional: fd.get("final") !== "on", paused: fd.get("paused") === "on", updatedAt: new Date() }).where(eq(S.channels.id, id));
    await audit(db(), "owner", "channel.save", "channel", id, v);
    const [ch] = await db().select().from(S.channels).where(eq(S.channels.id, id));
    refresh(`/channels/${ch.slug}`);
    return ok("Saved.");
  });
}

export async function saveSettings(_: Result, fd: FormData) {
  return run(async () => {
    const v = z.object({
      timezone: z.string().refine((tz) => { try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; } }, "Unknown timezone"),
      instagramDaily: z.coerce.number().int().min(0).max(3), shortsPerChannelDaily: z.coerce.number().int().min(0).max(3), bufferDays: z.coerce.number().int().min(0).max(30),
    }).parse({ timezone: str(fd, "timezone"), instagramDaily: str(fd, "instagramDaily"), shortsPerChannelDaily: str(fd, "shortsPerChannelDaily"), bufferDays: str(fd, "bufferDays") });
    const showDemo = fd.get("showDemo") === "on";
    // the switch never blocks the rest of the form: a refused turn-on just stays off, with a notice
    const { on: paid, notice } = await paidSwitch(db(), fd.get("paidGenerationEnabled") === "on");
    await db().update(S.studioSettings).set({ ...v, globalPause: fd.get("globalPause") === "on", stopExternalActions: fd.get("stopExternalActions") === "on", celebrationSound: fd.get("celebrationSound") === "on", lowPowerArt: fd.get("lowPowerArt") === "on", paidGenerationEnabled: paid, showDemo, updatedAt: new Date() }).where(eq(S.studioSettings.id, 1));
    await audit(db(), "owner", "settings.save", "studio_settings", "1", { ...v, paidGenerationEnabled: paid, showDemo });
    revalidatePath("/", "layout");   // the demo switch changes what every list shows
    return ok(notice ? `Settings saved. ${notice}` : "Settings saved.");
  });
}

export async function queueJob(_: Result, fd: FormData) {
  return run(async () => {
    const type = z.enum(["import_episodes", "reschedule_missed", "refresh_evolution"]).parse(fd.get("type"));
    const r = await enqueue(db(), { type, idempotencyKey: `${type}:${new Date().toISOString().slice(0, 16)}` });
    revalidatePath("/queue");
    return ok(r.created ? "Queued. The worker picks it up within a few seconds (npm run worker)." : "Already queued this minute.");
  });
}
export async function retryJob(fd: FormData) {
  await requireOwner();
  await retry(db(), z.string().uuid().parse(fd.get("jobId")));
  revalidatePath("/queue");
}
export async function cancelJob(fd: FormData) {
  await requireOwner();
  await requestCancel(db(), z.string().uuid().parse(fd.get("jobId")));
  revalidatePath("/queue");
}

// ── lessons (compilations) ─────────────────────────────────────────────────
export async function newLesson(_: Result, fd: FormData) {
  return run(async () => {
    const channelId = z.string().uuid().parse(fd.get("channelId"));
    const episodeIds = z.array(z.string().uuid()).parse(fd.getAll("episodeIds").map(String));
    const { createLesson } = await import("@/domain/lessons");
    const l = await createLesson(db(), { channelId, episodeIds, title: str(fd, "title") });
    const [ch] = await db().select().from(S.channels).where(eq(S.channels.id, channelId));
    refresh(`/channels/${ch.slug}`, "/queue");
    return ok(`${l.name} queued: the worker builds it with compilation.mjs (a few minutes).`);
  });
}
export async function approveLessonAction(_: Result, fd: FormData) {
  return run(async () => {
    const id = z.string().uuid().parse(fd.get("lessonId"));
    const { approveLesson } = await import("@/domain/lessons");
    await approveLesson(db(), id);
    refresh();
    return ok("Approved this exact video, title and description.");
  });
}
export async function saveLesson(_: Result, fd: FormData) {
  return run(async () => {
    const id = z.string().uuid().parse(fd.get("lessonId"));
    const v = z.object({ title: z.string().min(3).max(100, "YouTube titles are at most 100 characters"), description: z.string().max(5000, "YouTube descriptions are at most 5,000 characters") })
      .parse({ title: str(fd, "title"), description: str(fd, "description") });
    const { editLesson } = await import("@/domain/lessons");
    await editLesson(db(), id, v);
    refresh();
    return ok("Saved. Approve again before uploading.");
  });
}
export async function reportLessonUploaded(_: Result, fd: FormData) {
  return run(async () => {
    const id = z.string().uuid().parse(fd.get("lessonId"));
    if (fd.get("confirmAccount") !== "on") throw new DomainError("confirm", "Tick the box to confirm which channel you uploaded to.");
    const { markLessonUploaded } = await import("@/domain/lessons");
    await markLessonUploaded(db(), id, { postUrl: str(fd, "postUrl") || undefined });
    refresh("/analytics");
    return ok("Recorded as uploaded.");
  });
}
export async function dissolveLessonAction(_: Result, fd: FormData) {
  return run(async () => {
    const id = z.string().uuid().parse(fd.get("lessonId"));
    const { dissolveLesson } = await import("@/domain/lessons");
    await dissolveLesson(db(), id);
    refresh();
    return ok("Dissolved: its episodes can join another lesson.");
  });
}

// ── experiments and learnings ──────────────────────────────────────────────
export async function addExperiment(_: Result, fd: FormData) {
  return run(async () => {
    const v = z.object({ channelId: z.string().uuid(), hypothesis: z.string().min(5).max(300), change: z.string().min(3).max(300), metric: z.enum(["views", "avg_view_duration_s", "likes", "shares", "followers_gained"]), minSample: z.coerce.number().int().min(2).max(60) })
      .parse({ channelId: fd.get("channelId"), hypothesis: str(fd, "hypothesis"), change: str(fd, "change"), metric: fd.get("metric"), minSample: str(fd, "minSample") || 6 });
    await db().insert(S.experiments).values(v);
    await audit(db(), "owner", "experiment.create", "experiment", "", { hypothesis: v.hypothesis });
    revalidatePath("/learn");
    return ok("Proposed. Change one thing, then judge it after the minimum sample.");
  });
}
export async function setExperimentStatus(_: Result, fd: FormData) {
  return run(async () => {
    const id = z.string().uuid().parse(fd.get("experimentId"));
    const status = z.enum(["proposed", "running", "retained", "revised", "discarded"]).parse(fd.get("status"));
    const [x] = await db().select().from(S.experiments).where(eq(S.experiments.id, id));
    if (!x) throw new DomainError("not_found", "experiment not found");
    const note = str(fd, "note");
    if (["retained", "revised", "discarded"].includes(status) && x.status === "running" && !note) throw new DomainError("evidence", "Say what the numbers showed before closing an experiment.");
    await db().update(S.experiments).set({ status, evidence: { ...x.evidence, [`${status}_at`]: new Date().toISOString(), ...(note ? { [`${status}_note`]: note } : {}) } }).where(eq(S.experiments.id, id));
    revalidatePath("/learn");
    return ok(`Now ${status}.`);
  });
}
export async function addLearning(_: Result, fd: FormData) {
  return run(async () => {
    const v = z.object({ channelId: z.string().uuid(), finding: z.string().min(5).max(300), confidence: z.enum(["low", "medium", "high"]), evidence: z.string().max(500), counterexamples: z.string().max(500), decision: z.string().max(300) })
      .parse({ channelId: fd.get("channelId"), finding: str(fd, "finding"), confidence: fd.get("confidence") ?? "low", evidence: str(fd, "evidence"), counterexamples: str(fd, "counterexamples"), decision: str(fd, "decision") });
    await db().insert(S.learnings).values(v);
    revalidatePath("/learn");
    return ok("Recorded.");
  });
}

// ── posting text ───────────────────────────────────────────────────────────
export async function regenerateText(_: Result, fd: FormData) {
  return run(async () => {
    const episodeId = z.string().uuid().parse(fd.get("episodeId"));
    const { regenerateExports } = await import("@/domain/exports");
    const r = await regenerateExports(db(), episodeId);
    refresh(`/episodes/${episodeId}`, "/review", "/upload");
    return ok(`Rewrote ${r.platforms} platform texts from the script.${r.revoked ? ` ${r.revoked} approval${r.revoked > 1 ? "s" : ""} withdrawn: approve again.` : ""}${r.warnings.length ? ` Check: ${r.warnings.join("; ")}.` : ""}`);
  });
}

// ── connections and automated publishing ───────────────────────────────────
export async function disconnectDestination(_: Result, fd: FormData) {
  return run(async () => {
    const id = z.string().uuid().parse(fd.get("destinationId"));
    const { disconnect } = await import("@/domain/connections");
    await disconnect(db(), id);
    refresh("/connections", "/upload");
    return ok("Disconnected. This destination is manual again; the handle stays.");
  });
}
export async function setAutomationCaps(_: Result, fd: FormData) {
  return run(async () => {
    const id = z.string().uuid().parse(fd.get("destinationId"));
    const { connectionFor } = await import("@/domain/connections");
    const conn = await connectionFor(db(), id);
    if (!conn) throw new DomainError("not_connected", "connect it first");
    const caps = { ...(conn.capabilities as Record<string, unknown>), audited: fd.get("audited") === "on", privacy: fd.get("privacy") === "private" ? "private" : "public" };
    await db().update(S.connections).set({ capabilities: caps, updatedAt: new Date() }).where(eq(S.connections.id, conn.id));
    await audit(db(), "owner", "connection.caps", "connection", conn.id, caps);
    refresh("/connections");
    return ok("Saved.");
  });
}
/** "Publish now": queue one approved publication for the worker, through the destination's connection. */
export async function publishNow(_: Result, fd: FormData) {
  return run(async () => {
    const id = z.string().uuid().parse(fd.get("publicationId"));
    const s = await settings(db());
    if (s.stopExternalActions) throw new DomainError("stopped", "External actions are stopped in Settings.");
    const [p] = await db().select().from(S.publications).where(eq(S.publications.id, id));
    if (!p?.exportId) throw new DomainError("no_export", "no export");
    const { currentApproval } = await import("@/domain/approvals");
    if (!(await currentApproval(db(), p.exportId, p.destinationId))) throw new DomainError("not_approved", "Approve this exact video and text for this account first.");
    const { connectionFor } = await import("@/domain/connections");
    const conn = await connectionFor(db(), p.destinationId);
    if (!conn || conn.status !== "connected") throw new DomainError("not_connected", "This account isn't connected (Accounts → Connect).");
    const [e] = await db().select().from(S.episodes).where(eq(S.episodes.id, p.episodeId));
    const r = await enqueue(db(), { type: "publish", channelId: e.channelId, payload: { publicationId: id, manual: true }, idempotencyKey: `publish:${id}`, priority: 10, maxAttempts: 3 });
    refresh("/upload", "/queue");
    return ok(r.created ? "Queued: the worker uploads it now. Watch the Queue; the task updates itself when the platform answers." : "Already queued.");
  });
}

// ── costs and production budgets (records only: Prism never pays or moves money) ──
const optionalId = z.union([z.literal(""), z.string().uuid()]).transform((v) => v || null);
/** Revalidate Costs, Settings and each channel page the change touches (an edit can move a cost between channels). */
const costPaths = async (...channelIds: (string | null)[]) => {
  const ids = [...new Set(channelIds.filter((id): id is string => !!id))];
  const chs = ids.length ? await db().select({ slug: S.channels.slug }).from(S.channels).where(inArray(S.channels.id, ids)) : [];
  refresh("/costs", "/settings", ...chs.map((ch) => `/channels/${ch.slug}`));
};
function costInput(fd: FormData): CostInput {
  return {
    description: str(fd, "description"), amountCents: parseMoney(str(fd, "amount")), currency: str(fd, "currency") || "USD",
    incurredOn: str(fd, "incurredOn"), source: fd.get("estimate") === "on" ? "estimate" : "manual", category: str(fd, "category"),
    channelId: optionalId.parse(str(fd, "channelId")), episodeId: optionalId.parse(str(fd, "episodeId")), provider: str(fd, "provider"), note: str(fd, "note"),
  };
}
export async function saveBudget(_: Result, fd: FormData) {
  return run(async () => {
    const scope = str(fd, "scope");
    const channelId = scope === "studio" ? null : z.string().uuid("Pick who the budget is for").parse(scope);
    const raw = str(fd, "amount");
    const capCents = raw === "" ? null : parseMoney(raw);
    await setBudget(db(), { channelId, month: str(fd, "month"), capCents, currency: str(fd, "currency") || "USD" });
    await costPaths(channelId);
    return ok(capCents == null ? "Budget ended from that month: paid generation stays off without one." : "Budget saved. It applies from that month on until you change it.");
  });
}
export async function addCostEntry(_: Result, fd: FormData) {
  return run(async () => {
    const e = await addCost(db(), costInput(fd));
    await costPaths(e.channelId);
    return ok(e.source === "estimate" ? "Estimate recorded. It's labelled ESTIMATE and doesn't count as spent." : "Cost recorded. Prism only writes it down; it never pays anything.");
  });
}
export async function editCostEntry(_: Result, fd: FormData) {
  return run(async () => {
    const id = z.string().uuid().parse(fd.get("costId"));
    const [was] = await db().select({ channelId: S.costLedger.channelId }).from(S.costLedger).where(eq(S.costLedger.id, id));
    const e = await editCost(db(), id, costInput(fd));
    await costPaths(was?.channelId ?? null, e.channelId);   // the channel it left, and the one it joined
    return ok("Saved.");
  });
}
export async function voidCostEntry(_: Result, fd: FormData) {
  return run(async () => {
    const e = await voidCost(db(), z.string().uuid().parse(fd.get("costId")), str(fd, "reason"));
    await costPaths(e.channelId);
    return ok("Void: it stays on the record and no longer counts.");
  });
}

// ── push notifications (the owner's devices) ───────────────────────────────
/** The VAPID public key a browser subscribes with (made on first need). The only key that ever leaves the server. */
export async function pushPublicKey(): Promise<Result> {
  return run(async () => {
    const { vapidPublicKey } = await import("@/domain/push");
    return ok("", { publicKey: await vapidPublicKey(db()) });
  });
}
const pushDevice = z.object({
  endpoint: z.string().max(2048),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
  label: z.string().max(120).default(""),
});
/** "Notify this device": save the subscription this browser just made. */
export async function savePushDevice(input: unknown): Promise<Result> {
  return run(async () => {
    const v = pushDevice.parse(input);
    const { saveSubscription } = await import("@/domain/push");
    const r = await saveSubscription(db(), { endpoint: v.endpoint, keys: v.keys }, v.label);
    revalidatePath("/settings");
    return ok(`On: ${r.label} gets notifications. Send a test to check.`);
  });
}
/** "Turn off on this device": the browser unsubscribed; forget its endpoint. */
export async function forgetPushEndpoint(endpoint: string): Promise<Result> {
  return run(async () => {
    const { removeEndpoint } = await import("@/domain/push");
    await removeEndpoint(db(), z.string().max(2048).parse(endpoint));
    revalidatePath("/settings");
    return ok("Off on this device.");
  });
}
export async function removePushDevice(_: Result, fd: FormData) {
  return run(async () => {
    const { removeSubscription } = await import("@/domain/push");
    const gone = await removeSubscription(db(), z.string().uuid().parse(fd.get("deviceId")));
    revalidatePath("/settings");
    return ok(gone ? "Removed. That device gets nothing more." : "Already removed.");
  });
}
export async function sendTestPush(_: Result, _fd: FormData) {
  return run(async () => {
    const { sendTestNotification } = await import("@/domain/push");
    const r = await sendTestNotification(db());
    revalidatePath("/settings");
    const gone = r.removed ? ` ${r.removed} device${r.removed === 1 ? " had" : "s had"} dropped notifications and ${r.removed === 1 ? "was" : "were"} removed.` : "";
    if (!r.sent) return { ok: false, message: `Not delivered: ${r.failed ? "the push service refused it (see the device list)" : "no device is left"}.${gone}` };
    return ok(`Sent to ${r.sent} of ${r.devices} device${r.devices === 1 ? "" : "s"}${r.failed ? `; ${r.failed} failed (see the device list)` : ""}.${gone}`);
  });
}
/** Start over when the signing key can't be opened (its secret changed): every device turns notifications on again. */
export async function resetPushKeys(_: Result, _fd: FormData) {
  return run(async () => {
    const { resetPush } = await import("@/domain/push");
    const n = await resetPush(db());
    revalidatePath("/settings");
    return ok(`Reset. ${n ? `${n} device${n === 1 ? " was" : "s were"} removed: ` : ""}press Notify this device on each one again.`);
  });
}
