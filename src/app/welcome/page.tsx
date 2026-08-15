'use client';
import { useEffect, useState } from 'react';
import { useSession } from '@/client/useSession';
import LogoMark from '@/components/LogoMark';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

  if (loading) return <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">Setting up your account…</div>;
  if (!user) {
    if (typeof window !== 'undefined') window.location.href = '/';
    return null;
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-5">
      <Card className="glow-primary w-full max-w-md border-border/70 bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-2xl">
            <LogoMark size={26} /> Welcome!
          </CardTitle>
          <CardDescription>Pick a username - this is how other players will find you. You can change it later in Account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={finish} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="username">Username</Label>
              <Input id="username" autoFocus maxLength={20} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@handle" />
              <p className="text-xs text-muted-foreground">3–20 characters · letters, numbers, and underscores.</p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="display">Display name</Label>
              <Input id="display" maxLength={24} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Shown in games" />
            </div>
            {err && <p className="text-sm font-medium text-destructive">{err}</p>}
            <Button type="submit" className="glow-primary w-full" disabled={busy}>
              {busy ? 'Saving…' : 'Continue'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
