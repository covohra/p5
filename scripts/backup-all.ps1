param(
  [string]$ProdPassword = $env:PROD_DB_PW,
  [string]$StgPassword  = $env:STG_DB_PW
)

# backup-all.ps1
# Purpose:
#   Create FULL plain SQL backups of PROD and STAGING PostgreSQL databases
#   via flyctl proxy + dockerized pg_dump.
#
# Output:
#   backups\prod-<db>-<timestamp>.sql
#   backups\staging-<db>-<timestamp>.sql
#
# Notes:
#   - This script produces plain-text SQL backups (NOT compressed custom dumps).
#   - Easier to inspect and restore with psql.
#   - Keep real passwords out of the script; pass via env vars or prompt.
#   - Always verify backup file size after completion.

# -------- settings --------
$ProdCluster   = "p5-postgres"
$StgCluster    = "p5-postgres-staging"

# Default DB/user created by fly postgres attach (adjust if yours differ)
$ProdDb        = "p5_api"
$ProdUser      = "p5_api"
$StgDb         = "p5_api"
$StgUser       = "p5_api"

# Local proxy ports
$ProdLocalPort = 5433
$StgLocalPort  = 5533

# Docker image for pg_dump
$PgImage       = "postgres:17"

# Always use repo-local backups folder
$OutDir        = Join-Path (Get-Location) "backups"

# -------- helpers --------
function Test-Command($name) {
  return $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

function Wait-Port($port, $timeoutSec = 40) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)

  while ((Get-Date) -lt $deadline) {
    try {
      $c = New-Object System.Net.Sockets.TcpClient
      $iar = $c.BeginConnect("127.0.0.1", $port, $null, $null)
      $ok = $iar.AsyncWaitHandle.WaitOne(500)

      if ($ok -and $c.Connected) {
        $c.Close()
        return $true
      }

      $c.Close()
    } catch {}
  }

  return $false
}

function Start-FlyProxy($app, $port) {
  Write-Host "Starting fly proxy: $app -> localhost:$port"

  $proc = Start-Process `
    -FilePath "flyctl" `
    -ArgumentList @("proxy", "$port", "-a", "$app") `
    -PassThru `
    -WindowStyle Hidden

  if (-not (Wait-Port -port $port -timeoutSec 40)) {
    try { $proc | Stop-Process -Force } catch {}
    throw "flyctl proxy for $app did not open port $port"
  }

  return $proc
}

function Stop-Proc($proc) {
  if ($proc -and -not $proc.HasExited) {
    try { $proc | Stop-Process -Force } catch {}
  }
}

function Read-Plain([string]$prompt) {
  $sec = Read-Host -Prompt $prompt -AsSecureString
  return [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  )
}

function Assert-BackupFile($fullPath, $label) {
  if (-not (Test-Path $fullPath)) {
    throw "$label backup file was not created: $fullPath"
  }

  $item = Get-Item $fullPath
  if ($item.Length -le 0) {
    throw "$label backup file is empty: $fullPath"
  }

  Write-Host "Verified $label backup file size: $($item.Length) bytes"
}

function Do-PlainSqlDump($label, $localPort, $db, $user, $password, $outfile) {
  Write-Host "Dumping $label -> $outfile"

  if ([string]::IsNullOrWhiteSpace($password)) {
    throw "$label password is empty."
  }

  if (-not (Test-Command docker)) {
    throw "Docker Desktop is required (docker not found)."
  }

  # Use repo-local backups path as bind mount source
  $srcPath = (Resolve-Path $OutDir).Path
  $mountArg = "--mount=type=bind,source=""$srcPath"",target=/dump"

  $args = @(
    "run", "--rm",
    "-e", "PGPASSWORD=$password",
    $mountArg,
    $PgImage,
    "pg_dump",
    "-h", "host.docker.internal",
    "-p", "$localPort",
    "-U", "$user",
    "-d", "$db",
    "--no-owner",
    "--no-privileges",
    "-f", "/dump/$outfile"
  )

  $p = Start-Process -FilePath "docker" -ArgumentList $args -NoNewWindow -PassThru -Wait

  if ($p.ExitCode -ne 0) {
    Write-Host "docker run failed (exit $($p.ExitCode))"
    Write-Host "Mount: $mountArg"
    throw "pg_dump failed for $label"
  }

  $fullPath = Join-Path $OutDir $outfile
  Assert-BackupFile -fullPath $fullPath -label $label
}

# -------- preflight --------
if (-not (Test-Command flyctl)) {
  throw "flyctl is required on PATH."
}

if (-not (Test-Command docker)) {
  throw "Docker Desktop is required (docker not found)."
}

# Ensure backups dir exists
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"

# -------- passwords: params/env -> prompt fallback --------
if (-not $ProdPassword) {
  Write-Host "PROD password not provided via -ProdPassword or env:PROD_DB_PW"
  $ProdPassword = Read-Plain "Enter PROD DB password for user '$ProdUser' (cluster: $ProdCluster)"
}

if (-not $StgPassword) {
  Write-Host "STAGING password not provided via -StgPassword or env:STG_DB_PW"
  $StgPassword = Read-Plain "Enter STAGING DB password for user '$StgUser' (cluster: $StgCluster)"
}

# -------- PROD --------
$prodFile  = "prod-$($ProdDb)-$stamp.sql"
$prodProxy = $null

try {
  $prodProxy = Start-FlyProxy -app $ProdCluster -port $ProdLocalPort
  Do-PlainSqlDump `
    -label "PROD" `
    -localPort $ProdLocalPort `
    -db $ProdDb `
    -user $ProdUser `
    -password $ProdPassword `
    -outfile $prodFile

  Write-Host "PROD backup written to: $(Join-Path $OutDir $prodFile)"
}
finally {
  Stop-Proc $prodProxy
}

# -------- STAGING --------
$stgFile  = "staging-$($StgDb)-$stamp.sql"
$stgProxy = $null

try {
  $stgProxy = Start-FlyProxy -app $StgCluster -port $StgLocalPort
  Do-PlainSqlDump `
    -label "STAGING" `
    -localPort $StgLocalPort `
    -db $StgDb `
    -user $StgUser `
    -password $StgPassword `
    -outfile $stgFile

  Write-Host "STAGING backup written to: $(Join-Path $OutDir $stgFile)"
}
finally {
  Stop-Proc $stgProxy
}

Write-Host ""
Write-Host "All SQL backups written to: $OutDir"