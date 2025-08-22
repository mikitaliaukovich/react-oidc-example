import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

import { WebStorageStateStore } from 'oidc-client-ts';
import { AuthProvider } from 'react-oidc-context';

// Configuration for the OIDC authentication
export const oidcConfig = {
  // Set Authority to your Auth service URL
  authority: 'https://sh-global-test-eus2-00.qa.example.com/auth-qa',
  // Set Client ID to the Application ID
  client_id: 'hnc7vaJmQAQBKOE9Mcd5a6Jvc12frvzv',

  // Set Client Secret to Application Secret
  // !(for testing only, do not use ClientSecret auth in frontend apps)
  client_secret:
    'appv_ipqA5uuna38UdfNxxxxxxxxxxxxxxxobM_fvi50bCd_B-bD9xsoM4CDI8Z',

  // Set Redirect URI to your application's redirect URI
  redirect_uri: 'http://localhost:5173/test2',

  response_type: 'code',
  // Scope can be edited
  scope: 'openid email profile',
  automaticSilentRenew: true,

  extraQueryParams: {
    // Pass API audience parameter if needed
    // Pass tenantId parameter if you don't need multi-tenant login and just want to log in to the specific organization
    audience: '',
    tenantId: '',
  },

  // Using localStorage to persist the session
  userStore: new WebStorageStateStore({ store: window.localStorage }),

  onSigninCallback: () => {
    // Remove the auth params from the URL after successful login
    window.history.replaceState({}, document.title, 'http://localhost:5173/');
  },

  onerror: (error) => {
    // Handle errors during authentication
    console.error('Authentication error:', error);
    window.history.replaceState({}, document.title, 'http://localhost:5173/');
  },
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider {...oidcConfig}>
      <App />
    </AuthProvider>
  </StrictMode>
);
