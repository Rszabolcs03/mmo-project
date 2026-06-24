const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mmoLauncher', {
  getConfig: () => ipcRenderer.invoke('launcher:get-config'),
  checkServer: () => ipcRenderer.invoke('launcher:check-server'),
  checkUpdate: () => ipcRenderer.invoke('launcher:check-update'),
  downloadUpdate: (updateUrl) => ipcRenderer.invoke('launcher:download-update', updateUrl),
  play: () => ipcRenderer.invoke('launcher:play'),
  setFullscreen: (fullscreen) => ipcRenderer.invoke('launcher:set-fullscreen', fullscreen),
  setResolution: (width, height) => ipcRenderer.invoke('launcher:set-resolution', width, height),
  exitGame: () => ipcRenderer.invoke('launcher:exit-game'),
  returnToLauncher: () => ipcRenderer.invoke('launcher:return-to-launcher'),
  loadCharacters: () => ipcRenderer.invoke('launcher:load-characters'),
  saveCharacters: (characters) => ipcRenderer.invoke('launcher:save-characters', characters),
  onGameEscape: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('game:escape', listener);
    return () => ipcRenderer.removeListener('game:escape', listener);
  },
});
