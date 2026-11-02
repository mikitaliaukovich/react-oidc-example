// Electron-level check of the http(s) interception, which Vitest can't load.
// Run with `npm run test:electron`. Exits non-zero on failure.
//
// Fake IdPs answer with redirect chains that end at the app's redirect URI.
// Every hop must come back through the protocol handlers, so the app (not
// whatever really listens on localhost:8080) serves the final page with ?code
// in the URL, and the IdP cookie must be kept. Needs `openssl` (Git for
// Windows ships one) to make a throwaway certificate for the https IdP.
import { execFileSync } from 'node:child_process';
import { app, BrowserWindow, session } from 'electron';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { APP_URL, registerAppProtocol } from './appServer.js';
import { forwardWithoutFollowingRedirects } from './passThrough.js';

const workDir = mkdtempSync(path.join(tmpdir(), 'protocol-e2e-'));
const distDir = path.join(workDir, 'dist');
const CALLBACK_URL = `${APP_URL}?code=test-code&state=test-state`;

function findOpenssl() {
  const gitOpenssl = 'C:\\Program Files\\Git\\usr\\bin\\openssl.exe';
  return existsSync(gitOpenssl) ? gitOpenssl : 'openssl';
}

function makeCertificate() {
  const key = path.join(workDir, 'key.pem');
  const cert = path.join(workDir, 'cert.pem');
  execFileSync(findOpenssl(), [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-keyout', key, '-out', cert,
    '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1',
  ], { stdio: 'ignore' });
  return { key: readFileSync(key), cert: readFileSync(cert) };
}

function idpHandler(req, res) {
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    if (req.url === '/login' && req.method === 'POST' && body === 'user=alice') {
      res.writeHead(302, { 'Set-Cookie': 'idp_session=1; Path=/', Location: '/authorize' });
    } else if (req.url === '/authorize' && req.headers.cookie === 'idp_session=1') {
      res.writeHead(302, { Location: CALLBACK_URL });
    } else if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.write('<form method="post" action="/login"><input name="user" value="alice"></form>');
    } else {
      res.writeHead(400);
    }
    res.end();
  });
}

// Stands in for an unrelated local server (e.g. `npm run dev`) on the app's
// port. The auth code must never reach it.
const realPortHits = [];
const realPort = http.createServer((req, res) => {
  realPortHits.push(req.url);
  res.end('<title>real-port</title>');
});

function listen(server, port = 0) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

async function loginLandsInApp(idpUrl) {
  const ses = session.fromPartition(`protocol-e2e-${Date.now()}-${Math.random()}`);
  // The pass-through's own requests don't raise app 'certificate-error'.
  ses.setCertificateVerifyProc((_request, callback) => callback(0));
  registerAppProtocol(ses, distDir, (request) => forwardWithoutFollowingRedirects(ses, request));

  const win = new BrowserWindow({ show: false, webPreferences: { session: ses } });
  try {
    await win.loadURL(`${idpUrl}/`);
    await win.webContents.executeJavaScript('document.forms[0].submit()');
    // The https redirect lands via an extra page, so wait for the last load.
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline && (win.webContents.getURL() !== CALLBACK_URL || win.webContents.isLoading())) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    assert.equal(win.webContents.getURL(), CALLBACK_URL, idpUrl);
    assert.equal(await win.webContents.executeJavaScript('document.title'), 'served-by-app', idpUrl);
    const cookies = await ses.cookies.get({ name: 'idp_session' });
    assert.equal(cookies.length, 1, idpUrl);
  } finally {
    win.destroy();
  }
}

const servers = [];

// Each case closes its window; don't let that quit the app between cases.
app.on('window-all-closed', () => {});

// The https IdP's certificate is self-signed.
app.on('certificate-error', (event, _webContents, _url, _error, _certificate, callback) => {
  event.preventDefault();
  callback(true);
});

async function run() {
  mkdirSync(distDir);
  writeFileSync(path.join(distDir, 'index.html'), '<title>served-by-app</title>');

  try {
    servers.push(await listen(realPort, 8080));
  } catch {
    console.warn('protocol e2e: port 8080 is busy, skipping the real-port check');
  }

  const httpIdp = await listen(http.createServer(idpHandler));
  const httpsIdp = await listen(https.createServer(makeCertificate(), idpHandler));
  servers.push(httpIdp, httpsIdp);

  await loginLandsInApp(`http://127.0.0.1:${httpIdp.address().port}`);
  await loginLandsInApp(`https://127.0.0.1:${httpsIdp.address().port}`);
  assert.deepEqual(realPortHits, [], 'requests reached the real port 8080');
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
    for (const server of servers) server.close();
    rmSync(workDir, { recursive: true, force: true });
    app.exit(exitCode);
  }
});
