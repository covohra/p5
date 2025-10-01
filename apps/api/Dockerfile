# apps/api/Dockerfile
# Build Prisma client into the image, then run the API.

# ---------- build layer ----------
FROM node:20-alpine AS build
WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace manifests (for proper dependency install)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
# Only the manifests for the two workspaces we need
COPY apps/api/package.json ./apps/api/package.json
COPY prisma/package.json   ./prisma/package.json

# Install deps WITHOUT running postinstall (so Prisma doesn't try to autogenerate here)
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy sources needed at build time
COPY prisma ./prisma
COPY apps/api ./apps/api

# Generate Prisma Client directly into the runtime node_modules path
# (the app runs from /app/apps/api, but dependencies live at /app/node_modules)
ENV PRISMA_GENERATE_SKIP_AUTOINSTALL=1
ENV PRISMA_CLIENT_OUTPUT=/app/node_modules/.prisma/client
RUN pnpm --filter @p5/prisma exec prisma generate --schema prisma/schema.prisma

# ---------- runtime layer ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

# Copy node_modules (contains generated .prisma/client), app code, and prisma schema (for tooling)
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/api   /app/apps/api
COPY --from=build /app/prisma     /app/prisma

EXPOSE 3000
CMD ["node", "apps/api/src/server.js"]