// @ts-check
/**
 * Playwright fixtures that load the real extension into a persistent Chromium
 * context and expose helpers for the service worker, storage and the servers.
 *
 * How extension loading works here (verified empirically in this sandbox):
 *  - chromium.launchPersistentContext with --disable-extensions-except/--load-extension
 *  - headless: true works with the full Chromium binary (/opt/pw-browsers/chromium,
 *    Chromium 141): modern "new headless" supports MV3 extensions and service workers.
 *    Set CQ_HEADED=1 to watch the browser.
 *  - --host-resolver-rules maps the real job-board hostnames to the HTTPS fixture
 *    server so the manifest's content_scripts match and inject for real.
 *  - --no-proxy-server keeps the sandbox's HTTPS proxy from swallowing those hosts.
 *  - --ignore-certificate-errors (+ ignoreHTTPSErrors) accepts the self-signed cert.
 */
const { test: base, expect, chromium } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const { startFixtureServer, FIXTURE_HOSTS } = require("./servers/fixture-server");
const { startMockApi } = require("./servers/mock-api");

const EXTENSION_PATH = path.resolve(__dirname, "..");
const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH || "/opt/pw-browsers/chromium";

/**
 * @typedef {object} ExtensionHelper
 * @property {string} id
 * @property {import("@playwright/test").BrowserContext} context
 * @property {() => Promise<import("@playwright/test").Worker>} sw
 * @property {(fn: any, arg?: any) => Promise<any>} evaluate
 * @property {(key: string) => Promise<any>} local
 * @property {(key: string) => Promise<any>} session
 * @property {() => Promise<void>} reset
 * @property {(opts: { apiBaseUrl?: string, token?: string, connection?: object }) => Promise<void>} configure
 * @property {(page: import("@playwright/test").Page) => Promise<number>} tabIdOf
 * @property {(tabId: number, opts?: { predicate?: (d: any) => boolean, timeoutMs?: number }) => Promise<any>} waitForDetection
 * @property {(tabId: number) => Promise<string>} badge
 * @property {import("@playwright/test").Page[]} opened
 * @property {(tabId: number) => Promise<import("@playwright/test").Page>} openPopup
 * @property {() => Promise<import("@playwright/test").Page>} openOptions
 */

