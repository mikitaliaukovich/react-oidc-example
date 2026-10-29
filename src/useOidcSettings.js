import { useState } from 'react';
import { oidcConfig } from './oidc.config.js';
import { loadStoredSettings, saveStoredSettings } from './settingsStorage.js';

// Client authentication methods selectable in the UI. `none` leaves the auth
// config untouched (public client), the others set `client_authentication` so
// oidc-client-ts sends the credentials in the body or the Authorization header.
export const AUTH_METHODS = [
  { value: 'none', label: 'None' },
  { value: 'client_secret_post', label: 'ClientSecretPost' },
  { value: 'client_secret_basic', label: 'ClientSecretBasic' },
];

function loadInitialSettings() {
  const defaults = {
    authority: oidcConfig.authority,
    client_id: oidcConfig.client_id,
    client_secret: oidcConfig.client_secret,
    client_auth_method: oidcConfig.client_authentication ?? 'none',
    scope: oidcConfig.scope,
    audience: oidcConfig.extraQueryParams?.audience ?? '',
    tenantId: oidcConfig.extraQueryParams?.tenantId ?? '',
  };

  const stored = loadStoredSettings();
  return stored ? { ...defaults, ...stored } : defaults;
}

export function useOidcSettings() {
  const [settings, setSettings] = useState(loadInitialSettings);
  const [secretNotSaved, setSecretNotSaved] = useState(false);

  function setField(field, value) {
    const next = { ...settings, [field]: value };
    setSettings(next);
    saveStoredSettings(next).then(({ secretSaved }) => setSecretNotSaved(!secretSaved));
  }

  function buildAuthProviderConfig() {
    const { audience, tenantId, client_auth_method, ...rest } = settings;
    return {
      ...oidcConfig,
      ...rest,
      // `none` keeps the config as-is; anything else pins the method explicitly.
      ...(client_auth_method !== 'none' && {
        client_authentication: client_auth_method,
      }),
      extraQueryParams: {
        ...(audience && { audience }),
        ...(tenantId && { tenantId }),
      },
    };
  }

  return { settings, setField, secretNotSaved, buildAuthProviderConfig };
}
