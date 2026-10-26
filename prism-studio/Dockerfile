# Prism Studio: one image for the web app and the worker (the command picks which).
#   docker compose up -d        (see deploy/DEPLOY.md)
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx next build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3100
# No renderer in here: lesson compilations are built on the films machine and synced (deploy/DEPLOY.md).
COPY --from=build /app /app
RUN chmod +x deploy/entrypoint.sh && mkdir -p /data/media /films && chown -R node:node /data /films /app/.next
USER node
EXPOSE 3100
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD node -e "fetch('http://127.0.0.1:3100/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["deploy/entrypoint.sh"]
CMD ["web"]
