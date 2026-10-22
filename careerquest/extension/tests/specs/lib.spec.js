// @ts-check
/**
 * Unit tests for the pure modules in src/lib (no browser, no chrome.* — run by
 * the same `npx playwright test` command as the extension-loaded specs).
 */
const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const lib = (file) => import(pathToFileURL(path.join(__dirname, "..", "..", "src", "lib", file)).href);
const MANIFEST = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "manifest.json"), "utf8"));

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

  test("enqueue is idempotent per captureId (a retried/duplicated capture is queued once)", async () => {
    const { enqueue } = await lib("queue.js");
    const payload = { kind: "JOB_PAGE", url: "https://x/1", evidence: { captureId: "cap-123" } };
    const first = enqueue([], payload, { now: 1 });
    const second = enqueue(first.queue, { ...payload }, { now: 2 });
    expect(second.duplicate).toBe(true);
    expect(second.queue).toHaveLength(1);
    expect(second.item.id).toBe(first.item.id);
    const other = enqueue(second.queue, { ...payload, evidence: { captureId: "cap-456" } }, { now: 3 });
    expect(other.queue).toHaveLength(2);
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
    expect(Object.keys(payload.evidence).sort()).toEqual(["captureId", "capturedAt", "confirmationText", "detectedBy", "pageTitle"]);
    expect(payload.evidence.captureId).toMatch(/^[0-9a-z-]{8,64}$/i);
    expect(buildCapturePayload(detection, { kind: "JOB_PAGE", captureId: "fixed-id" }).evidence.captureId).toBe("fixed-id");
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

  test("confirmation text has e-mail addresses and phone numbers masked before it is sent", async () => {
    const { buildCapturePayload, maskPii } = await lib("capture.js");
    const payload = buildCapturePayload(
      { ...detection, confirmationText: "Thank you for applying, we e-mailed jane.doe@example.com and will call (949) 555-0134 or +1 949 555 0134." },
      { kind: "MANUAL_CONFIRMATION" },
    );
    expect(payload.evidence.confirmationText).toBe("Thank you for applying, we e-mailed [email] and will call [phone] or [phone].");
    // partial addresses cut at a sentence end, but not ids, dates or short numbers
    expect(maskPii("sent to jane@x.")).toBe("sent to [email]");
    expect(maskPii("Req R-20417 (ST-12345678-26-ABC) on 2026-10-02, ref 4012345")).toBe("Req R-20417 (ST-12345678-26-ABC) on 2026-10-02, ref 4012345");
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

  test("mergeWithLastJob never pre-fills from a different or stale job (EXT-10)", async () => {
    const { mergeWithLastJob, isSameJob } = await lib("capture.js");
    const now = 10_000_000;
    const jobA = { kind: "JOB_PAGE", platform: "WORKDAY", url: "https://acme.wd5.myworkdayjobs.com/en-US/C/job/Irvine/Electrician_R-111", company: "Acme", title: "Electrician", requisitionId: "R-111", seenAt: now - 60_000 };
    const confB = { kind: "CONFIRMATION_PAGE", platform: "WORKDAY", url: "https://acme.wd5.myworkdayjobs.com/en-US/C/job/Tustin/Helper_R-222/apply/applied", company: "", title: "", requisitionId: "R-222", detectedBy: [], confidence: 0.7 };
    // requisition ids disagree → untouched
    expect(mergeWithLastJob(confB, jobA, { now })).toBe(confB);
    // job ids in the URLs disagree (no requisition on the confirmation)
    const confNoReq = { ...confB, requisitionId: "" };
    expect(mergeWithLastJob(confNoReq, jobA, { now })).toBe(confNoReq);
    // titles disagree
    const confOtherTitle = { kind: "CONFIRMATION_PAGE", platform: "WORKDAY", url: "https://acme.wd5.myworkdayjobs.com/en-US/C/userHome", title: "Helper", detectedBy: [] };
    expect(mergeWithLastJob(confOtherTitle, jobA, { now })).toBe(confOtherTitle);
    // a different site
    const confIndeed = { kind: "CONFIRMATION_PAGE", platform: "INDEED", url: "https://smartapply.indeed.com/post-apply", detectedBy: [] };
    expect(mergeWithLastJob(confIndeed, jobA, { now })).toBe(confIndeed);
    // the last job page is too old
    const confA = { kind: "CONFIRMATION_PAGE", platform: "WORKDAY", url: `${jobA.url}/apply/applied`, detectedBy: [] };
    expect(mergeWithLastJob(confA, { ...jobA, seenAt: now - 3 * 60 * 60 * 1000 }, { now })).toBe(confA);
    // same job (URL nested under the posting) and fresh → pre-filled
    const merged = mergeWithLastJob(confA, jobA, { now });
    expect(merged).toMatchObject({ title: "Electrician", company: "Acme", requisitionId: "R-111" });
    expect(isSameJob(confA, jobA)).toBe(true);
    expect(isSameJob(confB, jobA)).toBe(false);
    expect(isSameJob({ url: "https://smartapply.indeed.com/post-apply", platform: "INDEED" }, { url: "https://www.indeed.com/viewjob?jk=abc", platform: "INDEED" })).toBeNull();
  });

  test("promptKey identifies a prompt by page and matched phrase, not by re-render noise", async () => {
    const { promptKey, pruneKeys } = await lib("capture.js");
    const d = { kind: "CONFIRMATION_PAGE", url: "https://x/applied", pageTitle: "(1) Jobs", detectedBy: ["jsonld", "phrase:Application sent"], confidence: 0.7 };
    expect(promptKey(d)).toBe("CONFIRMATION_PAGE|https://x/applied|phrase:application sent");
    expect(promptKey({ ...d, pageTitle: "(2) Jobs", confirmationText: "Application sent 2 min ago" })).toBe(promptKey(d));
    expect(promptKey({ ...d, url: "https://x/other" })).not.toBe(promptKey(d));
    expect(promptKey({ ...d, detectedBy: ["confirmation-route"] })).toBe("CONFIRMATION_PAGE|https://x/applied|");
    const pruned = pruneKeys({ old: 1, fresh: 900, freshObj: { at: 950 } }, 1000, 500, 1);
    expect(Object.keys(pruned)).toEqual(["freshObj"]);
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

  test("the token is never configured for plain http to a non-local host (SP-09)", async () => {
    const { normalizeBaseUrl, baseUrlError, isLoopbackHost } = await lib("url.js");
    expect(normalizeBaseUrl("http://cq.example.com:3000")).toBeNull();
    expect(baseUrlError("http://cq.example.com:3000")).toMatch(/https/);
    expect(normalizeBaseUrl("http://192.168.1.20:3000")).toBeNull();
    expect(normalizeBaseUrl("http://printer.local")).toBeNull();
    // no scheme typed: https for remote hosts, http only for loopback
    expect(normalizeBaseUrl("cq.example.com:3000")).toBe("https://cq.example.com:3000");
    expect(normalizeBaseUrl("127.0.0.1:4320")).toBe("http://127.0.0.1:4320");
    expect(normalizeBaseUrl("http://[::1]:3000")).toBe("http://[::1]:3000");
    expect(normalizeBaseUrl("http://dev.localhost:3000/")).toBe("http://dev.localhost:3000");
    expect(normalizeBaseUrl("https://user:pw@cq.example.com")).toBeNull();
    expect([isLoopbackHost("localhost"), isLoopbackHost("127.0.0.9"), isLoopbackHost("[::1]"), isLoopbackHost("localhost.example.com"), isLoopbackHost("10.0.0.1")]).toEqual([true, true, true, false, false]);
  });

  test("host-permission helpers: grantable origins and stale CareerQuest origins (SP-10, EXT-12)", async () => {
    const { isGrantableOrigin, staleHostOrigins, patternCovers } = await lib("url.js");
    expect(isGrantableOrigin("http://localhost/*", MANIFEST)).toBe(true);
    expect(isGrantableOrigin("https://cq.example.com/*", MANIFEST)).toBe(true);
    expect(isGrantableOrigin("http://[::1]/*", MANIFEST)).toBe(false);
    expect(isGrantableOrigin("http://dev.localhost/*", MANIFEST)).toBe(false);
    expect(patternCovers("https://*/*", "https://a.b/*")).toBe(true);
    expect(patternCovers("http://localhost/*", "https://localhost/*")).toBe(false);
    const granted = ["https://staging.cq.example/*", "https://cq.example/*", "http://localhost/*", "https://jobs.lever.co/*", "https://*.indeed.com/viewjob*", "https://*.myworkdayjobs.com/job/*"];
    expect(staleHostOrigins(granted, "https://cq.example/*", MANIFEST)).toEqual(["https://staging.cq.example/*", "http://localhost/*"]);
  });
});

/**
 * Chrome match-pattern semantics for content scripts: scheme, host (with
 * "*." subdomains) and a glob over path + query.
 */
function matchesPattern(pattern, url) {
  const m = pattern.match(/^(\*|https?):\/\/([^/]+)(\/.*)$/);
  if (!m) throw new Error(`bad pattern ${pattern}`);
  const u = new URL(url);
  const scheme = u.protocol.slice(0, -1);
  if (m[1] !== "*" ? m[1] !== scheme : !/^https?$/.test(scheme)) return false;
  const host = m[2];
  if (host !== "*" && !(host.startsWith("*.") ? u.hostname === host.slice(2) || u.hostname.endsWith(host.slice(1)) : u.hostname === host)) return false;
  const glob = new RegExp(`^${m[3].split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`);
  return glob.test(u.pathname + u.search);
}
const injectedScripts = (url) => MANIFEST.content_scripts.filter((cs) => cs.matches.some((p) => matchesPattern(p, url))).map((cs) => cs.js[cs.js.length - 1]);

test.describe("manifest content-script scope (SP-01, SP-06)", () => {
  test("job search, posting and apply/confirmation paths are covered", () => {
    for (const [url, script] of [
      ["https://www.indeed.com/viewjob?jk=abc", "indeed.js"],
      ["https://smartapply.indeed.com/beta/indeedapply/form/post-apply", "indeed.js"],
      ["https://www.linkedin.com/jobs/view/3912345678/", "linkedin.js"],
      ["https://www.ziprecruiter.com/c/Acme-Electric/Job/Apprentice-Electrician/-in-Irvine,CA?jid=9a7f2c1d", "ziprecruiter.js"],
      ["https://www.ziprecruiter.com/jobs/acme-electric-0b9c/apprentice-electrician-1d2e", "ziprecruiter.js"],
      ["https://www.ziprecruiter.com/jobs-search?search=electrician", "ziprecruiter.js"],
      ["https://acme.wd5.myworkdayjobs.com/en-US/Acme_Careers/job/Irvine-CA/Apprentice-Electrician_R-20417", "workday.js"],
      ["https://acme.wd5.myworkdayjobs.com/en-US/Acme_Careers/job/Irvine-CA/Apprentice-Electrician_R-20417/apply/applyManually", "workday.js"],
      ["https://acme.wd5.myworkdayjobs.com/Acme_Careers/details/Apprentice-Electrician_R-20417", "workday.js"],
      ["https://careers-acme.icims.com/jobs/1187/apprentice-electrician/job", "icims.js"],
      ["https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=abc&jobId=441", "adp.js"],
      ["https://workforcenow.adp.com/jobs/apply/posting.html?client=acme&jobId=441", "adp.js"],
      ["https://recruiting.adp.com/srccar/public/RTI.home?c=123&d=ExternalCareerSite", "adp.js"],
      ["https://www.governmentjobs.com/careers/irvine/jobs/4598123/apprentice-electrician", "governmentjobs.js"],
      ["https://www.governmentjobs.com/careers/irvine/applications/4598123/confirmation", "governmentjobs.js"],
      ["https://www.governmentjobs.com/jobs/4598123-0/apprentice-electrician", "governmentjobs.js"],
      ["https://www.usajobs.gov/job/812345678", "usajobs.js"],
      ["https://www.usajobs.gov/Applicant/Application/complete/812345678", "usajobs.js"],
    ]) {
      expect(injectedScripts(url), url).toEqual([`src/content/${script}`]);
    }
  });

  test("HR/payroll, candidate profile and applied-list areas are never injected", () => {
    for (const url of [
      "https://workforcenow.adp.com/theme/index.html#/Myself_ttd_MyselfTabPayCategoryPayStatements",
      "https://workforcenow.adp.com/mascsr/default/mdf/payroll/paystatement.html",
      "https://my.adp.com/?careers=1#/pay",
      "https://workforcenow.adp.com/theme/admin.html?section=careers",
      "https://my.usajobs.gov/Applicant/Application/ListApplications",
      "https://my.usajobs.gov/Applicant/ProfileDashboard/Resumes",
      "https://www.ziprecruiter.com/candidate/profile",
      "https://www.ziprecruiter.com/candidate/applied",
      "https://www.ziprecruiter.com/settings/account",
      "https://acme.wd5.myworkdayjobs.com/en-US/Acme_Careers/userHome",
      "https://acme.wd5.myworkdayjobs.com/en-US/Acme_Careers",
      "https://careers-acme.icims.com/",
      "https://www.governmentjobs.com/Applications/Index",
      "https://www.governmentjobs.com/Profile/Edit",
    ]) {
      expect(injectedScripts(url), url).toEqual([]);
    }
  });
});

test.describe("lib/api-client", () => {
  const settings = { apiBaseUrl: "https://api.test", token: "cqt_abc" };
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
    expect(seen.url).toBe("https://api.test/api/extension/me");
    expect(seen.init.headers.Authorization).toBe("Bearer cqt_abc");
    await client.lookup({ url: "https://x/y?z=1", company: "Acme", title: undefined });
    expect(seen.url).toBe("https://api.test/api/extension/lookup?url=https%3A%2F%2Fx%2Fy%3Fz%3D1&company=Acme");
  });

  test("refuses to send the token over plain http to a non-local host, even from stored settings (SP-09)", async () => {
    const { createApiClient, isRetryable } = await lib("api-client.js");
    let calls = 0;
    const fetchImpl = async () => {
      calls++;
      return fakeFetch(200, {})();
    };
    const remote = createApiClient({ fetchImpl, getSettings: async () => ({ apiBaseUrl: "http://cq.example.com:3000", token: "cqt_abc" }) });
    const err = await remote.createCapture({ kind: "JOB_PAGE" }).catch((e) => e);
    expect(err.code).toBe("insecure");
    expect(isRetryable(err)).toBe(false);
    expect(calls).toBe(0);
    const local = createApiClient({ fetchImpl, getSettings: async () => ({ apiBaseUrl: "http://127.0.0.1:4320", token: "cqt_abc" }) });
    await local.me();
    expect(calls).toBe(1);
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
    const unconfigured = await mk(fakeFetch(200, {}), { apiBaseUrl: "https://x", token: "" }).me().catch((e) => e);
    expect(unconfigured.code).toBe("not_configured");
    const hanging = async (_url, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))));
    const timeout = await mk(hanging, settings, 50).me().catch((e) => e);
    expect(timeout.code).toBe("timeout");
  });
});
