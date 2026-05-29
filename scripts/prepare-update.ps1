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

$releaseLatestManifest = Join-Path $ReleaseDir "latest.yml"
if (-not (Test-Path $releaseLatestManifest)) {
  throw "release/latest.yml does not exist. Run npm.cmd run electron:dist first."
}

Copy-Item -LiteralPath $releaseLatestManifest -Destination (Join-Path $UpdatesDir "latest.yml") -Force

Write-Host "Copied update files to:" -ForegroundColor Cyan
Write-Host "  $UpdatesDir" -ForegroundColor Green
Write-Host ""
Write-Host "Upload these files to Firebase Hosting or any static host, then set the launcher update URL to:"
Write-Host "  https://your-site.web.app/updates/latest.yml" -ForegroundColor Green
