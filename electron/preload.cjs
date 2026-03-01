const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  getHwid: () => ipcRenderer.invoke('license:getHwid'),
  
  // Update methods
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  
  // Update events
  onUpdateAvailable: (callback) => ipcRenderer.on('update:available', (event, info) => callback(info)),
  onUpdateNotAvailable: (callback) => ipcRenderer.on('update:not-available', (event, info) => callback(info)),
  onUpdateProgress: (callback) => ipcRenderer.on('update:progress', (event, progress) => callback(progress)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update:downloaded', (event, info) => callback(info)),
  onUpdateError: (callback) => ipcRenderer.on('update:error', (event, err) => callback(err)),
})
