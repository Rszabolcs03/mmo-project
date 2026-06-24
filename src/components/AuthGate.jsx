import { Cloud } from 'lucide-react';

export { AuthGate };

function AuthGate({
  authForm,
  authMode,
  authStatus,
  firebaseReady,
  onAuthChange,
  onAuthModeChange,
  onAuthSubmit,
  rememberLogin,
  onRememberLoginChange,
}) {
  const isRegister = authMode === 'register';

  return (
    <main className="auth-screen">
      <form className="auth-card" onSubmit={(event) => {
        event.preventDefault();
        onAuthSubmit(authMode);
      }}>
        <div>
          <p className="eyebrow">Top-Down MMO Prototype</p>
          <h1>{isRegister ? 'Create Account' : 'Login'}</h1>
        </div>
        <div className="auth-status">
          <Cloud size={18} />
          <span>{authStatus}</span>
        </div>
        <label className="auth-field">
          <span>Email</span>
          <input
            autoComplete="email"
            disabled={!firebaseReady}
            value={authForm.email}
            onChange={(event) => onAuthChange({ ...authForm, email: event.target.value })}
            placeholder="you@example.com"
          />
        </label>
        <label className="auth-field">
          <span>Password</span>
          <input
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            disabled={!firebaseReady}
            type="password"
            value={authForm.password}
            onChange={(event) => onAuthChange({ ...authForm, password: event.target.value })}
            placeholder="Minimum 6 characters"
          />
        </label>
        {!isRegister && (
          <label className="auth-remember">
            <input
              checked={rememberLogin}
              disabled={!firebaseReady}
              type="checkbox"
              onChange={(event) => onRememberLoginChange(event.target.checked)}
            />
            <span>Remember login email</span>
          </label>
        )}
        <button className="auth-submit" disabled={!firebaseReady} type="submit">
          {isRegister ? 'Register' : 'Login'}
        </button>
        <button
          className="auth-switch"
          disabled={!firebaseReady}
          type="button"
          onClick={() => onAuthModeChange(isRegister ? 'login' : 'register')}
        >
          {isRegister ? 'Already verified? Login' : 'Need an account? Register'}
        </button>
      </form>
    </main>
  );
}
