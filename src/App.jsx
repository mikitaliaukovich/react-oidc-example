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
        Oops... {auth.error.kind} caused {auth.error.message}
      </div>
    );
  }

  return (
    <>
      <h1>Test Login</h1>
      <div className="card">
        {!auth.isAuthenticated && (
          <button onClick={auth.signinRedirect} disabled={auth.isLoading}>
            Log In
          </button>
        )}
        <p>{auth.user?.profile.email}</p>
        {auth.user?.access_token && (
          <pre className="text-left">
            {JSON.stringify(decodeJwt(auth.user?.access_token), null, 2)}
          </pre>
        )}
        {auth.isAuthenticated && (
          <button onClick={auth.signoutSilent}>Log Out</button>
        )}
      </div>
    </>
  );
}

export default App;
