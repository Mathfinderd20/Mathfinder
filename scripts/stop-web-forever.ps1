$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$pidPath = Join-Path $repoRoot '.cache\web-dev-forever.pid'

if (-not (Test-Path $pidPath)) {
  Write-Host 'No watchdog PID file found.'
  exit 0
}

$pidValue = Get-Content $pidPath | Select-Object -First 1
if (-not $pidValue) {
  Write-Host 'Watchdog PID file was empty.'
  exit 0
}

try {
  Stop-Process -Id ([int]$pidValue) -Force -ErrorAction Stop
  Write-Host "Stopped web watchdog PID $pidValue"
} catch {
  Write-Host ("Could not stop watchdog PID {0}: {1}" -f $pidValue, $_.Exception.Message)
}

Remove-Item -Path $pidPath -ErrorAction SilentlyContinue
