# syntax=docker/dockerfile:1
# Build from repo root so the pnpm workspace + lockfile are visible:
#   docker build -f apps/web/Dockerfile .

# ---------- deps ----------
FROM node:22-alpine AS deps
WORKDIR /repo
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/database/package.json packages/database/

RUN pnpm fetch \
 && pnpm install --frozen-lockfile --filter web... --filter @ai-crm/database

# ---------- builder ----------
FROM node:22-alpine AS builder
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

COPY --from=deps /repo/node_modules ./node_modules
COPY pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/database/package.json packages/database/
COPY packages/database/prisma packages/database/prisma
COPY packages/database/src packages/database/src
COPY packages/database/tsconfig.json packages/database/
COPY apps/web ./apps/web

ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_sales_crm \
    NEXTAUTH_SECRET=build-time-placeholder-secret-32-chars \
    NEXTAUTH_URL=http://localhost:3000 \
    AGENTS_API_URL=http://127.0.0.1:8000

RUN pnpm --filter @ai-crm/database db:generate \
 && NEXT_OUTPUT_STANDALONE=1 pnpm --filter web build

# ---------- runner ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
