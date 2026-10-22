/**
 * HTTPS fixture server for extension tests (127.0.0.1:4310).
 *
 * Content scripts only match the real job-board hosts, so the test browser is
 * started with --host-resolver-rules mapping those hosts to this server; the
 * page URL then looks exactly like production (https://www.indeed.com/viewjob?jk=…)
 * and the manifest's real match patterns inject the real content scripts.
 *
 * Routing: the (host, path+query) pair selects a fixture file (ROUTES below).
 * A path-prefix form is also supported for direct access without host mapping,
 * e.g. https://127.0.0.1:4310/indeed/viewjob?jk=abc, and /__fixtures/<file>.html
 * serves any fixture verbatim (used by the addScriptTag unit tests).
 */
const fs = require("node:fs");
const https = require("node:https");
const path = require("node:path");
const { ensureCerts } = require("./certs");

const FIXTURE_DIR = path.join(__dirname, "..", "fixtures");
const PORT = 4310;

/** Hostnames mapped to this server by the test browser. */
const FIXTURE_HOSTS = [
  "www.indeed.com",
  "smartapply.indeed.com",
  "www.linkedin.com",
  "www.glassdoor.com",
  "www.ziprecruiter.com",
  "acme.wd5.myworkdayjobs.com",
  "boards.greenhouse.io",
  "job-boards.greenhouse.io",
  "jobs.lever.co",
  "jobs.smartrecruiters.com",
  "careers-acme.icims.com",
  "workforcenow.adp.com",
  "www.governmentjobs.com",
  "www.usajobs.gov",
  "my.usajobs.gov",
  "careers.example.com",
];

/** Path-prefix → synthetic host (for https://127.0.0.1:4310/<prefix>/...). */
const PREFIX_HOSTS = {
  indeed: "www.indeed.com",
  linkedin: "www.linkedin.com",
  glassdoor: "www.glassdoor.com",
  ziprecruiter: "www.ziprecruiter.com",
  workday: "acme.wd5.myworkdayjobs.com",
  greenhouse: "boards.greenhouse.io",
  lever: "jobs.lever.co",
  smartrecruiters: "jobs.smartrecruiters.com",
  icims: "careers-acme.icims.com",
  adp: "workforcenow.adp.com",
  governmentjobs: "www.governmentjobs.com",
  usajobs: "www.usajobs.gov",
  generic: "careers.example.com",
};

