// @ts-check
/**
 * (f) Options page: Save stores the settings and requests the optional host
 * permission for the base URL origin (asserted via the stored flag, because the
 * native permission prompt cannot be answered in headless automation), and
 * "Test connection" shows the user name from /me.
 */
const { test, expect } = require("../fixtures");

test("save stores settings, records the host-permission request and auto-tests the connection", async ({ ext, mockApi }) => {
  const options = await ext.openOptions();
  await expect(options.locator("#apiBaseUrl")).toHaveValue("http://localhost:3000");
  await options.locator("#apiBaseUrl").fill(`127.0.0.1:${mockApi.port}/`);
  await options.locator("#token").fill(mockApi.token);
  await options.locator("#save").click();

  await expect(options.locator("#form-message")).toHaveText("Connected as Test User.");
  await expect(options.locator("#perm-state")).toHaveText(/Requested for http:\/\/127\.0\.0\.1\/\*/);

  const settings = await ext.local("settings");
  expect(settings).toEqual({ apiBaseUrl: `http://127.0.0.1:${mockApi.port}`, token: mockApi.token });
  const hostPermission = await ext.local("hostPermission");
  expect(hostPermission.pattern).toBe("http://127.0.0.1/*");
  expect(typeof hostPermission.requestedAt).toBe("number");
  expect(hostPermission.requestedAt).toBeGreaterThan(Date.now() - 60_000);
  const connection = await ext.local("connection");
  expect(connection.status).toBe("connected");
  expect(connection.user.name).toBe("Test User");
  const me = mockApi.state.requests.find((r) => r.path === "/api/extension/me");
  expect(me.auth).toBe(`Bearer ${mockApi.token}`);
});

test("'Test connection' reports the user name, a bad token and an unreachable server", async ({ ext, mockApi }) => {
  const options = await ext.openOptions();
  await options.locator("#apiBaseUrl").fill(mockApi.baseUrl);
  await options.locator("#token").fill("cqt_nope");
  await options.locator("#test").click();
  await expect(options.locator("#form-message")).toHaveText(/Token rejected \(401\)/);

  await options.locator("#token").fill(mockApi.token);
  await options.locator("#test").click();
  await expect(options.locator("#form-message")).toHaveText("Connected as Test User.");

  await options.locator("#apiBaseUrl").fill("http://127.0.0.1:1");
  await options.locator("#test").click();
  await expect(options.locator("#form-message")).toHaveText(/Could not reach CareerQuest/);

  await options.locator("#token").fill("");
  await options.locator("#test").click();
  await expect(options.locator("#form-message")).toHaveText(/Enter the CareerQuest URL and a developer token first/);
});

test("'Clear local queue' empties the queue and 'Forget token' disconnects", async ({ ext }) => {
  await ext.configure();
  await ext.evaluate(() => chrome.storage.local.set({ queue: [{ id: "q1", payload: { kind: "JOB_PAGE", url: "https://x" }, attempts: 2, createdAt: 0, nextAttemptAt: Date.now() + 60_000 }] }));
  await ext.evaluate(() => chrome.alarms.create("cq-queue-retry", { when: Date.now() + 60_000 }));
  const options = await ext.openOptions();
  await expect(options.locator("#queue-state")).toHaveText("1 capture waiting.");
  await options.locator("#clear-queue").click();
  await expect(options.locator("#form-message")).toHaveText("Local queue cleared.");
  await expect(options.locator("#queue-state")).toHaveText("0 captures waiting.");
  expect(await ext.local("queue")).toEqual([]);
  expect(await ext.evaluate(() => chrome.alarms.get("cq-queue-retry"))).toBeFalsy();

  await options.locator("#forget").click();
  await expect(options.locator("#form-message")).toHaveText("Token removed from this browser.");
  expect((await ext.local("settings")).token).toBe("");
  expect((await ext.local("connection")).status).toBe("disconnected");
});
