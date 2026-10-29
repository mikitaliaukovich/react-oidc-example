const STORAGE_KEY = 'oidc-settings-overrides';

// In the desktop app the preload exposes `window.oidcApp`, and settings are
// kept encrypted by the main process. In a plain browser (`npm run dev`) they
// fall back to localStorage on the developer's own localhost origin.
function desktopBridge() {
  return window.oidcApp?.settings;
}

export function loadStoredSettings() {
  const bridge = desktopBridge();
  if (bridge) return bridge.initial ?? null;

  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

// False when the desktop app can't encrypt (no DPAPI), so it won't keep the
// client secret across restarts.
export function canSaveSecret() {
  return desktopBridge()?.encryptionAvailable ?? true;
}

export async function saveStoredSettings(settings) {
  try {
    const bridge = desktopBridge();
    if (bridge) {
      const { secretSaved } = await bridge.save(settings);
      return { saved: true, secretSaved };
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    return { saved: true, secretSaved: true };
  } catch {
    return { saved: false, secretSaved: false };
  }
}
