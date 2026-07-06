import { useState } from 'react';
import { oidcConfig } from './oidc.config.js';

const STORAGE_KEY = 'oidc-settings-overrides';

function loadInitialSettings() {
  const defaults = {
    authority: oidcConfig.authority,
    client_id: oidcConfig.client_id,
    client_secret: oidcConfig.client_secret,
    scope: oidcConfig.scope,
    audience: oidcConfig.extraQueryParams?.audience ?? '',
    tenantId: oidcConfig.extraQueryParams?.tenantId ?? '',
  };

  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return stored ? { ...defaults, ...stored } : defaults;
  } catch {
    return defaults;
  }
}

export function useOidcSettings() {
  const [settings, setSettings] = useState(loadInitialSettings);

  function setField(field, value) {
    setSettings((prev) => {
      const next = { ...prev, [field]: value };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function buildAuthProviderConfig() {
    const { audience, tenantId, ...rest } = settings;
    return {
      ...oidcConfig,
      ...rest,
      extraQueryParams: {
        ...(audience && { audience }),
        ...(tenantId && { tenantId }),
      },
    };
  }

  return { settings, setField, buildAuthProviderConfig };
}
