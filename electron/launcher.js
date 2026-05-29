const serverInput = document.querySelector('#serverUrl');
const updateManifestInput = document.querySelector('#updateManifestUrl');
const playButton = document.querySelector('#playButton');
const updateButton = document.querySelector('#updateButton');
const saveServerButton = document.querySelector('#saveServer');
const checkUpdateButton = document.querySelector('#checkUpdate');
const versionLabel = document.querySelector('#version');
const updateStatus = document.querySelector('#updateStatus');

let pendingUpdate = null;

function normalizeServerUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) return 'ws://localhost:2567';
  if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) return trimmed;
  if (trimmed.startsWith('http://')) return `ws://${trimmed.slice('http://'.length)}`;
  if (trimmed.startsWith('https://')) return `wss://${trimmed.slice('https://'.length)}`;
  return `ws://${trimmed}`;
}

function normalizeManifestUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (trimmed.endsWith('/')) return `${trimmed.replace(/\/+$/, '')}/latest.yml`;
  if (/\.(ya?ml|json)$/i.test(trimmed)) return trimmed;

  return `${trimmed.replace(/\/+$/, '')}/latest.yml`;
}

function getManifestUrlFromServerUrl(serverUrl) {
  try {
    const url = new URL(normalizeServerUrl(serverUrl));
    url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
    url.pathname = '/updates/latest.yml';
    url.search = '';
    url.hash = '';
    return url.href;
  } catch {
    return '';
  }
}

function setUpdateAvailable(update) {
  pendingUpdate = update;
  playButton.hidden = true;
  updateButton.hidden = false;
  updateStatus.textContent = `Update available: v${update.version}`;
}

function setNoUpdate(message) {
  pendingUpdate = null;
  playButton.hidden = false;
  updateButton.hidden = true;
  updateStatus.textContent = message;
}

async function checkForUpdates() {
  const config = await window.mmoLauncher.getConfig();
  serverInput.value = normalizeServerUrl(serverInput.value || config.serverUrl || '');
  const manifestUrl = normalizeManifestUrl(
    updateManifestInput.value || config.updateManifestUrl || getManifestUrlFromServerUrl(serverInput.value),
  );
  if (!manifestUrl) {
    setNoUpdate('No update feed configured.');
    return;
  }

  updateStatus.textContent = 'Checking for update...';
  checkUpdateButton.disabled = true;
  try {
    updateManifestInput.value = manifestUrl;
    const result = await window.mmoLauncher.checkUpdate(manifestUrl);
    if (result.hasUpdate) {
      setUpdateAvailable(result.update);
    } else {
      setNoUpdate(`Client is up to date: v${result.currentVersion ?? config.appVersion}`);
    }
  } catch (error) {
    setNoUpdate(error.message || 'Update check failed.');
  } finally {
    checkUpdateButton.disabled = false;
  }
}

async function init() {
  const config = await window.mmoLauncher.getConfig();
  serverInput.value = config.serverUrl ?? 'ws://localhost:2567';
  updateManifestInput.value = config.updateManifestUrl ?? '';
  versionLabel.textContent = `v${config.appVersion ?? '0.1.0'}`;
  await checkForUpdates();
}

document.querySelectorAll('[data-server]').forEach((button) => {
  button.addEventListener('click', () => {
    serverInput.value = button.dataset.server;
  });
});

saveServerButton.addEventListener('click', async () => {
  serverInput.value = normalizeServerUrl(serverInput.value);
  await window.mmoLauncher.setServerUrl(serverInput.value);
  await window.mmoLauncher.setUpdateManifestUrl(normalizeManifestUrl(updateManifestInput.value));
});

checkUpdateButton.addEventListener('click', checkForUpdates);

updateButton.addEventListener('click', async () => {
  if (!pendingUpdate) return;
  updateButton.disabled = true;
  updateButton.textContent = 'Downloading...';
  updateStatus.textContent = `Downloading v${pendingUpdate.version}...`;
  try {
    const result = await window.mmoLauncher.downloadUpdate(pendingUpdate.url);
    updateStatus.textContent = `Installer opened from ${result.destination}`;
    updateButton.textContent = 'Update';
  } catch (error) {
    updateStatus.textContent = error.message || 'Update download failed.';
    updateButton.textContent = 'Update';
  } finally {
    updateButton.disabled = false;
  }
});

playButton.addEventListener('click', async () => {
  serverInput.value = normalizeServerUrl(serverInput.value);
  playButton.disabled = true;
  playButton.textContent = 'Launching...';
  await window.mmoLauncher.play(serverInput.value);
});

init();
