$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$ReleaseDir = Join-Path $Root "release"
$UnpackedDir = Join-Path $ReleaseDir "win-unpacked"
$UpdatesDir = Join-Path $Root "updates"
$PackagePath = Join-Path $Root "package.json"

if (-not (Test-Path $ReleaseDir)) {
  throw "release folder does not exist. Run npm.cmd run electron:dist first."
}

if (-not (Test-Path $UnpackedDir)) {
  throw "release/win-unpacked folder does not exist. Run npm.cmd run electron:dist first."
}

New-Item -ItemType Directory -Force -Path $UpdatesDir | Out-Null

$Package = Get-Content $PackagePath -Raw | ConvertFrom-Json
$Version = $Package.version

$Installer = Get-ChildItem $ReleaseDir -File -Filter "*.exe" |
  Where-Object { $_.Name -eq "Top-Down MMO Prototype Setup.exe" -or $_.Name -like "*Setup*$Version*.exe" } |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $Installer) {
  throw "Could not find installer for version $Version in $ReleaseDir. Run npm.cmd run electron:dist first."
}

Get-ChildItem $ReleaseDir -File |
  Where-Object {
    $_.Name -match '^Top-Down MMO Prototype Setup \d+\.\d+\.\d+.*\.exe(\.blockmap)?$' -or
    $_.Name -match '^mmo-project-\d+\.\d+\.\d+.*\.nsis\.7z$'
  } |
  Remove-Item -Force

Get-ChildItem $UpdatesDir -File |
  Where-Object { $_.Name -like "Top-Down MMO Prototype Setup*.exe" -or $_.Name -like "Top-Down MMO Prototype Setup*.exe.blockmap" } |
  Remove-Item -Force

Copy-Item -LiteralPath $Installer.FullName -Destination $UpdatesDir -Force

$InstallerBlockmap = Get-Item -LiteralPath "$($Installer.FullName).blockmap" -ErrorAction SilentlyContinue
if ($InstallerBlockmap) {
  Copy-Item -LiteralPath $InstallerBlockmap.FullName -Destination $UpdatesDir -Force
}

$UpdatePackageName = "Top-Down MMO Prototype-win-unpacked.zip"
$UpdatePackagePath = Join-Path $UpdatesDir $UpdatePackageName
if (Test-Path $UpdatePackagePath) {
  Remove-Item -LiteralPath $UpdatePackagePath -Force
}

Get-ChildItem $UpdatesDir -File -Filter "Top-Down MMO Prototype-*-win-unpacked.zip" |
  Remove-Item -Force

Compress-Archive -Path (Join-Path $UnpackedDir "*") -DestinationPath $UpdatePackagePath -Force

$ManifestPath = Join-Path $UpdatesDir "latest.yml"
$ReleaseDate = (Get-Date).ToUniversalTime().ToString("o")
$ManifestContent = @"
version: $Version
path: $UpdatePackageName
installer: $($Installer.Name)
releaseDate: '$ReleaseDate'
"@

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($ManifestPath, $ManifestContent, $Utf8NoBom)

$LatestJson = @{
  version = $Version
  url = "http://localhost:2567/updates/$([uri]::EscapeDataString($UpdatePackageName))"
  notes = "Version $Version"
} | ConvertTo-Json -Depth 4

[System.IO.File]::WriteAllText((Join-Path $UpdatesDir "latest.json"), $LatestJson + [Environment]::NewLine, $Utf8NoBom)
[System.IO.File]::WriteAllText((Join-Path $Root "release-update-example.json"), $LatestJson + [Environment]::NewLine, $Utf8NoBom)

Write-Host "Copied update files to:" -ForegroundColor Cyan
Write-Host "  $UpdatesDir" -ForegroundColor Green
Write-Host ""
Write-Host "Update manifest:" -ForegroundColor Cyan
Write-Host "  version: $Version"
Write-Host "  path: $UpdatePackageName"
Write-Host "  installer: $($Installer.Name)"
Write-Host "  latest.json url: http://localhost:2567/updates/$([uri]::EscapeDataString($UpdatePackageName))"
Write-Host ""
Write-Host "Upload these files to Firebase Hosting or any static host, then set the launcher update URL to:"
Write-Host "  https://your-site.web.app/updates/latest.yml" -ForegroundColor Green
