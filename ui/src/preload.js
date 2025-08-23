const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  scanDirectory: (params) => ipcRenderer.invoke('scan-directory', params),
  organizeFiles: (params) => ipcRenderer.invoke('organize-files', params),
  executeOrganization: (params) => ipcRenderer.invoke('execute-organization', params),
  openFolder: (params) => ipcRenderer.invoke('open-folder', params)
});
