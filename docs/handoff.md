# p5 — Local Dev Handoff

This document is the practical handoff for continuing development of p5 from the current stabilized local baseline.

---

## 1. Project Identity

p5 is a procurement workflow SaaS for SMEs.

Core workflow:

RFQ -> Invite -> Quote -> Bid-tab -> Approval -> Award -> PO / ERP Export

The current repository is at the stage where:

- the local backend baseline is stabilized
- the API architecture is working
- the real procurement modules are the next focus

---

## 2. Current Baseline Status

### Completed / working

- Fastify API baseline
- Docker local infrastructure
- PostgreSQL local database
- Redis local service
- Mailpit local email sink
- Prisma generate / migrate baseline
- JWT login baseline
- Health / readiness / version endpoints
- Metrics endpoint
- Global error handling
- Mail helper
- Canonical app/server/config/version/email files

### Not yet product-complete

- RFQ domain module
- supplier workflow
- invite tokens
- quote submission
- bid-tab engine
- approvals
- awards
- PO export

---

## 3. Canonical Active Files

These are the active backend baseline files:

- `apps/api/src/server.js`
- `apps/api/src/app.js`
- `apps/api/src/config.js`
- `apps/api/src/version.js`
- `apps/api/src/email.js`
- `apps/api/src/errors.js`
- `prisma/schema.prisma`

Do not create duplicate competing versions of these.

---

## 4. Environment Rules

### Active env source

- root `.env`

### Not allowed

- `prisma/.env`

### Notes

- `.env.example` is template only
- rotate any secret that was pasted into chat or documentation previously
- use placeholder local dev values when possible

Recommended local dev values:

```env
AUTH_EMAIL=admin@p5.local
AUTH_PASSWORD=dev-password-only
JWT_SECRET=local-dev-secret-change-later