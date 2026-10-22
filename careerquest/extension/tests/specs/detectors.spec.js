// @ts-check
/**
 * Detector tests.
 *
 * Part 1 (extension-loaded): the browser maps each real job-board hostname to
 * the fixture server, so navigating to e.g. https://www.indeed.com/viewjob?jk=…
 * makes Chrome inject the manifest's real content scripts. The content script
 * reports to the background worker, which stores the detection in
 * chrome.storage.session — that is what we assert on.
 *
 * Part 2 (unit, in-page): common.js + generic.js are injected with
 * page.addScriptTag into fixture pages served from 127.0.0.1 (no content-script
 * match), and window.__cqDetect / window.__cqCommon are called directly.
 */
const path = require("node:path");
const { test, expect, EXTENSION_PATH } = require("../fixtures");

const SENSITIVE = /123-45-6789|hunter2-secret|4111 1111 1111 1111|SECRET-COVER-LETTER|REFERRAL-SECRET|secret-search-term/;

/** @type {Array<{ name: string, url: string, expect: Record<string, any> }>} */
const CASES = [
  {
    name: "Indeed job page (JSON-LD + DOM)",
    url: "https://www.indeed.com/viewjob?jk=abc123def456&from=serp&vjs=3",
    expect: { kind: "JOB_PAGE", platform: "INDEED", company: "Acme Electric Inc.", title: "Apprentice Electrician", location: /Irvine/, requisitionId: "REQ-48213", salaryText: /28/, confidence: 0.9, detectedBy: ["jsonld"], url: "https://www.indeed.com/viewjob?jk=abc123def456" },
  },
  {
    name: "Indeed post-apply confirmation",
    url: "https://smartapply.indeed.com/beta/indeedapply/form/post-apply",
    expect: { kind: "CONFIRMATION_PAGE", platform: "INDEED", minConfidence: 0.9, confirmationText: /^Your application has been submitted/i, company: "Acme Electric Inc.", title: "Apprentice Electrician", detectedBy: ["confirmation-route", "phrase:Your application has been submitted"] },
  },
  {
    name: "Indeed Apply form = APPLY_STARTED (never auto-recorded)",
    url: "https://smartapply.indeed.com/beta/indeedapply/form/contact-info",
    expect: { kind: "APPLY_STARTED", platform: "INDEED", confidence: 0.5, title: "Apprentice Electrician", company: "Acme Electric Inc." },
  },
  {
    name: "LinkedIn job view (DOM selectors, no JSON-LD)",
    url: "https://www.linkedin.com/jobs/view/3912345678/?trk=public_jobs",
    expect: { kind: "JOB_PAGE", platform: "LINKEDIN", company: "Acme Electric", title: "Apprentice Electrician", location: "Irvine, CA", salaryText: /\$28/, requisitionId: "JR-77421", confidence: 0.7 },
  },
  {
    name: "LinkedIn Easy Apply post-apply modal",
    url: "https://www.linkedin.com/jobs/view/3912345678/?applied=1",
    expect: { kind: "CONFIRMATION_PAGE", platform: "LINKEDIN", minConfidence: 0.9, confirmationText: /Your application was sent to Acme Electric/, title: "Apprentice Electrician" },
  },
  {
    name: "Glassdoor listing",
    url: "https://www.glassdoor.com/job-listing/apprentice-electrician-acme-electric-JV_IC1146821_KO0,22_KE23,36.htm?jl=1009283",
    expect: { kind: "JOB_PAGE", platform: "GLASSDOOR", company: "Acme Electric", title: "Apprentice Electrician", location: /Irvine/, salaryText: /58,000/, confidence: 0.9 },
  },
  {
    name: "ZipRecruiter job",
    url: "https://www.ziprecruiter.com/c/Acme-Electric/Job/Apprentice-Electrician/-in-Irvine,CA?jid=9a7f2c1d",
    expect: { kind: "JOB_PAGE", platform: "ZIPRECRUITER", company: "Acme Electric", title: "Apprentice Electrician", location: "Irvine, CA", salaryText: /\$28/, confidence: 0.7 },
  },
  {
    name: "ZipRecruiter 'Application sent' modal",
    url: "https://www.ziprecruiter.com/c/Acme-Electric/Job/Apprentice-Electrician/-in-Irvine,CA?jid=9a7f2c1d&applied=true",
    expect: { kind: "CONFIRMATION_PAGE", platform: "ZIPRECRUITER", minConfidence: 0.9, confirmationText: /Application sent/ },
  },
  {
    name: "ZipRecruiter bare 'Applied' badge is only a weak signal (prompt, never auto)",
    url: "https://www.ziprecruiter.com/jobs-search?search=electrician&applied=weak",
    expect: { kind: "CONFIRMATION_PAGE", platform: "ZIPRECRUITER", confidence: 0.6, confirmationText: /Applied/ },
  },
  {
    name: "Workday posting",
    url: "https://acme.wd5.myworkdayjobs.com/en-US/Acme_Careers/job/Irvine-CA/Apprentice-Electrician_R-20417",
    expect: { kind: "JOB_PAGE", platform: "WORKDAY", title: "Apprentice Electrician", company: "Acme", location: "Irvine, CA", requisitionId: "R-20417", salaryText: /\$28/, confidence: 0.7 },
  },
  {
    name: "Workday apply flow = APPLY_STARTED",
    url: "https://acme.wd5.myworkdayjobs.com/en-US/Acme_Careers/job/Irvine-CA/Apprentice-Electrician_R-20417/apply/applyManually",
    expect: { kind: "APPLY_STARTED", platform: "WORKDAY", confidence: 0.5, requisitionId: "R-20417" },
  },
  {
    name: "Workday completed page",
    url: "https://acme.wd5.myworkdayjobs.com/en-US/Acme_Careers/job/Irvine-CA/Apprentice-Electrician_R-20417/apply/applied",
    expect: { kind: "CONFIRMATION_PAGE", platform: "WORKDAY", minConfidence: 0.9, confirmationText: /You have successfully applied/, requisitionId: "R-20417" },
  },
  {
    name: "Workday confirmation route without any phrase → 0.7 (prompt)",
    url: "https://acme.wd5.myworkdayjobs.com/en-US/Acme_Careers/job/Irvine-CA/Apprentice-Electrician_R-20417/apply/applied?silent=1",
    expect: { kind: "CONFIRMATION_PAGE", platform: "WORKDAY", confidence: 0.7, noConfirmationText: true },
  },
  {
    name: "Greenhouse job board",
    url: "https://boards.greenhouse.io/acmeelectric/jobs/4012345?gh_src=abc",
    expect: { kind: "JOB_PAGE", platform: "GREENHOUSE", company: "Acme Electric", title: "Apprentice Electrician", location: /Irvine/, requisitionId: "4012345", salaryText: /58,000/, confidence: 0.9 },
  },
  {
    name: "Greenhouse confirmation",
    url: "https://boards.greenhouse.io/acmeelectric/jobs/4012345/confirmation",
    expect: { kind: "CONFIRMATION_PAGE", platform: "GREENHOUSE", minConfidence: 0.9, confirmationText: /Thank you for applying/, company: "Acme Electric", title: "Apprentice Electrician" },
  },
  {
    name: "Lever posting",
    url: "https://jobs.lever.co/acme-electric/8f1c2a3b-4d5e-6f70-8192-a3b4c5d6e7f8",
    expect: { kind: "JOB_PAGE", platform: "LEVER", company: "Acme Electric", title: "Apprentice Electrician", location: "Irvine, CA", salaryText: /58,000/, confidence: 0.7 },
  },
  {
    name: "Lever thanks page",
    url: "https://jobs.lever.co/acme-electric/8f1c2a3b-4d5e-6f70-8192-a3b4c5d6e7f8/thanks",
    expect: { kind: "CONFIRMATION_PAGE", platform: "LEVER", minConfidence: 0.9, confirmationText: /Application submitted/, company: "Acme Electric", title: "Apprentice Electrician" },
  },
  {
    name: "SmartRecruiters job",
    url: "https://jobs.smartrecruiters.com/AcmeElectric/743999999-apprentice-electrician",
    expect: { kind: "JOB_PAGE", platform: "SMARTRECRUITERS", company: "Acme Electric", title: "Apprentice Electrician", location: /Irvine/, requisitionId: "REQ-SR-5541", confidence: 0.9 },
  },
  {
    name: "SmartRecruiters thank-you",
    url: "https://jobs.smartrecruiters.com/AcmeElectric/743999999-apprentice-electrician/thank-you",
    expect: { kind: "CONFIRMATION_PAGE", platform: "SMARTRECRUITERS", minConfidence: 0.9, confirmationText: /Thank you for your application/ },
  },
  {
    name: "iCIMS job",
    url: "https://careers-acme.icims.com/jobs/1187/apprentice-electrician/job",
    expect: { kind: "JOB_PAGE", platform: "ICIMS", company: "Acme Electric", title: "Apprentice Electrician", location: "Irvine, CA", requisitionId: "2026-1187", salaryText: /27\.50/, confidence: 0.7 },
  },
  {
    name: "iCIMS confirmation",
    url: "https://careers-acme.icims.com/jobs/1187/apprentice-electrician/thank-you",
    expect: { kind: "CONFIRMATION_PAGE", platform: "ICIMS", minConfidence: 0.9, confirmationText: /Thank you for applying/ },
  },
  {
    name: "ADP Workforce Now job",
    url: "https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=abc&ccId=1&jobId=441&lang=en_US",
    expect: { kind: "JOB_PAGE", platform: "ADP", company: "Acme Electric", title: "Apprentice Electrician", location: "Irvine, CA", requisitionId: "10-2026-0441", confidence: 0.7 },
  },
  {
    name: "ADP confirmation",
    url: "https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=abc&jobId=441&page=applicationConfirmation",
    expect: { kind: "CONFIRMATION_PAGE", platform: "ADP", minConfidence: 0.9, confirmationText: /Thank you for applying/ },
  },
  {
    name: "GovernmentJobs posting",
    url: "https://www.governmentjobs.com/careers/irvine/jobs/4598123/apprentice-electrician",
    expect: { kind: "JOB_PAGE", platform: "GOVERNMENTJOBS", company: "City of Irvine", title: "Apprentice Electrician", location: "Irvine, CA", salaryText: /58,000/, requisitionId: "2026-00123", confidence: 0.7 },
  },
  {
    name: "GovernmentJobs confirmation",
    url: "https://www.governmentjobs.com/careers/irvine/applications/4598123/confirmation",
    expect: { kind: "CONFIRMATION_PAGE", platform: "GOVERNMENTJOBS", minConfidence: 0.9, confirmationText: /Your application has been received/ },
  },
  {
    name: "USAJOBS announcement",
    url: "https://www.usajobs.gov/job/812345678",
    expect: { kind: "JOB_PAGE", platform: "USAJOBS", company: "Department of the Navy", title: "Electrician Apprentice", location: "San Diego, CA", salaryText: /45,000/, requisitionId: "ST-12345678-26-ABC", confidence: 0.7 },
  },
  {
    name: "USAJOBS application complete",
    url: "https://www.usajobs.gov/Applicant/Application/complete/812345678",
    expect: { kind: "CONFIRMATION_PAGE", platform: "USAJOBS", minConfidence: 0.9, confirmationText: /successfully submitted your application/ },
  },
  // ---- negative / privacy cases (adversarial review) ----
  {
    name: "EXT-01: a posting (JSON-LD) whose description, nav, footer and closed FAQ say 'Thank you for applying' stays a JOB_PAGE",
    url: "https://boards.greenhouse.io/acmeelectric/jobs/4012399",
    expect: { kind: "JOB_PAGE", platform: "GREENHOUSE", title: "Journeyman Electrician", company: "Acme Electric", confidence: 0.9, noConfirmationText: true, salaryText: /42/ },
  },
  {
    name: "EXT-02: an 'Applied Materials' posting mentioning 'applied behavior analysis' is a JOB_PAGE, not a weak confirmation",
    url: "https://www.ziprecruiter.com/c/Applied-Materials/Job/Process-Technician/-in-Santa-Clara,CA?jid=5b2e9d1a",
    expect: { kind: "JOB_PAGE", platform: "ZIPRECRUITER", company: "Applied Materials", title: "Process Technician", confidence: 0.7 },
  },
  {
    name: "SP-02: the applied-jobs list (path contains /applied, several 'Applied' badges) is not a confirmation",
    url: "https://www.ziprecruiter.com/jobs/applied?page=1",
    expect: { kind: null, platform: "ZIPRECRUITER", noConfirmationText: true },
  },
  {
    name: "SP-07: a 'You applied to this job on …' status line is only a prompt (≤ 0.7), never auto-recorded",
    url: "https://www.ziprecruiter.com/c/Acme-Electric/Job/Apprentice-Electrician/-in-Irvine,CA?jid=9a7f2c1d&status=1",
    expect: { kind: "CONFIRMATION_PAGE", platform: "ZIPRECRUITER", confidence: 0.7, confirmationText: /^You applied to this job on Oct 2, 2026\.$/ },
  },
  {
    name: "SP-05: the apply review step never harvests the applicant's own salary / ids / contact answers",
    url: "https://acme.wd5.myworkdayjobs.com/en-US/Acme_Careers/job/Irvine-CA/Apprentice-Electrician_R-20417/apply/review",
    expect: { kind: "APPLY_STARTED", platform: "WORKDAY", salaryText: "", requisitionId: "R-20417", notContaining: /85,000|EMP-445566|555-0134|jane\.doe/ },
  },
  {
    name: "SP-03/EXT-06: the confirmation sentence stops at the heading and never includes the applicant's name, e-mail or phone",
    url: "https://jobs.lever.co/acme-electric/8f1c2a3b-4d5e-6f70-8192-a3b4c5d6e7f8/thanks?pii=1",
    expect: { kind: "CONFIRMATION_PAGE", platform: "LEVER", minConfidence: 0.9, confirmationText: "Application submitted", title: "Apprentice Electrician", notContaining: /Jane|jane\.doe|example\.com|555-0134/ },
  },
  {
    name: "SP-08: a stray '%' in the URL does not abort detection",
    url: "https://jobs.lever.co/acme-electric/8f1c2a3b-4d5e-6f70-8192-a3b4c5d6e7f8?src=50%&q=%E0%A4%A",
    expect: { kind: "JOB_PAGE", platform: "LEVER", title: "Apprentice Electrician", company: "Acme Electric" },
  },
  {
    name: "a confirmation heading picked up by a generic h1 selector is not reported as the job title",
    url: "https://careers-acme.icims.com/jobs/1187/apprentice-electrician/thank-you",
    expect: { kind: "CONFIRMATION_PAGE", platform: "ICIMS", title: "", minConfidence: 0.9 },
  },
];

