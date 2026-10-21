/** GovernmentJobs.com / NEOGOV agency career portals. */
(() => {
  const C = window.__cqCommon;
  if (!C) return;
  C.registerDetector({
    platform: "GOVERNMENTJOBS",
    detect: C.createDetector({
      platform: "GOVERNMENTJOBS",
      confirmationPhrases: ["Your application has been received", "Application submitted"],
      confirmationRoutes: ["/applications/confirmation", "/confirmation", "/submitted", "/thank-you", "/applied"],
      confirmationSelectors: [".application-confirmation", '[class*="application-confirmation"]', '[class*="confirmation"]', '[id*="confirmation"]'],
      applyRoutes: ["/apply", "/applications/", "/application/"],
      applySelectors: ['form[class*="application"]', 'form[id*="application"]', '[class*="application-form"]'],
      selectors: {
        title: ["h1.job-title", 'h1[class*="title"]', ".job-details h1", '[class*="job-title"]', "h1"],
        company: [".job-header .agency", '[class*="agency"]', '[class*="employer"]', '[class*="company"]'],
        location: [".job-location", '[class*="job-location"]', '[class*="location"]', '[data-automation="location"]'],
        salaryText: ['[class*="salary"]', '[data-automation="salary"]'],
        requisitionId: ['[class*="job-number"]', '[class*="jobNumber"]', '[data-automation="job-number"]'],
      },
      custom(doc, url, fields, detectedBy) {
        if (!fields.company) {
          const m = url.match(/\/careers\/([^/?#]+)/i);
          if (m) {
            fields.company = C.titleCase(m[1]);
            detectedBy.push("path:company");
          }
        }
        if (!fields.requisitionId) {
          const m = url.match(/\/jobs\/(\d{4,})\b/);
          if (m) {
            fields.requisitionId = m[1];
            detectedBy.push("url:requisition");
          }
        }
      },
    }),
  });
})();
