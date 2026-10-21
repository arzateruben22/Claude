/** USAJOBS announcements and application status pages. */
(() => {
  const C = window.__cqCommon;
  if (!C) return;
  C.registerDetector({
    platform: "USAJOBS",
    detect: C.createDetector({
      platform: "USAJOBS",
      confirmationPhrases: ["You've successfully submitted your application", "You’ve successfully submitted your application", "successfully submitted your application", "Application submitted"],
      confirmationRoutes: ["/application/complete", "/confirmation", "/submitted", "/applicant/application", "/thank-you"],
      confirmationSelectors: [".usajobs-application-status", '[class*="application-complete"]', '[class*="application-submitted"]', '[class*="confirmation"]'],
      applyRoutes: ["/applicant/", "/apply", "/application/"],
      applySelectors: ['form[class*="application"]', 'form[id*="application"]', '[class*="usajobs-application"]'],
      selectors: {
        title: ["h1.usajobs-joa-banner__title", ".usajobs-joa-banner__title", '[class*="joa-banner__title"]', "h1"],
        company: [".usajobs-joa-banner__dept", ".usajobs-joa-banner__agency", '[class*="joa-banner__agency"]', '[class*="agency"]', '[class*="department"]'],
        location: [".usajobs-joa-locations__list li", ".usajobs-joa-locations__list", '[class*="joa-locations"]', '[class*="location"]'],
        salaryText: [".usajobs-joa-summary__salary", '[class*="joa-summary__salary"]', '[class*="salary"]'],
        requisitionId: ["#announcement-number", ".usajobs-joa-summary__number", '[class*="announcement-number"]', '[class*="control-number"]'],
      },
      custom(doc, url, fields, detectedBy) {
        if (!fields.requisitionId) {
          const m = url.match(/\/job\/(\d{6,})\b/i);
          if (m) {
            fields.requisitionId = m[1];
            detectedBy.push("url:requisition");
          }
        }
      },
    }),
  });
})();
