/** Indeed job pages, the Indeed Apply flow and its post-apply confirmation. */
(() => {
  const C = window.__cqCommon;
  if (!C) return;
  C.registerDetector({
    platform: "INDEED",
    detect: C.createDetector({
      platform: "INDEED",
      confirmationPhrases: ["Your application has been submitted", "Your application has been sent to", "Application submitted"],
      confirmationRoutes: ["/post-apply", "/postapply", "/applied", "/confirmation"],
      confirmationSelectors: ['[data-testid="post-apply-confirmation"]', '[data-testid="ia-PostApply"]', ".ia-PostApply", '[data-testid*="PostApply"]', '[class*="post-apply"]'],
      applyRoutes: ["smartapply.indeed.com", "/applystart", "/indeedapply/form", "apply.indeed.com"],
      applySelectors: ["#ia-container", 'form[data-testid="ia-form"]', ".ia-BasePage", '[data-testid="ia-form"]'],
      selectors: {
        title: ['h1[data-testid="jobsearch-JobInfoHeader-title"]', ".jobsearch-JobInfoHeader-title", '[data-testid="simpler-jobTitle"]', 'h2[data-testid="jobTitle"]', "h1.icl-u-xs-mb--xs", ".jobsearch-JobInfoHeader h1"],
        company: ['[data-testid="inlineHeader-companyName"]', '[data-company-name="true"]', '[data-testid="jobsearch-CompanyInfoContainer"] a', ".jobsearch-InlineCompanyRating > div:first-child", ".jobsearch-CompanyInfoWithoutHeaderImage a", '[data-testid="company-name"]'],
        location: ['[data-testid="inlineHeader-companyLocation"]', '[data-testid="jobsearch-JobInfoHeader-companyLocation"]', '[data-testid="job-location"]', ".jobsearch-JobInfoHeader-subtitle > div:last-child", ".jobsearch-CompanyInfoWithoutHeaderImage > div > div:last-child"],
        salaryText: ["#salaryInfoAndJobType span:first-child", '[data-testid="attribute_snippet_testid"]', ".jobsearch-JobMetadataHeader-item", '[data-testid="salaryInfoAndJobType"]'],
      },
      custom(doc, url, fields, detectedBy) {
        // Indeed Apply pages show "Applying to <Title> at <Company>" in the header.
        if (!fields.title) {
          const hit = C.firstText(doc, ['[data-testid="ia-JobInfoCard-title"]', ".ia-JobInfoCard-title", '[data-testid="ia-jobTitle"]']);
          if (hit) {
            fields.title = hit.text;
            detectedBy.push("selector:title");
          }
        }
        if (!fields.company) {
          const hit = C.firstText(doc, ['[data-testid="ia-JobInfoCard-company"]', ".ia-JobInfoCard-company", '[data-testid="ia-companyName"]']);
          if (hit) {
            fields.company = hit.text;
            detectedBy.push("selector:company");
          }
        }
      },
    }),
  });
})();
