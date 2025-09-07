$ok = $true
function Good($m){Write-Host "✅ $m" -ForegroundColor Green}
function Bad($m){Write-Host "❌ $m" -ForegroundColor Red; $script:ok=$false}

try { docker version *>$null } catch { Bad "Docker not running."; exit 1 }

# Check containers
$ps = docker compose ps --format json | ConvertFrom-Json
if (-not $ps) { Bad "docker compose ps returned nothing." } else { Good "docker compose running." }

# Ports
if ((Test-NetConnection 127.0.0.1 -Port 55432).TcpTestSucceeded) { Good "Postgres OK on 127.0.0.1:55432 (db=p5db user=p5 pass=p5pass)" } else { Bad "Postgres not listening on 55432" }
if ((Test-NetConnection 127.0.0.1 -Port 6379).TcpTestSucceeded)  { Good "Redis OK on 127.0.0.1:6379" } else { Bad "Redis not listening on 6379" }
if ((Test-NetConnection 127.0.0.1 -Port 1025).TcpTestSucceeded)  { Good "Mailpit SMTP OK on 127.0.0.1:1025" } else { Bad "Mailpit SMTP not listening" }
if ((Test-NetConnection 127.0.0.1 -Port 8025).TcpTestSucceeded)  { Good "Mailpit Web UI OK → open http://localhost:8025" } else { Bad "Mailpit Web UI not listening" }

if ($ok) { exit 0 } else { exit 1 }
