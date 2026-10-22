/** Glassdoor job listings and its Easy Apply confirmation. */
(() => {
  const C = window.__cqCommon;
  if (!C) return;
  C.registerDetector({
    platform: "GLASSDOOR",
    detect: C.createDetector({
      platform: "GLASSDOOR",
      confirmationPhrases: ["Your application has been submitted", "Application submitted", "Thank you for applying"],
      confirmationRoutes: ["/apply/confirmation", "/confirmation", "/thank-you"],
      confirmationSelectors: ['[data-test="apply-confirmation"]', '[class*="ApplyConfirmation"]'],
      applyRoutes: ["/apply/"],
      applySelectors: ['[data-test="easy-apply-form"]', 'form[class*="EasyApply"]', 'form[class*="apply"]'],
      selectors: {
        title: ['[data-test="job-title"]', 'h1[id^="jd-job-title"]', '[class*="JobDetails_jobTitle"]', "h1"],
        company: ['[data-test="employer-name"]', '[class*="EmployerProfile_employerName"]', '[class*="EmployerProfile_employerNameHeading"]', '[data-test="employerName"]', '[class*="employer-name"]'],
        location: ['[data-test="location"]', '[class*="JobDetails_location"]', '[data-test="emp-location"]', '[class*="location"]'],
        salaryText: ['[data-test="detailSalary"]', '[class*="SalaryEstimate_salaryRange"]', '[class*="SalaryEstimate"]', '[data-test="salary"]'],
      },
    }),
  });
})();
