/**
 * Mock CareerQuest extension API (http://127.0.0.1:4320) implementing:
 *   GET  /api/extension/me
 *   GET  /api/extension/lookup
 *   POST /api/extension/captures
 * It records every request, lets tests script failures (503 / 429 / 401) for
 * the next capture POSTs and returns CORS headers (the extension's service
 * worker fetches cross-origin; a real deployment either grants the optional host
 * permission or serves CORS for chrome-extension:// origins).
 */
const http = require("node:http");

const PORT = 4320;
const DEFAULT_TOKEN = "cqt_test_token_123";
const DEFAULT_USER = { userId: "user_1", name: "Test User", email: "test@example.com", scopes: ["capture:write", "applications:read"] };

function createState() {
  return {
    token: DEFAULT_TOKEN,
    user: { ...DEFAULT_USER },
    /** matches returned by /lookup */
    matches: [],
    /** scripted responses for upcoming capture POSTs: { status, body? } consumed in order */
    captureFailures: [],
    /** scripted delays (ms) for upcoming capture POSTs, consumed in order on arrival */
    captureDelays: [],
    /** scripted responses for upcoming /me calls */
    meFailures: [],
    /** recorded capture bodies (successful ones) */
    captures: [],
    /** every request: { method, path, query, auth, body } */
    requests: [],
    /** all capture attempts including failed ones */
    captureAttempts: [],
    nextApplicationId: 1,
  };
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
  });
}

/**
 * @param {{ port?: number }} [opts]
 */
async function startMockApi(opts = {}) {
  const port = opts.port ?? PORT;
  let state = createState();

  const json = (res, status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };

  const server = http.createServer(async (req, res) => {
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-headers", "authorization, content-type, accept");
    res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      return res.end();
    }
    const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
    const rawBody = await readBody(req);
    let body = null;
    if (rawBody) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        body = rawBody;
      }
    }
    const auth = req.headers.authorization || "";
    state.requests.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), auth, body, rawBody });

    const authorized = auth === `Bearer ${state.token}`;

    if (url.pathname === "/api/extension/me") {
      const scripted = state.meFailures.shift();
      if (scripted) return json(res, scripted.status, scripted.body || { error: `scripted ${scripted.status}` });
      if (!authorized) return json(res, 401, { error: "Invalid token" });
      return json(res, 200, state.user);
    }
    if (url.pathname === "/api/extension/lookup") {
      if (!authorized) return json(res, 401, { error: "Invalid token" });
      return json(res, 200, { matches: state.matches });
    }
    if (url.pathname === "/api/extension/captures" && req.method === "POST") {
      state.captureAttempts.push({ auth, body, rawBody, at: Date.now() });
      // Both scripts are consumed when the request ARRIVES, so a delayed request
      // never takes the scripted answer meant for a later one.
      const scripted = state.captureFailures.shift();
      const delay = state.captureDelays.shift();
      if (delay) await new Promise((r) => setTimeout(r, delay));
      if (scripted) return json(res, scripted.status, scripted.body || { error: `scripted ${scripted.status}` });
      if (!authorized) return json(res, 401, { error: "Invalid token" });
      if (!body || typeof body !== "object" || !body.kind || !body.url) return json(res, 400, { error: "kind and url are required" });
      const id = `cap_${state.captures.length + 1}`;
      const applicationId = body.applicationId || `app_${state.nextApplicationId++}`;
      const isConfirmation = body.kind === "CONFIRMATION_PAGE" || body.kind === "MANUAL_CONFIRMATION";
      state.captures.push({ id, body, rawBody, receivedAt: Date.now() });
      return json(res, 201, {
        capture: { id, status: "ACCEPTED" },
        application: { id: applicationId, status: isConfirmation ? "SUBMITTED" : "SAVED", detailUrl: `/applications/${applicationId}` },
        action: body.applicationId ? "updated" : "created",
      });
    }
    json(res, 404, { error: "not found" });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });

  return {
    port,
    baseUrl: `http://127.0.0.1:${port}`,
    token: DEFAULT_TOKEN,
    user: DEFAULT_USER,
    get state() {
      return state;
    },
    reset() {
      state = createState();
    },
    /** @param {Partial<ReturnType<typeof createState>>} patch */
    configure(patch) {
      Object.assign(state, patch);
    },
    /**
     * Resolves with the first recorded capture satisfying `predicate` (default: any).
     * @param {{ predicate?: (c: any) => boolean, count?: number, timeoutMs?: number }} [opts]
     */
    async waitForCaptures(opts = {}) {
      const { predicate = () => true, count = 1, timeoutMs = 10_000 } = opts;
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        const hits = state.captures.filter(predicate);
        if (hits.length >= count) return hits;
        await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error(`timed out waiting for ${count} capture(s); got ${state.captures.length}`);
    },
    async waitForAttempts(count, timeoutMs = 10_000) {
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        if (state.captureAttempts.length >= count) return state.captureAttempts;
        await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error(`timed out waiting for ${count} capture attempt(s); got ${state.captureAttempts.length}`);
    },
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

module.exports = { startMockApi, PORT, DEFAULT_TOKEN, DEFAULT_USER };

if (require.main === module) {
  startMockApi().then((s) => console.log(`mock API on ${s.baseUrl} (token ${s.token})`));
}
