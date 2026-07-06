import { useAuth } from 'react-oidc-context';
import './App.css';
import { decodeJwt } from 'jose';

function App() {
  const auth = useAuth();

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
        Oops... {auth.error.kind}. Caused by "{auth.error.message}".
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
            <button onClick={auth.signinRedirect} disabled={auth.isLoading}>
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
        {auth.isAuthenticated && <button onClick={auth.signoutRedirect}>Log Out</button>}
      </div>
    </>
  );
}

export default App;
