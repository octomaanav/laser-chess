'use client';
import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { GameController, ViewState } from '@/client/controller';
import { useSession } from '@/client/useSession';
import { SETUP_NAMES } from '@/game/setups';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AccountMenu from './AccountMenu';
import LogoMark from './LogoMark';
import ThemeToggle from './ThemeToggle';

const PERKS = [
  { c: 'bg-laser/15 border-laser/60', t: 'No account needed — just share a link or code' },
  { c: 'bg-player-red/15 border-player-red/60', t: 'Authoritative server resolves every laser trace' },
  { c: 'bg-player-teal/15 border-player-teal/60', t: 'Spectators, live presence, reconnect & move timers' },
];

export default function Lobby({ controller, view }: { controller: GameController; view: ViewState }) {
  const [name, setName] = useState('');
  const [setup, setSetup] = useState('Classic');
  const [color, setColor] = useState<'random' | 'silver' | 'red'>('random');
  const [code, setCode] = useState('');
  const [showRules, setShowRules] = useState(false);
  const [invited, setInvited] = useState(false);
  const [names, setNames] = useState<string[]>(SETUP_NAMES);
  const [perMove, setPerMove] = useState(0); // minutes per move; 0 = no timer
  const { user } = useSession();

  // Signed-in players always play under their account's display name.
  useEffect(() => {
    if (user) setName(user.displayName);
  }, [user]);

  useEffect(() => {
    setName(controller.getStoredName());
    const params = new URLSearchParams(window.location.search);
    const g = (params.get('game') || '').toUpperCase();
    if (g) {
      setCode(g);
      setInvited(true);
      // Returning to a game this browser already played → reconnect seamlessly.
      if (controller.wasInRoom(g)) controller.start({ code: g });
    }
    fetch('/api/setups')
      .then((r) => r.json())
      .then((d: { setups: { name: string }[] }) => {
        if (Array.isArray(d.setups) && d.setups.length) setNames(d.setups.map((s) => s.name));
      })
      .catch(() => {});
  }, [controller]);

  const create = () => {
    controller.setName(name);
    controller.start({ setup, color, perMove });
  };
  const join = () => {
    if (!code.trim()) {
      controller.toast('Enter a game code');
      return;
    }
    controller.setName(name);
    controller.start({ code: code.trim().toUpperCase() });
  };

  return (
    <section className="relative flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <a href="/games/laser-chess" className="flex items-center gap-2.5 text-foreground">
          <LogoMark size={26} />
          <span className="font-display text-lg font-semibold tracking-tight">Laser Chess</span>
        </a>
        <div className="flex items-center gap-1.5">
          <a href="/" className="mr-1 hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline">
            ← All games
          </a>
          <ThemeToggle />
          <AccountMenu />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8">
        <div className="grid w-full max-w-5xl items-center gap-10 md:grid-cols-2 md:gap-16">
          {/* hero */}
          <div className="mx-auto max-w-lg text-center md:mx-0 md:text-left">
            <Badge
              variant="outline"
              className="mb-6 gap-2 border-laser/30 bg-laser/10 py-1.5 pl-2.5 text-[12px] font-semibold text-laser"
            >
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-laser opacity-70" />
                <span className="relative inline-flex size-2 rounded-full bg-laser" />
              </span>
              Real-time multiplayer · free · no install
            </Badge>
            <h1 className="font-display text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl">
              Deflect the beam.
              <br />
              Burn the <span className="text-laser text-glow">Pharaoh.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground md:mx-0">
              A fast head-to-head duel of mirrors and lasers. Spin up a board, share the link, and play a friend in
              seconds — right in the browser.
            </p>
            <ul className="mx-auto mt-7 hidden max-w-md flex-col gap-3 text-left sm:flex md:mx-0">
              {PERKS.map((p) => (
                <li key={p.t} className="flex items-center gap-3 text-sm font-medium text-foreground/90">
                  <span className={`size-4 shrink-0 rounded-[5px] border-2 ${p.c}`} />
                  {p.t}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <Button variant="link" className="h-auto p-0 text-laser" onClick={() => setShowRules((s) => !s)}>
                How to play {showRules ? '▴' : '▾'}
              </Button>
              {showRules && (
                <div className="mt-3 space-y-2 rounded-xl border border-border bg-card/60 p-4 text-left text-[13px] leading-relaxed text-muted-foreground animate-in fade-in slide-in-from-top-1">
                  <p>
                    Each turn: <b className="text-foreground">move</b> a piece one square or{' '}
                    <b className="text-foreground">rotate</b> it 90°. Then your laser fires automatically from your Sphinx.
                  </p>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>
                      <b className="text-foreground">Pharaoh</b> — your king. If a laser hits it, you lose.
                    </li>
                    <li>
                      <b className="text-foreground">Pyramid</b> — single mirror; deflects 90°. Hit flat and it&apos;s gone.
                    </li>
                    <li>
                      <b className="text-foreground">Scarab</b> — double mirror; never dies. Can swap with a neighbor.
                    </li>
                    <li>
                      <b className="text-foreground">Anubis</b> — shielded in front; vulnerable from side or back.
                    </li>
                    <li>
                      <b className="text-foreground">Sphinx</b> — your laser cannon in the corner. Rotate only.
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* play card */}
          <Card className="glow-primary relative mx-auto w-full max-w-md border-border/70 bg-card/80 backdrop-blur">
            <CardContent className="flex flex-col gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight">{invited ? 'Join the game' : 'New game'}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {invited ? `You're invited to ${code}. Enter a name and join.` : 'Set it up, then share the link.'}
                </p>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="name">Your name</Label>
                <Input
                  id="name"
                  maxLength={24}
                  placeholder="Player"
                  value={name}
                  readOnly={!!user}
                  onChange={(e) => setName(e.target.value)}
                />
                {user && (
                  <p className="text-xs text-muted-foreground">
                    Playing as your account name.{' '}
                    <a className="text-laser hover:underline" href="/account">
                      Change in Account
                    </a>
                    .
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Board</Label>
                  <Select value={setup} onValueChange={setSetup}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {names.map((n) => (
                        <SelectItem key={n} value={n}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Play as</Label>
                  <Select value={color} onValueChange={(v) => setColor(v as 'random' | 'silver' | 'red')}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="random">Random</SelectItem>
                      <SelectItem value="silver">Teal (moves first)</SelectItem>
                      <SelectItem value="red">Red</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label>Time per move</Label>
                <Select value={String(perMove)} onValueChange={(v) => setPerMove(Number(v))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">No timer</SelectItem>
                    <SelectItem value="1">1 minute</SelectItem>
                    <SelectItem value="2">2 minutes</SelectItem>
                    <SelectItem value="3">3 minutes</SelectItem>
                    <SelectItem value="5">5 minutes</SelectItem>
                    <SelectItem value="10">10 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button size="lg" className="glow-primary mt-1 w-full font-semibold" onClick={create}>
                Create game &amp; get share link <ArrowRight className="size-4" />
              </Button>

              <div className="relative my-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                or join a game
                <span className="h-px flex-1 bg-border" />
              </div>

              <div className="flex gap-2.5">
                <Input
                  maxLength={5}
                  placeholder="CODE"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && join()}
                  className="text-center font-mono text-base font-bold uppercase tracking-[0.35em]"
                />
                <Button variant="secondary" onClick={join}>
                  Join
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="px-5 py-5 text-center text-xs text-muted-foreground">
        Teal moves first ·{' '}
        <a href="/admin" className="font-semibold text-laser hover:underline">
          Edit starting configurations →
        </a>
      </footer>
    </section>
  );
}
