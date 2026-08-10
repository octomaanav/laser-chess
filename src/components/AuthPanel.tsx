'use client';
import { useState } from 'react';
import type { Providers, SessionUser } from '@/client/useSession';
import LogoMark from './LogoMark';

type Mode = 'signin' | 'signup';

export default function AuthPanel({
  providers,
  onAuthed,
  onClose,
}: {
  providers: Providers;
  onAuthed: (user: SessionUser) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>('signin');
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const hasOAuth = providers.google || providers.github;
  // Come back to whatever page opened the panel (lobby, account, …).
  const returnTo = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const url = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
      const body = mode === 'signup' ? { email, username, displayName, password } : { emailOrUsername, password };
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) setErr(d.error || 'Something went wrong.');
      else onAuthed(d.user);
    } catch {
      setErr('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-overlay" onClick={onClose}>
      <form className="lobby-card auth-card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="lobby-head">
          <h1 className="logo">
            <LogoMark size={28} /> {mode === 'signup' ? 'Create account' : 'Sign in'}
          </h1>
          <button type="button" className="auth-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="sub">Accounts are for online matchmaking. You can still play quick games without one.</p>

        {hasOAuth && (
          <>
            <div className="oauth-buttons">
              {providers.google && (
                <a className="btn oauth" href={`/api/auth/oauth/google?returnTo=${encodeURIComponent(returnTo)}`}>
                  Continue with Google
                </a>
              )}
              {providers.github && (
                <a className="btn oauth" href={`/api/auth/oauth/github?returnTo=${encodeURIComponent(returnTo)}`}>
                  Continue with GitHub
                </a>
              )}
            </div>
            <div className="or">
              <span>or with email</span>
            </div>
          </>
        )}

        {mode === 'signup' ? (
          <>
            <label className="field">
              <span>Email</span>
              <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </label>
            <div className="row2">
              <label className="field">
                <span>Username</span>
                <input type="text" autoComplete="username" maxLength={20} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@handle" />
              </label>
              <label className="field">
                <span>Display name</span>
                <input type="text" maxLength={24} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Shown in games" />
              </label>
            </div>
            <label className="field">
              <span>Password</span>
              <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
            </label>
          </>
        ) : (
          <>
            <label className="field">
              <span>Email or username</span>
              <input type="text" autoComplete="username" value={emailOrUsername} onChange={(e) => setEmailOrUsername(e.target.value)} placeholder="you@example.com" />
            </label>
            <label className="field">
              <span>Password</span>
              <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </label>
          </>
        )}

        {err && <div className="save-msg err">{err}</div>}
        <button className="btn primary big" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>

        <button type="button" className="link" onClick={() => (setErr(''), setMode(mode === 'signup' ? 'signin' : 'signup'))}>
          {mode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}
        </button>
      </form>
    </div>
  );
}
