$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$cacheDir = Join-Path $repoRoot '.cache'
$logPath = Join-Path $cacheDir 'web-dev-forever.log'
$pidPath = Join-Path $cacheDir 'web-dev-forever.pid'
$port = 5173

New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null
Set-Content -Path $pidPath -Value $PID

function Write-Log([string]$message) {
  $line = "[$(Get-Date -Format o)] $message"
  Write-Host $line
  Add-Content -Path $logPath -Value $line
}

function Stop-PortListener([int]$listenPort) {
  try {
    $connections = Get-NetTCPConnection -LocalPort $listenPort -State Listen -ErrorAction Stop
    $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($owningPid in $pids) {
      if ($owningPid -and $owningPid -ne $PID) {
        Write-Log "Stopping existing listener on port $listenPort (PID $owningPid)"
        Stop-Process -Id $owningPid -Force -ErrorAction SilentlyContinue
      }
    }
  } catch {
    Write-Log "No existing listener found on port $listenPort"
  }
}

try {
  Stop-PortListener -listenPort $port
  while ($true) {
    Write-Log 'Starting Vite dev server watchdog child'
    $child = Start-Process -FilePath 'npm.cmd' -ArgumentList 'run', 'dev', '--workspace', '@mathfinder/web', '--', '--host', '0.0.0.0' -WorkingDirectory $repoRoot -PassThru -NoNewWindow
    Write-Log "Child started with PID $($child.Id)"
    Wait-Process -Id $child.Id
    Write-Log "Child exited with code $($child.ExitCode). Restarting in 2 seconds."
    Start-Sleep -Seconds 2
  }
} finally {
  Remove-Item -Path $pidPath -ErrorAction SilentlyContinue
}
