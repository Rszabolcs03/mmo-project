$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Get-EnvValue {
  param([string]$Name)

  $envValue = [Environment]::GetEnvironmentVariable($Name)
  if ($envValue) {
    return $envValue
  }

  $envPath = Join-Path $Root ".env"
  if (-not (Test-Path $envPath)) {
    return $null
  }

  $line = Get-Content $envPath | Where-Object { $_ -match "^\s*$Name\s*=" } | Select-Object -First 1
  if (-not $line) {
    return $null
  }

  return ($line -replace "^\s*$Name\s*=\s*", "").Trim().Trim('"').Trim("'")
}

function Get-LanAddresses {
  Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
      $_.IPAddress -notlike "127.*" -and
      $_.IPAddress -notlike "169.254.*" -and
      $_.PrefixOrigin -ne "WellKnown"
    } |
    Select-Object -ExpandProperty IPAddress -Unique
}

Write-Host "Starting the MMO demo..." -ForegroundColor Cyan
Write-Host ""

Start-Process cmd.exe -ArgumentList "/k cd /d `"$Root`" && npm.cmd run dev:server"
Start-Process cmd.exe -ArgumentList "/k cd /d `"$Root`" && npm.cmd run dev -- --host 0.0.0.0 --port 5173"

Write-Host "Local:"
Write-Host "  http://localhost:5173" -ForegroundColor Green

$lanAddresses = @(Get-LanAddresses)
if ($lanAddresses.Count -gt 0) {
  Write-Host ""
  Write-Host "LAN:"
  foreach ($address in $lanAddresses) {
    Write-Host "  http://$address`:5173" -ForegroundColor Green
  }
}

Write-Host ""
Write-Host "No third-party tunnel was started." -ForegroundColor Cyan
Write-Host "For the Electron client, use start-server.bat and enter ws://your-ip:2567 in the launcher."
