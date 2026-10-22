/**
 * ADP Workforce Now career center and ADP Recruiting career sites. The manifest
 * injects this only on the career-center/recruitment paths, never the employee
 * HR/payroll portal on the same hosts.
 */
(() => {
  const C = window.__cqCommon;
  if (!C) return;
  C.registerDetector({
    platform: "ADP",
    detect: C.createDetector({
      platform: "ADP",
      confirmationPhrases: ["Thank you for applying", "Your application has been submitted"],
      confirmationRoutes: ["/confirmation", "/thank-you", "applicationconfirmation"],
      // Only "application confirmation" elements: a bare *confirmation* class/id also
      // matches HR/payroll widgets (direct-deposit confirmations, pay statements).
      confirmationSelectors: ['[id*="applicationConfirmation"]', '[class*="application-confirmation"]', '[class*="applicationConfirmation"]', '[data-automation-id*="applicationConfirmation"]'],
      applyRoutes: ["/apply", "applynow", "/application"],
      applySelectors: ['form[class*="apply"]', 'form[id*="apply"]', '[data-automation-id*="applicationForm"]', 'form[class*="application"]'],
      jobContainers: [".job-details", '[class*="job-description"]', '[class*="jobDescription"]'],
      selectors: {
        title: ['h1[class*="job-title"]', ".job-details-title", '[data-automation-id="jobTitle"]', '[class*="jobTitle"]', "h1"],
        company: [".company-name", '[class*="company-name"]', '[class*="companyName"]', '[data-automation-id="companyName"]'],
        location: ['[class*="job-location"]', ".job-location", '[data-automation-id="jobLocation"]', '[class*="location"]'],
        requisitionId: ['[data-automation-id="requisitionId"]', '[class*="req-number"]', '[class*="requisition"]'],
      },
      custom(doc, url, fields, detectedBy) {
        if (!fields.requisitionId) {
          const m = url.match(/[?&](?:jobId|reqId|requisitionId)=([A-Za-z0-9_-]{3,})/i);
          if (m) {
            fields.requisitionId = m[1].toUpperCase();
            detectedBy.push("url:requisition");
          }
        }
        if (!fields.company) {
          const site = C.meta(doc, "og:site_name");
          if (site) {
            fields.company = site;
            detectedBy.push("og:site_name");
          }
        }
      },
    }),
  });
})();
