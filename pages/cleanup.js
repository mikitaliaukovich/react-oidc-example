// Removes what the old GitHub Pages build of the app left in the browser.
// mikitaliaukovich.github.io is shared by every Pages project of the owner,
// so only this app's own entries are removed, never the whole origin.
const SETTINGS_KEY = 'oidc-settings-overrides';
const OIDC_CLIENT_PREFIX = 'oidc.';
const APP_PATHS = ['/react-oidc-example/', '/react-oidc-example'];

function isOldAppKey(key) {
  return key === SETTINGS_KEY || key.startsWith(OIDC_CLIENT_PREFIX);
}

function cookieNames(cookieString) {
  return cookieString
    .split(';')
    .map((cookie) => cookie.split('=')[0].trim())
    .filter(Boolean);
}

export function removeOldAppData({ storages, getCookies, setCookie }) {
  let removed = 0;

  for (const storage of storages) {
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
    for (const key of keys.filter(isOldAppKey)) {
      storage.removeItem(key);
      removed++;
    }
  }

  const namesBefore = cookieNames(getCookies());
  for (const name of namesBefore) {
    for (const path of APP_PATHS) {
      setCookie(`${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}`);
    }
  }
  const namesAfter = new Set(cookieNames(getCookies()));
  removed += namesBefore.filter((name) => !namesAfter.has(name)).length;

  return removed;
}
