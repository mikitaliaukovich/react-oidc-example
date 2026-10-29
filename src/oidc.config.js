import { WebStorageStateStore } from 'oidc-client-ts';

// Configuration for the OIDC authentication
export const oidcConfig = {
  // Set Authority to your Auth service URL
  authority: 'https://iam.dev.company.cloud/staging/auth',
  // Set Client ID to the Application ID
  client_id: 'UUm8tH9GqEhyxxxxxxx8etO8iL6WGtv',

  // Set Client Secret to Application Secret
  // !(for testing only, do not use ClientSecret auth in frontend apps)
  client_secret: '',

  // Set Redirect URI to your application's redirect URI
  redirect_uri: window.location.origin + import.meta.env.BASE_URL,
  // Set Allowed Logount URI to your application's settings
  post_logout_redirect_uri: window.location.origin + import.meta.env.BASE_URL,

  response_type: 'code',
  // Scope can be edited
  scope: 'openid email profile',
  automaticSilentRenew: true,

  extraQueryParams: {
    // Pass API audience parameter if needed
    // Pass tenantId parameter if you don't need multi-tenant login and just want to log in to the specific organization
    // audience: '',
    // tenantId: '',
  },

  // Using sessionStorage so the session ends when the window closes
  userStore: new WebStorageStateStore({ store: window.sessionStorage }),

  onSigninCallback: () => {
    // Remove the auth params from the URL after successful login
    window.history.replaceState({}, document.title, window.location.origin + import.meta.env.BASE_URL);
  },
};
