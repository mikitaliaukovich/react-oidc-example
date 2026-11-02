import { app, BrowserWindow, ipcMain, Menu, safeStorage, session, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_URL, isAppUrl, registerAppProtocol } from './appServer.js';
import { forwardWithoutFollowingRedirects } from './passThrough.js';
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

// IdP pages load in the window itself, and one showing an error has no way
// back to the app, so the menu always offers one.
function createMenu() {
  return Menu.buildFromTemplate([
    {
      label: '&Navigate',
      submenu: [
        { label: 'Back to App Home', accelerator: 'Alt+Home', click: (_item, win) => win?.loadURL(APP_URL) },
        { label: 'Back', accelerator: 'Alt+Left', click: (_item, win) => win?.webContents.navigationHistory.goBack() },
        { label: 'Forward', accelerator: 'Alt+Right', click: (_item, win) => win?.webContents.navigationHistory.goForward() },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ]);
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
  registerAppProtocol(ses, distDir, (request) => forwardWithoutFollowingRedirects(ses, request));
  // Only the app may write to the clipboard (the token copy buttons).
  const isAllowed = (permission, url) => permission === 'clipboard-sanitized-write' && isAppUrl(url);
  ses.setPermissionRequestHandler((_webContents, permission, callback, details) =>
    callback(isAllowed(permission, details.requestingUrl)),
  );
  ses.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => isAllowed(permission, requestingOrigin));

  const store = createSettingsStore({
    filePath: path.join(app.getPath('userData'), 'settings.json'),
    safeStorage,
  });

  // IdP pages load in the same window, so only the app's own frames may read
  // or write the settings.
  ipcMain.on('settings:load', (event) => {
    event.returnValue = isAppUrl(event.senderFrame?.url)
      ? { settings: store.load(), encryptionAvailable: store.encryptionAvailable() }
      : null;
  });

  ipcMain.handle('settings:save', (event, settings) => {
    if (!isAppUrl(event.senderFrame?.url)) throw new Error('Settings are only available to the app.');
    if (typeof settings !== 'object' || settings === null) throw new Error('Settings must be an object.');
    return store.save(settings);
  });

  Menu.setApplicationMenu(createMenu());
  createWindow(ses);
});

app.on('window-all-closed', () => app.quit());
