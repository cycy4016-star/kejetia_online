# Kejetia Online — frontend + backend (Next.js 14, full-stack)
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first for better layer caching
COPY package*.json ./
RUN npm ci

# Build the app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
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