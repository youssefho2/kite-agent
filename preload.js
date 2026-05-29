const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  showNotification: (payload) => ipcRenderer.invoke('show-notification', payload),
  openFileDialog: (type) => ipcRenderer.invoke('open-file-dialog', type),
  saveFileDialog: (payload) => ipcRenderer.invoke('save-file-dialog', payload),
  sendEmail: (payload) => ipcRenderer.invoke('send-email', payload),
  saveAppData: (payload) => ipcRenderer.invoke('save-app-data', payload),
  loadAppData: (filename) => ipcRenderer.invoke('load-app-data', filename),
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
  closeWindow: () => ipcRenderer.invoke('window-close')
});
