'use client';
import { useEffect, useState } from 'react';
import SetupEditor from './SetupEditor';
import LogoMark from './LogoMark';

type Status = 'loading' | 'in' | 'out';

export default function AdminGate() {
  const [status, setStatus] = useState<Status>('loading');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/admin/me')
      .then((r) => r.json())
      .then((d: { authed: boolean; email: string | null }) => {
        if (d.authed) {
          setEmail(d.email || '');
          setStatus('in');
        } else setStatus('out');
      })
      .catch(() => setStatus('out'));
  }, []);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const d = await res.json();
      if (!res.ok) setErr(d.error || 'Login failed.');
      else {
        setPassword('');
        setStatus('in');
      }
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' }).catch(() => {});
    setStatus('out');
  };

  if (status === 'loading') {
    return <div className="gate"><div className="gate-loading">Checking access…</div></div>;
  }

  if (status === 'in') return <SetupEditor email={email} onLogout={logout} />;

  return (
    <div className="gate">
      <form className="lobby-card gate-card" onSubmit={login}>
        <div className="lobby-head">
          <h1 className="logo">
            <LogoMark size={30} /> Admin
          </h1>
        </div>
        <p className="sub">Sign in to edit starting configurations. Admins only.</p>
        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </label>
        {err && <div className="save-msg err">{err}</div>}
        <button className="btn primary big" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <div className="foot" style={{ marginTop: 14 }}>
          <a href="/" className="foot-link">← Back to game</a>
        </div>
      </form>
    </div>
  );
}
