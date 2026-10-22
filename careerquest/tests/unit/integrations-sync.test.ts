/**
 * Mailbox syncs against fake Gmail / Graph servers (no network): paging with a hard per-run cap and
 * cursor resume, refresh on 401, NEEDS_REAUTH on a revoked grant, outages, per-message failures,
 * job-mail filtering (unrelated mail never stored), SyncRun bookkeeping, scheduler isolation and the
 * scheduler endpoint's credential check.
 */
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { GMAIL_API } from "@/lib/integrations/adapters/gmail";
import type { FetchLike } from "@/lib/integrations/adapters/types";
import { saveOAuthConnection } from "@/lib/integrations/connections";
import { listRecentSyncRuns, syncAllUsers, syncConnection, type SyncDeps } from "@/lib/integrations/sync";
import type { IntegrationEnv } from "@/lib/integrations/registry";
import type { ApplicationObservation, IngestResult } from "@/lib/ingest/types";

const ENV: IntegrationEnv = {
  GOOGLE_CLIENT_ID: "gid",
  GOOGLE_CLIENT_SECRET: "gsecret",
  MICROSOFT_CLIENT_ID: "mid",
  MICROSOFT_CLIENT_SECRET: "msecret",
  APP_URL: "https://careerquest.test",
};

const DIR = path.join(process.cwd(), "tests", "fixtures", "emails");
const FILES = fs.readdirSync(DIR);
const fixture = (prefix: string) => fs.readFileSync(path.join(DIR, FILES.find((f) => f.startsWith(prefix))!));

const users: string[] = [];
let userId = "";
let appId = "";

async function makeUser(tag: string) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const u = await prisma.user.create({ data: { email: `sync-${tag}+${stamp}@careerquest.test`, passwordHash: "x", name: `Sync ${tag}` } });
  users.push(u.id);
  return u.id;
}

function fakeIngest(applicationId: () => string) {
  const calls: ApplicationObservation[] = [];
  const fn = async (_u: string, obs: ApplicationObservation): Promise<IngestResult> => {
    calls.push(obs);
    return { action: "created", applicationId: applicationId(), candidateIds: [], reason: "Created (fake engine).", statusApplied: "SUBMITTED", xpAwarded: 0 };
  };
  return { fn, calls };
}

type Req = { url: string; method: string; auth: string | null; prefer: string | null; body: URLSearchParams | null };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Fake Gmail API: list pages of ids (page token "o:<offset>"), raw messages, token endpoint. */
function gmailServer(
  messages: Array<{ id: string; raw: Buffer }>,
  opts: { validTokens?: string[]; refreshTo?: string | null; listStatus?: number; missing?: string[] } = {},
) {
  const reqs: Req[] = [];
  const valid = new Set(opts.validTokens ?? ["ya29.valid"]);
  const fn: FetchLike = async (url, init) => {
    const h = new Headers(init?.headers);
    const body = typeof init?.body === "string" ? new URLSearchParams(init.body) : null;
    reqs.push({ url, method: init?.method ?? "GET", auth: h.get("authorization"), prefer: h.get("prefer"), body });
    if (url === "https://oauth2.googleapis.com/token") {
      if (!opts.refreshTo) return json({ error: "invalid_grant", error_description: "Token has been expired or revoked." }, 400);
      valid.add(opts.refreshTo);
      return json({ access_token: opts.refreshTo, expires_in: 3600, scope: "https://www.googleapis.com/auth/gmail.readonly" });
    }
    const token = h.get("authorization")?.replace(/^Bearer /, "") ?? "";
    if (!valid.has(token)) return json({ error: { code: 401 } }, 401);
    const u = new URL(url);
    if (url.startsWith(`${GMAIL_API}/messages?`)) {
      if (opts.listStatus) return json({ error: {} }, opts.listStatus);
      const max = Number(u.searchParams.get("maxResults"));
      const offset = Number((u.searchParams.get("pageToken") ?? "o:0").slice(2));
      const page = messages.slice(offset, offset + max);
      const next = offset + max < messages.length ? `o:${offset + max}` : undefined;
      return json({ messages: page.map((m) => ({ id: m.id, threadId: `t-${m.id}` })), nextPageToken: next, resultSizeEstimate: messages.length });
    }
    const m = /\/messages\/([^/?]+)\?format=raw$/.exec(url);
    if (m) {
      const msg = messages.find((x) => x.id === decodeURIComponent(m[1]!));
      if (!msg || opts.missing?.includes(msg.id)) return json({ error: { code: 404 } }, 404);
      return json({ id: msg.id, threadId: `t-${msg.id}`, raw: msg.raw.toString("base64url") });
    }
    throw new TypeError(`unexpected ${url}`);
  };
  return { fn, reqs };
}

