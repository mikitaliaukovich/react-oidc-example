import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_URL, CONTENT_SECURITY_POLICY, isAppUrl, keepRedirectsToAppInside, resolveAppFile } from './appServer.js';

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

describe('CONTENT_SECURITY_POLICY', () => {
  const directives = Object.fromEntries(
    CONTENT_SECURITY_POLICY.split(';').map((directive) => {
      const [name, ...values] = directive.trim().split(/\s+/);
      return [name, values];
    }),
  );

  it("lets silent renew frame the user-supplied IdP's authorize page", () => {
    expect(directives['frame-src']).toEqual(expect.arrayContaining(["'self'", 'http:', 'https:']));
  });

  it('only lets the app frame itself', () => {
    expect(directives['frame-ancestors']).toEqual(["'self'"]);
  });
});

describe('keepRedirectsToAppInside', () => {
  const callback = `${APP_URL}?code=abc&state=xyz`;
  const fromIdp = new Request('https://idp.example/authorize');

  function redirect(location, headers = {}) {
    return new Response(null, { status: 302, headers: { Location: location, ...headers } });
  }

  it('turns an https redirect to the app into a page that navigates there', async () => {
    const response = await keepRedirectsToAppInside(fromIdp, redirect(callback, { 'Set-Cookie': 'sid=1' }));

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('set-cookie')).toBe('sid=1');
    expect(await response.text()).toContain(`content="0;url=${APP_URL}?code=abc&#38;state=xyz"`);
  });

  it('leaves redirects elsewhere alone', async () => {
    const original = redirect('https://idp.example/login');

    expect(await keepRedirectsToAppInside(fromIdp, original)).toBe(original);
  });

  it('leaves http redirects alone, they reach the app by themselves', async () => {
    const original = redirect(callback);

    expect(await keepRedirectsToAppInside(new Request('http://idp.example/authorize'), original)).toBe(original);
  });

  it('leaves other responses alone', async () => {
    const original = new Response('ok');

    expect(await keepRedirectsToAppInside(fromIdp, original)).toBe(original);
  });
});
