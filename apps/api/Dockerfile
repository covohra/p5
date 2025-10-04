# ---------- base (runtime) ----------
FROM node:20-slim AS base
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

# Runtime libs for Prisma & HTTPS
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends ca-certificates libssl3 openssl \
  && rm -rf /var/lib/apt/lists/*

# ---------- build ----------
FROM node:20-slim AS build
WORKDIR /app

# Build-time libs + pnpm
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends ca-certificates libssl3 openssl \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@latest --activate

# Workspace manifests first (better cache)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY prisma/package.json   ./prisma/package.json

# Install deps WITHOUT running postinstall scripts (prevents prisma auto-generate)
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy sources
COPY apps/api ./apps/api
COPY prisma   ./prisma

# Sanity: ensure schema exists
RUN test -f prisma/schema.prisma

# Generate Prisma client directly into the API package
ENV PRISMA_GENERATE_SKIP_AUTOINSTALL=1
ENV ENV PRISMA_CLIENT_OUTPUT=/app/node_modules/.prisma/client
RUN pnpm --filter @p5/prisma exec prisma generate --schema ./schema.prisma

# ---------- final (runtime) ----------
FROM base
WORKDIR /app

# Copy node_modules (with generated Prisma client) and app sources
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/api   /app/apps/api
# keep schema for ops/studio
COPY --from=build /app/prisma /app/prisma

EXPOSE 3000
CMD ["node", "apps/api/src/server.js"]

