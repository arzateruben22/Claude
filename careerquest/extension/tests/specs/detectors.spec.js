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
];

function assertDetection(d, exp) {
  expect(JSON.stringify(d)).not.toMatch(SENSITIVE);
  for (const [key, value] of Object.entries(exp)) {
    if (key === "minConfidence") expect(d.confidence, "confidence").toBeGreaterThanOrEqual(value);
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

  test("generic confirmation page: phrase only → 0.8", async ({ page }) => {
    await page.goto("https://127.0.0.1:4310/__fixtures/generic_confirmation.html");
    await inject(page);
    const d = await page.evaluate(() => window.__cqDetect());
    assertDetection(d, { kind: "CONFIRMATION_PAGE", confidence: 0.8, confirmationText: /^Thank you for applying/ });
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
        scores: [C.scoreConfirmation({ phrase: true, route: true, element: true }), C.scoreConfirmation({ phrase: true, route: false, element: false }), C.scoreConfirmation({ phrase: false, route: true, element: false })],
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
    expect(out.scores).toEqual([0.95, 0.8, 0.7]);
  });
});
