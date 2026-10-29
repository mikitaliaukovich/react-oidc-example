import { describe, expect, it } from 'vitest';
import { removeOldAppData } from './cleanup.js';

function fakeStorage(entries) {
  const items = new Map(Object.entries(entries));
  return {
    get length() {
      return items.size;
    },
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => items.delete(key),
    keys: () => [...items.keys()],
  };
}

// Simulates document.cookie: an expiring write only removes a cookie when its
// path matches the path the cookie was set with.
function fakeCookieJar(cookies) {
  const jar = new Map(Object.entries(cookies));
  return {
    getCookies: () => [...jar.keys()].map((name) => `${name}=${jar.get(name).value}`).join('; '),
    setCookie: (cookie) => {
      const name = cookie.split('=')[0];
      const path = /path=([^;]*)/.exec(cookie)?.[1];
      if (jar.get(name)?.path === path && /expires=Thu, 01 Jan 1970/.test(cookie)) jar.delete(name);
    },
    names: () => [...jar.keys()],
  };
}

describe('removeOldAppData', () => {
  it("removes only this app's keys from every storage", () => {
    const local = fakeStorage({ 'oidc-settings-overrides': '{}', 'oidc.user:https://idp:client': '{}', highscore: '42' });
    const session = fakeStorage({ 'oidc.abc123': '{}', 'formatter-draft': 'x' });

    const removed = removeOldAppData({ storages: [local, session], ...fakeCookieJar({}) });

    expect(removed).toBe(3);
    expect(local.keys()).toEqual(['highscore']);
    expect(session.keys()).toEqual(['formatter-draft']);
  });

  it("removes cookies on the app's path and leaves site-wide cookies alone", () => {
    const jar = fakeCookieJar({
      appCookie: { value: '1', path: '/react-oidc-example/' },
      siteCookie: { value: '2', path: '/' },
    });

    const removed = removeOldAppData({ storages: [], ...jar });

    expect(removed).toBe(1);
    expect(jar.names()).toEqual(['siteCookie']);
  });

  it('returns 0 when there is nothing to remove', () => {
    expect(removeOldAppData({ storages: [fakeStorage({})], ...fakeCookieJar({}) })).toBe(0);
  });
});
