// @ts-check
/**
 * End-to-end capture flows through the loaded extension:
 *  (b) a ≥0.8 confirmation page auto-POSTs a CONFIRMATION_PAGE capture with only
 *      the documented fields (no form values from the page),
 *  (c) a low-confidence page sets the pending flag instead of posting, and the
 *      popup prompt records a MANUAL_CONFIRMATION only after "Yes",
 *  plus lookup/attach, Save and "I submitted" from the popup.
 */
const { test, expect } = require("../fixtures");

const SENSITIVE = /123-45-6789|hunter2-secret|4111 1111 1111 1111|SECRET-COVER-LETTER|REFERRAL-SECRET|Jane Q\. Applicant|secret-search-term/;
const ALLOWED_TOP_LEVEL = ["kind", "url", "platform", "company", "title", "location", "salaryText", "requisitionId", "confidence", "evidence", "applicationId"];
const ALLOWED_EVIDENCE = ["pageTitle", "detectedBy", "confirmationText", "capturedAt"];

const INDEED_JOB = "https://www.indeed.com/viewjob?jk=abc123def456";
const INDEED_CONFIRMATION = "https://smartapply.indeed.com/beta/indeedapply/form/post-apply";
const WORKDAY_JOB = "https://acme.wd5.myworkdayjobs.com/en-US/Acme_Careers/job/Irvine-CA/Apprentice-Electrician_R-20417";
const WORKDAY_ROUTE_ONLY = `${WORKDAY_JOB}/apply/applied?silent=1`;
const WORKDAY_APPLY = `${WORKDAY_JOB}/apply/applyManually`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test.describe("automatic confirmation capture", () => {
  test("(b) confidence ≥ 0.8 posts CONFIRMATION_PAGE with the matched sentence and nothing else from the page", async ({ page, ext, mockApi }) => {
    await ext.configure();
    await page.goto(INDEED_CONFIRMATION);
    const tabId = await ext.tabIdOf(page);

    const [capture] = await mockApi.waitForCaptures({ predicate: (c) => c.body.kind === "CONFIRMATION_PAGE" });
    const body = capture.body;
    expect(body.kind).toBe("CONFIRMATION_PAGE");
    expect(body.platform).toBe("INDEED");
    expect(body.url).toBe(INDEED_CONFIRMATION);
    expect(body.company).toBe("Acme Electric Inc.");
    expect(body.title).toBe("Apprentice Electrician");
    expect(body.confidence).toBeGreaterThanOrEqual(0.9);
    expect(body.evidence.confirmationText).toMatch(/^Your application has been submitted/i);
    expect(body.evidence.confirmationText.length).toBeLessThanOrEqual(300);
    expect(body.evidence.detectedBy).toEqual(expect.arrayContaining(["confirmation-route", "phrase:Your application has been submitted"]));
    expect(typeof body.evidence.capturedAt).toBe("string");
    expect(new Date(body.evidence.capturedAt).toISOString()).toBe(body.evidence.capturedAt);

    // Allow-list: nothing but the documented fields, and no page/form data.
    for (const key of Object.keys(body)) expect(ALLOWED_TOP_LEVEL, `unexpected top-level field ${key}`).toContain(key);
    for (const key of Object.keys(body.evidence)) expect(ALLOWED_EVIDENCE, `unexpected evidence field ${key}`).toContain(key);
    expect(capture.rawBody).not.toMatch(SENSITIVE);
    expect(capture.rawBody).not.toMatch(/Track all of your applications/); // only the matched sentence, not the paragraph
    expect(mockApi.state.requests.find((r) => r.path === "/api/extension/captures").auth).toBe(`Bearer ${mockApi.token}`);
    expect(mockApi.state.requests.some((r) => r.auth !== `Bearer ${mockApi.token}`)).toBe(false);

    await expect.poll(() => ext.badge(tabId)).toBe("✓");
    expect(await ext.local("pending")).toEqual({});
  });

  test("the same confirmation is not posted twice when the page re-renders or reloads", async ({ page, ext, mockApi }) => {
    await ext.configure();
    await page.goto(INDEED_CONFIRMATION);
    await mockApi.waitForCaptures();
    await page.reload();
    await ext.waitForDetection(await ext.tabIdOf(page), { predicate: (d) => d.kind === "CONFIRMATION_PAGE" });
    await sleep(800);
    expect(mockApi.state.captures).toHaveLength(1);
  });
});

