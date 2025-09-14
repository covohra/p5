# ---------- build ----------
FROM node:20-slim AS build
WORKDIR /repo

# OS deps + pnpm (install libssl3 so Prisma can detect openssl-3.0)
RUN apt-get update -y && apt-get install -y openssl libssl3 ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable

# Install workspace (gets Prisma CLI via devDeps)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY prisma/package.json prisma/package.json
RUN pnpm install --recursive --frozen-lockfile

# Copy sources
COPY apps apps
COPY prisma prisma

# Create a pruned, self-contained prod bundle for ONLY @p5/api
RUN pnpm deploy --filter @p5/api --prod --legacy /out

# Generate Prisma client into the deployed bundle
ENV PRISMA_GENERATE_SKIP_AUTOINSTALL=1
ENV PRISMA_CLIENT_OUTPUT=/out/node_modules/.prisma/client
WORKDIR /repo/prisma
RUN pnpm exec prisma generate --schema ./schema.prisma

# ---------- runtime ----------
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Ensure runtime has libssl3 as well
RUN apt-get update -y && apt-get install -y libssl3 ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy the deployed app with standalone node_modules AND generated client
COPY --from=build /out /app

ENV PORT=3000
EXPOSE 3000
CMD ["node", "-r", "dotenv/config", "./src/index.js"]