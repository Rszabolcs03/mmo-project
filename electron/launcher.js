const playButton = document.querySelector('#playButton');
const updateButton = document.querySelector('#updateButton');
const checkUpdateButton = document.querySelector('#checkUpdate');
const versionLabel = document.querySelector('#version');
const clientStatus = document.querySelector('#clientStatus');
const updateStatus = document.querySelector('#updateStatus');

let pendingUpdate = null;
let appVersion = '0.1.0';
let serverOnline = false;

function syncPlayState() {
  playButton.disabled = Boolean(pendingUpdate) || !serverOnline;
}

function setUpdateAvailable(update) {
  pendingUpdate = update;
  playButton.hidden = true;
  updateButton.hidden = false;
  clientStatus.textContent = 'Update needed';
  updateStatus.textContent = `Update needed: v${appVersion} -> v${update.version}`;
  syncPlayState();
}

function setNoUpdate(message) {
  pendingUpdate = null;
  playButton.hidden = false;
  updateButton.hidden = true;
  clientStatus.textContent = 'Up to date';
  updateStatus.textContent = message;
  syncPlayState();
}

async function checkServer() {
  serverOnline = false;
  syncPlayState();
  try {
    const result = await window.mmoLauncher.checkServer();
    serverOnline = Boolean(result.online);
    if (!serverOnline) {
      clientStatus.textContent = 'Server offline';
      updateStatus.textContent = `Server offline${result.error ? `: ${result.error}` : ''}`;
    } else if (!pendingUpdate) {
      clientStatus.textContent = 'Ready';
      updateStatus.textContent = `Client is up to date: v${appVersion} | Server online`;
    }
    return result;
  } catch (error) {
    serverOnline = false;
    clientStatus.textContent = 'Server offline';
    updateStatus.textContent = error.message || 'Server check failed.';
    return { online: false, error: error.message };
  } finally {
    syncPlayState();
  }
}

async function checkForUpdates() {
  updateStatus.textContent = 'Checking for update...';
  clientStatus.textContent = 'Checking...';
  checkUpdateButton.disabled = true;
  serverOnline = false;
  syncPlayState();

  try {
    const result = await window.mmoLauncher.checkUpdate();
    if (result.hasUpdate) {
      setUpdateAvailable(result.update);
    } else {
      setNoUpdate(`Client is up to date: v${result.currentVersion ?? appVersion}`);
    }
  } catch (error) {
    pendingUpdate = null;
    playButton.hidden = false;
    updateButton.hidden = true;
    clientStatus.textContent = 'Check failed';
    updateStatus.textContent = error.message || 'Update check failed.';
  } finally {
    checkUpdateButton.disabled = false;
    if (!pendingUpdate) await checkServer();
  }
}

async function init() {
  const config = await window.mmoLauncher.getConfig();
  appVersion = config.appVersion ?? '0.1.0';
  versionLabel.textContent = `v${appVersion}`;
  await checkForUpdates();
}

checkUpdateButton.addEventListener('click', checkForUpdates);

updateButton.addEventListener('click', async () => {
  if (!pendingUpdate) return;
  updateButton.disabled = true;
  updateButton.textContent = 'Downloading...';
  updateStatus.textContent = `Downloading v${pendingUpdate.version}...`;

  try {
    const result = await window.mmoLauncher.downloadUpdate(pendingUpdate.url);
    if (result.mode === 'installer') {
      updateStatus.textContent = result.closing
        ? 'Installer opened. Closing launcher so the update can install...'
        : `Installer opened from ${result.destination}`;
    } else {
      updateStatus.textContent = 'Update downloaded. Closing launcher to replace client files...';
    }
    updateButton.textContent = 'Update';
  } catch (error) {
    updateStatus.textContent = error.message || 'Update download failed.';
    updateButton.textContent = 'Update';
  } finally {
    updateButton.disabled = false;
  }
});

playButton.addEventListener('click', async () => {
  playButton.disabled = true;
  playButton.textContent = 'Launching...';

  try {
    const server = await checkServer();
    if (!server.online) {
      playButton.textContent = 'Play';
      return;
    }
    await window.mmoLauncher.play();
  } catch (error) {
    playButton.disabled = false;
    playButton.textContent = 'Play';
    updateStatus.textContent = error.message || 'Launch failed.';
  } finally {
    syncPlayState();
  }
});

init();
