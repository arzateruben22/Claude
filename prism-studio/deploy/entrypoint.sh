#!/bin/sh
# Container entrypoint: migrate + seed (both idempotent) before the web app starts; the worker waits for them.
set -e
case "${1:-web}" in
  web)
    npx tsx scripts/migrate.ts
    npx tsx scripts/seed.ts
    exec npx next start -p "${PORT:-3100}" -H 0.0.0.0
    ;;
  worker)
    # the web container migrates; give it a moment on a cold start, then run the job loop
    until npx tsx -e "import('./src/db/client').then(async m=>{await m.pool().query('select 1 from studio_settings limit 1');process.exit(0)}).catch(()=>process.exit(1))" 2>/dev/null; do sleep 3; done
    exec npx tsx worker/index.ts
    ;;
  import)
    exec npx tsx scripts/import-episodes.ts
    ;;
  *)
    exec "$@"
    ;;
esac
