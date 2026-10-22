/** SmartRecruiters career sites and job pages. */
(() => {
  const C = window.__cqCommon;
  if (!C) return;
  C.registerDetector({
    platform: "SMARTRECRUITERS",
    detect: C.createDetector({
      platform: "SMARTRECRUITERS",
      confirmationPhrases: ["Thank you for your application", "Application submitted"],
      confirmationRoutes: ["/thank-you", "/thankyou", "/confirmation"],
      confirmationSelectors: ['[class*="thank-you"]', ".application-confirmation", '[data-test*="thank"]'],
      applyRoutes: ["/oneclick-ui/", "/apply", "/application"],
      applySelectors: ['form[class*="apply"]', '[data-test="application-form"]', 'form[id*="application"]', '[class*="application-form"]'],
      selectors: {
        title: ["h1.job-title", '[class*="job-title"]', '[itemprop="title"]', "h1"],
        company: ['[itemprop="hiringOrganization"]', ".job-company", '[class*="company-name"]', '[class*="companyName"]'],
        location: ['[itemprop="jobLocation"]', ".job-location", '[class*="job-location"]', '[class*="location"]'],
        salaryText: ['[class*="salary"]'],
      },
      custom(doc, url, fields, detectedBy) {
        if (!fields.company) {
          const m = url.match(/smartrecruiters\.com\/([^/?#]+)/i);
          if (m) {
            fields.company = C.titleCase(m[1]);
            detectedBy.push("path:company");
          }
        }
      },
    }),
  });
})();
