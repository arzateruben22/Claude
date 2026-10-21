// @ts-check
/**
 * Unit tests for the pure modules in src/lib (no browser, no chrome.* — run by
 * the same `npx playwright test` command as the extension-loaded specs).
 */
const { test, expect } = require("@playwright/test");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const lib = (file) => import(pathToFileURL(path.join(__dirname, "..", "..", "src", "lib", file)).href);

test.describe("lib/queue", () => {
  test("backoff grows exponentially with jitter and is capped", async () => {
    const { computeBackoffMs } = await lib("queue.js");
    const noJitter = { baseMs: 1000, maxMs: 60_000, random: () => 0.5 };
    expect(computeBackoffMs(0, noJitter)).toBe(1000);
    expect(computeBackoffMs(1, noJitter)).toBe(2000);
    expect(computeBackoffMs(3, noJitter)).toBe(8000);
    expect(computeBackoffMs(10, noJitter)).toBe(60_000);
    const jittered = computeBackoffMs(2, { baseMs: 1000, maxMs: 60_000, random: () => 1 });
    expect(jittered).toBeGreaterThan(4000);
    expect(jittered).toBeLessThanOrEqual(4800);
  });

  test("enqueue caps the queue and markFailed honours retryAfter", async () => {
    const { enqueue, markFailed, dueItems, nextAttemptAt, isExhausted } = await lib("queue.js");
    let q = [];
    for (let i = 0; i < 4; i++) q = enqueue(q, { kind: "JOB_PAGE", url: `https://x/${i}` }, { max: 3, now: 1000 + i }).queue;
    expect(q).toHaveLength(3);
    expect(q[0].payload.url).toBe("https://x/1");
    const failed = markFailed(q[0], { now: 5000, retryAfterMs: 7000, error: "429" });
    expect(failed.attempts).toBe(1);
    expect(failed.nextAttemptAt).toBe(12_000);
    expect(failed.lastError).toBe("429");
    expect(dueItems([failed, q[1]], 6000).map((i) => i.id)).toEqual([q[1].id]);
    expect(nextAttemptAt([failed, q[1]])).toBe(q[1].nextAttemptAt);
    let exhausted = q[1];
    for (let i = 0; i < 8; i++) exhausted = markFailed(exhausted, { now: 0, baseMs: 1 });
    expect(isExhausted(exhausted)).toBe(true);
  });
});

test.describe("lib/capture", () => {
  const detection = {
    kind: "CONFIRMATION_PAGE",
    platform: "INDEED",
    url: "https://www.indeed.com/viewjob?jk=abc",
    pageTitle: "Indeed Apply",
    company: "  Acme   Electric ",
    title: "Apprentice Electrician",
    location: "Irvine, CA",
    salaryText: "$28 - $34 an hour",
    requisitionId: "REQ-1",
    confidence: 0.95,
    detectedBy: ["jsonld", "phrase:Application submitted"],
    confirmationText: "x".repeat(500),
    // things that must never leak
    formValues: { ssn: "123-45-6789" },
    innerText: "whole page",
  };

  test("buildCapturePayload only emits documented fields and enforces limits", async () => {
    const { buildCapturePayload } = await lib("capture.js");
    const payload = buildCapturePayload(detection, { kind: "CONFIRMATION_PAGE", capturedAt: "2026-10-21T00:00:00.000Z" });
    expect(Object.keys(payload).sort()).toEqual(["company", "confidence", "evidence", "kind", "location", "platform", "requisitionId", "salaryText", "title", "url"]);
    expect(Object.keys(payload.evidence).sort()).toEqual(["capturedAt", "confirmationText", "detectedBy", "pageTitle"]);
    expect(payload.company).toBe("Acme Electric");
    expect(payload.evidence.confirmationText).toHaveLength(300);
    expect(JSON.stringify(payload)).not.toContain("123-45-6789");
    expect(JSON.stringify(payload)).not.toContain("whole page");
  });

  test("confirmation text is dropped for JOB_PAGE captures; confidence is clamped; applicationId attaches", async () => {
    const { buildCapturePayload } = await lib("capture.js");
    const job = buildCapturePayload({ ...detection, kind: "JOB_PAGE" }, { kind: "JOB_PAGE", confidence: 7 });
    expect(job.evidence.confirmationText).toBeUndefined();
    expect(job.confidence).toBe(1);
    const manual = buildCapturePayload(detection, { kind: "MANUAL_CONFIRMATION", confidence: 1, applicationId: "app_9" });
    expect(manual.applicationId).toBe("app_9");
    expect(manual.evidence.confirmationText).toBeDefined();
    expect(() => buildCapturePayload(detection, { kind: "WHATEVER" })).toThrow(/Unknown capture kind/);
    const unknownPlatform = buildCapturePayload({ ...detection, platform: "UNION_PORTAL" }, { kind: "JOB_PAGE" });
    expect(unknownPlatform.platform).toBe("OTHER");
  });

  test("decideAction applies the confidence thresholds", async () => {
    const { decideAction } = await lib("capture.js");
    expect(decideAction({ kind: "CONFIRMATION_PAGE", confidence: 0.8 })).toBe("auto_confirm");
    expect(decideAction({ kind: "CONFIRMATION_PAGE", confidence: 0.79 })).toBe("prompt");
    expect(decideAction({ kind: "CONFIRMATION_PAGE", confidence: 0.5 })).toBe("prompt");
    expect(decideAction({ kind: "CONFIRMATION_PAGE", confidence: 0.4 })).toBe("none");
    expect(decideAction({ kind: "APPLY_STARTED", confidence: 0.5 })).toBe("apply_started");
    expect(decideAction({ kind: "JOB_PAGE", confidence: 0.9 })).toBe("job_page");
    expect(decideAction({ kind: null, confidence: 0 })).toBe("none");
    expect(decideAction(null)).toBe("none");
  });

  test("mergeWithLastJob pre-fills a confirmation from the last job page", async () => {
    const { mergeWithLastJob } = await lib("capture.js");
    const confirmation = { kind: "CONFIRMATION_PAGE", url: "https://x/thanks", company: "", title: "", detectedBy: ["phrase:x"], confidence: 0.9 };
    const merged = mergeWithLastJob(confirmation, { url: "https://x/job", company: "Acme", title: "Electrician", requisitionId: "R-1" });
    expect(merged.company).toBe("Acme");
    expect(merged.title).toBe("Electrician");
    expect(merged.requisitionId).toBe("R-1");
    expect(merged.detectedBy).toContain("prefilled-from-job-page");
    expect(merged.jobPageUrl).toBe("https://x/job");
    expect(mergeWithLastJob(confirmation, null)).toBe(confirmation);
  });
});

