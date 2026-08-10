'use client';
import { useEffect, useState } from 'react';
import { ArrowLeft, LogOut } from 'lucide-react';
import { useSession } from '@/client/useSession';
import AuthPanel from '@/components/AuthPanel';
import LogoMark from '@/components/LogoMark';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const PROVIDER_LABELS: Record<string, string> = { google: 'Google', github: 'GitHub' };

export default function AccountPage() {
  const { user, providers, loading, logout, setUser } = useSession();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [linked, setLinked] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ text: string; err: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

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

  if (loading) return <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">Checking access…</div>;
  if (!user) return <AuthPanel providers={providers} onAuthed={(u) => setUser(u)} onClose={() => (window.location.href = '/')} />;

  const linkable = (['google', 'github'] as const).filter((p) => providers[p] && !linked.includes(p));

  return (
    <div className="flex min-h-dvh items-center justify-center p-5">
      <Card className="glow-primary w-full max-w-md border-border/70 bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-xl">
            <LogoMark size={24} /> Account
          </CardTitle>
          <CardDescription>Signed in as {user.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="username">Username</Label>
                <Input id="username" maxLength={20} value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="display">Display name</Label>
                <Input id="display" maxLength={24} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Linked sign-in</Label>
              <div className="flex flex-wrap items-center gap-2">
                {linked.length === 0 && <span className="text-sm text-muted-foreground">Email &amp; password only</span>}
                {linked.map((p) => (
                  <Badge key={p} variant="secondary">
                    {PROVIDER_LABELS[p] ?? p}
                  </Badge>
                ))}
                {linkable.map((p) => (
                  <Button key={p} asChild size="sm" variant="outline" className="h-7">
                    <a href={`/api/auth/oauth/${p}?returnTo=/account`}>+ Link {PROVIDER_LABELS[p]}</a>
                  </Button>
                ))}
              </div>
            </div>

            {msg && <p className={`text-sm font-medium ${msg.err ? 'text-destructive' : 'text-laser'}`}>{msg.text}</p>}
            <Button type="submit" className="glow-primary w-full" disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </Button>
          </form>

          <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-sm">
            <a href="/" className="flex items-center gap-1.5 font-medium text-laser hover:underline">
              <ArrowLeft className="size-4" /> Back to game
            </a>
            <button
              type="button"
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => void logout().then(() => (window.location.href = '/'))}
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
