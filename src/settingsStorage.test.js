import { afterEach, describe, expect, it, vi } from 'vitest';
import { canSaveSecret, loadStoredSettings, saveStoredSettings } from './settingsStorage.js';

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

    await expect(saveStoredSettings({ client_secret: 's' })).resolves.toEqual({ saved: true, secretSaved: false });
    expect(save).toHaveBeenCalledWith({ client_secret: 's' });
    expect(localStorage.getItem('oidc-settings-overrides')).toBeNull();
  });

  it('reports a failed save instead of rejecting', async () => {
    const save = vi.fn().mockRejectedValue(new Error('EPERM: operation not permitted'));
    vi.stubGlobal('window', { oidcApp: { settings: { initial: null, save } } });

    await expect(saveStoredSettings({ client_id: 'a' })).resolves.toEqual({ saved: false, secretSaved: false });
  });

  it('knows at startup whether the secret can be saved', () => {
    vi.stubGlobal('window', { oidcApp: { settings: { initial: null, encryptionAvailable: false, save: vi.fn() } } });
    expect(canSaveSecret()).toBe(false);

    vi.stubGlobal('window', { oidcApp: { settings: { initial: null, encryptionAvailable: true, save: vi.fn() } } });
    expect(canSaveSecret()).toBe(true);
  });
});

describe('in a plain browser (npm run dev)', () => {
  it('round-trips settings through localStorage', async () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', memoryStorage());

    await expect(saveStoredSettings({ client_id: 'b' })).resolves.toEqual({ saved: true, secretSaved: true });
    expect(loadStoredSettings()).toEqual({ client_id: 'b' });
  });

  it('reports a failed save when localStorage throws', async () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', {
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    });

    await expect(saveStoredSettings({ client_id: 'b' })).resolves.toEqual({ saved: false, secretSaved: false });
  });

  it('can always save the secret', () => {
    vi.stubGlobal('window', {});
    expect(canSaveSecret()).toBe(true);
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
