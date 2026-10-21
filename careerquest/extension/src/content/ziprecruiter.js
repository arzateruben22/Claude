/** ZipRecruiter job pages and 1-Click Apply confirmations. */
(() => {
  const C = window.__cqCommon;
  if (!C) return;
  C.registerDetector({
    platform: "ZIPRECRUITER",
    detect: C.createDetector({
      platform: "ZIPRECRUITER",
      confirmationPhrases: ["Application sent", "You applied to"],
      // "Applied" alone also appears as a badge in job lists → prompt instead of auto-record.
      weakPhrases: ["Applied"],
      confirmationRoutes: ["/apply/confirmation", "/applied", "/application-sent", "/thank-you", "/confirmation"],
      confirmationSelectors: ['[data-testid*="apply-confirmation"]', '[class*="application_sent"]', '[class*="ApplyConfirmation"]', '[class*="apply-confirmation"]', '[class*="applied_confirmation"]'],
      applyRoutes: ["/apply/", "/ojob/apply", "/candidate/apply"],
      applySelectors: ['form[class*="apply"]', ".apply_modal", '[data-testid="apply-form"]', 'form[id*="apply"]'],
      selectors: {
        title: ["h1.job_title", 'h1[class*="job_title"]', 'h1[class*="JobTitle"]', ".job_header h1", '[data-testid="job-title"]', "h1"],
        company: [".hiring_company_text", 'a[class*="hiring_company"]', '[class*="company_name"]', '[data-testid="job-card-company"]', ".job_header .company", '[class*="companyName"]'],
        location: [".location_text", '[class*="job_location"]', '[data-testid="job-location"]', '[class*="location"]'],
        salaryText: ['[class*="salary"]', ".job_benefits_list .perk", '[data-testid="job-salary"]', ".perks_item"],
      },
    }),
  });
})();
