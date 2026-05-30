$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$ReleaseDir = Join-Path $Root "release"
$UpdatesDir = Join-Path $Root "updates"
$PackagePath = Join-Path $Root "package.json"

if (-not (Test-Path $ReleaseDir)) {
  throw "release folder does not exist. Run npm.cmd run electron:dist first."
}

New-Item -ItemType Directory -Force -Path $UpdatesDir | Out-Null

Get-ChildItem $ReleaseDir -File |
  Where-Object { $_.Name -like "*.exe" -or $_.Name -like "*.blockmap" } |
  Copy-Item -Destination $UpdatesDir -Force

$Package = Get-Content $PackagePath -Raw | ConvertFrom-Json
$Version = $Package.version

$Installer = Get-ChildItem $UpdatesDir -File -Filter "*.exe" |
  Where-Object { $_.Name -like "*Setup*$Version*.exe" } |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $Installer) {
  throw "Could not find installer for version $Version in $UpdatesDir. Run npm.cmd run electron:dist first."
}

$ManifestPath = Join-Path $UpdatesDir "latest.yml"
$ReleaseDate = (Get-Date).ToUniversalTime().ToString("o")
$ManifestContent = @"
version: $Version
path: $($Installer.Name)
releaseDate: '$ReleaseDate'
"@

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($ManifestPath, $ManifestContent, $Utf8NoBom)

Write-Host "Copied update files to:" -ForegroundColor Cyan
Write-Host "  $UpdatesDir" -ForegroundColor Green
Write-Host ""
Write-Host "Update manifest:" -ForegroundColor Cyan
Write-Host "  version: $Version"
Write-Host "  path: $($Installer.Name)"
Write-Host ""
Write-Host "Upload these files to Firebase Hosting or any static host, then set the launcher update URL to:"
Write-Host "  https://your-site.web.app/updates/latest.yml" -ForegroundColor Green
