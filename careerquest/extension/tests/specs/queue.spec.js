// @ts-check
/**
 * (d) Offline queue: a 503 queues the capture, schedules the retry alarm, and the
 * alarm-driven retry succeeds; 429 honours retryAfterSeconds; 401 parks the
 * capture (no retry loop) until reconnecting; queue updates are serialised.
 */
const { test, expect } = require("../fixtures");

const INDEED_JOB = "https://www.indeed.com/viewjob?jk=abc123def456";
const ALARM = "cq-queue-retry";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PAYLOAD = (id, url = "https://www.indeed.com/viewjob?jk=x") => ({ kind: "JOB_PAGE", url, platform: "INDEED", confidence: 0.5, evidence: { pageTitle: "x", detectedBy: [], capturedAt: new Date().toISOString(), captureId: id } });
const item = (id, nextAttemptAt, extra = {}) => ({ id, payload: PAYLOAD(`cap-${id}`, `https://www.indeed.com/viewjob?jk=${id}`), attempts: 0, createdAt: Date.now(), nextAttemptAt, ...extra });
/** Simulates the backoff having elapsed for every queued item. */
const makeAllDue = (ext) => ext.evaluate(async () => {
  const { queue = [] } = await chrome.storage.local.get("queue");
  await chrome.storage.local.set({ queue: queue.map((i) => ({ ...i, nextAttemptAt: Date.now() })) });
});

async function saveFromPopup(page, ext) {
  await page.goto(INDEED_JOB);
  const tabId = await ext.tabIdOf(page);
  await ext.waitForDetection(tabId, { predicate: (d) => d.kind === "JOB_PAGE" });
  const popup = await ext.openPopup(tabId);
  await popup.locator("#save-job").click();
  return { tabId, popup };
}

test("a 503 queues the capture with backoff and the alarm retry delivers it", async ({ page, ext, mockApi }) => {
  await ext.configure();
  mockApi.configure({ captureFailures: [{ status: 503, body: { error: "db down" } }] });
  const { tabId, popup } = await saveFromPopup(page, ext);

  await expect(popup.locator("#message")).toHaveText(/Saved locally — will send when CareerQuest is reachable/);
  await expect(popup.locator("#queue-status")).toHaveText("1 capture waiting to send");
  await expect.poll(() => ext.badge(tabId)).toBe("↻");

  const queue = await ext.local("queue");
  expect(queue).toHaveLength(1);
  expect(queue[0].attempts).toBe(1);
  expect(queue[0].payload.kind).toBe("JOB_PAGE");
  expect(queue[0].nextAttemptAt).toBeGreaterThan(Date.now() + 20_000); // 30s base backoff (±jitter)
  const alarm = await ext.evaluate((n) => chrome.alarms.get(n), ALARM);
  expect(alarm).toBeTruthy();
  expect(alarm.scheduledTime).toBeGreaterThan(Date.now() + 15_000);
  expect(mockApi.state.captureAttempts).toHaveLength(1);
  expect(mockApi.state.captures).toHaveLength(0);

  // Let the backoff elapse and fire the retry alarm early (same handler production uses).
  await makeAllDue(ext);
  await ext.evaluate((n) => chrome.alarms.create(n, { when: Date.now() + 200 }), ALARM);
  const [capture] = await mockApi.waitForCaptures();
  expect(capture.body.kind).toBe("JOB_PAGE");
  expect(capture.body.title).toBe("Apprentice Electrician");
  expect(mockApi.state.captureAttempts).toHaveLength(2);
  await expect.poll(() => ext.local("queue")).toEqual([]);
  await expect.poll(() => ext.evaluate((n) => chrome.alarms.get(n), ALARM)).toBeFalsy();
});

