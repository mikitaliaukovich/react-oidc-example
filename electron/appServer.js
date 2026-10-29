import { readFile } from 'node:fs/promises';
import path from 'node:path';

// The app keeps the same URL as `npm run dev`, so one redirect URI
// registration at the IdP covers both the desktop app and local development.
export const APP_ORIGIN = 'http://localhost:8080';
export const APP_BASE = '/react-oidc-example/';
export const APP_URL = APP_ORIGIN + APP_BASE;

// The authority is user-supplied, so OIDC discovery and token calls may go to
// any host. Scripts, styles and frames stay limited to the app itself.
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "frame-src 'self'",
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

// Answers app URLs from distDir inside the given session instead of opening a
// real port. Every other http request is handed to `forward`.
export function registerAppProtocol(ses, distDir, forward) {
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
