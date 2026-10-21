/** LinkedIn job views and the Easy Apply post-apply modal. */
(() => {
  const C = window.__cqCommon;
  if (!C) return;
  C.registerDetector({
    platform: "LINKEDIN",
    detect: C.createDetector({
      platform: "LINKEDIN",
      confirmationPhrases: ["Your application was sent to", "Application sent"],
      confirmationRoutes: ["/post-apply", "/applied", "/application-sent"],
      confirmationSelectors: ['[data-test-modal-id="post-apply-modal"]', ".post-apply-modal", ".jpac-modal", '[class*="post-apply"]', ".artdeco-modal .jobs-post-apply"],
      applyRoutes: ["/job-apply/"],
      applySelectors: [".jobs-easy-apply-modal", ".jobs-easy-apply-content", "form.jobs-easy-apply-form", '[data-test-modal-id="easy-apply-modal"]'],
      selectors: {
        title: [".job-details-jobs-unified-top-card__job-title h1", ".job-details-jobs-unified-top-card__job-title", "h1.t-24", ".jobs-unified-top-card__job-title", ".top-card-layout__title", "h1.topcard__title", ".jobs-details-top-card__job-title"],
        company: [".job-details-jobs-unified-top-card__company-name a", ".job-details-jobs-unified-top-card__company-name", ".jobs-unified-top-card__company-name", ".topcard__org-name-link", ".topcard__flavor:first-child", ".jobs-details-top-card__company-url"],
        location: [".job-details-jobs-unified-top-card__primary-description-container .tvm__text:first-child", ".job-details-jobs-unified-top-card__bullet", ".jobs-unified-top-card__bullet", ".topcard__flavor--bullet", ".jobs-details-top-card__bullet", ".job-details-jobs-unified-top-card__tertiary-description-container span:first-child"],
        salaryText: [".jobs-unified-top-card__job-insight span", ".compensation__salary", ".job-details-jobs-unified-top-card__job-insight--highlight span", '[class*="salary"]'],
      },
      custom(doc, url, fields) {
        // Easy Apply is a modal on the job page, so APPLY_STARTED comes from applySelectors only.
        if (!fields.company) {
          const m = C.splitTitle(doc.title);
          if (m.company) fields.company = m.company;
        }
      },
    }),
  });
})();
