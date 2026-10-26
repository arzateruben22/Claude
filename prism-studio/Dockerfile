# Prism Studio: one image for the web app, the worker and the deploy scripts (the command picks which).
#   docker compose up -d        (see deploy/DEPLOY.md)
# The runtime stage carries only Next's standalone server (the files the web app traces) and the few packages the
# worker and the migrate / seed / import scripts load through tsx: drizzle-orm, pg, web-push and tsx itself, at the
# lockfile's versions. No compiler, test tools, image library or build cache.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx next build

# Everything but the worker's and the scripts' packages pruned away (from the installed tree: no network needed).
FROM deps AS worker-deps
RUN node -e "const fs=require('fs'),p=JSON.parse(fs.readFileSync('package.json')),all={...p.dependencies,...p.devDependencies};p.dependencies=Object.fromEntries(['drizzle-orm','pg','web-push','tsx'].map(k=>[k,all[k]]));delete p.devDependencies;fs.writeFileSync('package.json',JSON.stringify(p))" \
 && npm prune --omit=dev --no-audit --no-fund && find node_modules -mindepth 1 -maxdepth 1 -type d -empty -delete

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3100 HOSTNAME=0.0.0.0 PATH=/app/node_modules/.bin:$PATH
# No renderer in here: lesson compilations are built on the films machine and synced (deploy/DEPLOY.md).
COPY --from=build /app/.next/standalone/server.js /app/.next/standalone/package.json ./
COPY --from=build /app/.next/standalone/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next/standalone/.next ./.next
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=worker-deps /app/node_modules ./node_modules
COPY tsconfig.json ./
COPY drizzle ./drizzle
COPY src ./src
COPY worker ./worker
COPY scripts/env.ts scripts/migrate.ts scripts/seed.ts scripts/import-episodes.ts ./scripts/
COPY deploy/entrypoint.sh ./deploy/
# Fail here, not at 3 a.m., if the worker or a script imports a package this stage doesn't carry.
RUN node -e "require('esbuild').buildSync({entryPoints:['worker/index.ts','scripts/migrate.ts','scripts/seed.ts','scripts/import-episodes.ts'],bundle:true,platform:'node',format:'esm',write:false,outdir:'/tmp/check',logLevel:'error'})" \
 && chmod +x deploy/entrypoint.sh && mkdir -p /data/media /films .next/cache && chown node:node /data/media /films .next/cache
USER node
EXPOSE 3100
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD node -e "fetch('http://127.0.0.1:3100/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["deploy/entrypoint.sh"]
CMD ["web"]