const test = base.extend({
  servers: [
    async ({}, provide) => {
      const fixture = await startFixtureServer();
      const mock = await startMockApi();
      await provide({ fixture, mock });
      await mock.close();
      await fixture.close();
    },
    { scope: "worker" },
  ],

  extContext: [
    async ({ servers }, provide) => {
      const hostRules = FIXTURE_HOSTS.map((h) => `MAP ${h} 127.0.0.1:${servers.fixture.port}`).join(", ");
      const context = await chromium.launchPersistentContext("", {
        executablePath: fs.existsSync(CHROMIUM_PATH) ? CHROMIUM_PATH : undefined,
        headless: !process.env.CQ_HEADED,
        ignoreHTTPSErrors: true,
        args: [
          `--disable-extensions-except=${EXTENSION_PATH}`,
          `--load-extension=${EXTENSION_PATH}`,
          `--host-resolver-rules=${hostRules}`,
          "--ignore-certificate-errors",
          "--no-proxy-server",
          "--no-first-run",
        ],
      });
      await provide(context);
      await context.close();
    },
    { scope: "worker" },
  ],

  extension: [
    async ({ extContext, servers }, provide) => {
      let [worker] = extContext.serviceWorkers();
      if (!worker) worker = await extContext.waitForEvent("serviceworker", { timeout: 20_000 });
      const id = new URL(worker.url()).host;
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      /** A worker handle is usable once its chrome.* bindings exist. */
      const isReady = (w) => w.evaluate(() => !!(globalThis.chrome && chrome.storage && chrome.storage.local && chrome.alarms)).catch(() => false);

      /** @type {ExtensionHelper} */
      const helper = {
        id,
        context: extContext,
        async sw() {
          for (let attempt = 0; attempt < 50; attempt++) {
            let [w] = extContext.serviceWorkers();
            if (!w) {
              // The worker was idle-terminated; opening an extension page wakes it.
              const waiter = extContext.waitForEvent("serviceworker", { timeout: 20_000 }).catch(() => null);
              const p = await extContext.newPage();
              await p.goto(`chrome-extension://${id}/src/options/options.html`);
              w = extContext.serviceWorkers()[0] || (await waiter);
              await p.close();
            }
            // A freshly (re)started worker can be handed out before chrome.* is bound.
            if (w && (await isReady(w))) return w;
            await sleep(100);
          }
          throw new Error("extension service worker did not become ready");
        },
        async evaluate(fn, arg) {
          for (let attempt = 0; ; attempt++) {
            const w = await helper.sw();
            try {
              return await w.evaluate(fn, arg);
            } catch (err) {
              // The worker may be terminated between sw() and evaluate(): retry once.
              if (attempt >= 1 || !/Target closed|has been closed|Execution context was destroyed/i.test(String(err && err.message))) throw err;
            }
          }
        },
        local: (key) => helper.evaluate(async (k) => (await chrome.storage.local.get(k))[k], key),
        session: (key) => helper.evaluate(async (k) => (await chrome.storage.session.get(k))[k], key),
        async reset() {
          await helper.evaluate(async () => {
            await chrome.storage.local.clear();
            await chrome.storage.session.clear();
            await chrome.alarms.clearAll();
          });
        },
        async configure(opts = {}) {
          const apiBaseUrl = opts.apiBaseUrl ?? servers.mock.baseUrl;
          const token = opts.token ?? servers.mock.token;
          const connection = opts.connection ?? { status: "connected", user: { ...servers.mock.user }, checkedAt: Date.now(), error: null };
          await helper.evaluate(async (v) => chrome.storage.local.set(v), { settings: { apiBaseUrl, token }, connection });
        },
        async tabIdOf(page) {
          await page.bringToFront();
          const tabs = await helper.evaluate(() => chrome.tabs.query({ active: true }));
          if (!tabs.length) throw new Error("no active tab");
          return tabs[tabs.length - 1].id;
        },
        async waitForDetection(tabId, opts = {}) {
          const { predicate = () => true, timeoutMs = 10_000 } = opts;
          const started = Date.now();
          let last = null;
          while (Date.now() - started < timeoutMs) {
            const all = (await helper.session("detections")) || {};
            last = all[tabId] || null;
            if (last && predicate(last)) return last;
            await new Promise((r) => setTimeout(r, 100));
          }
          throw new Error(`timed out waiting for detection on tab ${tabId}; last=${JSON.stringify(last)}`);
        },
        badge: (tabId) => helper.evaluate((t) => chrome.action.getBadgeText({ tabId: t }), tabId),
        opened: [],
        async openPopup(tabId) {
          const p = await extContext.newPage();
          helper.opened.push(p);
          await p.goto(`chrome-extension://${id}/src/popup/popup.html?tabId=${tabId}`);
          await p.waitForSelector('main[aria-busy="false"]');
          return p;
        },
        async openOptions() {
          const p = await extContext.newPage();
          helper.opened.push(p);
          await p.goto(`chrome-extension://${id}/src/options/options.html`);
          return p;
        },
      };
      // Wait for the install handler (it writes default settings) so it cannot
      // race a test's configure() on a freshly launched browser.
      for (let i = 0; i < 100 && !(await helper.local("settings")); i++) await sleep(100);
      await provide(helper);
    },
    { scope: "worker" },
  ],

  // Pages come from the persistent extension context, not Playwright's default browser.
  page: async ({ extContext }, provide) => {
    const page = await extContext.newPage();
    await provide(page);
    await page.close().catch(() => {});
  },

  mockApi: async ({ servers }, provide) => {
    servers.mock.reset();
    await provide(servers.mock);
  },

  ext: async ({ extension, mockApi }, provide) => {
    void mockApi;
    await extension.reset();
    await provide(extension);
    for (const p of extension.opened.splice(0)) await p.close().catch(() => {});
  },
});

module.exports = { test, expect, EXTENSION_PATH };
