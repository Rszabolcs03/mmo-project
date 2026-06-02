const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mmoLauncher', {
  getConfig: () => ipcRenderer.invoke('launcher:get-config'),
  setServerUrl: (serverUrl) => ipcRenderer.invoke('launcher:set-server-url', serverUrl),
  setUpdateManifestUrl: (updateManifestUrl) => ipcRenderer.invoke('launcher:set-update-manifest-url', updateManifestUrl),
  checkUpdate: (updateManifestUrl) => ipcRenderer.invoke('launcher:check-update', updateManifestUrl),
  downloadUpdate: (updateUrl) => ipcRenderer.invoke('launcher:download-update', updateUrl),
  play: (serverUrl) => ipcRenderer.invoke('launcher:play', serverUrl),
  onGameEscape: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('game:escape', listener);
    return () => ipcRenderer.removeListener('game:escape', listener);
  },
});
