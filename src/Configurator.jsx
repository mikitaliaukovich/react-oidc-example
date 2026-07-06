import { useState } from 'react';
import { AuthProvider } from 'react-oidc-context';
import './App.css';
import App from './App.jsx';
import { useOidcSettings } from './useOidcSettings.js';

const FORM_FIELDS = [
  { key: 'authority', label: 'Authority', required: true },
  { key: 'client_id', label: 'Client ID', required: true },
  { key: 'client_secret', label: 'Client Secret', secret: true },
  { key: 'scope', label: 'Scope' },
  { key: 'audience', label: 'Audience' },
  { key: 'tenantId', label: 'Tenant ID' },
];

// The IdP redirects back to this same URL with ?code&state (success) or
// ?error (failure) in the query string. AuthProvider must mount to process
// that response, so the settings gate has to be skipped on that load.
function hasAuthResponseInUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.has('code') || params.has('state') || params.has('error');
}

function Configurator() {
  const { settings, setField, buildAuthProviderConfig } = useOidcSettings();
  const [started, setStarted] = useState(hasAuthResponseInUrl);
  const [showSecret, setShowSecret] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const canProceed = Boolean(settings.authority && settings.client_id);

  function handleProceed() {
    if (!canProceed) {
      setShowValidation(true);
      return;
    }
    setStarted(true);
  }

  if (started) {
    return (
      <>
        <div className="card">
          <button onClick={() => setStarted(false)}>Edit Settings</button>
        </div>
        <AuthProvider
          key={JSON.stringify(settings)}
          {...buildAuthProviderConfig()}
        >
          <App />
        </AuthProvider>
      </>
    );
  }

  return (
    <div className="card">
      <h1>Configure OIDC Settings</h1>
      <form
        className="text-left"
        onSubmit={(e) => {
          e.preventDefault();
          handleProceed();
        }}
      >
        {FORM_FIELDS.map(({ key, label, required, secret }) => (
          <div key={key} style={{ marginBottom: '0.75rem' }}>
            <label htmlFor={key}>
              {label}
              {required ? ' *' : ''}
            </label>
            <br />
            <input
              id={key}
              type={secret && !showSecret ? 'password' : 'text'}
              value={settings[key] ?? ''}
              onChange={(e) => setField(key, e.target.value)}
              style={{ width: '100%' }}
            />
            {secret && (
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
              >
                {showSecret ? 'Hide' : 'Show'}
              </button>
            )}
          </div>
        ))}

        {showValidation && !canProceed && (
          <p style={{ color: 'red' }}>
            Authority and Client ID are required.
          </p>
        )}

        <button type="submit">Proceed to Login Testing</button>
      </form>
    </div>
  );
}

export default Configurator;
