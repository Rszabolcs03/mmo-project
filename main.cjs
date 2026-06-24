const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const path = require('node:path');

const isDev = !app.isPackaged;
const settingsPath = path.join(app.getPath('userData'), 'launcher-settings.json');
let gameStaticServer = null;
let gameStaticServerPromise = null;
let gameStaticServerUrl = null;

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.tmj': 'application/json; charset=utf-8',
  '.tmx': 'application/xml; charset=utf-8',
  '.tsx': 'application/xml; charset=utf-8',
  '.wasm': 'application/wasm',
};

function readLauncherConfig() {
  try {
    return {
      serverUrl: 'ws://localhost:2567',
      updateManifestUrl: '',
      ...JSON.parse(fs.readFileSync(settingsPath, 'utf8')),
    };
  } catch {
    return {
      serverUrl: 'ws://localhost:2567',
      updateManifestUrl: '',
    };
  }
}

function writeLauncherConfig(config) {
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(config, null, 2));
}

const launcherConfig = readLauncherConfig();

function serveDistFile(request, response, distRoot) {
  const sendStatus = (statusCode, message) => {
    response.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(message);
  };

  let requestPath = '/';
  try {
    requestPath = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
  } catch {
    sendStatus(400, 'Bad request');
    return;
  }

  if (requestPath === '/') requestPath = '/index.html';

  const filePath = path.resolve(distRoot, `.${requestPath}`);
  const relativePath = path.relative(distRoot, filePath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    sendStatus(403, 'Forbidden');
    return;
  }

  fs.stat(filePath, (error, stats) => {
    const hasExtension = Boolean(path.extname(filePath));
    if (error || !stats.isFile()) {
      if (!hasExtension) {
        serveDistFile({ ...request, url: '/index.html' }, response, distRoot);
        return;
      }
      sendStatus(404, 'Not found');
      return;
    }

    const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    response.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    });

    if (request.method === 'HEAD') {
      response.end();
      return;
    }

    fs.createReadStream(filePath).pipe(response);
  });
}

function ensureGameStaticServer() {
  if (gameStaticServerUrl) return Promise.resolve(gameStaticServerUrl);
  if (gameStaticServerPromise) return gameStaticServerPromise;

  gameStaticServerPromise = new Promise((resolve, reject) => {
    const distRoot = path.join(app.getAppPath(), 'dist');
    const server = http.createServer((request, response) => {
      serveDistFile(request, response, distRoot);
    });

    server.on('error', (error) => {
      gameStaticServerPromise = null;
      reject(error);
    });

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      gameStaticServer = server;
      gameStaticServerUrl = `http://127.0.0.1:${address.port}/`;
      resolve(gameStaticServerUrl);
    });
  });

  return gameStaticServerPromise;
}

function downloadFile(url, destination) {
  const protocol = url.startsWith('https:') ? https : http;
  fs.mkdirSync(path.dirname(destination), { recursive: true });

  return new Promise((resolve, reject) => {
    const request = protocol.get(url, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        downloadFile(new URL(response.headers.location, url).href, destination).then(resolve, reject);
        return;
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        reject(new Error(`Download failed with HTTP ${response.statusCode}`));
        return;
      }

      const file = fs.createWriteStream(destination);
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve(destination));
      });
      file.on('error', (error) => {
        fs.unlink(destination, () => reject(error));
      });
    });

    request.on('error', reject);
  });
}

function quotePowerShellString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function escapeBatchValue(value) {
  return String(value).replace(/%/g, '%%');
}

function getUpdateMode(fileName) {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith('.zip')) return 'folder';
  if (lowerName.endsWith('.exe') && !lowerName.includes('setup')) return 'exe';
  return 'installer';
}