test("429 schedules the retry after retryAfterSeconds and 'Retry now' flushes manually", async ({ page, ext, mockApi }) => {
  await ext.configure();
  mockApi.configure({ captureFailures: [{ status: 429, body: { error: "slow down", retryAfterSeconds: 7 } }] });
  const before = Date.now();
  const { popup } = await saveFromPopup(page, ext);
  await expect(popup.locator("#queue-status")).toHaveText("1 capture waiting to send");
  const [item] = await ext.local("queue");
  expect(item.nextAttemptAt).toBeGreaterThanOrEqual(before + 7000);
  expect(item.nextAttemptAt).toBeLessThan(before + 12_000);
  expect(item.lastError).toBe("slow down");

  await popup.locator("#retry-queue").click();
  await expect(popup.locator("#message")).toHaveText(/Sent 1, 0 still waiting/);
  expect(mockApi.state.captures).toHaveLength(1);
  await expect(popup.locator("#queue-status")).toBeHidden();
});

test("a 401 while sending marks the connection unauthorized and keeps the capture queued (parked, no retry alarm)", async ({ page, ext, mockApi }) => {
  await ext.configure();
  mockApi.configure({ captureFailures: [{ status: 401, body: { error: "Invalid token" } }] });
  const { popup } = await saveFromPopup(page, ext);
  await expect(popup.locator("#status-pill")).toHaveText("Token rejected");
  await expect(popup.locator("#connect-button")).toHaveText("Reconnect");
  expect((await ext.local("connection")).status).toBe("unauthorized");
  const queue = await ext.local("queue");
  expect(queue).toHaveLength(1);
  expect(queue[0].attempts).toBe(0); // a rejected token is not the capture's fault
  expect(await ext.evaluate((n) => chrome.alarms.get(n), ALARM)).toBeFalsy();
});

test("EXT-03: a 401 on a queued capture stops retries until reconnect (at most one attempt), then the queue resumes", async ({ ext, mockApi }) => {
  await ext.configure();
  mockApi.configure({ token: "cqt_rotated" }); // the stored token was revoked
  await ext.evaluate((q) => chrome.storage.local.set({ queue: q }), [item("a", Date.now())]);
  await ext.evaluate((n) => chrome.alarms.create(n, { when: Date.now() + 100 }), ALARM);
  await mockApi.waitForAttempts(1);
  await expect.poll(async () => (await ext.local("connection")).status).toBe("unauthorized");
  await sleep(3000); // the old code re-armed the alarm every second here
  expect(mockApi.state.captureAttempts).toHaveLength(1);
  expect(await ext.evaluate((n) => chrome.alarms.get(n), ALARM)).toBeFalsy();
  expect(await ext.local("queue")).toHaveLength(1);

  // "Forget token" with a non-empty queue does not wake the worker either.
  await ext.evaluate((n) => chrome.alarms.create(n, { when: Date.now() + 60_000 }), ALARM);
  const options = await ext.openOptions();
  await options.locator("#forget").click();
  await expect(options.locator("#form-message")).toHaveText("Token removed from this browser.");
  await expect.poll(() => ext.evaluate((n) => chrome.alarms.get(n), ALARM)).toBeFalsy();

  // Reconnecting with the new token resumes the parked queue.
  await options.locator("#apiBaseUrl").fill(mockApi.baseUrl);
  await options.locator("#token").fill("cqt_rotated");
  await options.locator("#save").click();
  await expect(options.locator("#form-message")).toHaveText("Connected as Test User.");
  const [capture] = await mockApi.waitForCaptures();
  expect(capture.body.evidence.captureId).toBe("cap-a");
  await expect.poll(() => ext.local("queue")).toEqual([]);
  expect(mockApi.state.captureAttempts).toHaveLength(2);
});

test("EXT-04: an alarm flush and 'Retry now' at the same time POST each queued capture exactly once", async ({ ext, mockApi }) => {
  await ext.configure();
  mockApi.configure({ captureDelays: [1500] }); // keep the first flush busy
  await ext.evaluate((q) => chrome.storage.local.set({ queue: q }), [item("a", Date.now())]);
  const options = await ext.openOptions();
  await expect(options.locator("#queue-state")).toHaveText("1 capture waiting.");
  await ext.evaluate((n) => chrome.alarms.create(n, { when: Date.now() + 50 }), ALARM);
  await mockApi.waitForAttempts(1);
  await options.locator("#flush").click(); // while the alarm's flush is in flight
  await expect(options.locator("#form-message")).toHaveText(/Sent 0, 0 still waiting/);
  await sleep(500);
  expect(mockApi.state.captureAttempts).toHaveLength(1);
  expect(mockApi.state.captures).toHaveLength(1);
  expect(await ext.local("queue")).toEqual([]);
});

