# p5 — Procurement Workflow SaaS (Local Dev Baseline)

p5 is a procurement workflow operating system being built for SMEs.  
The current repository contains the stabilized local development baseline for the API layer.

This project is intentionally being built in controlled phases:

1. Stabilize local baseline
2. Complete production-ready API badge
3. Build procurement spine
4. Add pilot usability features

---

## Current Status

The project is not starting from zero.

Current state:

- Strategy and product blueprint are largely complete
- Backend architecture baseline is stabilized
- Local API is running
- Prisma and PostgreSQL are working
- Docker local infrastructure is working
- JWT login baseline is working
- Health, readiness, and version endpoints are working
- Metrics endpoint is working
- Global error handling is working
- Mailpit email test support is working

The next major development step is:

- Build the first real procurement module: RFQ

---

## Product Identity

p5 is a procurement workflow SaaS for SMEs and procurement-heavy businesses.

Core workflow:

RFQ -> Invite -> Quote -> Bid-tab -> Approval -> Award -> PO / ERP Export

p5 is not intended to replace ERP.  
ERP remains the financial or transactional system of record.  
p5 sits before ERP in the sourcing process and makes the sourcing layer structured, auditable, and easier to execute.

---

## Tech Stack

- Node.js 20
- pnpm workspaces
- Fastify 4
- Prisma 5
- PostgreSQL
- Redis
- Docker Compose
- Vitest
- Fly.io

---

## Monorepo Structure

```text
p5/
  apps/
    api/
      src/
      test/
  prisma/
    schema.prisma
    migrations/
  docs/
  scripts/
  ops/
  storage/
  backups/

  Important active backend files:

apps/api/src/server.js -> canonical API entrypoint
apps/api/src/app.js -> canonical Fastify application
apps/api/src/config.js -> configuration and environment handling
apps/api/src/version.js -> version/build/runtime information
apps/api/src/email.js -> mailer logic
apps/api/src/errors.js -> global error handler
prisma/schema.prisma -> canonical database schema

Important active backend files:
apps/api/src/server.js -> canonical API entrypoint
apps/api/src/app.js -> canonical Fastify application
apps/api/src/config.js -> configuration and environment handling
apps/api/src/version.js -> version/build/runtime information
apps/api/src/email.js -> mailer logic
apps/api/src/errors.js -> global error handler
prisma/schema.prisma -> canonical database schema

Environment Rules

Important locked rules:
Use root .env only
Do not create prisma/.env
.env.example is template/reference only
Real secrets must never be committed
Any real secret that was pasted into chat or shared in documentation should be treated as compromised and rotated
For local development, prefer safe placeholder values

Recommended local dev auth values:
AUTH_EMAIL=admin@p5.local
AUTH_PASSWORD=dev-password-only
JWT_SECRET=local-dev-secret-change-later

Recommended Mailpit local dev values:
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
SMTP_SECURE=
SMTP_FROM=p5@local.test