function createUpdateScript(mode, downloadPath) {
  if (isDev) {
    throw new Error('In-place updates can only be applied from a packaged client.');
  }

  const updaterDir = path.join(app.getPath('temp'), 'mmo-project-updater');
  fs.mkdirSync(updaterDir, { recursive: true });

  const scriptId = `${Date.now()}-${process.pid}`;
  const cmdPath = path.join(updaterDir, `apply-update-${scriptId}.cmd`);
  const stagingPath = path.join(updaterDir, `staging-${scriptId}`);
  const logPath = path.join(app.getPath('userData'), 'update.log');
  const exePath = process.execPath;
  const appDir = path.dirname(exePath);
  const exeName = path.basename(exePath);

  const cmdScript = `
@echo off
setlocal EnableExtensions EnableDelayedExpansion
set "DOWNLOAD=${escapeBatchValue(downloadPath)}"
set "MODE=${escapeBatchValue(mode)}"
set "PID_TO_WAIT=${process.pid}"
set "APP_DIR=${escapeBatchValue(appDir)}"
set "EXE_PATH=${escapeBatchValue(exePath)}"
set "EXE_NAME=${escapeBatchValue(exeName)}"
set "STAGING=${escapeBatchValue(stagingPath)}"
set "LOG_PATH=${escapeBatchValue(logPath)}"

call :log "Updater started. Mode=%MODE% Download=%DOWNLOAD%"

:wait_loop
tasklist /FI "PID eq %PID_TO_WAIT%" 2>nul | findstr /R /C:"[ ]%PID_TO_WAIT%[ ]" >nul
if %ERRORLEVEL% EQU 0 (
  timeout /t 1 /nobreak >nul
  goto wait_loop
)

timeout /t 2 /nobreak >nul

if /I "%MODE%"=="folder" goto install_folder
if /I "%MODE%"=="exe" goto install_exe
call :log "Unsupported update mode: %MODE%"
goto restart_client

:install_folder
call :log "Preparing staging folder %STAGING%"
if exist "%STAGING%" rmdir /s /q "%STAGING%" >>"%LOG_PATH%" 2>&1
mkdir "%STAGING%" >>"%LOG_PATH%" 2>&1

call :log "Extracting update package."
tar.exe -xf "%DOWNLOAD%" -C "%STAGING%" >>"%LOG_PATH%" 2>&1
if %ERRORLEVEL% NEQ 0 (
  call :log "tar extraction failed with exit code %ERRORLEVEL%."
  goto restart_client
)

set "SOURCE=%STAGING%"
if exist "%STAGING%\\win-unpacked\\%EXE_NAME%" set "SOURCE=%STAGING%\\win-unpacked"
if exist "!SOURCE!\\%EXE_NAME%" goto copy_folder

set "FOUND_SOURCE="
for /d /r "%STAGING%" %%D in (*) do (
  if not defined FOUND_SOURCE if exist "%%D\\%EXE_NAME%" set "FOUND_SOURCE=%%D"
)
if defined FOUND_SOURCE set "SOURCE=!FOUND_SOURCE!"

if not exist "!SOURCE!\\%EXE_NAME%" (
  call :log "Update package does not contain %EXE_NAME%."
  goto restart_client
)

:copy_folder
call :log "Copying update from !SOURCE! to %APP_DIR%."
robocopy.exe "!SOURCE!" "%APP_DIR%" /E /R:30 /W:1 /NFL /NDL /NP /NJH /NJS >>"%LOG_PATH%" 2>&1
set "ROBOCOPY_EXIT=%ERRORLEVEL%"
call :log "Robocopy finished with exit code !ROBOCOPY_EXIT!."
if !ROBOCOPY_EXIT! GEQ 8 (
  call :log "Robocopy failed."
  goto restart_client
)

rmdir /s /q "%STAGING%" >>"%LOG_PATH%" 2>&1
call :log "Update applied."
goto restart_client

:install_exe
call :log "Replacing executable."
copy /Y "%DOWNLOAD%" "%EXE_PATH%" >>"%LOG_PATH%" 2>&1
if %ERRORLEVEL% NEQ 0 call :log "Executable copy failed with exit code %ERRORLEVEL%."
goto restart_client

:restart_client
if exist "%EXE_PATH%" (
  call :log "Starting client."
  start "" /D "%APP_DIR%" "%EXE_PATH%"
) else (
  call :log "Cannot restart client. Missing executable: %EXE_PATH%"
)
exit /b 0

:log
echo [%DATE% %TIME%] %~1>>"%LOG_PATH%"
exit /b 0
`;

  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(cmdPath, cmdScript.trim().replace(/\n/g, '\r\n'), 'utf8');

  return { cmdPath, logPath };
}

function scheduleInPlaceUpdate(mode, downloadPath) {
  const { cmdPath, logPath } = createUpdateScript(mode, downloadPath);
  const updater = spawn('cmd.exe', ['/d', '/c', cmdPath], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  updater.unref();

  setTimeout(() => {
    BrowserWindow.getAllWindows().forEach((window) => window.destroy());
    app.exit(0);
  }, 250);

  return { logPath };
}

function fetchText(url) {
  const protocol = url.startsWith('https:') ? https : http;

  return new Promise((resolve, reject) => {
    const request = protocol.get(url, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        fetchText(new URL(response.headers.location, url).href).then(resolve, reject);
        return;
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        reject(new Error(`Update check failed with HTTP ${response.statusCode}`));
        return;
      }

      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => resolve(body));
    });

    request.on('error', reject);
  });
}

