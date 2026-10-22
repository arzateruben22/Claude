/** Greenhouse hosted job boards (boards.greenhouse.io, job-boards.greenhouse.io). */
(() => {
  const C = window.__cqCommon;
  if (!C) return;
  C.registerDetector({
    platform: "GREENHOUSE",
    detect: C.createDetector({
      platform: "GREENHOUSE",
      confirmationPhrases: ["Thank you for applying", "Your application has been submitted"],
      confirmationRoutes: ["/confirmation", "/thank-you", "/thanks"],
      confirmationSelectors: ["#application_confirmation", ".application--confirmation", '[class*="application-confirmation"]', '[data-testid="confirmation"]', ".confirmation-message"],
      // Greenhouse renders the application form on the posting page itself, so a
      // visible form is not evidence that the user started applying: only the
      // dedicated apply route counts.
      applyRoutes: ["/apply", "#app"],
      jobContainers: ["#content", ".job__description", "#app_body"],
      selectors: {
        title: [".app-title", "h1.section-header", ".job__title h1", ".job__header h1", "h1"],
        company: [".company-name", '[class*="company-name"]', ".job__company", '[class*="job__company"]'],
        location: [".location", ".job__location", '[class*="job__location"]', '[class*="location"]'],
        salaryText: [".pay-range", '[class*="pay-range"]', '[class*="salary"]'],
      },
      custom(doc, url, fields, detectedBy) {
        if (fields.company) fields.company = fields.company.replace(/^\s*at\s+/i, "");
        if (!fields.company) {
          const m = url.match(/greenhouse\.io\/([^/?#]+)/i);
          if (m && m[1] !== "embed") {
            fields.company = C.titleCase(m[1]);
            detectedBy.push("path:company");
          }
        }
      },
    }),
  });
})();
