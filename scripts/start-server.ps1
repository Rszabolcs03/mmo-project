$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Get-LanAddresses {
  Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
      $_.IPAddress -notlike "127.*" -and
      $_.IPAddress -notlike "169.254.*" -and
      $_.PrefixOrigin -ne "WellKnown"
    } |
    Select-Object -ExpandProperty IPAddress -Unique
}

Write-Host "Starting the MMO Colyseus server..." -ForegroundColor Cyan
Write-Host ""

Start-Process cmd.exe -ArgumentList "/k cd /d `"$Root`" && npm.cmd run dev:server"

Write-Host "Server addresses for the Electron client:" -ForegroundColor Cyan
Write-Host "  ws://localhost:2567" -ForegroundColor Green

$lanAddresses = @(Get-LanAddresses)
if ($lanAddresses.Count -gt 0) {
  foreach ($address in $lanAddresses) {
    Write-Host "  ws://$address`:2567" -ForegroundColor Green
  }
}

Write-Host ""
Write-Host "Friends can use your Tailscale IP here too, for example ws://100.x.x.x:2567."
