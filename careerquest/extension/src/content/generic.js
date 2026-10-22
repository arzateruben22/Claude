/**
 * Generic extractor: used for manual capture on any site (injected on demand via
 * chrome.scripting with activeTab) and as the COMPANY_SITE/OTHER fallback.
 * Relies on JSON-LD JobPosting, Open Graph/meta and an <h1>; never auto-runs.
 */
(() => {
  const C = window.__cqCommon;
  if (!C) return;

  const detectPlatform = C.createDetector({
    platform: "COMPANY_SITE",
    confirmationPhrases: [
      "Your application has been submitted",
      "Your application has been received",
      "Thank you for applying",
      "Thank you for your application",
      "Application submitted",
      "successfully submitted your application",
      "successfully applied",
    ],
    confirmationRoutes: ["/thank-you", "/thankyou", "/confirmation", "/application-submitted"],
    // Runs only after the user clicked "Capture this page": any title is enough.
    lenientJobEvidence: true,
    applyRoutes: ["/apply"],
    applySelectors: ['form[id*="application" i]', 'form[class*="application" i]', 'form[id*="apply" i]', 'form[class*="apply" i]'],
    selectors: {
      title: ["h1", '[class*="job-title" i]', '[class*="jobTitle" i]', '[data-testid*="job-title" i]'],
      company: ['[class*="company-name" i]', '[class*="companyName" i]', '[itemprop="hiringOrganization"]', '[class*="employer" i]'],
      location: ['[class*="job-location" i]', '[class*="jobLocation" i]', '[itemprop="jobLocation"]', '[data-testid*="location" i]'],
    },
  });

  C.registerDetector({
    platform: "COMPANY_SITE",
    autoRun: false,
    detect(doc, url) {
      const result = detectPlatform(doc, url);
      result.platform = C.platformForUrl(url);
      return result;
    },
  });
})();
