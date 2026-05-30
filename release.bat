@echo off
setlocal enabledelayedexpansion

REM ================================
REM CONFIG
REM ================================
set "BASE_URL=http://localhost:2567"

echo.
echo ================================
echo   MMO Release Builder
echo ================================
echo.

if not exist package.json (
    echo [ERROR] package.json not found.
    echo Put this release.bat into the project root folder.
    pause
    exit /b 1
)

for /f "delims=" %%v in ('node -p "require('./package.json').version"') do set "CURRENT_VERSION=%%v"

echo Current version: %CURRENT_VERSION%
echo.

set /p NEW_VERSION=New version example 0.1.4 or 1.0.0: 

if "%NEW_VERSION%"=="" (
    echo [ERROR] Version cannot be empty.
    pause
    exit /b 1
)

echo.
echo This will build version: %NEW_VERSION%
echo.
set /p CONFIRM=Continue? y/n: 

if /i not "%CONFIRM%"=="y" (
    echo Cancelled.
    pause
    exit /b 0
)

echo.
echo [1/7] Updating package.json version...

npm version "%NEW_VERSION%" --no-git-tag-version

if errorlevel 1 (
    echo [ERROR] Failed to update package/package-lock version.
    pause
    exit /b 1
)

echo.
echo [2/7] Removing UTF-8 BOM from JSON/config files...

node -e "const fs=require('fs'); const files=['package.json','package-lock.json','firebase.json','release-update-example.json','updates/latest.json','updates/latest.yml','dist/latest.json','dist/updates/latest.json','dist/updates/latest.yml','postcss.config.json','.postcssrc','.postcssrc.json']; for (const f of files) { if (fs.existsSync(f)) { let s=fs.readFileSync(f,'utf8'); s=s.replace(/^\uFEFF/,''); fs.writeFileSync(f,s,{encoding:'utf8'}); console.log('Cleaned '+f); } }"

if errorlevel 1 (
    echo [ERROR] Failed while removing BOM.
    pause
    exit /b 1
)

echo.
echo [3/7] Installing dependencies if needed...

if exist node_modules (
    echo node_modules found, skipping npm install.
) else (
    npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

echo.
echo [4/7] Building Electron installer...

npm run electron:dist

if errorlevel 1 (
    echo [ERROR] Build failed.
    pause
    exit /b 1
)

echo.
echo [5/7] Preparing update folders...

if not exist release (
    echo [ERROR] release folder not found after build.
    pause
    exit /b 1
)

if not exist updates (
    mkdir updates
)

set "EXE_PATH="
set "BLOCKMAP_PATH="

for /f "delims=" %%f in ('powershell -NoProfile -Command "Get-ChildItem -Path 'release' -Filter '*Setup*%NEW_VERSION%*.exe' -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName"') do set "EXE_PATH=%%f"

if "%EXE_PATH%"=="" (
    echo [ERROR] Could not find Setup exe for version %NEW_VERSION% in release folder.
    echo Check what electron-builder generated.
    pause
    exit /b 1
)

for /f "delims=" %%f in ('powershell -NoProfile -Command "$exe = Get-Item -LiteralPath '%EXE_PATH%'; $block = $exe.FullName + '.blockmap'; if (Test-Path -LiteralPath $block) { $block }"') do set "BLOCKMAP_PATH=%%f"

for %%f in ("%EXE_PATH%") do set "TARGET_EXE=%%~nxf"
for %%f in ("%BLOCKMAP_PATH%") do set "TARGET_BLOCKMAP=%%~nxf"

echo Found builder exe:
echo %EXE_PATH%
echo.
echo Target update exe:
echo updates\%TARGET_EXE%
echo.

copy /Y "%EXE_PATH%" "updates\%TARGET_EXE%" >nul

if errorlevel 1 (
    echo [ERROR] Failed to copy exe to root updates folder.
    pause
    exit /b 1
)

if not "%BLOCKMAP_PATH%"=="" (
    copy /Y "%BLOCKMAP_PATH%" "updates\%TARGET_BLOCKMAP%" >nul
    if errorlevel 1 (
        echo [ERROR] Failed to copy blockmap to updates folder.
        pause
        exit /b 1
    )
)

echo Copied update exe:
echo updates\%TARGET_EXE%

echo.
echo [6/7] Writing latest.yml...

node -e "const fs=require('fs'); const version=process.argv[1]; const exeName=process.argv[2]; const releaseDate=new Date().toISOString(); const yml='version: '+version+'\npath: '+exeName+'\nreleaseDate: \''+releaseDate+'\'\n'; fs.writeFileSync('updates/latest.yml', yml, {encoding:'utf8'}); console.log(yml);" "%NEW_VERSION%" "%TARGET_EXE%"

if errorlevel 1 (
    echo [ERROR] Failed to write latest.yml.
    pause
    exit /b 1
)

echo.
echo [7/7] Writing latest.json...

node -e "const fs=require('fs'); const version=process.argv[1]; const baseUrl=process.argv[2].replace(/\/$/,''); const exeName=process.argv[3]; const latest={version, url: baseUrl + '/updates/' + exeName, notes:'Version ' + version}; fs.writeFileSync('updates/latest.json', JSON.stringify(latest,null,2)+'\n', {encoding:'utf8'}); fs.writeFileSync('release-update-example.json', JSON.stringify(latest,null,2)+'\n', {encoding:'utf8'}); console.log(JSON.stringify(latest,null,2));" "%NEW_VERSION%" "%BASE_URL%" "%TARGET_EXE%"

if errorlevel 1 (
    echo [ERROR] Failed to write latest.json.
    pause
    exit /b 1
)

echo.
echo ================================
echo   Release build completed
echo ================================
echo.
echo Version: %NEW_VERSION%
echo.
echo Root update folder should contain:
dir updates
echo.
echo Test these after restarting the server:
echo http://localhost:2567/updates/latest.yml
echo http://localhost:2567/updates/%TARGET_EXE%
echo.
echo If the second link downloads the exe, launcher update works.
echo.
pause
