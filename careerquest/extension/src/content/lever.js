/** Lever hosted postings (jobs.lever.co). */
(() => {
  const C = window.__cqCommon;
  if (!C) return;
  C.registerDetector({
    platform: "LEVER",
    detect: C.createDetector({
      platform: "LEVER",
      confirmationPhrases: ["Application submitted", "Thank you for applying"],
      confirmationRoutes: ["/thanks", "/thank-you", "/confirmation"],
      confirmationSelectors: [".thanks-page", '[data-qa="thanks"]', ".posting-apply-success", '[class*="thanks"]'],
      applyRoutes: ["/apply"],
      applySelectors: ["#application-form", 'form[data-qa="application-form"]', ".application-form", 'form[action*="/apply"]'],
      jobContainers: [".posting-page", ".content"],
      selectors: {
        title: [".posting-headline h2", ".posting-header h2", '[data-qa="posting-name"]', "h2"],
        location: [".posting-categories .location", ".posting-category.location", ".posting-categories .sort-by-time", '[class*="location"]'],
        salaryText: [".posting-categories .salary", '[class*="salary"]'],
      },
      companyAttrs: [[".main-header-logo img", "alt"], [".main-header-logo a", "aria-label"], ['[class*="logo"] img', "alt"]],
      custom(doc, url, fields, detectedBy) {
        if (fields.company) fields.company = fields.company.replace(/\s*(logo|home|careers?)\s*$/i, "").trim();
        if (!fields.company) {
          const t = C.splitTitle(doc.title);
          // Lever titles read "<Company> - <Role>".
          if (t.company && t.title) {
            fields.company = t.title;
            if (!fields.title) fields.title = t.company;
            detectedBy.push("title:company");
          }
        }
        if (!fields.company) {
          const m = url.match(/lever\.co\/([^/?#]+)/i);
          if (m) {
            fields.company = C.titleCase(m[1]);
            detectedBy.push("path:company");
          }
        }
      },
    }),
  });
})();
