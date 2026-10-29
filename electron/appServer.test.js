import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_URL, isAppUrl, resolveAppFile } from './appServer.js';

const distDir = path.resolve('/app/dist');

describe('resolveAppFile', () => {
  it('serves index.html for the app root', () => {
    expect(resolveAppFile(distDir, APP_URL)).toBe(path.join(distDir, 'index.html'));
  });

  it('serves built assets from dist', () => {
    expect(resolveAppFile(distDir, `${APP_URL}assets/x.js`)).toBe(path.join(distDir, 'assets', 'x.js'));
  });

  it('falls back to index.html for routes without an extension', () => {
    expect(resolveAppFile(distDir, `${APP_URL}some/route`)).toBe(path.join(distDir, 'index.html'));
  });

  it('rejects encoded path traversal out of dist', () => {
    expect(resolveAppFile(distDir, `${APP_URL}%2e%2e/%2e%2e/x`)).toBeNull();
    expect(resolveAppFile(distDir, `${APP_URL}..%2f..%2fsecret.txt`)).toBeNull();
    expect(resolveAppFile(distDir, `${APP_URL}..%5c..%5csecret.txt`)).toBeNull();
  });

  it('rejects paths outside the app base', () => {
    expect(resolveAppFile(distDir, 'http://localhost:8080/other')).toBeNull();
  });
});

describe('isAppUrl', () => {
  it('accepts the app origin', () => {
    expect(isAppUrl('http://localhost:8080/react-oidc-example/')).toBe(true);
  });

  it('rejects IdP pages and other ports', () => {
    expect(isAppUrl('https://idp.example/login')).toBe(false);
    expect(isAppUrl('http://localhost:8081/')).toBe(false);
  });

  it('rejects values that are not URLs', () => {
    expect(isAppUrl('')).toBe(false);
    expect(isAppUrl(undefined)).toBe(false);
  });
});
