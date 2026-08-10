'use client';
import { useEffect, useState } from 'react';
import { useSession } from '@/client/useSession';
import AuthPanel from '@/components/AuthPanel';
import LogoMark from '@/components/LogoMark';

const PROVIDER_LABELS: Record<string, string> = { google: 'Google', github: 'GitHub' };

export default function AccountPage() {
  const { user, providers, loading, refresh, logout, setUser } = useSession();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [linked, setLinked] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ text: string; err: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  // Load the editable fields + linked providers whenever the signed-in user changes.
  useEffect(() => {
    if (!user) return;
    setUsername(user.username);
    setDisplayName(user.displayName);
    fetch('/api/auth/profile', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { linked?: string[] } | null) => d?.linked && setLinked(d.linked))
      .catch(() => {});
  }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, displayName }),
      });
      const d = await res.json();
      if (!res.ok) setMsg({ text: d.error || 'Could not save.', err: true });
      else {
        setUser(d.user);
        setMsg({ text: 'Saved.', err: false });
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="gate"><div className="gate-loading">Checking access…</div></div>;

  if (!user) {
    return <AuthPanel providers={providers} onAuthed={(u) => setUser(u)} onClose={() => { window.location.href = '/'; }} />;
  }

  const linkable = (['google', 'github'] as const).filter((p) => providers[p] && !linked.includes(p));

  return (
    <div className="gate">
      <form className="lobby-card gate-card" onSubmit={save}>
        <div className="lobby-head">
          <h1 className="logo">
            <LogoMark size={30} /> Account
          </h1>
        </div>
        <p className="sub">Signed in as {user.email}</p>

        <div className="row2">
          <label className="field">
            <span>Username</span>
            <input type="text" maxLength={20} value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label className="field">
            <span>Display name</span>
            <input type="text" maxLength={24} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </label>
        </div>

        <div className="field">
          <span>Linked sign-in</span>
          <div className="linked-providers">
            {linked.length === 0 && <em className="muted">Email &amp; password only</em>}
            {linked.map((p) => (
              <span key={p} className="provider-chip">{PROVIDER_LABELS[p] ?? p}</span>
            ))}
            {linkable.map((p) => (
              <a key={p} className="provider-chip link" href={`/api/auth/oauth/${p}?returnTo=/account`}>
                + Link {PROVIDER_LABELS[p]}
              </a>
            ))}
          </div>
        </div>

        {msg && <div className={`save-msg${msg.err ? ' err' : ''}`}>{msg.text}</div>}
        <button className="btn primary big" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>

        <div className="foot" style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between' }}>
          <a href="/" className="foot-link">← Back to game</a>
          <button type="button" className="link" onClick={() => { void logout().then(() => { window.location.href = '/'; }); }}>
            Sign out
          </button>
        </div>
      </form>
    </div>
  );
}
