/**
 * Database tests for the browser-extension API. The route handlers are called directly with
 * Request objects; users, tokens and everything they create are deleted in afterAll.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createApiToken } from "@/lib/auth/api-token";
import { ingestObservation } from "@/lib/ingest/engine";
import { loadCaptureReview } from "@/lib/ingest/review";
import { createApplication } from "@/lib/applications/service";
import { applicationInputSchema } from "@/lib/validation/application";
import { GET as meGET, OPTIONS as meOPTIONS } from "@/app/api/extension/me/route";
import { GET as lookupGET } from "@/app/api/extension/lookup/route";
import { POST as capturesPOST, OPTIONS as capturesOPTIONS } from "@/app/api/extension/captures/route";

const BASE = "http://localhost:3000";
const APP = (process.env.APP_URL ?? BASE).replace(/\/+$/, "");
const EXT_ORIGIN = "chrome-extension://abcdefghijklmnopabcdefghijklmnop";

let userId = "";
let otherUserId = "";
let token = "";
let readOnly = "";
let writeOnly = "";
let revoked = "";
let otherToken = "";
let otherAppId = "";
let seq = 0;

type Opts = { method?: string; token?: string; body?: unknown; rawBody?: string; origin?: string; contentType?: string };

function req(path: string, o: Opts = {}): Request {
  const h = new Headers();
  if (o.token) h.set("authorization", `Bearer ${o.token}`);
  if (o.origin) h.set("origin", o.origin);
  const hasBody = o.body !== undefined || o.rawBody !== undefined;
  if (hasBody) h.set("content-type", o.contentType ?? "application/json");
  return new Request(`${BASE}${path}`, {
    method: o.method ?? (hasBody ? "POST" : "GET"),
    headers: h,
    body: o.rawBody ?? (o.body !== undefined ? JSON.stringify(o.body) : undefined),
  });
}

function capture(over: Record<string, unknown> = {}, evidence: Record<string, unknown> = {}) {
  seq += 1;
  return {
    kind: "JOB_PAGE",
    url: `https://www.indeed.com/viewjob?jk=ext${seq}${Date.now().toString(36)}`,
    platform: "INDEED",
    company: "Volt Line Electric",
    title: `Apprentice Electrician ${seq}`,
    location: "Anaheim, CA",
    salaryText: "$24–$30 an hour",
    confidence: 0.9,
    ...over,
    evidence: {
      pageTitle: "Apprentice Electrician - Anaheim, CA - Indeed.com",
      detectedBy: ["jsonld:JobPosting"],
      capturedAt: new Date().toISOString(),
      captureId: `cap-${seq}-${Math.random().toString(36).slice(2, 10)}`,
      ...evidence,
    },
  };
}

async function post(body: unknown, t = token) {
  const res = await capturesPOST(req("/api/extension/captures", { token: t, body }));
  return { res, json: (await res.json()) as Record<string, any> };
}

beforeAll(async () => {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const user = await prisma.user.create({
    data: {
      email: `ext-api+${stamp}@careerquest.test`,
      passwordHash: "x",
      name: "Extension Tester",
      profile: { create: { timezone: "America/Los_Angeles" } },
      stats: { create: {} },
    },
  });
  userId = user.id;
  const other = await prisma.user.create({
    data: {
      email: `ext-api-other+${stamp}@careerquest.test`,
      passwordHash: "x",
      name: "Other",
      profile: { create: {} },
      stats: { create: {} },
    },
  });
  otherUserId = other.id;
  token = (await createApiToken(userId, "Chrome")).plaintext;
  readOnly = (await createApiToken(userId, "Read only", ["applications:read"])).plaintext;
  writeOnly = (await createApiToken(userId, "Write only", ["capture:write"])).plaintext;
  const r = await createApiToken(userId, "Old laptop");
  revoked = r.plaintext;
  await prisma.apiToken.update({ where: { id: r.token.id }, data: { revokedAt: new Date() } });
  otherToken = (await createApiToken(otherUserId, "Other")).plaintext;
  const otherApp = await createApplication(
    otherUserId,
    applicationInputSchema.parse({ companyName: "Secret Co", positionTitle: "Wireman", postingUrl: "https://jobs.lever.co/secret/11111111-2222-4333-8444-555555555555" }),
  );
  otherAppId = otherApp.application.id;
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { userId: { in: [userId, otherUserId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
  await prisma.$disconnect();
});

describe("authentication and scopes", () => {
  it("answers 401 JSON for a missing, malformed, unknown or revoked token", async () => {
    for (const t of [undefined, "not-a-token", "cqt_doesnotexist", revoked]) {
      const res = await meGET(req("/api/extension/me", { token: t }));
      expect(res.status).toBe(401);
      expect(res.headers.get("content-type")).toMatch(/application\/json/);
      expect(res.headers.get("www-authenticate")).toMatch(/Bearer/);
      const body = await res.json();
      expect(typeof body.error).toBe("string");
    }
    const res = await capturesPOST(req("/api/extension/captures", { body: capture() }));
    expect(res.status).toBe(401);
  });

  it("GET /me returns the token owner and scopes", async () => {
    const res = await meGET(req("/api/extension/me", { token }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      userId,
      name: "Extension Tester",
      email: expect.stringContaining("ext-api+"),
      scopes: ["capture:write", "applications:read"],
    });
    const w = await meGET(req("/api/extension/me", { token: writeOnly }));
    expect(w.status).toBe(200);
    expect((await w.json()).scopes).toEqual(["capture:write"]);
  });

  it("enforces capture:write for POST and applications:read for lookup", async () => {
    const p = await capturesPOST(req("/api/extension/captures", { token: readOnly, body: capture() }));
    expect(p.status).toBe(403);
    expect((await p.json()).error).toMatch(/capture:write/);
    const l = await lookupGET(req("/api/extension/lookup?url=https%3A%2F%2Fexample.com%2Fjob%2F1", { token: writeOnly }));
    expect(l.status).toBe(403);
    expect((await l.json()).error).toMatch(/applications:read/);
  });

  it("rate-limits each token to 60 requests a minute with 429 + retryAfterSeconds + Retry-After", async () => {
    const limited = (await createApiToken(userId, "Busy")).plaintext;
    for (let i = 0; i < 60; i++) {
      const res = await meGET(req("/api/extension/me", { token: limited }));
      expect(res.status).toBe(200);
    }
    const res = await meGET(req("/api/extension/me", { token: limited }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(body.retryAfterSeconds).toBeLessThanOrEqual(60);
    expect(res.headers.get("retry-after")).toBe(String(body.retryAfterSeconds));
    // Another token of the same user is unaffected.
    expect((await meGET(req("/api/extension/me", { token }))).status).toBe(200);
  });
});

describe("CORS", () => {
  it("answers preflight with 204 and echoes only chrome-extension and APP_URL origins", async () => {
    const ext = await capturesOPTIONS(req("/api/extension/captures", { method: "OPTIONS", origin: EXT_ORIGIN }));
    expect(ext.status).toBe(204);
    expect(ext.headers.get("access-control-allow-origin")).toBe(EXT_ORIGIN);
    expect(ext.headers.get("access-control-allow-headers")).toBe("authorization, content-type");
    expect(ext.headers.get("access-control-allow-methods")).toContain("POST");
    expect(ext.headers.get("access-control-allow-credentials")).toBeNull();

    const app = await meOPTIONS(req("/api/extension/me", { method: "OPTIONS", origin: new URL(APP).origin }));
    expect(app.headers.get("access-control-allow-origin")).toBe(new URL(APP).origin);

    const evil = await meOPTIONS(req("/api/extension/me", { method: "OPTIONS", origin: "https://evil.example" }));
    expect(evil.status).toBe(204);
    expect(evil.headers.get("access-control-allow-origin")).toBeNull();
    expect(evil.headers.get("vary")).toBe("Origin");
  });

  it("adds the allow-origin header to real responses for the extension", async () => {
    const res = await meGET(req("/api/extension/me", { token, origin: EXT_ORIGIN }));
    expect(res.headers.get("access-control-allow-origin")).toBe(EXT_ORIGIN);
    const denied = await meGET(req("/api/extension/me", { origin: EXT_ORIGIN }));
    expect(denied.status).toBe(401);
    expect(denied.headers.get("access-control-allow-origin")).toBe(EXT_ORIGIN);
  });
});

describe("POST /captures validation", () => {
  it("rejects unknown keys, oversized fields, bad values and non-JSON bodies", async () => {
    const cases: Array<[unknown, RegExp]> = [
      [{ ...capture(), extra: "x" }, /Unrecognized key/],
      [capture({}, { html: "<html>" }), /evidence: Unrecognized key/],
      [capture({ url: `https://example.com/${"a".repeat(2050)}` }), /url/],
      [capture({ url: "javascript:alert(1)" }), /http\(s\)/],
      [capture({ company: "x".repeat(301) }), /company/],
      [capture({ kind: "CONFIRMATION_PAGE" }, { confirmationText: "y".repeat(301) }), /confirmationText/],
      [capture({ confidence: 1.5 }), /confidence/],
      [capture({ kind: "SHARED_URL" }), /kind/],
      [capture({ platform: "MONSTER" }), /platform/],
      [capture({}, { capturedAt: "yesterday" }), /capturedAt/],
    ];
    for (const [body, re] of cases) {
      const { res, json } = await post(body);
      expect(res.status, JSON.stringify(json)).toBe(400);
      expect(json.error).toMatch(re);
    }
    const notJson = await capturesPOST(req("/api/extension/captures", { token, rawBody: "{nope" }));
    expect(notJson.status).toBe(400);
    const wrongType = await capturesPOST(req("/api/extension/captures", { token, rawBody: "{}", contentType: "text/plain" }));
    expect(wrongType.status).toBe(415);
    expect(await prisma.extensionCapture.count({ where: { userId } })).toBe(0);
  });

  it("stores only allow-listed fields with PII masked in the confirmation sentence", async () => {
    const body = capture(
      { kind: "CONFIRMATION_PAGE", confidence: 0.6, company: "  Mask   Test Co ", title: "Helper" },
      { confirmationText: "Thanks! We emailed jane.doe@example.com and will call (714) 555-0199.", detectedBy: ["phrase:thank you for applying", "phrase:thank you for applying"] },
    );
    const { res, json } = await post(body);
    expect(res.status).toBe(201);
    const row = await prisma.extensionCapture.findUniqueOrThrow({ where: { id: json.capture.id } });
    expect(row.company).toBe("Mask Test Co");
    expect(row.evidence).toEqual({
      pageTitle: body.evidence.pageTitle,
      detectedBy: ["phrase:thank you for applying"],
      confirmationText: "Thanks! We emailed [email] and will call [phone].",
      capturedAt: new Date(body.evidence.capturedAt).toISOString(),
      captureId: body.evidence.captureId,
    });
    // JOB_PAGE captures never keep page text.
    const jp = await post(capture({}, { confirmationText: "should be dropped" }));
    const jpRow = await prisma.extensionCapture.findUniqueOrThrow({ where: { id: jp.json.capture.id } });
    expect((jpRow.evidence as Record<string, unknown>).confirmationText).toBeUndefined();
  });
});

describe("POST /captures behaviour", () => {
  it("JOB_PAGE then CONFIRMATION_PAGE for the same URL → one application, Saved then Submitted", async () => {
    const url = "https://www.indeed.com/viewjob?jk=a1b2c3d4e5f60718&from=serp";
    const save = await post(capture({ url, company: "Northstar Electric", title: "Electrician Helper", confidence: 0.7 }));
    expect(save.res.status).toBe(201);
    expect(save.json.action).toBe("created");
    expect(save.json.capture.status).toBe("ACCEPTED");
    expect(save.json.application).toEqual({
      id: expect.any(String),
      status: "SAVED",
      detailUrl: `${APP}/applications/${save.json.application.id}`,
    });
    const appId = save.json.application.id as string;

    const confirm = await post(
      capture(
        { kind: "CONFIRMATION_PAGE", url, company: "Northstar Electric", title: "Electrician Helper", confidence: 0.85 },
        { confirmationText: "Your application has been submitted.", detectedBy: ["phrase:your application has been submitted", "route:/post-apply"] },
      ),
    );
    expect(confirm.res.status).toBe(201);
    expect(confirm.json.action).toBe("updated");
    expect(confirm.json.application).toMatchObject({ id: appId, status: "SUBMITTED" });

    const apps = await prisma.application.findMany({ where: { userId, normalizedCompany: "northstar electric" }, include: { statusHistory: { orderBy: { occurredAt: "asc" } } } });
    expect(apps).toHaveLength(1);
    expect(apps[0]!.status).toBe("SUBMITTED");
    expect(apps[0]!.statusVerified).toBe(false);
    expect(apps[0]!.appliedAt).not.toBeNull();
    expect(apps[0]!.statusHistory.map((h) => [h.toStatus, h.source])).toEqual([
      ["SAVED", "EXTENSION"],
      ["SUBMITTED", "EXTENSION"],
    ]);
    const captures = await prisma.extensionCapture.findMany({ where: { userId, applicationId: appId } });
    expect(captures.map((c) => c.status).sort()).toEqual(["ACCEPTED", "ACCEPTED"]);
  });

  it("an email-imported application plus the extension's confirmation for the same job never duplicates", async () => {
    const email = await ingestObservation(userId, {
      kind: "SUBMITTED",
      source: "EMAIL",
      origin: "EMAIL",
      observedAt: new Date(Date.now() - 3600_000),
      company: "Bright Spark Electric",
      title: "Electrician Apprentice",
      requisitionId: "R-20417",
      platform: "WORKDAY",
      confidence: 0.95,
      verified: true,
      evidence: { kind: "EMAIL", sourceRef: `EML:ext-acceptance-${Date.now()}@test`, title: "Application received", data: { senderKind: "ats" } },
    });
    expect(email.action).toBe("created");
    const { res, json } = await post(
      capture(
        {
          kind: "CONFIRMATION_PAGE",
          url: "https://brightspark.wd5.myworkdayjobs.com/en-US/careers/job/Anaheim-CA/Electrician-Apprentice_R-20417/apply/applied",
          platform: "WORKDAY",
          company: "Bright Spark Electric",
          title: "Electrician Apprentice",
          requisitionId: "R-20417",
          confidence: 0.95,
        },
        { confirmationText: "Thanks for applying! Your application has been submitted.", detectedBy: ["phrase:your application has been submitted", "element:applyFlowCompletedPage", "route:/apply/applied"] },
      ),
    );
    expect(res.status).toBe(201);
    expect(json.action).toBe("updated");
    expect(json.application.id).toBe(email.applicationId);
    const apps = await prisma.application.findMany({ where: { userId, normalizedCompany: "bright spark electric" }, include: { evidence: true } });
    expect(apps).toHaveLength(1);
    expect(apps[0]!.evidence.map((e) => e.kind).sort()).toEqual(["EMAIL", "EXTENSION_CAPTURE"]);
    const xp = await prisma.xpLedger.count({ where: { userId, sourceId: apps[0]!.id, reason: "APPLICATION_SUBMITTED" } });
    expect(xp).toBe(1);
  });

  it("a low-confidence confirmation stays pending and shows in the review queue", async () => {
    const { res, json } = await post(
      capture({ kind: "CONFIRMATION_PAGE", company: "Pending Power", title: "Journeyman", confidence: 0.7 }, { confirmationText: "Thank you for applying." }),
    );
    expect(res.status).toBe(201);
    expect(json).toEqual({ capture: { id: expect.any(String), status: "PENDING_CONFIRMATION" }, application: null, action: "pending_confirmation" });
    expect(await prisma.application.count({ where: { userId, normalizedCompany: "pending power" } })).toBe(0);
    const review = await loadCaptureReview(userId);
    expect(review.items.map((i) => i.id)).toContain(json.capture.id);
  });

  it("APPLY_STARTED is stored for confirmation only and never recorded as submitted", async () => {
    const { json } = await post(capture({ kind: "APPLY_STARTED", company: "Started Co", title: "Wireman", confidence: 0.5 }));
    expect(json.action).toBe("pending_confirmation");
    expect(json.application).toBeNull();
    expect(await prisma.application.count({ where: { userId, normalizedCompany: "started co" } })).toBe(0);
  });

  it("MANUAL_CONFIRMATION records a submission the user asserted", async () => {
    const { json } = await post(
      capture({ kind: "MANUAL_CONFIRMATION", company: "Asserted Electric", title: "Inside Wireman", confidence: 1 }, { detectedBy: ["user-asserted"] }),
    );
    expect(json.action).toBe("created");
    expect(json.application.status).toBe("SUBMITTED");
    const app = await prisma.application.findUniqueOrThrow({ where: { id: json.application.id } });
    expect(app.statusVerified).toBe(true);
    expect(app.createdVia).toBe("EXTENSION");
    expect(app.appliedAt).not.toBeNull();
  });

  it("a repeated POST returns the existing capture and application as a duplicate", async () => {
    const body = capture({ company: "Repeat Electric", title: "Apprentice" });
    const first = await post(body);
    expect(first.json.action).toBe("created");
    const again = await post(body);
    expect(again.res.status).toBe(201);
    expect(again.json).toEqual({ capture: first.json.capture, application: first.json.application, action: "duplicate" });
    // Same content with a fresh delivery id (e.g. a second click) is also a duplicate within 24 h.
    const fresh = await post({ ...body, evidence: { ...body.evidence, captureId: "another-delivery" } });
    expect(fresh.json.action).toBe("duplicate");
    expect(await prisma.extensionCapture.count({ where: { userId, company: "Repeat Electric" } })).toBe(1);
    expect(await prisma.application.count({ where: { userId, normalizedCompany: "repeat electric" } })).toBe(1);
  });

  it("attaches to an explicitly chosen application, and 404s for another user's application", async () => {
    const mine = await createApplication(userId, applicationInputSchema.parse({ companyName: "Attach Target Inc", positionTitle: "Electrician" }));
    const { json } = await post(capture({ company: "Attach Target", title: "Electrician (Job ID 77)", applicationId: mine.application.id }));
    expect(json.action).toBe("updated");
    expect(json.application.id).toBe(mine.application.id);

    const before = await prisma.extensionCapture.count({ where: { userId } });
    const foreign = await post(capture({ kind: "MANUAL_CONFIRMATION", applicationId: otherAppId }));
    expect(foreign.res.status).toBe(404);
    expect(foreign.json).toEqual({ error: "Application not found." });
    expect(await prisma.extensionCapture.count({ where: { userId } })).toBe(before);
    const other = await prisma.application.findUniqueOrThrow({ where: { id: otherAppId } });
    expect(other.status).toBe("SAVED");
  });

  it("writes an audit row without URLs, company names or page text", async () => {
    const { json } = await post(capture({ company: "Audit Trail Electric", title: "Helper" }));
    const row = await prisma.auditLog.findFirstOrThrow({ where: { userId, action: "extension.capture", entityId: json.capture.id } });
    const text = JSON.stringify(row.metadata);
    expect(text).not.toMatch(/Audit Trail|indeed\.com|Apprentice Electrician/);
    expect(row.metadata).toMatchObject({ kind: "JOB_PAGE", action: "created", captureStatus: "ACCEPTED" });
  });
});

describe("GET /lookup", () => {
  it("finds the user's tracked application by URL with status, date and links", async () => {
    const url = "https://boards.greenhouse.io/sparkco/jobs/4455667";
    const created = await post(capture({ url, platform: "GREENHOUSE", company: "SparkCo", title: "Maintenance Electrician" }));
    const res = await lookupGET(req(`/api/extension/lookup?url=${encodeURIComponent(`${url}?gh_src=abc`)}&company=SparkCo&title=Maintenance%20Electrician`, { token }));
    expect(res.status).toBe(200);
    const { matches } = await res.json();
    expect(matches).toHaveLength(1);
    expect(matches[0]).toEqual({
      id: created.json.application.id,
      companyName: "SparkCo",
      positionTitle: "Maintenance Electrician",
      status: "SAVED",
      appliedAt: null,
      postingUrl: url,
      detailUrl: `${APP}/applications/${created.json.application.id}`,
    });
  });

  it("never returns another user's records and validates its parameters", async () => {
    const res = await lookupGET(
      req(`/api/extension/lookup?url=${encodeURIComponent("https://jobs.lever.co/secret/11111111-2222-4333-8444-555555555555")}&company=Secret%20Co`, { token }),
    );
    expect((await res.json()).matches).toEqual([]);
    const other = await lookupGET(
      req(`/api/extension/lookup?url=${encodeURIComponent("https://jobs.lever.co/secret/11111111-2222-4333-8444-555555555555")}`, { token: otherToken }),
    );
    expect((await other.json()).matches.map((m: { id: string }) => m.id)).toEqual([otherAppId]);
    expect((await lookupGET(req("/api/extension/lookup", { token }))).status).toBe(400);
    expect((await lookupGET(req("/api/extension/lookup?company=A&debug=1", { token }))).status).toBe(400);
    expect((await lookupGET(req("/api/extension/lookup?url=ftp%3A%2F%2Fx", { token }))).status).toBe(400);
  });
});
