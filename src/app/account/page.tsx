'use client';
import { useEffect, useState } from 'react';
import { ArrowLeft, LogOut, UserCheck } from 'lucide-react';
import { useSession } from '@/client/useSession';
import AuthPanel from '@/components/AuthPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SITE_NAME } from '@/lib/site';

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
    <div className="relative flex min-h-dvh items-center justify-center p-5 bg-background text-foreground transition-colors duration-200">
      {/* ambient glows */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 -top-20 size-80 rounded-full bg-lime-500/10 dark:bg-[#c3f53b]/10 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 size-80 rounded-full bg-amber-500/10 dark:bg-[#ffb020]/10 blur-3xl" />
      </div>

      <Card className="relative z-10 w-full max-w-md border-border bg-card/90 shadow-2xl backdrop-blur-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2.5 font-display text-xl font-bold">
              <span className="grid size-8 place-items-center rounded-lg bg-lime-500 dark:bg-[#c3f53b] text-black font-extrabold text-xs shadow-sm">
                GN
              </span>
              Account Settings
            </CardTitle>
            <Badge variant="outline" className="gap-1 border-primary/30 bg-primary/10 text-primary text-xs">
              <UserCheck className="size-3" /> {SITE_NAME}
            </Badge>
          </div>
          <CardDescription className="text-xs text-muted-foreground pt-1">
            Signed in as <span className="font-medium text-foreground">{user.email}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="username" className="text-xs font-medium text-muted-foreground">Username</Label>
                <Input id="username" maxLength={20} value={username} onChange={(e) => setUsername(e.target.value)} className="border-input bg-background/50 text-sm" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="display" className="text-xs font-medium text-muted-foreground">Display name</Label>
                <Input id="display" maxLength={24} value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="border-input bg-background/50 text-sm" />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Linked sign-in</Label>
              <div className="flex flex-wrap items-center gap-2">
                {linked.length === 0 && <span className="text-xs text-muted-foreground">Email &amp; password only</span>}
                {linked.map((p) => (
                  <Badge key={p} variant="secondary" className="text-xs">
                    {PROVIDER_LABELS[p] ?? p}
                  </Badge>
                ))}
                {linkable.map((p) => (
                  <Button key={p} asChild size="sm" variant="outline" className="h-7 text-xs">
                    <a href={`/api/auth/oauth/${p}?returnTo=/account`}>+ Link {PROVIDER_LABELS[p]}</a>
                  </Button>
                ))}
              </div>
            </div>

            {msg && <p className={`text-xs font-medium ${msg.err ? 'text-destructive' : 'text-emerald-500'}`}>{msg.text}</p>}
            <Button type="submit" className="w-full font-semibold shadow-sm" disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </Button>
          </form>

          <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-xs">
            <a href="/" className="flex items-center gap-1.5 font-medium text-foreground hover:text-primary transition-colors">
              <ArrowLeft className="size-3.5" /> Back to games
            </a>
            <button
              type="button"
              className="flex items-center gap-1.5 text-muted-foreground hover:text-destructive transition-colors"
              onClick={() => void logout().then(() => (window.location.href = '/'))}
            >
              <LogOut className="size-3.5" /> Sign out
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
