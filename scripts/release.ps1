$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$PackagePath = Join-Path $Root "package.json"
$PackageLockPath = Join-Path $Root "package-lock.json"
$UpdatesDir = Join-Path $Root "updates"
$LatestManifestPath = Join-Path $UpdatesDir "latest.yml"
$KeepReleaseCount = 5

function Invoke-Step {
  param(
    [string]$Title,
    [scriptblock]$Action
  )

  Write-Host ""
  Write-Host $Title -ForegroundColor Cyan
  & $Action
}

function Assert-CommandSucceeded {
  param([string]$What)

  if ($LASTEXITCODE -ne 0) {
    throw "$What failed with exit code $LASTEXITCODE."
  }
}

function Read-PackageVersion {
  if (-not (Test-Path $PackagePath)) {
    throw "package.json was not found. Run release.bat from the project root."
  }

  return (Get-Content $PackagePath -Raw | ConvertFrom-Json).version
}

function Test-Semver {
  param([string]$Version)
  return $Version -match '^\d+\.\d+\.\d+([-.+][0-9A-Za-z.-]+)?$'
}

function Compare-Semver {
  param(
    [string]$Left,
    [string]$Right
  )

  $leftParts = ($Left -replace '[-+].*$', '').Split('.') | ForEach-Object { [int]$_ }
  $rightParts = ($Right -replace '[-+].*$', '').Split('.') | ForEach-Object { [int]$_ }

  for ($i = 0; $i -lt 3; $i += 1) {
    if ($leftParts[$i] -gt $rightParts[$i]) { return 1 }
    if ($leftParts[$i] -lt $rightParts[$i]) { return -1 }
  }

  return 0
}

function Get-ManifestValue {
  param(
    [string]$ManifestText,
    [string]$Key
  )

  $match = [regex]::Match($ManifestText, "(?m)^$([regex]::Escape($Key)):\s*(.+)$")
  if (-not $match.Success) { return $null }
  return $match.Groups[1].Value.Trim().Trim("'").Trim('"')
}

function Get-InstallerVersion {
  param([string]$FileName)

  $match = [regex]::Match($FileName, '^Top-Down MMO Prototype Setup (?<version>\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)\.exe(?:\.blockmap)?$')
  if (-not $match.Success) { return $null }
  return $match.Groups["version"].Value
}

function Remove-OldUpdateInstallers {
  if (-not (Test-Path $UpdatesDir)) {
    return
  }

  $updateRoot = [System.IO.Path]::GetFullPath($UpdatesDir)
  $installerFiles = Get-ChildItem -Path $UpdatesDir -File |
    Where-Object { Get-InstallerVersion $_.Name } |
    ForEach-Object {
      [pscustomobject]@{
        File = $_
        Version = Get-InstallerVersion $_.Name
      }
    }

  $versionsToKeep = $installerFiles |
    Select-Object -ExpandProperty Version -Unique |
    Sort-Object -Property @{ Expression = { [version]($_ -replace '[-+].*$', '') } } -Descending |
    Select-Object -First $KeepReleaseCount

  if (-not $versionsToKeep -or $versionsToKeep.Count -eq 0) {
    Write-Host "No installer files found to clean."
    return
  }

  $removedCount = 0
  foreach ($entry in $installerFiles) {
    if ($versionsToKeep -contains $entry.Version) {
      continue
    }

    $targetPath = [System.IO.Path]::GetFullPath($entry.File.FullName)
    if (-not $targetPath.StartsWith($updateRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw "Refusing to delete a file outside updates/: $targetPath"
    }

    Remove-Item -LiteralPath $targetPath -Force
    $removedCount += 1
  }

  Write-Host "Kept installer versions: $($versionsToKeep -join ', ')" -ForegroundColor Green
  Write-Host "Removed old installer files: $removedCount" -ForegroundColor Green
}

try {
  Set-Location $Root

  Write-Host ""
  Write-Host "================================" -ForegroundColor DarkCyan
  Write-Host "   MMO Release Builder" -ForegroundColor White
  Write-Host "================================" -ForegroundColor DarkCyan

  $currentVersion = Read-PackageVersion
  Write-Host ""
  Write-Host "Current version: $currentVersion"

  $newVersion = Read-Host "Next version, for example 0.1.6"
  $newVersion = $newVersion.Trim()

  if (-not (Test-Semver $newVersion)) {
    throw "Version must look like 0.1.6 or 1.0.0."
  }

  if ((Compare-Semver $newVersion $currentVersion) -le 0) {
    throw "Next version must be higher than current version $currentVersion."
  }

  Write-Host ""
  Write-Host "This will build update $currentVersion -> $newVersion."
  $confirm = Read-Host "Continue? Type y"
  if ($confirm.Trim().ToLowerInvariant() -ne "y") {
    Write-Host "Cancelled."
    exit 0
  }

  Invoke-Step "[1/5] Updating package version" {
    npm.cmd version $newVersion --no-git-tag-version
    Assert-CommandSucceeded "npm version"
  }

  Invoke-Step "[2/5] Installing dependencies if needed" {
    if (Test-Path (Join-Path $Root "node_modules")) {
      Write-Host "node_modules exists, skipping npm install."
    } else {
      npm.cmd install
      Assert-CommandSucceeded "npm install"
    }
  }

  Invoke-Step "[3/5] Building Electron installer" {
    npm.cmd run electron:dist
    Assert-CommandSucceeded "electron build"
  }

  Invoke-Step "[4/5] Preparing client update files" {
    npm.cmd run update:prepare
    Assert-CommandSucceeded "update preparation"
  }

  Invoke-Step "[5/6] Verifying update manifest" {
    if (-not (Test-Path $LatestManifestPath)) {
      throw "updates/latest.yml was not generated."
    }

    $manifest = Get-Content $LatestManifestPath -Raw
    $manifestVersion = Get-ManifestValue $manifest "version"
    $installerName = Get-ManifestValue $manifest "path"

    if ($manifestVersion -ne $newVersion) {
      throw "latest.yml version is $manifestVersion, expected $newVersion."
    }

    if (-not $installerName) {
      throw "latest.yml does not contain a path field."
    }

    $installerPath = Join-Path $UpdatesDir $installerName
    if (-not (Test-Path $installerPath)) {
      throw "Installer referenced by latest.yml does not exist: $installerPath"
    }

    $latestJson = @{
      version = $newVersion
      url = "http://localhost:2567/updates/$([uri]::EscapeDataString($installerName))"
      notes = "Version $newVersion"
    } | ConvertTo-Json -Depth 4

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText((Join-Path $UpdatesDir "latest.json"), $latestJson + [Environment]::NewLine, $utf8NoBom)
    [System.IO.File]::WriteAllText((Join-Path $Root "release-update-example.json"), $latestJson + [Environment]::NewLine, $utf8NoBom)

    Write-Host "Manifest version: $manifestVersion" -ForegroundColor Green
    Write-Host "Installer: $installerName" -ForegroundColor Green
  }

  Invoke-Step "[6/6] Cleaning old update installers" {
    Remove-OldUpdateInstallers
  }

  Write-Host ""
  Write-Host "Release $newVersion is ready." -ForegroundColor Green
  Write-Host ""
  Write-Host "Start the server, then test:"
  Write-Host "  http://localhost:2567/updates/latest.yml" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "Friends on your LAN should test:"
  Write-Host "  http://YOUR-LAN-IP:2567/updates/latest.yml" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "The old client should now show an update to $newVersion."
} catch {
  Write-Host ""
  Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
  Write-Host ""
  Write-Host "No files were deleted. Check the message above and run release.bat again."
  exit 1
}
