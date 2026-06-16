# syntax=docker/dockerfile:1

# ── Stage 1: install dependencies ────────────────────────────────────────────
FROM node:24-alpine AS deps
WORKDIR /app
# Toolchain for native modules (better-sqlite3) in case no prebuilt binary matches
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
# npm install instead of npm ci: the Windows-generated lockfile is missing
# Linux-only optional deps (@emnapi/*) — a known npm cross-platform bug
RUN npm install --no-audit --no-fund

# ── Stage 2: build ────────────────────────────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Prerendering may open the SQLite DB; make sure the directory exists
RUN mkdir -p data && npm run build

# ── Stage 3: runtime ──────────────────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S nodejs -g 1001 && adduser -S nextjs -G nodejs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# SQLite lives in /app/data — mounted as a volume in docker-compose
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
