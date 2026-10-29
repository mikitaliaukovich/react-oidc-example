import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSettingsStore } from './settingsStore.js';

// Reversible stand-in for Electron's safeStorage (DPAPI on Windows).
function fakeSafeStorage(available = true) {
  return {
    isEncryptionAvailable: () => available,
    encryptString: (text) => Buffer.from(text, 'utf8').reverse(),
    decryptString: (buffer) => Buffer.from(buffer).reverse().toString('utf8'),
  };
}

const SETTINGS = {
  authority: 'https://idp.example',
  client_id: 'client-1',
  client_secret: 'super-secret-value',
};

let dir;
let filePath;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'settings-store-'));
  filePath = path.join(dir, 'settings.json');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('createSettingsStore', () => {
  it('round-trips settings including the client secret', () => {
    const store = createSettingsStore({ filePath, safeStorage: fakeSafeStorage() });

    expect(store.save(SETTINGS)).toEqual({ secretSaved: true });
    expect(store.load()).toEqual(SETTINGS);
  });

  it('never writes the client secret to disk in plain text', () => {
    const store = createSettingsStore({ filePath, safeStorage: fakeSafeStorage() });
    store.save(SETTINGS);

    expect(readFileSync(filePath, 'utf8')).not.toContain('super-secret-value');
  });

  it('drops only the secret when encryption is unavailable', () => {
    const store = createSettingsStore({ filePath, safeStorage: fakeSafeStorage(false) });

    expect(store.encryptionAvailable()).toBe(false);
    expect(store.save(SETTINGS)).toEqual({ secretSaved: false });
    expect(readFileSync(filePath, 'utf8')).not.toContain('super-secret-value');
    expect(store.load()).toEqual({ authority: 'https://idp.example', client_id: 'client-1' });
  });

  it('reports secretSaved when there is no secret to drop', () => {
    const store = createSettingsStore({ filePath, safeStorage: fakeSafeStorage(false) });

    expect(store.save({ authority: 'https://idp.example', client_secret: '' })).toEqual({ secretSaved: true });
  });

  it('returns null when the file is missing', () => {
    const store = createSettingsStore({ filePath, safeStorage: fakeSafeStorage() });

    expect(store.load()).toBeNull();
  });

  it('returns null when the file is corrupt', () => {
    writeFileSync(filePath, 'not json {');
    const store = createSettingsStore({ filePath, safeStorage: fakeSafeStorage() });

    expect(store.load()).toBeNull();
  });

  it('returns null when the encrypted payload cannot be decrypted', () => {
    writeFileSync(filePath, JSON.stringify({ encrypted: 'AAAA' }));
    const safeStorage = {
      ...fakeSafeStorage(),
      decryptString: () => {
        throw new Error('Error while decrypting the ciphertext');
      },
    };
    const store = createSettingsStore({ filePath, safeStorage });

    expect(store.load()).toBeNull();
  });
});