function assertDetection(d, exp) {
  expect(JSON.stringify(d)).not.toMatch(SENSITIVE);
  for (const [key, value] of Object.entries(exp)) {
    if (key === "minConfidence") expect(d.confidence, "confidence").toBeGreaterThanOrEqual(value);
    else if (key === "maxConfidence") expect(d.confidence, "confidence").toBeLessThanOrEqual(value);
    else if (key === "notContaining") expect(JSON.stringify(d)).not.toMatch(value);
    else if (key === "noConfirmationText") expect(d.confirmationText).toBeUndefined();
    else if (key === "detectedBy") for (const v of value) expect(d.detectedBy, "detectedBy").toContain(v);
    else if (value instanceof RegExp) expect(d[key], key).toMatch(value);
    else expect(d[key], key).toBe(value);
  }
  if (d.confirmationText) expect(d.confirmationText.length).toBeLessThanOrEqual(300);
}

test.describe("platform content scripts (injected by the real manifest matches)", () => {
  for (const c of CASES) {
    test(c.name, async ({ page, ext }) => {
      await page.goto(c.url);
      const tabId = await ext.tabIdOf(page);
      const detection = await ext.waitForDetection(tabId, { predicate: (d) => d.kind === c.expect.kind });
      assertDetection(detection, c.expect);
    });
  }

  test("detection follows SPA changes: a confirmation banner rendered later is noticed", async ({ page, ext }) => {
    await page.goto("https://www.linkedin.com/jobs/view/3912345678/");
    const tabId = await ext.tabIdOf(page);
    await ext.waitForDetection(tabId, { predicate: (d) => d.kind === "JOB_PAGE" });
    await page.evaluate(() => {
      const modal = document.createElement("div");
      modal.setAttribute("data-test-modal-id", "post-apply-modal");
      modal.innerHTML = "<h2>Your application was sent to Acme Electric!</h2>";
      document.body.append(modal);
    });
    const d = await ext.waitForDetection(tabId, { predicate: (x) => x.kind === "CONFIRMATION_PAGE" });
    expect(d.confidence).toBeGreaterThanOrEqual(0.9);
    expect(d.confirmationText).toMatch(/Your application was sent to Acme Electric/);
  });

  // SP-01 / SP-06: the manifest scope keeps content scripts out of HR/payroll
  // and candidate account areas on the same hosts.
  for (const [name, url] of [
    ["SP-01: ADP Workforce Now pay statement (HR/payroll portal)", "https://workforcenow.adp.com/theme/index.html?section=pay"],
    ["SP-06: USAJOBS applicant 'My Applications' list", "https://my.usajobs.gov/Applicant/Application/ListApplications"],
  ]) {
    test(`no content script runs on ${name}`, async ({ page, ext, mockApi }) => {
      await ext.configure();
      await page.goto(url);
      await expect(page.locator("h1")).toBeVisible(); // the page itself loaded
      const tabId = await ext.tabIdOf(page);
      await new Promise((r) => setTimeout(r, 1500));
      expect(((await ext.session("detections")) || {})[tabId]).toBeUndefined();
      expect(((await ext.local("pending")) || {})[tabId]).toBeUndefined();
      expect(await ext.badge(tabId)).toBe("");
      expect(mockApi.state.requests).toHaveLength(0);
    });
  }
});