test.describe("low-confidence signals never auto-post", () => {
  test("(c) a confirmation route without a phrase (0.7) sets the pending flag, no POST, badge '!'", async ({ page, ext, mockApi }) => {
    await ext.configure();
    await page.goto(WORKDAY_ROUTE_ONLY);
    const tabId = await ext.tabIdOf(page);
    const detection = await ext.waitForDetection(tabId, { predicate: (d) => d.kind === "CONFIRMATION_PAGE" });
    expect(detection.confidence).toBe(0.7);

    await expect.poll(async () => (await ext.local("pending"))?.[tabId]?.reason).toBe("needs_confirmation");
    await expect.poll(() => ext.badge(tabId)).toBe("!");
    await sleep(700);
    expect(mockApi.state.captureAttempts).toHaveLength(0);
  });

  test("the pending prompt pre-fills job details from the job page seen earlier in the tab", async ({ page, ext }) => {
    await ext.configure();
    await page.goto(WORKDAY_JOB);
    const tabId = await ext.tabIdOf(page);
    await ext.waitForDetection(tabId, { predicate: (d) => d.kind === "JOB_PAGE" });
    await page.goto(WORKDAY_ROUTE_ONLY);
    await expect.poll(async () => (await ext.local("pending"))?.[tabId]?.detection?.title).toBe("Apprentice Electrician");
    const pending = (await ext.local("pending"))[tabId];
    expect(pending.detection.company).toBe("Acme");
    expect(pending.detection.requisitionId).toBe("R-20417");
    expect(pending.detection.detectedBy).toContain("prefilled-from-job-page");
  });

  test("popup prompt: 'Yes' records a MANUAL_CONFIRMATION with confidence 1.0; 'No' records nothing", async ({ page, ext, mockApi }) => {
    await ext.configure();
    await page.goto(WORKDAY_ROUTE_ONLY);
    const tabId = await ext.tabIdOf(page);
    await expect.poll(async () => (await ext.local("pending"))?.[tabId]?.reason).toBe("needs_confirmation");

    const popup = await ext.openPopup(tabId);
    await expect(popup.locator("#pending-section")).toBeVisible();
    await expect(popup.locator("#pending-title")).toHaveText(/Did you submit this application\?/);
    await expect(popup.locator("#status-pill")).toHaveText(/Connected · Test User/);

    await popup.locator("#pending-no").click();
    await expect(popup.locator("#message")).toHaveText(/nothing recorded/i);
    await expect(popup.locator("#pending-section")).toBeHidden();
    expect(mockApi.state.captureAttempts).toHaveLength(0);
    expect((await ext.local("pending"))[tabId]).toBeUndefined();
    await expect.poll(() => ext.badge(tabId)).toBe("");

    // Visit again → pending again → Yes.
    await page.goto(WORKDAY_ROUTE_ONLY + "&again=1");
    await expect.poll(async () => (await ext.local("pending"))?.[tabId]?.reason).toBe("needs_confirmation");
    await popup.reload();
    await popup.waitForSelector('main[aria-busy="false"]');
    await popup.locator("#pending-yes").click();
    const [capture] = await mockApi.waitForCaptures();
    expect(capture.body.kind).toBe("MANUAL_CONFIRMATION");
    expect(capture.body.confidence).toBe(1);
    expect(capture.body.platform).toBe("WORKDAY");
    expect(capture.body.evidence.detectedBy).toContain("user-asserted");
    expect(capture.rawBody).not.toMatch(SENSITIVE);
    await expect(popup.locator("#message")).toHaveText(/Recorded as submitted/);
    expect((await ext.local("pending"))[tabId]).toBeUndefined();
    await expect.poll(() => ext.badge(tabId)).toBe("✓");
  });

  test("APPLY_STARTED only pre-fills the prompt (badge '…'), it is never recorded as submitted", async ({ page, ext, mockApi }) => {
    await ext.configure();
    await page.goto(WORKDAY_APPLY);
    const tabId = await ext.tabIdOf(page);
    await ext.waitForDetection(tabId, { predicate: (d) => d.kind === "APPLY_STARTED" });
    await expect.poll(async () => (await ext.local("pending"))?.[tabId]?.reason).toBe("apply_started");
    await expect.poll(() => ext.badge(tabId)).toBe("…");
    const popup = await ext.openPopup(tabId);
    await expect(popup.locator("#pending-text")).toHaveText(/started an application/);
    await sleep(500);
    expect(mockApi.state.captureAttempts).toHaveLength(0);
  });

  test("a weak phrase ('Applied' badge on ZipRecruiter) prompts instead of recording", async ({ page, ext, mockApi }) => {
    await ext.configure();
    await page.goto("https://www.ziprecruiter.com/jobs-search?search=electrician&applied=weak");
    const tabId = await ext.tabIdOf(page);
    const d = await ext.waitForDetection(tabId, { predicate: (x) => x.kind === "CONFIRMATION_PAGE" });
    expect(d.confidence).toBe(0.6);
    await expect.poll(async () => (await ext.local("pending"))?.[tabId]?.reason).toBe("needs_confirmation");
    await sleep(500);
    expect(mockApi.state.captureAttempts).toHaveLength(0);
  });
});