function parseSimpleYml(text) {
  const manifest = {};
  let inFilesArray = false;
  let currentFile = null;

  String(text)
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) return;

      const indent = line.match(/^\s*/)[0].length;
      const isRootLine = indent === 0;

      if (isRootLine && trimmedLine.startsWith('files:')) {
        manifest.files = [];
        inFilesArray = true;
        currentFile = null;
        return;
      }

      if (isRootLine && inFilesArray) {
        if (currentFile) {
          manifest.files.push(currentFile);
          currentFile = null;
        }
        inFilesArray = false;
      }

      if (inFilesArray) {
        if (indent >= 2 && trimmedLine.startsWith('-')) {
          if (currentFile) {
            manifest.files.push(currentFile);
          }
          currentFile = {};
          const fileMatch = trimmedLine.replace(/^-\s*/, '').match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
          if (fileMatch) {
            currentFile[fileMatch[1].toLowerCase()] = fileMatch[2].replace(/^['"]|['"]$/g, '');
          }
          return;
        }

        if (currentFile && indent >= 4) {
          const fileMatch = trimmedLine.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
          if (fileMatch) {
            currentFile[fileMatch[1].toLowerCase()] = fileMatch[2].replace(/^['"]|['"]$/g, '');
          }
          return;
        }
      }

      if (isRootLine) {
        const rootMatch = trimmedLine.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
        if (rootMatch) {
          manifest[rootMatch[1].toLowerCase()] = rootMatch[2].replace(/^['"]|['"]$/g, '');
        }
      }
    });

  if (inFilesArray && currentFile) {
    manifest.files.push(currentFile);
  }

  return manifest;
}

function normalizeManifestUrl(manifestUrl) {
  const trimmedManifestUrl = String(manifestUrl ?? '').trim();
  if (!trimmedManifestUrl) return trimmedManifestUrl;

  try {
    const parsedUrl = new URL(trimmedManifestUrl);
    if (/\.(ya?ml|json)$/i.test(parsedUrl.pathname)) return parsedUrl.href;
    const trimmedPath = parsedUrl.pathname.replace(/\/+$/, '');
    parsedUrl.pathname = `${trimmedPath}/latest.yml`;
    return parsedUrl.href;
  } catch {
    return trimmedManifestUrl;
  }
}

function compareVersions(a, b) {
  const left = String(a).split('.').map((part) => Number(part.replace(/\D.*/, '')) || 0);
  const right = String(b).split('.').map((part) => Number(part.replace(/\D.*/, '')) || 0);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    if ((left[index] ?? 0) > (right[index] ?? 0)) return 1;
    if ((left[index] ?? 0) < (right[index] ?? 0)) return -1;
  }
  return 0;
}

async function readUpdateManifest(manifestUrl) {
  const resolvedManifestUrl = normalizeManifestUrl(manifestUrl);
  const text = await fetchText(resolvedManifestUrl);
  const rawManifest = resolvedManifestUrl.endsWith('.json') ? JSON.parse(text) : parseSimpleYml(text);
  const manifest = Object.fromEntries(
    Object.entries(rawManifest).map(([key, value]) => [key.toLowerCase(), value]),
  );
  const nestedFile = Array.isArray(manifest.files) ? manifest.files.find((entry) => entry?.url) : null;
  const version = manifest.version ?? manifest['app-version'];
  const updatePath = nestedFile?.url ?? manifest.url ?? manifest.path ?? manifest.downloadurl ?? manifest.downloadpath ?? manifest.file ?? manifest.installer;
  if (!version || !updatePath) {
    const keys = Object.keys(manifest).join(', ') || 'none';
    throw new Error(`Update manifest at ${resolvedManifestUrl} must include version and path/url. Parsed keys: ${keys}.`);
  }

  return {
    version,
    url: new URL(String(updatePath), resolvedManifestUrl).href,
    notes: manifest.notes || '',
  };
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#101c1f',
    title: 'Top-Down MMO Prototype',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.removeMenu();
  mainWindow.loadFile(path.join(__dirname, 'launcher.html'));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 2) {
      console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
    }
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedUrl) => {
    console.log(`[renderer-load] ${errorCode} ${errorDescription} ${validatedUrl}`);
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    const navigationMouseButton = ['mouseBack', 'mouseForward', 'back', 'forward', 'button4', 'button5'].includes(String(input.button ?? '').toLowerCase());
    if (
      (input.type === 'keyDown'
        && (
          ['Escape', 'BrowserBack', 'BrowserForward', 'GoBack', 'GoForward'].includes(input.key)
          || (input.alt && ['ArrowLeft', 'ArrowRight'].includes(input.key))
        ))
      || navigationMouseButton
    ) {
      event.preventDefault();
      if (input.key === 'Escape') mainWindow.webContents.send('game:escape');
    }
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const currentUrl = mainWindow.webContents.getURL();
    if (!currentUrl || url === currentUrl) return;
    event.preventDefault();
  });

  mainWindow.webContents.on('did-navigate', () => {
    mainWindow.webContents.navigationHistory?.clear?.();
    mainWindow.webContents.clearHistory?.();
  });

  mainWindow.webContents.on('did-navigate-in-page', () => {
    mainWindow.webContents.navigationHistory?.clear?.();
    mainWindow.webContents.clearHistory?.();
  });

  mainWindow.on('app-command', (event, command) => {
    if (['browser-backward', 'browser-forward'].includes(command)) {
      event.preventDefault();
      mainWindow.webContents.navigationHistory?.clear?.();
      mainWindow.webContents.clearHistory?.();
    }
  });

  return mainWindow;
}

