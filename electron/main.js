import { app, BrowserWindow, ipcMain, safeStorage, session, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_URL, isAppUrl, registerAppProtocol } from './appServer.js';
import { createSettingsStore } from './settingsStore.js';

const electronDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(electronDir, '..', 'dist');

function isWebUrl(url) {
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

function createWindow(ses) {
  const win = new BrowserWindow({
    width: 1100,
    height: 850,
    webPreferences: {
      session: ses,
      preload: path.join(electronDir, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  // No popups: links that want a new window open in the default browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isWebUrl(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // IdPs redirect through federated providers, so any http(s) page may load
  // in the window, but nothing else (file:, custom schemes).
  win.webContents.on('will-navigate', (event, url) => {
    if (!isWebUrl(url)) event.preventDefault();
  });

  win.loadURL(APP_URL);
}

app.whenReady().then(() => {
  // No `persist:` prefix: storage, cookies and cache live only in memory.
  const ses = session.fromPartition('oidc-test-client');
  registerAppProtocol(ses, distDir);
  ses.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  ses.setPermissionCheckHandler(() => false);

  const store = createSettingsStore({
    filePath: path.join(app.getPath('userData'), 'settings.json'),
    safeStorage,
  });

  // IdP pages load in the same window, so only the app's own frames may read
  // or write the settings.
  ipcMain.on('settings:load', (event) => {
    event.returnValue = isAppUrl(event.senderFrame?.url) ? store.load() : null;
  });

  ipcMain.handle('settings:save', (event, settings) => {
    if (!isAppUrl(event.senderFrame?.url)) throw new Error('Settings are only available to the app.');
    if (typeof settings !== 'object' || settings === null) throw new Error('Settings must be an object.');
    return store.save(settings);
  });

  createWindow(ses);
});

app.on('window-all-closed', () => app.quit());
