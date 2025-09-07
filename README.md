# p5 — Local Dev Handoff (dev-only values)

## Run in this order (from repo root: C:\Users\<you>\Dev\p5)
corepack enable
corepack prepare pnpm@latest --activate
pnpm install
docker compose up -d
Copy-Item .\.env.local .\prisma\.env -Force
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
pnpm db:smoke  # should list users incl. covohra@gmail.com

## Dev credentials & ports
Postgres → host 127.0.0.1, port 55432, db p5db, user p5, pass p5pass
DATABASE_URL → postgresql://p5:p5pass@127.0.0.1:55432/p5db?schema=public&sslmode=disable
Redis → redis://127.0.0.1:6379

## Files (Windows paths)
docker-compose.yml → C:\Users\<you>\Dev\p5\docker-compose.yml
.env.example      → C:\Users\<you>\Dev\p5\.env.example
.env.local        → C:\Users\<you>\Dev\p5\.env.local   (do not commit)
prisma/.env       → C:\Users\<you>\Dev\p5\prisma\.env (copy of .env.local)
schema            → C:\Users\<you>\Dev\p5\prisma\schema.prisma
seed              → C:\Users\<you>\Dev\p5\prisma\seed.cjs
smoke test        → C:\Users\<you>\Dev\p5\prisma\scripts\db-smoke.cjs

## Seed data
- covohra@gmail.com / "Faseeh Vohra"  (from prisma/seed.cjs)
- alice@example.com / "Alice" (optional; remove if not needed)

## Email (no real passwords)
Use Mailpit locally:

Compose (in docker-compose.yml):
  mailpit:
    image: axllent/mailpit
    container_name: p5-mailpit
    restart: unless-stopped
    ports: ["8025:8025","1025:1025"]

.env.local:
  SMTP_HOST=127.0.0.1
  SMTP_PORT=1025
  SMTP_USER=
  SMTP_PASS=

Open http://localhost:8025 to view dev emails.
