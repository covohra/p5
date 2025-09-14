# ---------- build ----------
FROM node:20-slim AS build
WORKDIR /repo

# OS deps + pnpm
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable

# Install from lockfile for all workspaces (gets Prisma CLI via devDeps)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY prisma/package.json prisma/package.json
RUN pnpm install --recursive --frozen-lockfile

# Copy sources
COPY apps apps
COPY prisma prisma

# Generate Prisma client from the prisma workspace (output goes into apps/api/.prisma)
WORKDIR /repo/prisma
RUN pnpm install --offline --frozen-lockfile
RUN pnpm exec prisma generate --schema ./schema.prisma

# Create a pruned, self-contained prod bundle FOR ONLY @p5/api
# (--legacy makes pnpm produce a node_modules that doesn't rely on the global store)
WORKDIR /repo
RUN pnpm deploy --filter @p5/api --prod --legacy /out

# ---------- runtime ----------
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copy the deployed app (with standalone node_modules and generated .prisma)
COPY --from=build /out /app

ENV PORT=3000
EXPOSE 3000
CMD ["node", "-r", "dotenv/config", "./src/index.js"]