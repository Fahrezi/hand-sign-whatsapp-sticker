# Build context is the repo root (npm workspaces):
#   docker build -f apps/api/Dockerfile .

FROM node:22-alpine AS base
WORKDIR /app
# npm ci checks every workspace against the lockfile, so all package.json files are needed
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# Full install + build. Also used as the `migrate` target (has the prisma CLI and migrations).
FROM base AS build
RUN npm ci -w @hand-sign/shared -w @hand-sign/api
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @hand-sign/shared && npm run build -w @hand-sign/api

# Production dependencies only
FROM base AS deps
RUN npm ci --omit=dev -w @hand-sign/shared -w @hand-sign/api && mkdir -p apps/api/node_modules

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/apps/api/node_modules apps/api/node_modules
COPY --from=build /app/packages/shared/package.json packages/shared/
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/api/package.json apps/api/
COPY --from=build /app/apps/api/dist apps/api/dist
WORKDIR /app/apps/api
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "dist/main.js"]
