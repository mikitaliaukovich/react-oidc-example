import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadStoredSettings, saveStoredSettings } from './settingsStorage.js';

function memoryStorage() {
  const items = new Map();
  return {
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => items.set(key, String(value)),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('in the desktop app', () => {
  it('loads the settings the main process handed to the preload', () => {
    vi.stubGlobal('window', { oidcApp: { settings: { initial: { client_id: 'a' }, save: vi.fn() } } });
    vi.stubGlobal('localStorage', memoryStorage());

    expect(loadStoredSettings()).toEqual({ client_id: 'a' });
  });

  it('saves through the bridge and never touches localStorage', async () => {
    const save = vi.fn().mockResolvedValue({ secretSaved: false });
    const localStorage = memoryStorage();
    vi.stubGlobal('window', { oidcApp: { settings: { initial: null, save } } });
    vi.stubGlobal('localStorage', localStorage);

    await expect(saveStoredSettings({ client_secret: 's' })).resolves.toEqual({ secretSaved: false });
    expect(save).toHaveBeenCalledWith({ client_secret: 's' });
    expect(localStorage.getItem('oidc-settings-overrides')).toBeNull();
  });
});

describe('in a plain browser (npm run dev)', () => {
  it('round-trips settings through localStorage', async () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', memoryStorage());

    await expect(saveStoredSettings({ client_id: 'b' })).resolves.toEqual({ secretSaved: true });
    expect(loadStoredSettings()).toEqual({ client_id: 'b' });
  });

  it('returns null for missing or corrupt settings', () => {
    const localStorage = memoryStorage();
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', localStorage);

    expect(loadStoredSettings()).toBeNull();
    localStorage.setItem('oidc-settings-overrides', '{oops');
    expect(loadStoredSettings()).toBeNull();
  });
});
