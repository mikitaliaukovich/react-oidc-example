// Electron-level check of the http interception, which Vitest can't load.
// Run with `npm run test:electron`. Exits non-zero on failure.
//
// A fake plain-http IdP answers a login form POST with a redirect chain that
// ends at the app's redirect URI. Every hop must come back through the
// protocol handler, so the app (not the real network on port 8080) serves the
// final page with ?code in the URL, and the IdP cookie must be kept.
import { app, BrowserWindow, session } from 'electron';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { APP_URL, registerAppProtocol } from './appServer.js';
import { forwardWithoutFollowingRedirects } from './passThrough.js';

const distDir = mkdtempSync(path.join(tmpdir(), 'protocol-e2e-'));
writeFileSync(path.join(distDir, 'index.html'), '<title>served-by-app</title>');

const idp = http.createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    if (req.url === '/login' && req.method === 'POST' && body === 'user=alice') {
      res.writeHead(302, { 'Set-Cookie': 'idp_session=1; Path=/', Location: '/authorize' });
    } else if (req.url === '/authorize' && req.headers.cookie === 'idp_session=1') {
      res.writeHead(302, { Location: `${APP_URL}?code=test-code&state=test-state` });
    } else if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.write('<form method="post" action="/login"><input name="user" value="alice"></form>');
    } else {
      res.writeHead(400);
    }
    res.end();
  });
});

async function run() {
  await new Promise((resolve) => idp.listen(0, '127.0.0.1', resolve));
  const idpUrl = `http://127.0.0.1:${idp.address().port}`;

  const ses = session.fromPartition(`protocol-e2e-${Date.now()}`);
  registerAppProtocol(ses, distDir, (request) => forwardWithoutFollowingRedirects(ses, request));

  const win = new BrowserWindow({ show: false, webPreferences: { session: ses } });
  await win.loadURL(`${idpUrl}/`);
  const landed = new Promise((resolve) => win.webContents.once('did-finish-load', resolve));
  await win.webContents.executeJavaScript('document.forms[0].submit()');
  await Promise.race([landed, new Promise((resolve) => setTimeout(resolve, 5000))]);

  assert.equal(win.webContents.getURL(), `${APP_URL}?code=test-code&state=test-state`);
  assert.equal(await win.webContents.executeJavaScript('document.title'), 'served-by-app');
  const cookies = await ses.cookies.get({ name: 'idp_session' });
  assert.equal(cookies.length, 1);
}

app.whenReady().then(async () => {
  let exitCode = 0;
  try {
    await run();
    console.log('protocol e2e: PASS');
  } catch (error) {
    console.error('protocol e2e: FAIL\n', error);
    exitCode = 1;
  } finally {
    idp.close();
    rmSync(distDir, { recursive: true, force: true });
    app.exit(exitCode);
  }
});
