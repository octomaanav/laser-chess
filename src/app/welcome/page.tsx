'use client';
import { useEffect, useState } from 'react';
import { useSession } from '@/client/useSession';
import LogoMark from '@/components/LogoMark';

// First-run onboarding after an OAuth sign-in: let the new user choose their own
// @username (pre-filled with a suggestion) instead of keeping the email-derived one.
export default function WelcomePage() {
  const { user, loading, setUser } = useSession();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [returnTo, setReturnTo] = useState('/');

  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get('returnTo');
    setReturnTo(r && r.startsWith('/') && !r.startsWith('//') ? r : '/');
  }, []);

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setDisplayName(user.displayName);
    }
  }, [user]);

  const finish = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, displayName }),
      });
      const d = await res.json();
      if (!res.ok) setErr(d.error || 'Could not save. Try another username.');
      else {
        setUser(d.user);
        window.location.href = returnTo;
      }
    } catch {
      setErr('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="gate"><div className="gate-loading">Setting up your account…</div></div>;
  if (!user) {
    if (typeof window !== 'undefined') window.location.href = '/';
    return null;
  }

  return (
    <div className="gate">
      <form className="lobby-card gate-card" onSubmit={finish}>
        <div className="lobby-head">
          <h1 className="logo">
            <LogoMark size={30} /> Welcome!
          </h1>
        </div>
        <p className="sub">Pick a username — this is how other players will find you. You can change it later in Account.</p>

        <label className="field">
          <span>Username</span>
          <input
            type="text"
            autoFocus
            maxLength={20}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="@handle"
          />
          <small className="field-hint">3–20 characters · letters, numbers, and underscores.</small>
        </label>
        <label className="field">
          <span>Display name</span>
          <input type="text" maxLength={24} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Shown in games" />
        </label>

        {err && <div className="save-msg err">{err}</div>}
        <button className="btn primary big" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
