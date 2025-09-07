param(
  [int]$WaitSeconds = 60
)

$ErrorActionPreference = "Stop"

function Info($msg)  { Write-Host "• $msg" -ForegroundColor Cyan }
function Good($msg)  { Write-Host "✓ $msg" -ForegroundColor Green }
function Warn($msg)  { Write-Host "! $msg" -ForegroundColor Yellow }
function Fail($msg)  { Write-Host "✗ $msg" -ForegroundColor Red }

# 0) Preconditions
try { docker version *>$null } catch { Fail "Docker Desktop is not running."; exit 1 }
if (-not (Test-Path .\.env.local)) { Fail ".env.local is missing. Create it first."; exit 1 }
if (-not (Test-Path .\docker-compose.yml)) { Fail "docker-compose.yml not found."; exit 1 }

# 1) Stop & fully remove prior state (including volumes)
Info "Stopping containers and removing volumes…"
docker compose down -v

# 2) Wipe local PG data folder to clear old credentials
Info "Resetting storage\\postgres…"
Remove-Item -Recurse -Force .\storage\postgres -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path .\storage\postgres | Out-Null

# 3) Bring up services
Info "Starting Postgres, Redis, Mailpit…"
docker compose up -d

# 4) Wait for Postgres readiness (pg_isready inside container)
$deadline = (Get-Date).AddSeconds($WaitSeconds)
$pgReady = $false
while((Get-Date) -lt $deadline) {
  $ready = docker exec p5-postgres pg_isready 2>$null
  if ($LASTEXITCODE -eq 0) { $pgReady = $true; break }
  Start-Sleep -Seconds 2
}
if (-not $pgReady) {
  Warn "Postgres not ready after $WaitSeconds seconds. Logs follow:"
  docker logs p5-postgres --tail=100
  Fail "Aborting because Postgres never reported ready."
  exit 1
}
Good "Postgres is ready."

# 5) Ensure Prisma sees env
Copy-Item .\.env.local .\prisma\.env -Force
Good "Copied .env.local -> prisma\.env"

# 6) Prisma: generate, migrate, seed
Info "Running prisma generate…"
pnpm prisma:generate
if ($LASTEXITCODE -ne 0) { Fail "prisma:generate failed"; exit 1 }

Info "Running prisma migrate dev…"
pnpm prisma:migrate
if ($LASTEXITCODE -ne 0) { Fail "prisma:migrate failed"; exit 1 }

Info "Running prisma seed…"
pnpm prisma:seed
if ($LASTEXITCODE -ne 0) { Fail "prisma:seed failed"; exit 1 }

# 7) Smoke test
Info "Running db smoke test…"
pnpm db:smoke
if ($LASTEXITCODE -ne 0) { Fail "db:smoke failed"; exit 1 }

# 8) Sanity pings (optional)
$pg = Test-NetConnection 127.0.0.1 -Port 55432
$mp = Test-NetConnection 127.0.0.1 -Port 8025
$sm = Test-NetConnection 127.0.0.1 -Port 1025
if ($pg.TcpTestSucceeded) { Good "Postgres listening on 55432" } else { Warn "Postgres not listening on 55432" }
if ($sm.TcpTestSucceeded) { Good "Mailpit SMTP listening on 1025" } else { Warn "Mailpit SMTP not listening" }
if ($mp.TcpTestSucceeded) { Good "Mailpit Web at http://localhost:8025" } else { Warn "Mailpit Web not listening" }

Good "DB reset complete. You are ready to develop."
