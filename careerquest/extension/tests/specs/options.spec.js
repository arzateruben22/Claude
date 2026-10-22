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

/** Replaces chrome.permissions in the options page with an in-memory fake (the native prompt cannot be answered headless). */
async function fakePermissions(options, granted) {
  await options.evaluate((initial) => {
    const state = { granted: new Set(initial), removed: [], requested: [] };
    window.__perm = state;
    chrome.permissions.getAll = async () => ({ origins: [...state.granted], permissions: [] });
    chrome.permissions.contains = async ({ origins }) => origins.every((o) => state.granted.has(o));
    chrome.permissions.request = async ({ origins }) => {
      state.requested.push(...origins);
      origins.forEach((o) => state.granted.add(o));
      return true;
    };
    chrome.permissions.remove = async ({ origins }) => {
      if (origins.some((o) => o.includes("indeed") || o.includes("lever"))) throw new Error("You cannot remove required permissions.");
      state.removed.push(...origins);
      origins.forEach((o) => state.granted.delete(o));
      return true;
    };
  }, granted);
}

test("EXT-05: 'Test connection' with an unsaved token never changes the saved connection state", async ({ ext, mockApi }) => {
  await ext.configure(); // saved: valid token, connected
  const before = await ext.local("connection");
  const options = await ext.openOptions();
  await options.locator("#token").fill("cqt_typo");
  await options.locator("#test").click();
  await expect(options.locator("#form-message")).toHaveText(/Token rejected \(401\)/);
  const after = await ext.local("connection");
  expect(after).toEqual(before);
  expect((await ext.local("settings")).token).toBe(mockApi.token);
});

test("SP-09: a plain-http remote CareerQuest URL is refused; nothing is saved and no token is sent", async ({ ext, mockApi }) => {
  await ext.configure();
  const options = await ext.openOptions();
  await options.locator("#apiBaseUrl").fill("http://cq.example.com:3000");
  await options.locator("#token").fill("cqt_secret_should_not_travel");
  await options.locator("#save").click();
  await expect(options.locator("#form-message")).toHaveText(/Use https:\/\//);
  await options.locator("#test").click();
  await expect(options.locator("#form-message")).toHaveText(/Use https:\/\//);
  expect(await ext.local("settings")).toEqual({ apiBaseUrl: mockApi.baseUrl, token: mockApi.token });
  // The background refuses it too, even if a page bypasses the form check.
  const res = await options.evaluate(() => new Promise((r) => chrome.runtime.sendMessage({ type: "cq:save-settings", apiBaseUrl: "http://cq.example.com", token: "x" }, r)));
  expect(res).toMatchObject({ ok: false, code: "invalid_url" });
  expect(await ext.local("settings")).toEqual({ apiBaseUrl: mockApi.baseUrl, token: mockApi.token });
  expect(mockApi.state.requests).toHaveLength(0);
  // Without a scheme a remote host defaults to https.
  await options.locator("#apiBaseUrl").fill("cq.example.com");
  await options.locator("#apiBaseUrl").dispatchEvent("change");
  await expect(options.locator("#perm-state")).toHaveText(/https:\/\/cq\.example\.com\/\*/);
});

test("SP-10: saving a new CareerQuest URL revokes the previous origin's host permission; access is re-tested after the grant", async ({ ext, mockApi }) => {
  await ext.configure();
  const options = await ext.openOptions();
  await fakePermissions(options, ["https://staging.cq.example/*", "https://jobs.lever.co/*", "https://*.indeed.com/viewjob*"]);
  await options.locator("#apiBaseUrl").fill(mockApi.baseUrl);
  await options.locator("#token").fill(mockApi.token);
  await options.locator("#save").click();
  await expect(options.locator("#form-message")).toHaveText("Connected as Test User.");
  await expect.poll(() => options.evaluate(() => window.__perm.removed)).toEqual(["https://staging.cq.example/*"]);
  expect(await options.evaluate(() => window.__perm.requested)).toEqual(["http://127.0.0.1/*"]);
  await expect(options.locator("#perm-state")).toHaveText("Granted for http://127.0.0.1/*");
  // EXT-12: the connection is tested again once the permission is granted
  await expect.poll(() => mockApi.state.requests.filter((r) => r.path === "/api/extension/me").length).toBe(2);
  expect(await options.evaluate(() => [...window.__perm.granted].sort())).toEqual(["http://127.0.0.1/*", "https://*.indeed.com/viewjob*", "https://jobs.lever.co/*"]);

  await options.locator("#revoke").click();
  await expect(options.locator("#perm-state")).toHaveText("Revoked for http://127.0.0.1/*. Save again to allow it.");
  expect(await options.evaluate(() => window.__perm.removed)).toContain("http://127.0.0.1/*");
});

test("EXT-12: an origin Chrome cannot grant is reported as such, never requested, and the message is not overwritten", async ({ ext, mockApi }) => {
  const options = await ext.openOptions();
  await fakePermissions(options, []);
  await options.locator("#apiBaseUrl").fill("http://[::1]:4320");
  await options.locator("#token").fill(mockApi.token);
  await options.locator("#save").click();
  await expect(options.locator("#form-message")).not.toHaveText(/Testing connection/);
  await expect(options.locator("#perm-state")).toHaveText(/Chrome cannot grant access to http:\/\/\[::1\]\/\*/);
  expect(await options.evaluate(() => window.__perm.requested)).toEqual([]);
  expect((await ext.local("settings")).apiBaseUrl).toBe("http://[::1]:4320");
  expect((await ext.local("hostPermission")).grantable).toBe(false);
});
