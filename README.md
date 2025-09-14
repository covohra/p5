📖 Final README.md (paste this as is)

# p5 — API (Fastify + Prisma + Postgres)

![CI](https://github.com/covohra/p5/actions/workflows/ci.yml/badge.svg)

Monorepo with a Fastify API, Prisma ORM, and PostgreSQL.  
CI runs tests on every push to main and deploys to Fly.io when green.

---

## 📦 Stack
- *Runtime:* Node 20, pnpm workspaces  
- *API:* Fastify  
- *DB:* PostgreSQL  
- *ORM:* Prisma  
- *Tests:* Vitest + Supertest  
- *Infra:* Fly.io (Machines)  
- *CI/CD:* GitHub Actions  

---

## 🗂 Repo Layout

. ├─ apps/ │  └─ api/                   # Fastify app (ports, routes, tests) │     ├─ src/ │     ├─ test/ │     └─ node_modules/.prisma/client  # Prisma client generated here ├─ prisma/ │  ├─ schema.prisma          # Data model │  └─ migrations/            # Prisma migrations ├─ .github/workflows/ci.yml  # CI/CD pipeline ├─ package.json              # workspace root └─ pnpm-workspace.yaml

---

## 🛠 Local Development

### Setup
```powershell
cd C:\Users\<you>\Dev\p5
corepack enable
corepack prepare pnpm@latest --activate
pnpm install
docker compose up -d

Database & Prisma

# copy env file
Copy-Item .\.env.local .\prisma\.env -Force

# generate client
pnpm prisma:generate

# run migrations
pnpm prisma:migrate

# seed data
pnpm prisma:seed

# smoke test: should list seeded users incl. covohra@gmail.com
pnpm db:smoke

Services

API: http://localhost:3000

Health: http://localhost:3000/health

Ready: http://localhost:3000/ready

Postgres: host 127.0.0.1, port 55432, db p5db, user p5, pass p5pass

Redis: redis://127.0.0.1:6379

Mailpit: http://localhost:8025 (SMTP: 127.0.0.1:1025)



---

🧪 Testing

pnpm --filter @p5/api test

Unit/integration tests live in apps/api/test/

DB-backed tests use ephemeral Postgres in CI



---

🚀 Fly.io Deployment

One-time setup

# login
flyctl auth login

# create app (skip if already created)
flyctl apps create p5-api

# create Postgres (choose nearest region, e.g. sin = Singapore)
flyctl postgres create --name p5-postgres

# attach DB to app (sets DATABASE_URL secret)
flyctl postgres attach --app p5-api p5-postgres

Run migrations against production DB

# open proxy in a separate terminal
flyctl proxy 5433 -a p5-postgres

# in prisma workspace
cd prisma
pnpm install
$env:DATABASE_URL="postgres://p5_api:<password>@127.0.0.1:5433/p5_api?sslmode=disable"
pnpm exec prisma migrate deploy --schema ./schema.prisma
cd ..

Deploy API

flyctl deploy --app p5-api
flyctl status --app p5-api
flyctl logs   --app p5-api

Smoke test (remote)

# health & ready
curl -s https://p5-api.fly.dev/health
curl -s https://p5-api.fly.dev/ready

# create a smoke user
$email = "covohra+smoke$((Get-Random))@example.com"
$body = @{ email = $email; name = "Smoke Test" } | ConvertTo-Json
Invoke-RestMethod -Uri "https://p5-api.fly.dev/api/users" -Method Post -ContentType "application/json" -Body $body

# list smoke users
Invoke-RestMethod -Uri "https://p5-api.fly.dev/api/users" |
  Where-Object { $_.email -like "covohra+smoke*@example.com" }


---

⚙️ CI/CD

Workflow: .github/workflows/ci.yml

Jobs:

1. Setup Node & pnpm (version pinned from repo)


2. Install deps with --ignore-scripts


3. Generate Prisma client into apps/api


4. Apply migrations to ephemeral Postgres


5. Run tests


6. Deploy to Fly.io


7. Post-deploy smoke test (probes /health)



> Requires repo secret FLY_API_TOKEN.




---

🐛 Troubleshooting

“Cannot find module '.prisma/client/default'”
Run:

pnpm --filter @p5/prisma exec prisma generate --schema prisma/schema.prisma

Migrations fail in CI
Ensure DATABASE_URL env matches the CI Postgres service.

Deploy fails with auth
Set FLY_API_TOKEN under Settings → Secrets → Actions.



---

🗺 Roadmap

Staging environment on Fly

Preview apps per PR

DB migrations gate (apply on deploy)

Observability: Fly logs, Sentry, OpenTelemetry

Security headers + stricter CORS

Dependabot/Renovate for deps

Automated load/perf smoke tests

Nightly backup job for Postgres



---

📝 Notes

Do not commit .env.local or prisma/.env (local only).

For production: migrations are applied manually once; automation will be added later.

Mailpit is local only (dev email sink).

CORS is currently origin: true (open). Lock it down once frontend domain is known.