ipcMain.handle('launcher:get-config', () => ({
  ...launcherConfig,
  appVersion: app.getVersion(),
  isDev,
}));

ipcMain.handle('launcher:set-server-url', (_event, serverUrl) => {
  launcherConfig.serverUrl = serverUrl || 'ws://localhost:2567';
  writeLauncherConfig(launcherConfig);
  return launcherConfig;
});

ipcMain.handle('launcher:set-update-manifest-url', (_event, updateManifestUrl) => {
  launcherConfig.updateManifestUrl = updateManifestUrl || '';
  writeLauncherConfig(launcherConfig);
  return launcherConfig;
});

ipcMain.handle('launcher:set-fullscreen', (event, fullscreen) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  window?.setFullScreen(Boolean(fullscreen));
  return Boolean(window?.isFullScreen());
});

ipcMain.handle('launcher:set-resolution', (event, width, height) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) return null;
  const safeWidth = Math.max(1024, Math.min(3840, Number(width) || 1280));
  const safeHeight = Math.max(680, Math.min(2160, Number(height) || 720));
  window.setFullScreen(false);
  window.setSize(Math.round(safeWidth), Math.round(safeHeight), true);
  window.center();
  return window.getSize();
});

ipcMain.handle('launcher:exit-game', () => {
  app.quit();
  return true;
});

ipcMain.handle('launcher:check-update', async (_event, updateManifestUrl) => {
  launcherConfig.updateManifestUrl = updateManifestUrl || launcherConfig.updateManifestUrl || '';
  writeLauncherConfig(launcherConfig);

  if (!launcherConfig.updateManifestUrl) {
    return {
      configured: false,
      hasUpdate: false,
      currentVersion: app.getVersion(),
    };
  }

  const update = await readUpdateManifest(launcherConfig.updateManifestUrl);
  return {
    configured: true,
    hasUpdate: compareVersions(update.version, app.getVersion()) > 0,
    currentVersion: app.getVersion(),
    update,
  };
});

ipcMain.handle('launcher:play', async (event, serverUrl) => {
  launcherConfig.serverUrl = serverUrl || launcherConfig.serverUrl;
  writeLauncherConfig(launcherConfig);
  const window = BrowserWindow.fromWebContents(event.sender);
  const gameBaseUrl = await ensureGameStaticServer();
  const gameUrl = `${gameBaseUrl}index.html?colyseus=${encodeURIComponent(launcherConfig.serverUrl)}`;
  window.loadURL(gameUrl);
});

ipcMain.handle('launcher:download-update', async (_event, updateUrl) => {
  const updatePath = decodeURIComponent(new URL(updateUrl).pathname);
  const fileName = (path.basename(updatePath) || 'Top-Down-MMO-Update.exe')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
  const destination = path.join(app.getPath('temp'), 'mmo-project-updates', fileName);
  const mode = getUpdateMode(fileName);

  await downloadFile(updateUrl, destination);

  if (mode === 'installer') {
    const result = await shell.openPath(destination);
    if (result) throw new Error(result);
    setTimeout(() => {
      app.quit();
    }, 1200);
    return { destination, mode, closing: true };
  }

  const { logPath } = scheduleInPlaceUpdate(mode, destination);
  return { destination, mode, logPath, closing: true };
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (gameStaticServer) {
    gameStaticServer.close();
    gameStaticServer = null;
    gameStaticServerPromise = null;
    gameStaticServerUrl = null;
  }
});
