# ---------- build ----------
FROM node:20-slim AS build
WORKDIR /repo

# OS deps + pnpm
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable

# Install from lockfile for all workspaces (gets prisma CLI via devDeps)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY prisma/package.json prisma/package.json
RUN pnpm install --recursive --frozen-lockfile

# Copy sources
COPY apps apps
COPY prisma prisma

# ---- Generate Prisma client from the prisma workspace ----
# (schema outputs to ../apps/api/node_modules/.prisma/client)
WORKDIR /repo/prisma
RUN pnpm install --offline --frozen-lockfile
ENV PRISMA_GENERATE_SKIP_AUTOINSTALL=1
RUN pnpm exec prisma generate --schema ./schema.prisma

# ---- Prune the API to production deps (keeps generated .prisma) ----
WORKDIR /repo/apps/api
RUN pnpm prune --prod

# ---------- runtime ----------
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copy the pruned app (with node_modules and generated client)
COPY --from=build /repo/apps/api /app

ENV PORT=3000
EXPOSE 3000
CMD ["node", "-r", "dotenv/config", "./src/index.js"]