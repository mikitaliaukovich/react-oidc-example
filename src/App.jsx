import { useEffect } from 'react';
import { useAuth } from 'react-oidc-context';
import './App.css';
import { decodeJwt } from 'jose';

function App() {
  const auth = useAuth();

  // onSigninCallback only runs on success. After a failed sign-in the IdP
  // response stays in the URL, and the next AuthProvider mount (e.g. after
  // editing settings) would process it again, so remove it here.
  useEffect(() => {
    if (auth.error) {
      window.history.replaceState({}, document.title, window.location.origin + import.meta.env.BASE_URL);
    }
  }, [auth.error]);

  switch (auth.activeNavigator) {
    case 'signinSilent':
      return <div>Signing you in...</div>;
    case 'signoutRedirect':
      return <div>Signing you out...</div>;
  }

  if (auth.isLoading) {
    return <div>Loading...</div>;
  }

  if (auth.error) {
    return (
      <div>
        <p>Oops... Error caused by "{auth.error.message}".</p>
        <p>Try logging out using the button below.</p>
        <button onClick={() => auth.signoutRedirect()}>Log Out</button>
      </div>
    );
  }

  let decodedToken = null;
  if (auth.user?.access_token) {
    try {
      decodedToken = decodeJwt(auth.user.access_token);
      console.log('Decoded Access Token:', decodedToken);
    } catch (error) {
      console.error('Failed to decode access token:', error);
    }
  }

  return (
    <>
      <div className="card">
        {!auth.isAuthenticated && (
          <>
            <h1>Welcome to the React OIDC client example!</h1>
            <p>
              Please configure your OIDC settings using the <code>Edit Settings</code> button above and log in.
            </p>
            <br />
            <br />
            <button onClick={() => auth.signinRedirect()} disabled={auth.isLoading}>
              Log In
            </button>
          </>
        )}

        <h2>{auth.user?.profile.email}</h2>

        {auth.isAuthenticated && !decodedToken && (
          <>
            <p>
              You have successfully authenticated, but the access token could not be parsed. Set allowed API in the application settings to
              make the token parseable.
            </p>
            <p>ID token is available below:</p>

            <pre className="pre-block">{auth.user?.id_token}</pre>
          </>
        )}

        {decodedToken && <pre className="text-left">{JSON.stringify(decodedToken, null, 2)}</pre>}
        {auth.isAuthenticated && <button onClick={() => auth.signoutRedirect()}>Log Out</button>}
      </div>
    </>
  );
}

export default App;
