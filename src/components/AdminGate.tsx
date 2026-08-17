'use client';
import { useEffect, useState } from 'react';
import AdminDashboard from './AdminDashboard';
import LogoMark from './LogoMark';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

  if (status === 'loading') return <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">Checking access…</div>;
  if (status === 'in') return <AdminDashboard email={email} onLogout={logout} />;

  return (
    <div className="flex min-h-dvh items-center justify-center p-5">
      <Card className="glow-primary w-full max-w-sm border-border/70 bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-xl">
            <LogoMark size={24} /> Admin
          </CardTitle>
          <CardDescription>Sign in to edit starting configurations. Admins only.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={login} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pw">Password</Label>
              <Input id="pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            {err && <p className="text-sm font-medium text-destructive">{err}</p>}
            <Button type="submit" className="glow-primary w-full" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <a href="/" className="text-sm font-medium text-laser hover:underline">
              ← Back to game
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
