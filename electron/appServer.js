import { readFile } from 'node:fs/promises';
import path from 'node:path';

// The app keeps the same URL as `npm run dev`, so one redirect URI
// registration at the IdP covers both the desktop app and local development.
export const APP_ORIGIN = 'http://localhost:8080';
export const APP_BASE = '/react-oidc-example/';
export const APP_URL = APP_ORIGIN + APP_BASE;

// The authority is user-supplied, so OIDC discovery and token calls may go to
// any host, and silent renew frames the IdP's authorize page. Scripts and
// styles stay limited to the app itself.
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "frame-src 'self' http: https:",
  "frame-ancestors 'self'",
  'connect-src *',
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

export function isAppUrl(url) {
  try {
    return new URL(url).origin === APP_ORIGIN;
  } catch {
    return false;
  }
}

// Maps an app URL to a file inside distDir. Paths without an extension fall
// back to index.html; anything outside the base path or distDir is rejected.
export function resolveAppFile(distDir, url) {
  if (!isAppUrl(url)) return null;

  const { pathname } = new URL(url);
  if (!pathname.startsWith(APP_BASE)) return null;

  let relativePath;
  try {
    relativePath = decodeURIComponent(pathname.slice(APP_BASE.length));
  } catch {
    return null;
  }

  const root = path.resolve(distDir);
  const filePath = path.resolve(root, relativePath);
  if (filePath !== root && !filePath.startsWith(root + path.sep)) return null;

  if (filePath === root || !path.extname(filePath)) {
    return path.join(root, 'index.html');
  }
  return filePath;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

// Chromium only runs a redirect through the protocol handlers when it stays
// on the same scheme. An https IdP's redirect to the (http) app URL would go
// to whatever really listens on localhost:8080 instead: nothing, so a blank
// window, or another program, which would get the auth code. Such redirects
// become a page that navigates to the app itself, and a new navigation does
// go through the handlers. Other headers (Set-Cookie) are kept as they are.
export async function keepRedirectsToAppInside(request, response) {
  if (!REDIRECT_STATUSES.has(response.status)) return response;

  const location = response.headers.get('location');
  let target;
  try {
    target = new URL(location, request.url).href;
  } catch {
    return response;
  }
  if (!isAppUrl(target) || new URL(request.url).protocol === 'http:') return response;

  const headers = new Headers(response.headers);
  headers.delete('location');
  headers.delete('content-length');
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Content-Security-Policy', "default-src 'none'");
  headers.set('Cache-Control', 'no-store');
  const body = `<!doctype html><meta http-equiv="refresh" content="0;url=${escapeHtml(target)}">`;
  return new Response(body, { status: 200, headers });
}

// Answers app URLs from distDir inside the given session instead of opening a
// real port. Every other http(s) request is handed to `forward`, which must
// return redirects instead of following them; https is handled only so that
// its redirects to the app can be caught (see keepRedirectsToAppInside).
export function registerAppProtocol(ses, distDir, forward) {
  ses.protocol.handle('https', async (request) => keepRedirectsToAppInside(request, await forward(request)));
  ses.protocol.handle('http', async (request) => {
    if (!isAppUrl(request.url)) return forward(request);

    const filePath = resolveAppFile(distDir, request.url);
    if (!filePath) return new Response('Not found', { status: 404 });

    try {
      const body = await readFile(filePath);
      return new Response(body, {
        headers: {
          'Content-Type': CONTENT_TYPES[path.extname(filePath)] ?? 'application/octet-stream',
          'Content-Security-Policy': CONTENT_SECURITY_POLICY,
        },
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}
