param(
  [string]$ProdPassword = $env:PROD_DB_PW,
  [string]$StgPassword  = $env:STG_DB_PW
)

# backup-all.ps1 — Docker-based pg_dump via flyctl proxy (Windows-safe mounts)
# Produces compressed .dump files in .\backups\  (or %BACKUP_DIR% if set)

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

# Output dir (prefer BACKUP_DIR env if provided; else repo ./backups)
$OutDir        = if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { Join-Path (Get-Location) "backups" }

# -------- helpers --------
function Test-Command($name) { $null -ne (Get-Command $name -ErrorAction SilentlyContinue) }

function Wait-Port($port, $timeoutSec=40) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $c = New-Object System.Net.Sockets.TcpClient
      $iar = $c.BeginConnect("127.0.0.1", $port, $null, $null)
      $ok = $iar.AsyncWaitHandle.WaitOne(500)
      if ($ok -and $c.Connected) { $c.Close(); return $true }
      $c.Close()
    } catch {}
  }
  return $false
}

function Start-FlyProxy($app, $port) {
  Write-Host "🔌 Starting fly proxy: $app → localhost:$port ..."
  $proc = Start-Process -FilePath "flyctl" -ArgumentList @("proxy", "$port", "-a", "$app") -PassThru -WindowStyle Hidden
  if (-not (Wait-Port -port $port -timeoutSec 40)) {
    try { $proc | Stop-Process -Force } catch {}
    throw "flyctl proxy for $app did not open port $port"
  }
  return $proc
}

function Stop-Proc($proc) {
  if ($proc -and !$proc.HasExited) { try { $proc | Stop-Process -Force } catch {} }
}

function Read-Plain([string]$prompt) {
  $sec = Read-Host -Prompt $prompt -AsSecureString
  [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  )
}

function Do-Dump($label, $localPort, $db, $user, $password, $outfile) {
  Write-Host "🗄️  Dumping $label → $outfile"
  if ([string]::IsNullOrWhiteSpace($password)) { throw "$label password is empty." }
  if (-not (Test-Command docker)) { throw "Docker Desktop is required (docker not found)." }

  # Windows path mount (quote the source because it may contain spaces)
  $srcPath = (Resolve-Path $PWD).Path  # absolute path (may contain spaces)
  $mountArg = "--mount=type=bind,source=""$srcPath"",target=/dump"

  $args = @(
    "run","--rm",
    "-e","PGPASSWORD=$password",
    $mountArg,
    $PgImage,
    "pg_dump",
    "-h","host.docker.internal",
    "-p","$localPort",
    "-U","$user",
    "-d","$db",
    "-Fc",
    "-f","/dump/$outfile"
  )

  $p = Start-Process -FilePath "docker" -ArgumentList $args -NoNewWindow -PassThru -Wait
  if ($p.ExitCode -ne 0) {
    Write-Host "❌ docker run failed (exit $($p.ExitCode))."
    Write-Host "   Mount: $mountArg"
    throw "pg_dump failed for $label"
  }
}

# -------- preflight --------
if (-not (Test-Command flyctl)) { throw "flyctl is required on PATH." }
if (-not (Test-Command docker)) { throw "Docker Desktop is required (docker not found)." }

# Ensure backups dir
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
Set-Location $OutDir

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"

# -------- passwords: params/env → prompt fallback --------
if (-not $ProdPassword) {
  Write-Host "🔐 PROD password not provided via -ProdPassword or env:PROD_DB_PW"
  $ProdPassword = Read-Plain "Enter PROD DB password for user '$ProdUser' (cluster: $ProdCluster)"
}
if (-not $StgPassword) {
  Write-Host "🔐 STAGING password not provided via -StgPassword or env:STG_DB_PW"
  $StgPassword = Read-Plain "Enter STAGING DB password for user '$StgUser' (cluster: $StgCluster)"
}

# -------- PROD --------
$prodDump  = "prod-$($ProdDb)-$stamp.dump"
$prodProxy = $null
try {
  $prodProxy = Start-FlyProxy -app $ProdCluster -port $ProdLocalPort
  Do-Dump -label "PROD" -localPort $ProdLocalPort -db $ProdDb -user $ProdUser -password $ProdPassword -outfile $prodDump
  Write-Host "✅ PROD dump: $(Join-Path $OutDir $prodDump)"
} finally {
  Stop-Proc $prodProxy
}

# -------- STAGING --------
$stgDump  = "staging-$($StgDb)-$stamp.dump"
$stgProxy = $null
try {
  $stgProxy = Start-FlyProxy -app $StgCluster -port $StgLocalPort
  Do-Dump -label "STAGING" -localPort $StgLocalPort -db $StgDb -user $StgUser -password $StgPassword -outfile $stgDump
  Write-Host "✅ STAGING dump: $(Join-Path $OutDir $stgDump)"
} finally {
  Stop-Proc $stgProxy
}

Write-Host "`n🎉 All dumps written to: $OutDir"