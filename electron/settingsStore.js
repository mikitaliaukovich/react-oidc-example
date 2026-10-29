import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Persists the OIDC settings for the next launch. With encryption available
// (DPAPI on Windows) the whole object is encrypted; without it the client
// secret is dropped rather than written to disk in plain text.
export function createSettingsStore({ filePath, safeStorage }) {
  function encryptionAvailable() {
    return safeStorage.isEncryptionAvailable();
  }

  function load() {
    try {
      const stored = JSON.parse(readFileSync(filePath, 'utf8'));
      if (typeof stored.encrypted === 'string') {
        return JSON.parse(safeStorage.decryptString(Buffer.from(stored.encrypted, 'base64')));
      }
      return stored.plain ?? null;
    } catch {
      return null;
    }
  }

  function save(settings) {
    mkdirSync(path.dirname(filePath), { recursive: true });

    if (encryptionAvailable()) {
      const encrypted = safeStorage.encryptString(JSON.stringify(settings)).toString('base64');
      writeFileSync(filePath, JSON.stringify({ encrypted }));
      return { secretSaved: true };
    }

    const { client_secret, ...plain } = settings;
    writeFileSync(filePath, JSON.stringify({ plain }));
    return { secretSaved: !client_secret };
  }

  return { load, save, encryptionAvailable };
}
