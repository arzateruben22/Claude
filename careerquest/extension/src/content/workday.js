/** Workday (myworkdayjobs.com) postings, apply flow and completion page. */
(() => {
  const C = window.__cqCommon;
  if (!C) return;
  C.registerDetector({
    platform: "WORKDAY",
    detect: C.createDetector({
      platform: "WORKDAY",
      confirmationPhrases: ["You have successfully applied", "Thank you for applying", "Your application has been submitted"],
      confirmationRoutes: ["/applied", "/thank-you", "/confirmation", "/applyflowcompleted", "/complete"],
      confirmationSelectors: ['[data-automation-id="applyFlowCompletedPage"]', '[data-automation-id="applicationSubmitted"]', '[data-automation-id="thankYouPage"]', '[data-automation-id*="Completed"]', '[data-automation-id*="completed"]'],
      applyRoutes: ["/apply/", "/apply?", "/applymanually", "/applyflow"],
      applySelectors: ['[data-automation-id="applyFlowPage"]', '[data-automation-id="jobApplicationForm"]', 'form[data-automation-id*="apply"]', '[data-automation-id="applyFlowMyExperiencePage"]'],
      selectors: {
        title: ['h2[data-automation-id="jobPostingHeader"]', '[data-automation-id="jobPostingHeader"]', '[data-automation-id="jobTitle"]', "h1"],
        location: ['[data-automation-id="locations"] dd', '[data-automation-id="locations"]', '[data-automation-id="location"]'],
        requisitionId: ['[data-automation-id="requisitionId"] dd', '[data-automation-id="requisitionId"]', '[data-automation-id="jobReqId"]'],
      },
      custom(doc, url, fields, detectedBy) {
        // Posting URLs end in _<REQ-ID>, e.g. /job/Irvine/Electrician_R-12345
        if (!fields.requisitionId) {
          const m = url.match(/_([A-Z]{0,4}-?\d{3,}[A-Z0-9-]*)(?:[/?#]|$)/i);
          if (m) {
            fields.requisitionId = m[1].toUpperCase();
            detectedBy.push("url:requisition");
          }
        }
        if (!fields.company) {
          // "Electrician | Acme Careers" style titles, else the tenant subdomain.
          const t = doc.title.split(/\s[|·–-]\s/).map((s) => s.trim()).filter(Boolean);
          const site = t.find((s) => /careers|jobs/i.test(s) && s !== fields.title);
          if (site) {
            fields.company = site.replace(/\s*(careers?|jobs?)\s*$/i, "").trim();
            detectedBy.push("title:company");
          } else {
            try {
              const sub = new URL(url).hostname.split(".")[0];
              if (sub && !/^(www|wd\d+)$/i.test(sub)) {
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
