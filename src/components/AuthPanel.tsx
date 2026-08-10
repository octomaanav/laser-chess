'use client';
import { useState } from 'react';
import type { Providers, SessionUser } from '@/client/useSession';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Mode = 'signin' | 'signup';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-4" aria-hidden>
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.2 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.11-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.65 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.62-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58C20.57 22.29 24 17.8 24 12.5 24 5.87 18.63.5 12 .5z" />
    </svg>
  );
}

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
  const returnTo = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const url = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
      const bodyData = mode === 'signup' ? { email, username, displayName, password } : { emailOrUsername, password };
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(bodyData) });
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
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{mode === 'signup' ? 'Create your account' : 'Welcome back'}</DialogTitle>
          <DialogDescription>Accounts are for online matchmaking. You can still play quick games without one.</DialogDescription>
        </DialogHeader>

        {hasOAuth && (
          <div className="grid gap-2">
            {providers.google && (
              <Button asChild variant="outline" className="w-full">
                <a href={`/api/auth/oauth/google?returnTo=${encodeURIComponent(returnTo)}`}>
                  <GoogleIcon /> Continue with Google
                </a>
              </Button>
            )}
            {providers.github && (
              <Button asChild variant="outline" className="w-full">
                <a href={`/api/auth/oauth/github?returnTo=${encodeURIComponent(returnTo)}`}>
                  <GitHubIcon /> Continue with GitHub
                </a>
              </Button>
            )}
            <div className="my-1 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or with email <span className="h-px flex-1 bg-border" />
            </div>
          </div>
        )}

        <form onSubmit={submit} className="grid gap-4">
          <Tabs value={mode} onValueChange={(v) => (setErr(''), setMode(v as Mode))}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-4 grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="ident">Email or username</Label>
                <Input id="ident" autoComplete="username" value={emailOrUsername} onChange={(e) => setEmailOrUsername(e.target.value)} placeholder="you@example.com" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pw">Password</Label>
                <Input id="pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
            </TabsContent>

            <TabsContent value="signup" className="mt-4 grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="uname">Username</Label>
                  <Input id="uname" maxLength={20} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@handle" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="dname">Display name</Label>
                  <Input id="dname" maxLength={24} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Shown in games" />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="npw">Password</Label>
                <Input id="npw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
              </div>
            </TabsContent>
          </Tabs>

          {err && <p className="text-sm font-medium text-destructive">{err}</p>}
          <Button type="submit" className="glow-primary w-full" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
