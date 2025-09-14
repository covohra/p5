p5 API
Local Development
Setup
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

API → http://localhost:3000

Health → http://localhost:3000/health

Ready → http://localhost:3000/ready

Postgres → host 127.0.0.1, port 55432, db p5db, user p5, pass p5pass

Redis → redis://127.0.0.1:6379

Mailpit → http://localhost:8025
 (SMTP 127.0.0.1:1025)

Testing
pnpm --filter @p5/api test

Fly.io Deployment
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

Notes

Do not commit .env.local or prisma/.env (local only).

For production: migrations are applied once manually; later we’ll automate with a release step.

CORS is currently open (origin: true). Lock it down once frontend domain is known.

Mailpit is local only (dev email sink).