test.describe("generic extractor and helpers (addScriptTag unit tests)", () => {
  const inject = async (page) => {
    await page.addScriptTag({ path: path.join(EXTENSION_PATH, "src/content/common.js") });
    await page.addScriptTag({ path: path.join(EXTENSION_PATH, "src/content/generic.js") });
  };

  test("generic JSON-LD job page", async ({ page, ext }) => {
    await page.goto(`https://127.0.0.1:${ext.context ? 4310 : 4310}/__fixtures/generic_jsonld.html`);
    await inject(page);
    const d = await page.evaluate(() => window.__cqDetect());
    assertDetection(d, { kind: "JOB_PAGE", platform: "COMPANY_SITE", company: "Example Energy", title: "Apprentice Electrician", location: "Santa Ana, CA", salaryText: "$30 per hour", requisitionId: "EE-2026-017", confidence: 0.9, detectedBy: ["jsonld"] });
    expect(JSON.stringify(d)).not.toContain("private@example.com");
  });

  test("generic confirmation page: phrase only → 0.7 (a prompt, never auto-recorded)", async ({ page }) => {
    await page.goto("https://127.0.0.1:4310/__fixtures/generic_confirmation.html");
    await inject(page);
    const d = await page.evaluate(() => window.__cqDetect());
    assertDetection(d, { kind: "CONFIRMATION_PAGE", confidence: 0.7, confirmationText: "Thank you for applying" });
  });

  test("visible-text search ignores hidden nodes and form controls; sentences are capped at 300 chars", async ({ page }) => {
    await page.goto("https://127.0.0.1:4310/__fixtures/generic_jsonld.html");
    await inject(page);
    const out = await page.evaluate(() => {
      const C = window.__cqCommon;
      document.body.insertAdjacentHTML(
        "beforeend",
        `<div id="t">
           <p style="display:none">HIDDEN Your application has been submitted</p>
           <p hidden>HIDDEN2 Application submitted</p>
           <input value="INPUT Thank you for applying" />
           <textarea>TEXTAREA Thank you for applying</textarea>
           <p>Visible: ${"word ".repeat(80)}Thank you for applying to Example Energy ${"tail ".repeat(80)}and that is all</p>
         </div>`,
      );
      const text = C.visibleText(document);
      const found = C.findConfirmation(document, ["Your application has been submitted", "Application submitted", "Thank you for applying"]);
      return {
        hasHidden: /HIDDEN/.test(text),
        hasInput: /INPUT|TEXTAREA/.test(text),
        phrase: found && found.phrase,
        len: found ? found.sentence.length : 0,
        containsPhrase: !!found && /Thank you for applying/.test(found.sentence),
        req: [C.extractRequisitionId("Job ID: 2026-1187"), C.extractRequisitionId("Requisition R-20417 open"), C.extractRequisitionId("ref JR123456"), C.extractRequisitionId("no id here")],
        salary: [C.extractSalaryText("Pay: $28 - $34 an hour, benefits"), C.extractSalaryText("$58,000 - $70,000 per year"), C.extractSalaryText("nothing")],
        scores: [
          C.scoreConfirmation({ phrase: true, route: true, element: true }),
          C.scoreConfirmation({ phrase: true, route: false, element: false }),
          C.scoreConfirmation({ phrase: false, route: true, element: false }),
          C.scoreConfirmation({ phrase: true, weak: true, route: true, element: true }),
          C.scoreConfirmation({ phrase: true, weak: true, route: false, element: false }),
        ],
      };
    });
    expect(out.hasHidden).toBe(false);
    expect(out.hasInput).toBe(false);
    expect(out.phrase).toBe("Thank you for applying");
    expect(out.containsPhrase).toBe(true);
    expect(out.len).toBeLessThanOrEqual(300);
    expect(out.len).toBeGreaterThan(100);
    expect(out.req).toEqual(["2026-1187", "R-20417", "JR123456", ""]);
    expect(out.salary[0]).toBe("$28 - $34 an hour");
    expect(out.salary[1]).toBe("$58,000 - $70,000 per year");
    expect(out.salary[2]).toBe("");
    // Only a corroborated strong phrase reaches the auto-record threshold (0.8).
    expect(out.scores).toEqual([0.95, 0.7, 0.7, 0.7, 0.6]);
  });
});

