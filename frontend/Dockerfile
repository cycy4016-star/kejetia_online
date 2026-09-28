# Kejetia Online — frontend + backend (Next.js 14, full-stack)
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first for better layer caching
COPY package*.json ./
RUN npm ci

# Build the app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* values are inlined into the browser bundle at BUILD time, not
# read at runtime. If this is not set here the bundle silently falls back to
# mock mode (localStorage only, no database/auth/realtime) and the site still
# *looks* fine — so pin it. Override with
# `--build-arg NEXT_PUBLIC_DB_MODE=mock` for an offline demo image.
ARG NEXT_PUBLIC_DB_MODE=postgres
ENV NEXT_PUBLIC_DB_MODE=${NEXT_PUBLIC_DB_MODE}
RUN npm run build

# --- Production image ---
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy built assets + runtime deps only
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/node_modules ./node_modules
# Schema + auto-migrate runner (applies db/schema.sql at boot when DATABASE_URL is set)
COPY --from=builder /app/db ./db
COPY --from=builder /app/scripts ./scripts

EXPOSE 3000
# Apply schema (idempotent, no-ops when DATABASE_URL is unset) then serve.
CMD ["sh", "-c", "node ./scripts/migrate.mjs && npm start"]