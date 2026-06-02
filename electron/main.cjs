const { app, BrowserWindow, ipcMain, shell } = require('electron');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const isDev = !app.isPackaged;
const settingsPath = path.join(app.getPath('userData'), 'launcher-settings.json');

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

function downloadFile(url, destination) {
  const protocol = url.startsWith('https:') ? https : http;

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
      file.on('error', reject);
    });

    request.on('error', reject);
  });
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

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape' && mainWindow.isFullScreen()) {
      event.preventDefault();
      mainWindow.webContents.send('game:escape');
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

ipcMain.handle('launcher:play', (event, serverUrl) => {
  launcherConfig.serverUrl = serverUrl || launcherConfig.serverUrl;
  writeLauncherConfig(launcherConfig);
  const window = BrowserWindow.fromWebContents(event.sender);
  const gamePath = path.join(app.getAppPath(), 'dist', 'index.html');
  const gameUrl = `${pathToFileURL(gamePath).href}?colyseus=${encodeURIComponent(launcherConfig.serverUrl)}`;
  window.loadURL(gameUrl);
});

ipcMain.handle('launcher:download-update', async (_event, updateUrl) => {
  const fileName = path.basename(new URL(updateUrl).pathname) || 'Top-Down-MMO-Update.exe';
  const destination = path.join(app.getPath('downloads'), fileName);
  await downloadFile(updateUrl, destination);
  const result = await shell.openPath(destination);
  if (result) throw new Error(result);
  return { destination };
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
