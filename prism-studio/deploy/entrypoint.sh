#!/bin/sh
# Container entrypoint: migrate + seed (both idempotent) before the web app starts; the worker waits for them.
# "all" runs both in one container (deploy/run-both.mjs), for Railway.
# The web app is Next's standalone server (server.js); the worker and the scripts run their TypeScript with tsx.
set -e
case "${1:-web}" in
  web)
    tsx scripts/migrate.ts
    tsx scripts/seed.ts
    # Docker sets HOSTNAME to the container id; the server must listen on every interface
    export HOSTNAME=0.0.0.0
    exec node server.js
    ;;
  worker)
    # the web container migrates; give it a moment on a cold start, then run the job loop
    until tsx -e "import('./src/db/client').then(async m=>{await m.pool().query('select 1 from studio_settings limit 1');process.exit(0)}).catch(()=>process.exit(1))" 2>/dev/null; do sleep 3; done
    exec tsx worker/index.ts
    ;;
  all)
    # web and worker in one container (a host with one disk per service: Railway). Migrate and seed first, as "web" does.
    tsx scripts/migrate.ts
    tsx scripts/seed.ts
    mkdir -p "${MEDIA_ROOT:-/data/media}" "${FILMS_REPO_ROOT:-/films}/films/channels" 2>/dev/null || true
    exec node deploy/run-both.mjs
    ;;
  import)
    exec tsx scripts/import-episodes.ts
    ;;
  *)
    exec "$@"
    ;;
esac
