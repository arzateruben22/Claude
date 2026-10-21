// @ts-check
/**
 * (d) Offline queue: a 503 queues the capture, schedules the retry alarm, and the
 * alarm-driven retry succeeds; 429 honours retryAfterSeconds; 401 keeps the
 * capture for after reconnecting.
 */
const { test, expect } = require("../fixtures");

const INDEED_JOB = "https://www.indeed.com/viewjob?jk=abc123def456";
const ALARM = "cq-queue-retry";

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

  // Fire the retry alarm early (same handler production uses) instead of waiting 30s.
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

test("a 401 while sending marks the connection unauthorized and keeps the capture queued", async ({ page, ext, mockApi }) => {
  await ext.configure();
  mockApi.configure({ captureFailures: [{ status: 401, body: { error: "Invalid token" } }] });
  const { popup } = await saveFromPopup(page, ext);
  await expect(popup.locator("#status-pill")).toHaveText("Token rejected");
  await expect(popup.locator("#connect-button")).toHaveText("Reconnect");
  expect((await ext.local("connection")).status).toBe("unauthorized");
  expect(await ext.local("queue")).toHaveLength(1);
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
  await ext.evaluate((n) => chrome.alarms.create(n, { when: Date.now() + 100 }), ALARM);
  await expect.poll(() => ext.local("queue")).toEqual([]);
  expect(mockApi.state.captures).toHaveLength(0);
});
