$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$ManifestPath = Join-Path $Root "updates\latest.yml"
$JsonManifestPath = Join-Path $Root "updates\latest.json"
$ReleaseAsarPath = Join-Path $Root "release\win-unpacked\resources\app.asar"
$ReleaseExecutablePath = Join-Path $Root "release\win-unpacked\Top-Down MMO Prototype.exe"

if (-not (Test-Path -LiteralPath $ManifestPath)) {
  throw "updates/latest.yml is missing."
}
if (-not (Test-Path -LiteralPath $JsonManifestPath)) {
  throw "updates/latest.json is missing."
}
if (-not (Test-Path -LiteralPath $ReleaseAsarPath)) {
  throw "The tested release app.asar is missing: $ReleaseAsarPath"
}

$Manifest = Get-Content -LiteralPath $ManifestPath -Raw
$PackageNameMatch = [regex]::Match($Manifest, "(?m)^path:\s*(?<value>.+?)\s*$")
$VersionMatch = [regex]::Match($Manifest, "(?m)^version:\s*(?<value>.+?)\s*$")
if (-not $PackageNameMatch.Success) {
  throw "updates/latest.yml does not contain a path."
}

$PackageName = $PackageNameMatch.Groups["value"].Value.Trim().Trim("'`"")
$ManifestVersion = $VersionMatch.Groups["value"].Value.Trim().Trim("'`"")
$UpdateZipPath = Join-Path $Root "updates\$PackageName"
if (-not (Test-Path -LiteralPath $UpdateZipPath)) {
  throw "Update ZIP referenced by latest.yml is missing: $UpdateZipPath"
}

$JsonManifest = Get-Content -LiteralPath $JsonManifestPath -Raw | ConvertFrom-Json
$ExpectedJsonUrl = [uri]::EscapeDataString($PackageName)
if ([string]$JsonManifest.version -ne $ManifestVersion) {
  throw "latest.json version $($JsonManifest.version) does not match latest.yml version $ManifestVersion."
}
if ([string]$JsonManifest.url -ne $ExpectedJsonUrl) {
  throw "latest.json must reference the same portable update ZIP as latest.yml. Expected '$ExpectedJsonUrl', found '$($JsonManifest.url)'."
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$Archive = [System.IO.Compression.ZipFile]::OpenRead($UpdateZipPath)
try {
  $NormalizedEntries = @{}
  foreach ($Entry in $Archive.Entries) {
    $NormalizedEntries[$Entry.FullName.Replace("\", "/").TrimStart("./")] = $Entry
  }

  $AsarEntry = $NormalizedEntries["resources/app.asar"]
  $ExecutableEntry = $NormalizedEntries["Top-Down MMO Prototype.exe"]
  if (-not $AsarEntry) {
    throw "Update ZIP does not contain resources/app.asar at its install root."
  }
  if (-not $ExecutableEntry) {
    throw "Update ZIP does not contain the client executable at its install root."
  }

  $ReleaseHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $ReleaseAsarPath).Hash
  $Stream = $AsarEntry.Open()
  try {
    $Hasher = [System.Security.Cryptography.SHA256]::Create()
    try {
      $UpdateHash = ([System.BitConverter]::ToString($Hasher.ComputeHash($Stream))).Replace("-", "")
    } finally {
      $Hasher.Dispose()
    }
  } finally {
    $Stream.Dispose()
  }

  if ($ReleaseHash -ne $UpdateHash) {
    throw "Update ZIP app.asar differs from the packaged client that passed verification."
  }
  if ((Get-Item -LiteralPath $ReleaseExecutablePath).Length -ne $ExecutableEntry.Length) {
    throw "Update ZIP executable size differs from release/win-unpacked."
  }

  Write-Host (
    "Verified update payload {0}: root executable present and app.asar SHA-256 {1} matches the tested client." `
      -f $ManifestVersion, $UpdateHash
  ) -ForegroundColor Green
} finally {
  $Archive.Dispose()
}