/**
 * Rules of the shared detector, exercised in-page on synthetic markup with a
 * Greenhouse-like config (common.js injected with addScriptTag).
 */
test.describe("detector rules (in-page unit tests)", () => {
  const CONFIG = {
    platform: "GREENHOUSE",
    confirmationPhrases: ["Thank you for applying", "Your application has been submitted", "Application submitted"],
    weakPhrases: ["Applied"],
    confirmationRoutes: ["/confirmation"],
    confirmationSelectors: ["#application_confirmation"],
    applyRoutes: ["/apply"],
    jobContainers: ["#content-body"],
    selectors: { title: [".app-title", "h1"], company: [".company-name"], location: [".location"] },
  };
  const JSONLD = `<script type="application/ld+json">{"@type":"JobPosting","title":"Journeyman Electrician","hiringOrganization":{"name":"Acme Electric"}}</script>`;
  const POSTING = `<h1 class="app-title">Journeyman Electrician</h1><div class="company-name">Acme Electric</div>`;
  const JOB_URL = "https://boards.greenhouse.io/acme/jobs/4012399";

  /** @param {import("@playwright/test").Page} page */
  const setup = async (page) => {
    await page.goto("https://127.0.0.1:4310/__fixtures/generic_jsonld.html");
    await page.addScriptTag({ path: path.join(EXTENSION_PATH, "src/content/common.js") });
    return (html, url = JOB_URL, config = CONFIG) =>
      page.evaluate(
        ({ html, url, config }) => {
          document.head.querySelectorAll('script[type="application/ld+json"]').forEach((el) => el.remove());
          document.body.innerHTML = html;
          return window.__cqCommon.createDetector(config)(document, url);
        },
        { html, url, config },
      );
  };

  test("EXT-01: with JSON-LD JobPosting, a phrase in the description/heading is ignored; in a dialog it only prompts; with a route it counts", async ({ page }) => {
    const detect = await setup(page);
    const description = `<div id="content-body"><h3>Thank you for applying!</h3><p>Your application has been submitted once you finish below.</p></div>`;
    const job = await detect(JSONLD + POSTING + description);
    expect(job).toMatchObject({ kind: "JOB_PAGE", confidence: 0.9 });
    expect(job.confirmationText).toBeUndefined();

    const dialog = await detect(JSONLD + POSTING + description + `<div role="dialog"><h2>Application submitted</h2></div>`);
    expect(dialog).toMatchObject({ kind: "CONFIRMATION_PAGE", confidence: 0.7, confirmationText: "Application submitted" });

    const routed = await detect(JSONLD + POSTING + description, `${JOB_URL}/confirmation`);
    expect(routed).toMatchObject({ kind: "CONFIRMATION_PAGE", confidence: 0.9, confirmationText: "Thank you for applying!" });
  });

  test("phrases in nav, footer and a closed FAQ are never read; phrase-only body text is at most a prompt (SP-07)", async ({ page }) => {
    const detect = await setup(page);
    const chrome = `<nav><a>Application submitted</a></nav><footer>Thank you for applying!</footer><details><summary>FAQ</summary><p>Your application has been submitted when…</p></details>`;
    const d = await detect(POSTING + chrome);
    expect(d.kind).toBe("JOB_PAGE");
    expect(d.detectedBy.some((x) => x.startsWith("phrase:"))).toBe(false);
    const opened = await detect(POSTING + chrome.replace("<details>", "<details open>"));
    expect(opened).toMatchObject({ kind: "CONFIRMATION_PAGE", confidence: 0.7 });
    const status = await detect(POSTING + `<p class="status">You applied — Application submitted on Oct 2.</p>`);
    expect(status).toMatchObject({ kind: "CONFIRMATION_PAGE", confidence: 0.7 });
  });

  test("SP-03/EXT-06: the sentence is block-bounded and e-mails/phones inside it are masked", async ({ page }) => {
    const detect = await setup(page);
    const url = `${JOB_URL}/confirmation`;
    const adjacent = await detect(`<div id="application_confirmation"><h2>Application submitted</h2><p>Jane Doe · jane.doe@example.com · (949) 555-0134</p><span>Thanks, Jane</span></div>`, url);
    expect(adjacent).toMatchObject({ kind: "CONFIRMATION_PAGE", confidence: 0.95, confirmationText: "Application submitted" });
    const inline = await detect(`<div id="application_confirmation"><h2>Thank you for applying, we e-mailed jane.doe@example.com and will call (949) 555-0134</h2></div>`, url);
    expect(inline.confirmationText).toBe("Thank you for applying, we e-mailed [email] and will call [phone]");
    const spanning = await detect(`<div id="application_confirmation"><p>Your application has been <b>submitted</b>. Jane Doe</p></div>`, url);
    expect(spanning.confirmationText).toBe("Your application has been submitted.");
    const br = await detect(`<div id="application_confirmation"><p>Application submitted<br>Jane Doe</p></div>`, url);
    expect(br.confirmationText).toBe("Application submitted");
  });

  test("EXT-02: weak phrases count only as one standalone badge, never above 0.7", async ({ page }) => {
    const detect = await setup(page);
    const materials = await detect(`<h1 class="app-title">Process Technician</h1><div class="company-name">Applied Materials</div><p>Applied behavior analysis; skills applied daily.</p>`);
    expect(materials.kind).toBe("JOB_PAGE");
    const badge = await detect(POSTING + `<button disabled>✓ Applied</button>`);
    expect(badge).toMatchObject({ kind: "CONFIRMATION_PAGE", confidence: 0.6, confirmationText: "✓ Applied" });
    const withRouteAndElement = await detect(POSTING + `<div id="application_confirmation"><span>Applied</span></div>`, `${JOB_URL}/confirmation`);
    expect(withRouteAndElement.confidence).toBe(0.7);
    const list = await detect(POSTING + `<ul><li><span>Applied</span> A</li><li><span>Applied</span> B</li></ul>`);
    expect(list.kind).toBe("JOB_PAGE");
    const notWholeWord = await detect(POSTING + `<p>Application submittedAt: 3pm</p>`);
    expect(notWholeWord.kind).toBe("JOB_PAGE");
  });

  test("SP-05/SP-01: free-text salary and requisition scans run only on identified postings, inside the posting container", async ({ page }) => {
    const detect = await setup(page);
    const answers = `<dl><dt>Salary expectations</dt><dd>$85,000 per year</dd><dt>Req ID</dt><dd>REQ-99887</dd></dl>`;
    const apply = await detect(POSTING + answers, `${JOB_URL}/apply`);
    expect(apply).toMatchObject({ kind: "APPLY_STARTED", salaryText: "", requisitionId: "" });
    const confirmation = await detect(`<div id="application_confirmation"><h2>Application submitted</h2></div>` + answers, `${JOB_URL}/confirmation`);
    expect(confirmation).toMatchObject({ kind: "CONFIRMATION_PAGE", salaryText: "", requisitionId: "" });
    // an unidentified page (only a bare <h1>, e.g. an HR portal) is not scanned at all
    const unknown = await detect(`<h1>Pay statement</h1><p>Net pay $2,345.67 per week. Employee REQ-445566</p>`, "https://boards.greenhouse.io/acme/account");
    expect(unknown).toMatchObject({ kind: null, salaryText: "", requisitionId: "" });
    // a posting is scanned, but only inside its description container
    const job = await detect(POSTING + `<aside>$99,999 per year bonus banner</aside><div id="content-body"><p>Pay range: $42 - $55 per hour. Req ID 2026-0042</p></div>`);
    expect(job).toMatchObject({ kind: "JOB_PAGE", salaryText: "$42 - $55 per hour", requisitionId: "2026-0042" });
  });

  test("EXT-07: a page known only by its <title> is not a JOB_PAGE; SP-08: a stray % in the URL does not break detection", async ({ page }) => {
    const detect = await setup(page);
    await page.evaluate(() => (document.title = "Acme Careers"));
    const home = await detect(`<h2>Candidate Home</h2><p>Loading your applications…</p>`, "https://acme.wd5.myworkdayjobs.com/en-US/Acme_Careers/userHome");
    expect(home.kind).toBeNull();
    const malformed = await detect(JSONLD + POSTING, "https://boards.greenhouse.io/acme/jobs/4012399?q=50%&x=%E0%A4%A");
    expect(malformed).toMatchObject({ kind: "JOB_PAGE", title: "Journeyman Electrician" });
    expect(await page.evaluate(() => window.__cqCommon.safeDecode("a%E0%A4%A"))).toBe("a%E0%A4%A");
  });
});