test("EXT-04: a capture queued while a flush is in flight is not lost", async ({ page, ext, mockApi }) => {
  await ext.configure();
  mockApi.configure({ captureDelays: [1500] });
  await ext.evaluate((q) => chrome.storage.local.set({ queue: q }), [item("a", Date.now())]);
  await ext.evaluate((n) => chrome.alarms.create(n, { when: Date.now() + 50 }), ALARM);
  await mockApi.waitForAttempts(1); // queued item "a" is in flight (1.5 s)
  mockApi.configure({ captureFailures: [{ status: 503, body: { error: "busy" } }] });
  const { popup } = await saveFromPopup(page, ext); // direct send fails → queued meanwhile
  await expect(popup.locator("#message")).toHaveText(/Saved locally/);
  await expect.poll(() => mockApi.state.captures.length, { timeout: 5000 }).toBe(1); // "a" delivered
  await sleep(300);
  const queue = await ext.local("queue");
  expect(queue).toHaveLength(1);
  expect(queue[0].payload.title).toBe("Apprentice Electrician");
});

test("EXT-11: the retry alarm of one item does not re-send another item that is waiting for its 429 Retry-After", async ({ ext, mockApi }) => {
  await ext.configure();
  const later = Date.now() + 3600_000;
  await ext.evaluate((q) => chrome.storage.local.set({ queue: q }), [item("limited", later, { attempts: 1, lastError: "Rate limited." }), item("due", Date.now())]);
  await ext.evaluate((n) => chrome.alarms.create(n, { when: Date.now() + 100 }), ALARM);
  await mockApi.waitForCaptures();
  await sleep(500);
  expect(mockApi.state.captureAttempts.map((a) => a.body.evidence.captureId)).toEqual(["cap-due"]);
  const queue = await ext.local("queue");
  expect(queue.map((i) => [i.id, i.nextAttemptAt])).toEqual([["limited", later]]);
  const alarm = await ext.evaluate((n) => chrome.alarms.get(n), ALARM);
  expect(Math.abs(alarm.scheduledTime - later)).toBeLessThan(1000); // re-armed for the Retry-After time
});

test("exhausted items and 4xx rejections are dropped; network failures are retried", async ({ ext, mockApi }) => {
  await ext.configure({ apiBaseUrl: "http://127.0.0.1:1" }); // nothing listens here
  const payload = { kind: "JOB_PAGE", url: "https://www.indeed.com/viewjob?jk=x", platform: "INDEED", confidence: 0.5, evidence: { pageTitle: "x", detectedBy: [], capturedAt: new Date().toISOString() } };
  await ext.evaluate((p) => chrome.storage.local.set({ queue: [{ id: "a", payload: p, attempts: 0, createdAt: Date.now(), nextAttemptAt: Date.now() }, { id: "b", payload: p, attempts: 7, createdAt: Date.now(), nextAttemptAt: Date.now() }] }), payload);
  await ext.evaluate((n) => chrome.alarms.create(n, { when: Date.now() + 100 }), ALARM);
  await expect.poll(async () => (await ext.local("queue")).map((i) => [i.id, i.attempts])).toEqual([["a", 1]]);

  // Now point at the mock, which rejects the body with 400 → dropped, not retried forever.
  await ext.configure();
  mockApi.configure({ captureFailures: [{ status: 400, body: { error: "bad" } }] });
  await makeAllDue(ext);
  await ext.evaluate((n) => chrome.alarms.create(n, { when: Date.now() + 100 }), ALARM);
  await expect.poll(() => ext.local("queue")).toEqual([]);
  expect(mockApi.state.captures).toHaveLength(0);
});
