/**
 * What the desktop app adds to the page (window.desktop): telling the main process the app's
 * language, so the menu matches it. The web version has no window.desktop.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  setLanguage: (language) => ipcRenderer.send('desktop:language', language),
});
