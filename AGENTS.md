# AGENTS.md

## Cursor Cloud specific instructions

### Overview

p5 is a procurement workflow SaaS. The codebase is a pnpm monorepo with two workspaces:

- `apps/api` — Fastify 4 REST API (the main product)
- `prisma` — Prisma 5 schema, migrations, and seed

### Prerequisites

- **Node.js 20** (the project requires `>=20.0.0`; use nvm: `nvm use 20`)
- **pnpm 10.15.0** (pinned in root `package.json` via `packageManager` field; enable with `corepack enable && corepack prepare pnpm@10.15.0 --activate`)
- **PostgreSQL 16** on port **55432** (credentials: `p5` / `p5pass` / `p5db`)

### Key gotchas

- **Node version**: The cloud VM default is Node 22 via `/exec-daemon/node`. You must prepend the nvm Node 20 path: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"`.
- **Root `.env` only**: The project mandates a single `.env` at the repo root. Never create `prisma/.env`. Copy `.env.example` to `.env` if it doesn't exist. Add `AUTH_EMAIL=admin@p5.local` and `AUTH_PASSWORD=dev-password-only` for the login endpoint to work.
- **Prisma and `DATABASE_URL`**: Prisma CLI commands run from the `prisma/` workspace do not automatically pick up the root `.env`. Pass `DATABASE_URL` explicitly: `DATABASE_URL="postgresql://p5:p5pass@127.0.0.1:55432/p5db?schema=public&sslmode=disable"`.
- **Schema drift**: The existing migrations do not fully cover the current `schema.prisma` (e.g., `role`, `passwordHash`, `deletedAt`, `orgId` columns are missing from migrations). After running `prisma migrate deploy`, also run `prisma db push` to sync the schema.
- **`prisma:migrate` script doesn't exist**: The root `package.json` has `prisma:migrate` pointing to a non-existent `migrate` script in the prisma workspace. Use `pnpm --filter @p5/prisma run migrate:deploy` instead.
- **`prisma:seed` script doesn't exist**: Similarly, the root `prisma:seed` script points to a non-existent `seed` script. Run the seed manually: `DATABASE_URL=... node prisma/seed.cjs` (dotenv is not installed in the prisma workspace).
- **Lint**: `pnpm lint` in `apps/api` is a placeholder (`echo "(optional)"`). No ESLint is configured yet.
- **Docker Hub rate limits**: In cloud VMs, Docker Hub pulls may be rate-limited for unauthenticated requests. PostgreSQL can be installed directly via `apt-get install postgresql-16` as an alternative to Docker.

### Running the dev server

```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd /workspace
pnpm api          # starts Fastify dev server with --watch on port 3000
```

### Running tests

```bash
pnpm test         # runs vitest in apps/api (4 tests across 3 files)
```

### Key endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/ready` | GET | Readiness probe (checks DB) |
| `/version` | GET | Version/build/runtime info |
| `/metrics` | GET | Prometheus metrics |
| `/auth/login` | POST | JWT login (`{"email":"admin@p5.local","password":"dev-password-only"}`) |
| `/api/users` | GET | List users |
| `/api/users` | POST | Create user (`{"email":"...","name":"..."}`) |
| `/api/users/:id` | DELETE | Delete user |
| `/api/dev/send-test-email` | POST | Send test email via Mailpit |
