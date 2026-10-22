# Lumevina tests

```
npm install
npm test            # database, edge-function handlers, shared logic, baseline (Node 22, no Docker)
npm run test:e2e    # the site and the Skin Intelligence pages in Chromium at 390 and 1280 px
```

* `pg/` — PGlite (Postgres 17 in WASM) with Supabase's roles, default grants, `auth` and `storage` stubbed; `harness.mjs` applies `server/schema.sql` and `server/migrations/*`.
* `db/` — migrations (up/down/up), row-level security, integrity triggers.
* `functions/` — the real handlers (`server/functions/*/handler.ts`, run directly by Node's TypeScript support) against that database through `adapter.mjs`, a stand-in for the service-role supabase-js client.
* `unit/` — `js/skin/core`, the on-device checks, a baseline for existing `_shared` modules, and the check that generated copies are current.
* `e2e/` — Playwright with the preinstalled Chromium; `serve.mjs` serves `lumevina/`.

The analysis worker's tests are in `skin-intelligence/worker/tests` (pytest).
