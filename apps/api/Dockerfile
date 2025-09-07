# ---------- deps ----------
FROM node:20-slim AS deps
ENV PNPM_HOME=/root/.pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

COPY pnpm-lock.yaml ./
COPY package.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY prisma ./prisma

RUN pnpm fetch
RUN pnpm install --frozen-lockfile

# ---------- runner ----------
FROM node:20-slim AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY prisma ./prisma
COPY apps/api ./apps/api
COPY package.json pnpm-lock.yaml ./

RUN npx prisma generate

EXPOSE 3000
CMD [ "node", "apps/api/src/index.js" ]
