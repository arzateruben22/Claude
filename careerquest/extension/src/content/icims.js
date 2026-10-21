/** iCIMS career portals (<tenant>.icims.com). */
(() => {
  const C = window.__cqCommon;
  if (!C) return;
  C.registerDetector({
    platform: "ICIMS",
    detect: C.createDetector({
      platform: "ICIMS",
      confirmationPhrases: ["Thank you for applying", "Your application has been received"],
      confirmationRoutes: ["/thank-you", "/thankyou", "/confirmation", "/complete", "/applied"],
      confirmationSelectors: [".iCIMS_Confirmation", '[class*="iCIMS_ThankYou"]', '[class*="thankyou"]', '[class*="confirmation"]'],
      applyRoutes: ["/apply", "/candidate/", "/profile"],
      applySelectors: [".iCIMS_ApplyForm", "#iCIMS_Apply", 'form[name*="apply" i]', 'form[id*="apply" i]'],
      selectors: {
        title: ["h1.iCIMS_Header", ".iCIMS_JobHeader h1", ".iCIMS_JobHeaderTitle", 'h1[class*="iCIMS"]', "h1"],
        company: ['[class*="iCIMS_Company"]', '[class*="company-name"]'],
        location: ['[class*="iCIMS_JobLocation"]', ".iCIMS_JobHeaderGroup .iCIMS_JobHeaderData", '[class*="location"]'],
        requisitionId: ['[class*="iCIMS_JobHeaderData"][class*="id"]', '[class*="JobId"]'],
      },
      fallback(doc, url, fields, detectedBy) {
        // The numeric path segment is iCIMS' internal id; prefer the visible "Job ID".
        if (!fields.requisitionId) {
          const m = url.match(/\/jobs\/(\d{3,})\b/i);
          if (m) {
            fields.requisitionId = m[1];
            detectedBy.push("url:requisition");
          }
        }
      },
      custom(doc, url, fields, detectedBy) {
        if (!fields.company) {
          const site = C.meta(doc, "og:site_name");
          if (site) {
            fields.company = site;
            detectedBy.push("og:site_name");
          } else {
            try {
              const sub = new URL(url).hostname.split(".")[0].replace(/^(careers?|jobs?)-?/i, "");
              if (sub) {
                fields.company = C.titleCase(sub);
                detectedBy.push("host:company");
              }
            } catch {
              /* ignore */
            }
          }
        }
      },
    }),
  });
})();