/** @type {Array<[RegExp, RegExp, string]>} [host, path+query, fixture file] — first match wins. */
const ROUTES = [
  [/indeed\.com$/, /post-apply|postapply/i, "indeed_confirmation.html"],
  [/indeed\.com$/, /indeedapply\/form|applystart/i, "indeed_apply.html"],
  [/indeed\.com$/, /./, "indeed_job.html"],
  [/linkedin\.com$/, /post-apply|applied=1/i, "linkedin_confirmation.html"],
  [/linkedin\.com$/, /./, "linkedin_job.html"],
  [/glassdoor\.com$/, /./, "glassdoor_job.html"],
  [/ziprecruiter\.com$/, /applied=weak/i, "ziprecruiter_weak.html"],
  [/ziprecruiter\.com$/, /^\/jobs\/applied/, "ziprecruiter_applied_list.html"],
  [/ziprecruiter\.com$/, /Applied-Materials/, "ziprecruiter_applied_materials.html"],
  [/ziprecruiter\.com$/, /status=1/, "ziprecruiter_status.html"],
  [/ziprecruiter\.com$/, /applied|confirmation/i, "ziprecruiter_confirmation.html"],
  [/ziprecruiter\.com$/, /./, "ziprecruiter_job.html"],
  [/myworkdayjobs\.com$/, /R-30999/, "workday_job_b.html"],
  [/myworkdayjobs\.com$/, /\/apply\/review/i, "workday_review.html"],
  [/myworkdayjobs\.com$/, /applied.*silent/i, "workday_route_only.html"],
  [/myworkdayjobs\.com$/, /applied|complete/i, "workday_confirmation.html"],
  [/myworkdayjobs\.com$/, /\/apply/i, "workday_apply.html"],
  [/myworkdayjobs\.com$/, /./, "workday_job.html"],
  [/greenhouse\.io$/, /4012399/, "greenhouse_job_boilerplate.html"],
  [/greenhouse\.io$/, /confirmation/i, "greenhouse_confirmation.html"],
  [/greenhouse\.io$/, /./, "greenhouse_job.html"],
  [/lever\.co$/, /pii=1/, "lever_confirmation_pii.html"],
  [/lever\.co$/, /thanks/i, "lever_confirmation.html"],
  [/lever\.co$/, /./, "lever_job.html"],
  [/smartrecruiters\.com$/, /thank-you/i, "smartrecruiters_confirmation.html"],
  [/smartrecruiters\.com$/, /./, "smartrecruiters_job.html"],
  [/icims\.com$/, /thank-you|confirmation/i, "icims_confirmation.html"],
  [/icims\.com$/, /./, "icims_job.html"],
  [/adp\.com$/, /^\/theme\//, "adp_paystatement.html"],
  [/adp\.com$/, /confirmation/i, "adp_confirmation.html"],
  [/adp\.com$/, /./, "adp_job.html"],
  [/governmentjobs\.com$/, /confirmation|submitted/i, "governmentjobs_confirmation.html"],
  [/governmentjobs\.com$/, /./, "governmentjobs_job.html"],
  [/usajobs\.gov$/, /ListApplications/i, "usajobs_applications.html"],
  [/usajobs\.gov$/, /complete|submitted/i, "usajobs_confirmation.html"],
  [/usajobs\.gov$/, /./, "usajobs_job.html"],
  [/example\.com$/, /thank-you/i, "generic_confirmation.html"],
  [/example\.com$/, /./, "generic_jsonld.html"],
];

/**
 * @param {string} host
 * @param {string} urlPath path + query
 * @returns {string | null} fixture file name
 */
function resolveFixture(host, urlPath) {
  const direct = urlPath.match(/^\/__fixtures\/([a-z0-9_]+\.html)/i);
  if (direct) return direct[1];
  let effectiveHost = host.replace(/:\d+$/, "");
  let effectivePath = urlPath;
  const prefixed = urlPath.match(/^\/([a-z]+)(\/.*)?$/i);
  if (prefixed && PREFIX_HOSTS[prefixed[1].toLowerCase()] && /^(127\.0\.0\.1|localhost)$/.test(effectiveHost)) {
    effectiveHost = PREFIX_HOSTS[prefixed[1].toLowerCase()];
    effectivePath = prefixed[2] || "/";
  }
  for (const [hostRe, pathRe, file] of ROUTES) {
    if (hostRe.test(effectiveHost) && pathRe.test(effectivePath)) return file;
  }
  return null;
}

/**
 * @param {{ port?: number, certDir?: string }} [opts]
 * @returns {Promise<{ port: number, close: () => Promise<void>, requests: Array<{ host: string, url: string }> }>}
 */
async function startFixtureServer(opts = {}) {
  const port = opts.port ?? PORT;
  const certDir = opts.certDir ?? path.join(__dirname, "..", ".tmp", "certs");
  const { key, cert } = ensureCerts(certDir, FIXTURE_HOSTS);
  /** @type {Array<{ host: string, url: string }>} */
  const requests = [];
  const server = https.createServer({ key, cert }, (req, res) => {
    const host = String(req.headers.host || "");
    requests.push({ host, url: req.url || "/" });
    if (req.url === "/__health") {
      res.writeHead(200, { "content-type": "text/plain" });
      return res.end("ok");
    }
    if (req.url === "/favicon.ico") {
      res.writeHead(204);
      return res.end();
    }
    const file = resolveFixture(host, req.url || "/");
    const full = file && path.join(FIXTURE_DIR, path.basename(file));
    if (!full || !fs.existsSync(full)) {
      res.writeHead(404, { "content-type": "text/plain" });
      return res.end(`no fixture for ${host}${req.url}`);
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(fs.readFileSync(full));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return {
    port,
    requests,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

module.exports = { startFixtureServer, resolveFixture, FIXTURE_HOSTS, PREFIX_HOSTS, ROUTES, PORT };

if (require.main === module) {
  startFixtureServer().then((s) => console.log(`fixture server on https://127.0.0.1:${s.port}`));
}
