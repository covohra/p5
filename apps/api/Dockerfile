# ---------- build ----------
FROM node:20-slim AS build
WORKDIR /repo

# OS deps + pnpm (OpenSSL 3 for Prisma)
RUN apt-get update -y && apt-get install -y openssl libssl3 ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable

# Workspace manifests first (better caching)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY prisma/package.json prisma/package.json

# Install all workspaces (skip postinstall)
RUN pnpm install --recursive --frozen-lockfile --ignore-scripts

# Copy sources
COPY apps apps
COPY prisma prisma

# Create a pruned, self-contained prod bundle for ONLY @p5/api
# NOTE: This writes the API package to /out with its own node_modules at /out/node_modules
RUN pnpm deploy --filter @p5/api --prod --legacy /out

# Generate Prisma client into the deployed bundle (next to @prisma/client)
ENV PRISMA_GENERATE_SKIP_AUTOINSTALL=1
ENV PRISMA_CLIENT_OUTPUT=/out/node_modules/.prisma/client
WORKDIR /repo/prisma
RUN pnpm exec prisma generate --schema ./schema.prisma

# ---------- runtime ----------
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

# minimal deps (wget for healthcheck; OpenSSL for Prisma engine)
RUN apt-get update -y \
  && apt-get install -y wget ca-certificates libssl3 \
  && rm -rf /var/lib/apt/lists/*

# Copy the deployed app with standalone node_modules AND generated client
COPY --from=build /out /app

# Optional: vector config for future log shipping (safe to keep)
COPY ops/vector.toml /etc/vector/vector.toml

# Healthcheck (Fastify /ready)
HEALTHCHECK --interval=10s --timeout=3s --retries=6 CMD wget -qO- http://127.0.0.1:3000/ready || exit 1

# Run as non-root
USER node

EXPOSE 3000

# >>> Single source of truth: start the API from the deployed bundle <<<
# After pnpm deploy, your API code is at /app/src, NOT /app/apps/api/src
CMD ["node", "src/server.js"]