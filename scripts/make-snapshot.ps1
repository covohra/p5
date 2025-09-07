$ErrorActionPreference = "Stop"

# start from the folder that contains this script, then go to repo root
Set-Location (Join-Path $PSScriptRoot "..")

$dst = "project-snapshot"
Remove-Item -Recurse -Force $dst -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $dst | Out-Null

# 1) structure
tree /f > (Join-Path $dst "project-structure.txt")

# 2) core files
Copy-Item ".\prisma\schema.prisma"   (Join-Path $dst "project-schema.prisma")        -Force
Copy-Item ".\.env.example"           (Join-Path $dst "project-env-template.txt")     -Force
Copy-Item ".\docker-compose.yml"     (Join-Path $dst "docker-compose.yml")           -Force -ErrorAction SilentlyContinue
Get-Content ".\package.json" | Out-File (Join-Path $dst "project-scripts.json") -Encoding utf8

# 3) README (create a tiny one if missing)
if (Test-Path ".\README.md") {
  Copy-Item ".\README.md" (Join-Path $dst "project-readme.md") -Force
}
else {
  @"
# p5 — Local Dev Handoff
See local-credentials.txt and project-env-template.txt for dev values.
"@ | Out-File (Join-Path $dst "project-readme.md") -Encoding utf8
}

# 4) local creds sheet (dev-only; no secrets)
@"
Postgres: 127.0.0.1:55432 (user=p5 pass=p5pass db=p5db)
Redis:    127.0.0.1:6379
SMTP:     127.0.0.1:1025 (UI: http://localhost:8025)
"@ | Out-File (Join-Path $dst "local-credentials.txt") -Encoding utf8

# 5) timestamped zip + latest alias
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$zipTimestamped = "project-snapshot-$stamp.zip"
$zipLatest      = "project-snapshot.zip"

if (Test-Path $zipTimestamped) { Remove-Item $zipTimestamped -Force }
if (Test-Path $zipLatest)      { Remove-Item $zipLatest      -Force }
Compress-Archive -Path $dst -DestinationPath $zipTimestamped -Force
Copy-Item $zipTimestamped $zipLatest -Force

Write-Host "✅ Snapshot written:"
Write-Host "   - $zipTimestamped"
Write-Host "   - $zipLatest (latest alias)"
