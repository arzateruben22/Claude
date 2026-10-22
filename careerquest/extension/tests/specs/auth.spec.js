// @ts-check
/** (e) 401 handling: the connected state is cleared and the popup offers "Reconnect". */
const { test, expect } = require("../fixtures");

test("a rejected token on /me clears the connected state and the popup shows Reconnect", async ({ ext }) => {
  await ext.configure({ token: "cqt_wrong", connection: { status: "unknown" } });
  const popup = await ext.openPopup(0);
  await expect(popup.locator("#status-pill")).toHaveText("Token rejected");
  await expect(popup.locator("#connect-section")).toBeVisible();
  await expect(popup.locator("#connect-button")).toHaveText("Reconnect");
  await expect(popup.locator("#connect-text")).toContainText("rejected the developer token");
  const connection = await ext.local("connection");
  expect(connection.status).toBe("unauthorized");
  expect(connection.user).toBeNull();
});

test("a token revoked after connecting is noticed on the next API call (lookup)", async ({ page, ext, mockApi }) => {
  await ext.configure(); // stored as connected with the right token
  mockApi.configure({ token: "cqt_rotated" }); // server now rejects the stored token
  await page.goto("https://www.indeed.com/viewjob?jk=abc123def456");
  const tabId = await ext.tabIdOf(page);
  await ext.waitForDetection(tabId, { predicate: (d) => d.kind === "JOB_PAGE" });
  await expect.poll(async () => (await ext.local("connection")).status).toBe("unauthorized");
  const popup = await ext.openPopup(tabId);
  await expect(popup.locator("#connect-button")).toHaveText("Reconnect");
  await expect(popup.locator("#save-job")).toBeVisible(); // still possible; it would be queued until reconnected
});

test("a valid token shows the user and a missing token shows Connect", async ({ ext }) => {
  await ext.configure({ connection: { status: "unknown" } });
  let popup = await ext.openPopup(0);
  await expect(popup.locator("#status-pill")).toHaveText("Connected · Test User");
  await expect(popup.locator("#connect-section")).toBeHidden();
  await popup.close();

  await ext.reset();
  popup = await ext.openPopup(0);
  await expect(popup.locator("#status-pill")).toHaveText("Not connected");
  await expect(popup.locator("#connect-button")).toHaveText("Connect");
  await expect(popup.locator("#save-job")).toBeHidden();
});

test("EXT-05: a stale 'Token rejected' state is re-checked when the popup opens and clears once the saved token works", async ({ ext }) => {
  await ext.configure({ connection: { status: "unauthorized", user: null, error: "Invalid token", checkedAt: Date.now() - 10 * 60 * 1000 } });
  const popup = await ext.openPopup(0);
  await expect(popup.locator("#status-pill")).toHaveText("Connected · Test User");
  expect((await ext.local("connection")).status).toBe("connected");
});
