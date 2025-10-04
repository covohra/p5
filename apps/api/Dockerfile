# ---------- build ----------
FROM node:20-slim AS build
WORKDIR /app

# OS deps + pnpm
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends ca-certificates openssl libssl3 \
 && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@latest --activate

# Workspace manifests first (better cache)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY prisma/package.json   ./prisma/package.json

# Install WITHOUT postinstall scripts
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy sources
COPY apps/api ./apps/api
COPY prisma   ./prisma

# ---- Prisma generate INTO the API package ----
# (pnpm sets CWD to the prisma workspace; so use ./schema.prisma)
# Generate client where @prisma/client will look for it at runtime
ENV PRISMA_GENERATE_SKIP_AUTOINSTALL=1
ENV PRISMA_CLIENT_OUTPUT=/app/node_modules/.prisma/client

WORKDIR /repo/prisma
RUN pnpm --filter @p5/prisma exec prisma generate --schema ./schema.prisma \
 && ls -la /app/node_modules/.prisma/client

# ---------- runtime ----------
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends ca-certificates libssl3 \
 && rm -rf /var/lib/apt/lists/*

# Copy the app, deps, and generated client
COPY --from=build /app/apps/api /app/apps/api
COPY --from=build /app/node_modules /app/node_modules

# Optional vector config (harmless if unused)
COPY ops/vector.toml /etc/vector/vector.toml

ENV PORT=3000
EXPOSE 3000
CMD ["node", "apps/api/src/server.js"]