test.describe("lib/url", () => {
  test("normalises base URLs and derives host patterns", async () => {
    const { normalizeBaseUrl, hostPatternFor } = await lib("url.js");
    expect(normalizeBaseUrl("localhost:3000/")).toBe("http://localhost:3000");
    expect(normalizeBaseUrl(" https://app.careerquest.example/ ")).toBe("https://app.careerquest.example");
    expect(normalizeBaseUrl("https://app.example.com/base/")).toBe("https://app.example.com/base");
    expect(normalizeBaseUrl("ftp://nope")).toBeNull();
    expect(normalizeBaseUrl("")).toBeNull();
    expect(hostPatternFor("http://localhost:3000")).toBe("http://localhost/*");
    expect(hostPatternFor("https://app.example.com:8443/x")).toBe("https://app.example.com/*");
  });
});

test.describe("lib/api-client", () => {
  const settings = { apiBaseUrl: "http://api.test", token: "cqt_abc" };
  const fakeFetch = (status, body, headers = {}) => async (url, init) => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k) => headers[k.toLowerCase()] },
    text: async () => (body == null ? "" : JSON.stringify(body)),
    _url: url,
    _init: init,
  });

  test("sends the bearer token and parses JSON", async () => {
    const { createApiClient } = await lib("api-client.js");
    let seen;
    const client = createApiClient({
      fetchImpl: async (url, init) => {
        seen = { url, init };
        return fakeFetch(200, { userId: "u1", name: "Test" })(url, init);
      },
      getSettings: async () => settings,
    });
    const me = await client.me();
    expect(me.name).toBe("Test");
    expect(seen.url).toBe("http://api.test/api/extension/me");
    expect(seen.init.headers.Authorization).toBe("Bearer cqt_abc");
    await client.lookup({ url: "https://x/y?z=1", company: "Acme", title: undefined });
    expect(seen.url).toBe("http://api.test/api/extension/lookup?url=https%3A%2F%2Fx%2Fy%3Fz%3D1&company=Acme");
  });

  test("maps 401 / 429 / 5xx / network / timeout / unconfigured to stable error codes", async () => {
    const { createApiClient, ApiError, isRetryable } = await lib("api-client.js");
    const mk = (fetchImpl, s = settings, timeoutMs) => createApiClient({ fetchImpl, getSettings: async () => s, timeoutMs });
    await expect(mk(fakeFetch(401, { error: "bad token" })).me()).rejects.toMatchObject({ code: "unauthorized", status: 401, message: "bad token" });
    const limited = await mk(fakeFetch(429, { error: "slow", retryAfterSeconds: 9 })).me().catch((e) => e);
    expect(limited).toBeInstanceOf(ApiError);
    expect(limited.code).toBe("rate_limited");
    expect(limited.retryAfterSeconds).toBe(9);
    expect(isRetryable(limited)).toBe(true);
    const server = await mk(fakeFetch(503, null)).me().catch((e) => e);
    expect(server.code).toBe("server");
    expect(isRetryable(server)).toBe(true);
    const bad = await mk(fakeFetch(400, { error: "nope" })).createCapture({}).catch((e) => e);
    expect(bad.code).toBe("http");
    expect(isRetryable(bad)).toBe(false);
    const network = await mk(async () => { throw new TypeError("Failed to fetch"); }).me().catch((e) => e);
    expect(network.code).toBe("network");
    const unconfigured = await mk(fakeFetch(200, {}), { apiBaseUrl: "http://x", token: "" }).me().catch((e) => e);
    expect(unconfigured.code).toBe("not_configured");
    const hanging = async (_url, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))));
    const timeout = await mk(hanging, settings, 50).me().catch((e) => e);
    expect(timeout.code).toBe("timeout");
  });
});