async function gmailConnection(uid: string, email: string, access = "ya29.valid") {
  return saveOAuthConnection(uid, {
    provider: "GMAIL",
    accountEmail: email,
    accessToken: access,
    refreshToken: "1//refresh",
    expiresIn: 3600,
    scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
    historyDays: 90,
  });
}

beforeAll(async () => {
  userId = await makeUser("main");
  appId = (
    await prisma.application.create({
      data: { userId, companyName: "Acme Electric", normalizedCompany: "acme electric", positionTitle: "Apprentice Electrician", normalizedTitle: "apprentice electrician" },
    })
  ).id;
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { userId: { in: users } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
});

describe("Gmail sync", () => {
  const MESSAGES = [
    { id: "g1", raw: fixture("001-") }, // Indeed confirmation
    { id: "g2", raw: fixture("025-") }, // rejection
    { id: "g3", raw: fixture("034-") }, // job alert → stored, never ingested
    { id: "g4", raw: fixture("040-") }, // unrelated newsletter → skipped, never stored
    { id: "g5", raw: fixture("005-") }, // Lever confirmation
  ];
  let connectionId = "";
  const ingest = fakeIngest(() => appId);

  beforeAll(async () => {
    connectionId = (await gmailConnection(userId, "me@gmail.com")).id;
  });

  it("fetches with a narrow query, stops at the per-run cap and resumes from the cursor", async () => {
    const server = gmailServer(MESSAGES);
    const deps: SyncDeps = { ingest: ingest.fn, env: ENV, fetch: server.fn, maxItems: 3 };

    const first = await syncConnection(userId, connectionId, deps);
    expect(first).toMatchObject({ status: "SUCCEEDED", scanned: 3 });
    const list1 = new URL(server.reqs[0]!.url);
    expect(list1.searchParams.get("q")).toMatch(/^newer_than:90d -in:chats \(from:\(/);
    expect(list1.searchParams.get("maxResults")).toBe("3");
    expect(server.reqs[0]!.auth).toBe("Bearer ya29.valid");
    expect(server.reqs.filter((r) => r.url.includes("format=raw"))).toHaveLength(3);

    let conn = await prisma.integrationConnection.findUniqueOrThrow({ where: { id: connectionId } });
    const cursor1 = JSON.parse(conn.syncCursor!);
    expect(cursor1.resume).toMatchObject({ pageToken: "o:3", query: list1.searchParams.get("q") });
    expect(conn.lastSyncAt).not.toBeNull();
    expect(conn.lastError).toBeNull();
    const run1 = await prisma.syncRun.findUniqueOrThrow({ where: { id: first.runId! } });
    expect(run1).toMatchObject({ status: "SUCCEEDED", itemsScanned: 3 });
    expect(run1.finishedAt).not.toBeNull();
    expect(JSON.stringify(run1.errors)).toContain("CAP_REACHED");

    const second = await syncConnection(userId, connectionId, deps);
    expect(second).toMatchObject({ status: "SUCCEEDED", scanned: 2 });
    const resumed = server.reqs.filter((r) => r.url.startsWith(`${GMAIL_API}/messages?`))[1]!;
    expect(new URL(resumed.url).searchParams.get("pageToken")).toBe("o:3");
    expect(new URL(resumed.url).searchParams.get("q")).toBe(list1.searchParams.get("q"));
    conn = await prisma.integrationConnection.findUniqueOrThrow({ where: { id: connectionId } });
    expect(JSON.parse(conn.syncCursor!)).toEqual({ v: 1, completedAt: expect.any(String) });

    // Unrelated mail is never stored; everything else is linked to this connection.
    const rows = await prisma.emailMessage.findMany({ where: { userId, provider: "GMAIL" } });
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.connectionId === connectionId)).toBe(true);
    expect(rows.some((r) => r.classification === "UNRELATED")).toBe(false);
    expect(rows.find((r) => r.classification === "JOB_ALERT")).toBeTruthy();
    // Job alerts never reach the ingestion engine.
    expect(ingest.calls.length).toBeGreaterThanOrEqual(1);
    expect(ingest.calls.every((o) => o.kind !== "JOB_SEEN")).toBe(true);
    const alertRow = rows.find((r) => r.classification === "JOB_ALERT")!;
    expect(ingest.calls.some((o) => o.evidence.sourceRef === `GMAIL:${alertRow.externalId}`)).toBe(false);

    const runs = await listRecentSyncRuns(userId);
    expect(runs.slice(0, 2).map((r) => r.scanned)).toEqual([2, 3]);
  });

  it("later runs search only since the last completed run and re-deliveries change nothing", async () => {
    const server = gmailServer(MESSAGES);
    const before = ingest.calls.length;
    const third = await syncConnection(userId, connectionId, { ingest: ingest.fn, env: ENV, fetch: server.fn });
    expect(third).toMatchObject({ status: "SUCCEEDED", scanned: 5, created: 0 });
    expect(new URL(server.reqs[0]!.url).searchParams.get("q")).toMatch(/^newer_than:[12]d /);
    expect(ingest.calls.length).toBe(before);
    expect(await prisma.emailMessage.count({ where: { userId, provider: "GMAIL" } })).toBe(4);
  });

  it("refreshes the access token on 401 and retries", async () => {
    await prisma.integrationConnection.update({
      where: { id: connectionId },
      data: { accessTokenEnc: encryptSecret("ya29.stale"), tokenExpiresAt: new Date(Date.now() + 3600_000) },
    });
    const server = gmailServer(MESSAGES.slice(0, 1), { validTokens: [], refreshTo: "ya29.fresh" });
    const res = await syncConnection(userId, connectionId, { ingest: ingest.fn, env: ENV, fetch: server.fn });
    expect(res.status).toBe("SUCCEEDED");
    expect(server.reqs.map((r) => r.auth ?? r.url)).toEqual([
      "Bearer ya29.stale",
      "https://oauth2.googleapis.com/token",
      "Bearer ya29.fresh",
      "Bearer ya29.fresh",
    ]);
    expect(server.reqs[1]!.body!.get("grant_type")).toBe("refresh_token");
    const conn = await prisma.integrationConnection.findUniqueOrThrow({ where: { id: connectionId } });
    expect(decryptSecret(conn.accessTokenEnc!)).toBe("ya29.fresh");
  });

  it("records message-level failures as a PARTIAL run", async () => {
    const server = gmailServer(MESSAGES.slice(0, 2), { validTokens: ["ya29.fresh"], missing: ["g2"] });
    const res = await syncConnection(userId, connectionId, { ingest: ingest.fn, env: ENV, fetch: server.fn });
    expect(res.status).toBe("PARTIAL");
    expect(res.issues).toEqual([{ code: "MESSAGE_FAILED", message: "Not found at the provider.", ref: "g2" }]);
    const conn = await prisma.integrationConnection.findUniqueOrThrow({ where: { id: connectionId } });
    expect(conn.lastError).toBe("1 item could not be processed in the last sync.");
    expect(conn.status).toBe("CONNECTED");
  });

  it("keeps the cursor and the connection through a provider outage", async () => {
    const before = await prisma.integrationConnection.findUniqueOrThrow({ where: { id: connectionId } });
    const server = gmailServer(MESSAGES, { validTokens: ["ya29.fresh"], listStatus: 503 });
    const res = await syncConnection(userId, connectionId, { ingest: ingest.fn, env: ENV, fetch: server.fn });
    expect(res.status).toBe("FAILED");
    expect(res.issues[0]).toMatchObject({ code: "PAGE_FAILED" });
    const conn = await prisma.integrationConnection.findUniqueOrThrow({ where: { id: connectionId } });
    expect(conn.status).toBe("CONNECTED");
    expect(conn.lastError).toMatch(/internal error \(HTTP 503\)/);
    expect(conn.lastSyncAt?.getTime()).toBe(before.lastSyncAt?.getTime());
    expect(JSON.parse(conn.syncCursor!).resume).toMatchObject({ pageToken: null });
  });

  it("marks the connection for reconnect when the grant was revoked, then refuses to sync it", async () => {
    await prisma.integrationConnection.update({ where: { id: connectionId }, data: { accessTokenEnc: encryptSecret("ya29.revoked") } });
    const server = gmailServer(MESSAGES, { validTokens: [], refreshTo: null });
    const res = await syncConnection(userId, connectionId, { ingest: ingest.fn, env: ENV, fetch: server.fn });
    expect(res.status).toBe("FAILED");
    expect(res.issues[0]).toMatchObject({ code: "AUTH" });
    const conn = await prisma.integrationConnection.findUniqueOrThrow({ where: { id: connectionId } });
    expect(conn.status).toBe("NEEDS_REAUTH");
    expect(conn.lastError).toMatch(/reconnect/i);
    expect(await prisma.auditLog.count({ where: { userId, action: "integration.needs_reauth" } })).toBe(1);
    expect(await syncConnection(userId, connectionId, { ingest: ingest.fn, env: ENV, fetch: server.fn })).toMatchObject({ status: "SKIPPED" });
  });

  it("never syncs another user's connection or an unconfigured provider", async () => {
    const other = await makeUser("other");
    const conn = await gmailConnection(other, "other@gmail.com");
    const server = gmailServer([]);
    expect(await syncConnection(userId, conn.id, { ingest: ingest.fn, env: ENV, fetch: server.fn })).toMatchObject({ status: "SKIPPED", message: "Connection not found." });
    expect(await syncConnection(other, conn.id, { ingest: ingest.fn, env: { APP_URL: ENV.APP_URL }, fetch: server.fn })).toMatchObject({ status: "SKIPPED" });
    expect(server.reqs).toHaveLength(0);
  });
});

describe("Outlook sync", () => {
  const graphMsg = (id: string, from: string, subject: string, content: string, received = "2026-10-20T16:00:00Z") => ({
    id,
    internetMessageId: `<${id}@mail.example>`,
    conversationId: `conv-${id}`,
    subject,
    from: { emailAddress: { name: from.split("@")[0], address: from } },
    toRecipients: [{ emailAddress: { address: "me@outlook.com" } }],
    receivedDateTime: received,
    body: { contentType: "text", content },
  });
  const JOB1 = graphMsg(
    "o-job-1",
    "no-reply@greenhouse.io",
    "Thank you for applying to Acme Electric",
    "Hi Ruben,\n\nThank you for applying to the Apprentice Electrician position at Acme Electric. We have received your application and our team will review it shortly.\n\nAcme Electric Recruiting",
  );
  const PERSONAL = graphMsg("o-personal", "friend@gmail.com", "Dinner Saturday?", "Are you free Saturday? Bring the kids.");
  const JOB2 = graphMsg(
    "o-job-2",
    "no-reply@greenhouse.io",
    "Your application to Pacific Coast Electric",
    "Hi Ruben,\n\nThank you for your interest in the Electrician Helper role at Pacific Coast Electric. Unfortunately, we have decided to move forward with other candidates.\n\nPacific Coast Electric",
  );
  const PAGE2 = "https://graph.microsoft.com/v1.0/me/messages?$skiptoken=page-2";

  function graphServer(pages: Record<string, { value: unknown[]; next?: string }>, firstKey = "first") {
    const reqs: Req[] = [];
    const fn: FetchLike = async (url, init) => {
      const h = new Headers(init?.headers);
      reqs.push({ url, method: init?.method ?? "GET", auth: h.get("authorization"), prefer: h.get("prefer"), body: null });
      const key = url.startsWith("https://graph.microsoft.com/v1.0/me/messages?$select=") ? firstKey : url;
      const page = pages[key];
      if (!page) throw new TypeError(`unexpected ${url}`);
      return json({ value: page.value, ...(page.next ? { "@odata.nextLink": page.next } : {}) });
    };
    return { fn, reqs };
  }

  async function outlookConnection(uid: string, email: string) {
    return saveOAuthConnection(uid, {
      provider: "OUTLOOK",
      accountEmail: email,
      accessToken: "EwB-valid",
      refreshToken: "M.R3",
      expiresIn: 3600,
      scopes: ["Mail.Read"],
      historyDays: 90,
    });
  }

  it("follows nextLink, asks for text bodies and discards non-job mail without storing it", async () => {
    const uid = await makeUser("outlook");
    const conn = await outlookConnection(uid, "me@outlook.com");
    const ingest = fakeIngest(() => "");
    const server = graphServer({ first: { value: [JOB1, PERSONAL], next: PAGE2 }, [PAGE2]: { value: [JOB2] } });
    const now = new Date(Math.floor(Date.now() / 1000) * 1000);
    const res = await syncConnection(uid, conn.id, { ingest: ingest.fn, env: ENV, fetch: server.fn, now: () => now });
    expect(res, JSON.stringify(res.issues)).toMatchObject({ status: "SUCCEEDED", scanned: 3 });
    expect(server.reqs.map((r) => r.url === PAGE2)).toEqual([false, true]);
    expect(server.reqs.every((r) => r.prefer === 'outlook.body-content-type="text"' && r.auth === "Bearer EwB-valid")).toBe(true);
    const first = new URL(server.reqs[0]!.url);
    const since = new Date(now.getTime() - 90 * 86_400_000).toISOString().replace(/\.\d{3}Z$/, "Z");
    expect(first.searchParams.get("$filter")).toBe(`receivedDateTime ge ${since}`);
    expect(first.searchParams.get("$top")).toBe("50");
    const rows = await prisma.emailMessage.findMany({ where: { userId: uid, provider: "OUTLOOK" } });
    expect(rows.map((r) => r.subject).sort()).toEqual(["Thank you for applying to Acme Electric", "Your application to Pacific Coast Electric"]);
    expect(JSON.stringify(rows)).not.toContain("Dinner");
  });

  it("caps exactly inside a page and resumes after the processed messages", async () => {
    const uid = await makeUser("outlook-cap");
    const conn = await outlookConnection(uid, "cap@outlook.com");
    const ingest = fakeIngest(() => "");
    const server = graphServer({ first: { value: [JOB1, PERSONAL, JOB2] } });
    const run1 = await syncConnection(uid, conn.id, { ingest: ingest.fn, env: ENV, fetch: server.fn, maxItems: 2 });
    expect(run1).toMatchObject({ status: "SUCCEEDED", scanned: 2 });
    const cursor = JSON.parse((await prisma.integrationConnection.findUniqueOrThrow({ where: { id: conn.id } })).syncCursor!);
    expect(cursor.resume).toMatchObject({ skip: 2 });
    expect(cursor.resume.link).toBe(server.reqs[0]!.url);
    const run2 = await syncConnection(uid, conn.id, { ingest: ingest.fn, env: ENV, fetch: server.fn, maxItems: 2 });
    expect(run2).toMatchObject({ status: "SUCCEEDED", scanned: 1 });
    expect(await prisma.emailMessage.count({ where: { userId: uid, provider: "OUTLOOK" } })).toBe(2);
  });

  it("refuses to follow a paging link to another host (the token is never sent there)", async () => {
    const uid = await makeUser("outlook-evil");
    const conn = await outlookConnection(uid, "evil@outlook.com");
    const ingest = fakeIngest(() => "");
    const server = graphServer({ first: { value: [JOB1], next: "https://evil.example/steal?token=1" } });
    const res = await syncConnection(uid, conn.id, { ingest: ingest.fn, env: ENV, fetch: server.fn });
    expect(res.status).toBe("PARTIAL");
    expect(res.issues[0]!.message).toMatch(/outside graph\.microsoft\.com/);
    expect(server.reqs.some((r) => r.url.includes("evil.example"))).toBe(false);
  });
});

describe("scheduled sync", () => {
  it("syncs only CONNECTED, sync-enabled mailbox connections and isolates failures per user", async () => {
    const a = await makeUser("cron-a");
    const b = await makeUser("cron-b");
    const c = await makeUser("cron-c");
    await gmailConnection(a, "a@gmail.com", "ya29.A");
    await gmailConnection(b, "b@gmail.com", "ya29.B");
    const off = await gmailConnection(c, "c@gmail.com", "ya29.C");
    await prisma.integrationConnection.update({ where: { id: off.id }, data: { syncEnabled: false } });

    const reqs: string[] = [];
    const fn: FetchLike = async (url, init) => {
      const auth = new Headers(init?.headers).get("authorization");
      reqs.push(auth ?? url);
      if (auth === "Bearer ya29.B") return json({ error: {} }, 500);
      return json({ messages: [] });
    };
    const ingest = fakeIngest(() => "");
    const report = await syncAllUsers({ ingest: ingest.fn, env: ENV, fetch: fn }, { userIds: [a, b, c] });
    expect(report.users).toBe(2);
    expect(report.connections).toBe(2);
    const byUser = Object.fromEntries(report.results.map((r) => [r.userId, r]));
    expect(byUser[a]).toMatchObject({ ok: true, summaries: [{ status: "SUCCEEDED" }] });
    expect(byUser[b]).toMatchObject({ ok: true, summaries: [{ status: "FAILED" }] });
    expect(byUser[c]).toBeUndefined();
    expect(reqs).not.toContain("Bearer ya29.C");
    expect(JSON.stringify(report)).not.toContain("@gmail.com");
  });

  it("the scheduler endpoint rejects missing, wrong or too-short secrets", async () => {
    const { POST } = await import("@/app/api/integrations/sync/route");
    const prev = process.env.CRON_SECRET;
    try {
      process.env.CRON_SECRET = "s".repeat(40);
      const call = (auth: string) => POST(new Request("http://localhost/api/integrations/sync", { method: "POST", headers: { authorization: auth } }));
      expect((await call(`Bearer ${"x".repeat(40)}`)).status).toBe(401);
      expect((await call("Bearer ")).status).toBe(401);
      process.env.CRON_SECRET = "short";
      expect((await call("Bearer short")).status).toBe(401);
      process.env.CRON_SECRET = "";
      expect((await call("Bearer ")).status).toBe(401);
    } finally {
      if (prev === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = prev;
    }
  });
});
