const { contextBridge, ipcRenderer } = require('electron');

// IdP pages load in the same window; only the app's own origin gets the bridge.
// Keep in sync with APP_ORIGIN in appServer.js (a sandboxed preload can't import it).
if (window.location.origin === 'http://localhost:8080') {
  const loaded = ipcRenderer.sendSync('settings:load');
  contextBridge.exposeInMainWorld('oidcApp', {
    settings: {
      initial: loaded?.settings ?? null,
      encryptionAvailable: loaded?.encryptionAvailable ?? false,
      save: (settings) => ipcRenderer.invoke('settings:save', settings),
    },
  });
}