test.describe("popup actions on a job page", () => {
  const match = {
    id: "app_77",
    companyName: "Acme Electric Inc.",
    positionTitle: "Apprentice Electrician",
    status: "SUBMITTED",
    appliedAt: "2026-10-02T15:00:00.000Z",
    postingUrl: INDEED_JOB,
    detailUrl: "/applications/app_77",
  };

  test("lookup runs on detection, existing matches are shown, 'Attach to this record' posts applicationId", async ({ page, ext, mockApi }) => {
    await ext.configure();
    mockApi.configure({ matches: [match] });
    await page.goto(INDEED_JOB + "&from=serp");
    const tabId = await ext.tabIdOf(page);
    await ext.waitForDetection(tabId, { predicate: (d) => d.kind === "JOB_PAGE" });

    await expect.poll(() => mockApi.state.requests.filter((r) => r.path === "/api/extension/lookup").length).toBeGreaterThan(0);
    const lookup = mockApi.state.requests.find((r) => r.path === "/api/extension/lookup");
    expect(lookup.query).toMatchObject({ url: INDEED_JOB, company: "Acme Electric Inc.", title: "Apprentice Electrician", requisitionId: "REQ-48213" });
    await expect.poll(() => ext.badge(tabId)).toBe("✓");

    const popup = await ext.openPopup(tabId);
    await expect(popup.locator("#kind-chip")).toHaveText("Job posting");
    await expect(popup.locator("#f-title")).toHaveText("Apprentice Electrician");
    await expect(popup.locator("#f-company")).toHaveText("Acme Electric Inc.");
    await expect(popup.locator("#f-platform")).toHaveText("Indeed");
    await expect(popup.locator("#f-confidence-text")).toHaveText("90%");
    const matchItem = popup.locator("#matches-list .match").first();
    await expect(matchItem).toContainText("Already tracked: Acme Electric Inc. · Apprentice Electrician");
    await expect(matchItem).toContainText(/Submitted on/);
    await expect(matchItem.locator("button")).toHaveText("Attach to this record");

    await matchItem.locator("button").click();
    const [capture] = await mockApi.waitForCaptures();
    expect(capture.body.applicationId).toBe("app_77");
    expect(capture.body.kind).toBe("JOB_PAGE");
    expect(capture.rawBody).not.toMatch(SENSITIVE);
    await expect(popup.locator("#message")).toHaveText(/Attached in CareerQuest/);
    await expect(popup.locator("#message a")).toHaveAttribute("href", `${mockApi.baseUrl}/applications/app_77`);
  });

  test("'Save to CareerQuest' posts JOB_PAGE; 'I submitted this application' posts MANUAL_CONFIRMATION at 1.0", async ({ page, ext, mockApi }) => {
    await ext.configure();
    await page.goto(INDEED_JOB);
    const tabId = await ext.tabIdOf(page);
    await ext.waitForDetection(tabId, { predicate: (d) => d.kind === "JOB_PAGE" });
    const popup = await ext.openPopup(tabId);
    await expect(popup.locator("#matches-section")).toBeHidden();

    await popup.locator("#save-job").click();
    const [job] = await mockApi.waitForCaptures();
    expect(job.body).toMatchObject({ kind: "JOB_PAGE", platform: "INDEED", company: "Acme Electric Inc.", title: "Apprentice Electrician", requisitionId: "REQ-48213", confidence: 0.9 });
    expect(job.body.location).toMatch(/Irvine/);
    expect(job.body.salaryText).toMatch(/28/);
    expect(job.body.evidence.confirmationText).toBeUndefined();
    expect(job.rawBody).not.toMatch(SENSITIVE);
    await expect(popup.locator("#message")).toHaveText(/Saved in CareerQuest/);

    await popup.locator("#confirm-submitted").click();
    const captures = await mockApi.waitForCaptures({ count: 2 });
    expect(captures[1].body.kind).toBe("MANUAL_CONFIRMATION");
    expect(captures[1].body.confidence).toBe(1);
    expect(captures[1].body.evidence.detectedBy).toContain("user-asserted");
    await expect(popup.locator("#message")).toHaveText(/Recorded as submitted/);
    await expect.poll(() => ext.badge(tabId)).toBe("✓");
  });

  test("the popup is keyboard operable and narrower than 360px", async ({ page, ext }) => {
    await ext.configure();
    await page.goto(INDEED_JOB);
    const tabId = await ext.tabIdOf(page);
    await ext.waitForDetection(tabId, { predicate: (d) => d.kind === "JOB_PAGE" });
    const popup = await ext.openPopup(tabId);
    const width = await popup.locator("main.popup").evaluate((el) => el.getBoundingClientRect().width);
    expect(width).toBeLessThanOrEqual(360);
    await popup.keyboard.press("Tab");
    const focusable = [];
    for (let i = 0; i < 8; i++) {
      focusable.push(await popup.evaluate(() => document.activeElement && document.activeElement.id));
      await popup.keyboard.press("Tab");
    }
    expect(focusable).toEqual(expect.arrayContaining(["status-pill", "save-job", "confirm-submitted", "options-link"]));
  });

  test("manual re-detection via the popup uses the live platform detector", async ({ page, ext }) => {
    await ext.configure();
    await page.goto(INDEED_JOB);
    const tabId = await ext.tabIdOf(page);
    await ext.waitForDetection(tabId, { predicate: (d) => d.kind === "JOB_PAGE" });
    // Simulate a lost detection (e.g. the service worker restarted and session state was dropped).
    await ext.evaluate(() => chrome.storage.session.set({ detections: {} }));
    const popup = await ext.openPopup(tabId);
    await expect(popup.locator("#no-detection")).toBeVisible();
    await popup.locator("#manual-detect").click();
    await expect(popup.locator("#f-title")).toHaveText("Apprentice Electrician");
    await expect(popup.locator("#kind-chip")).toHaveText("Job posting");
  });
});
