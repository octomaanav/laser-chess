'use client';
import { useEffect, useState } from 'react';
import { ArrowRight, Radio, Share2, ShieldCheck, Trophy } from 'lucide-react';
import type { GameController, ViewState } from '@/client/controller';
import { useSession } from '@/client/useSession';
import type { Difficulty } from '@/game/bot/types';
import { SETUP_NAMES } from '@/game/setups';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Footer from './Footer';
import LaserHeroArt from './LaserHeroArt';
import MatchmakingModal from './MatchmakingModal';
import Navbar from './Navbar';
import RankBadge from './RankBadge';
import TutorialModal from './tutorials/TutorialModal';
import { LASER_CHESS_TUTORIAL_STEPS } from './tutorials/laserChessTutorial';
import { useSocial } from '@/client/social/SocialProvider';

const PERKS = [
  {
    icon: Share2,
    c: 'bg-laser/15 border-laser/40 text-laser',
    t: 'No account needed. Just share a link or code',
  },
  {
    icon: ShieldCheck,
    c: 'bg-player-red/15 border-player-red/40 text-player-red',
    t: 'Authoritative server resolves every laser trace',
  },
  {
    icon: Radio,
    c: 'bg-player-teal/15 border-player-teal/40 text-player-teal',
    t: 'Spectators, live presence, reconnect & move timers',
  },
];

function NameField({
  name,
  onChange,
  isSignedIn,
}: {
  name: string;
  onChange: (value: string) => void;
  isSignedIn: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="name">Your name</Label>
      <Input
        id="name"
        maxLength={24}
        placeholder="Player"
        value={name}
        readOnly={isSignedIn}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-lg bg-background/60 transition-colors focus-visible:bg-background"
      />
      {isSignedIn && (
        <p className="text-xs text-muted-foreground">
          Playing as your account name.{' '}
          <a className="font-medium text-laser underline-offset-4 hover:underline" href="/account">
            Change in Account
          </a>
          .
        </p>
      )}
    </div>
  );
}

function JoinCodeRow({
  code,
  onChange,
  onJoin,
}: {
  code: string;
  onChange: (value: string) => void;
  onJoin: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Input
        aria-label="Room code"
        maxLength={5}
        placeholder="CODE"
        value={code}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        onKeyDown={(e) => e.key === 'Enter' && onJoin()}
        className="h-10 flex-1 rounded-lg bg-background/60 text-center font-mono text-base font-bold uppercase tracking-[0.35em] transition-colors focus-visible:bg-background"
      />
      <Button
        variant="secondary"
        onClick={onJoin}
        className="h-10 shrink-0 rounded-lg border border-border/80 px-5 font-semibold transition-colors hover:border-laser/40 hover:bg-secondary/90"
      >
        Join
      </Button>
    </div>
  );
}

export default function Lobby({ controller, gameSlug }: { controller: GameController; view: ViewState; gameSlug: string }) {
  const [name, setName] = useState('');
  const [setup, setSetup] = useState('Classic');
  const [color, setColor] = useState<'random' | 'silver' | 'red'>('random');
  const [code, setCode] = useState('');
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [invited, setInvited] = useState(false);
  const [names, setNames] = useState<string[]>(SETUP_NAMES);
  const [perMove, setPerMove] = useState(0); // minutes per move; 0 = no timer
  const [botDifficulty, setBotDifficulty] = useState<Difficulty | null>(null);
  const [matchmaking, setMatchmaking] = useState(false);
  const { user } = useSession();
  const social = useSocial();
  const gameRank = social?.rankInfo?.[gameSlug] ?? null;

  useEffect(() => {
    if (user) social?.refreshRank(gameSlug);
  }, [user, gameSlug]); // eslint-disable-line react-hooks/exhaustive-deps

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
      .catch(() => { });
  }, [controller]);

  const create = () => {
    controller.setName(name);
    controller.start({ setup, color, perMove, vsBot: botDifficulty ?? undefined });
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
    <section className="relative flex min-h-dvh w-full max-w-full flex-col overflow-x-hidden">
      <Navbar game="laser-chess" showBackToGames className="border-b-0" />

      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8">
        <div className="grid w-full max-w-5xl items-center gap-10 md:grid-cols-2 md:gap-14 lg:gap-16">
          {/* hero */}
          <div className="mx-auto w-full max-w-lg text-center md:mx-0 md:text-left">
            <Badge
              variant="outline"
              className="mb-5 gap-2 border-laser/30 bg-laser/10 py-1.5 pl-2.5 text-[12px] font-semibold text-laser"
            >
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-laser opacity-70" />
                <span className="relative inline-flex size-2 rounded-full bg-laser" />
              </span>
              Real-time multiplayer · free · no install
            </Badge>
            <h1 className="font-display text-4xl font-bold leading-[1.03] tracking-tight sm:text-5xl">
              Deflect the beam.
              <br />
              Burn the <span className="text-laser text-glow">Pharaoh.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground md:mx-0">
              A fast head-to-head duel of mirrors and lasers. Spin up a board, share the link, and play a friend in
              seconds, right in the browser.
            </p>

            <LaserHeroArt />

            <ul className="mx-auto mt-6 hidden max-w-md flex-col gap-2.5 text-left sm:flex md:mx-0">
              {PERKS.map((p) => {
                const Icon = p.icon;
                return (
                  <li key={p.t} className="flex items-center gap-3 text-sm font-medium text-foreground/90">
                    <span
                      aria-hidden="true"
                      className={`inline-flex size-7 shrink-0 items-center justify-center rounded-lg border ${p.c}`}
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <span className="min-w-0 leading-snug">{p.t}</span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-5">
              <Button variant="link" className="h-auto p-0 font-semibold text-laser" onClick={() => setTutorialOpen(true)}>
                How to play →
              </Button>
              <TutorialModal
                open={tutorialOpen}
                onOpenChange={setTutorialOpen}
                gameTitle="Laser Chess"
                steps={LASER_CHESS_TUTORIAL_STEPS}
                theme="laser"
              />
            </div>
          </div>

          {/* play card */}
          <Card className="glow-primary relative mx-auto w-full max-w-md overflow-hidden rounded-2xl border-border/80 bg-card/85 py-5 backdrop-blur-md">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-laser/60 to-transparent"
            />
            <CardContent className="flex flex-col gap-4 px-5 sm:px-6">
              {invited ? (
                <div className="flex flex-col gap-4 py-1">
                  <div>
                    <h2 className="font-display text-2xl font-bold tracking-tight">Join the game</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      You're invited to {code}. Enter a name and join.
                    </p>
                  </div>
                  <NameField name={name} onChange={setName} isSignedIn={!!user} />
                  <div className="pt-1">
                    <JoinCodeRow code={code} onChange={setCode} onJoin={join} />
                  </div>
                </div>
              ) : (
                <Tabs defaultValue="casual" className="w-full">
                  <TabsList className="mb-4 grid h-11 w-full grid-cols-2 rounded-xl border border-border/60 bg-muted/60 p-1">
                    <TabsTrigger value="casual" className="h-full rounded-lg text-sm font-semibold sm:text-base">
                      Casual
                    </TabsTrigger>
                    <TabsTrigger value="ranked" className="h-full rounded-lg text-sm font-semibold sm:text-base">
                      Ranked
                    </TabsTrigger>
                  </TabsList>

                  {/* Both panels share one grid cell so the card is always as tall as the taller panel. */}
                  <div className="grid">
                  <TabsContent
                    value="casual"
                    forceMount
                    className="col-start-1 row-start-1 flex flex-col gap-3.5 data-[state=inactive]:pointer-events-none data-[state=inactive]:invisible"
                  >
                    <NameField name={name} onChange={setName} isSignedIn={!!user} />

                    <div className="grid gap-3 rounded-xl border border-border/70 bg-muted/25 p-3.5">
                      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                        <div className="grid min-w-0 gap-1.5">
                          <Label>Board</Label>
                          <Select value={setup} onValueChange={setSetup}>
                            <SelectTrigger className="w-full min-w-0 rounded-lg bg-background/70">
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
                        <div className="grid min-w-0 gap-1.5">
                          <Label>Play as</Label>
                          <Select value={color} onValueChange={(v) => setColor(v as 'random' | 'silver' | 'red')}>
                            <SelectTrigger className="w-full min-w-0 rounded-lg bg-background/70">
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

                      <div className="grid grid-cols-1 gap-2.5 min-[400px]:grid-cols-2 sm:gap-3">
                        <div className="grid min-w-0 gap-1.5">
                          <Label>Time per move</Label>
                          <Select value={String(perMove)} onValueChange={(v) => setPerMove(Number(v))}>
                            <SelectTrigger className="w-full min-w-0 rounded-lg bg-background/70">
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
                        <div className="grid min-w-0 gap-1.5">
                          <Label>Opponent</Label>
                          <Select
                            value={botDifficulty ?? 'human'}
                            onValueChange={(v) => setBotDifficulty(v === 'human' ? null : (v as Difficulty))}
                          >
                            <SelectTrigger className="w-full min-w-0 rounded-lg bg-background/70">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="human">Another player</SelectItem>
                              <SelectItem value="easy">Bot (Easy)</SelectItem>
                              <SelectItem value="medium">Bot (Medium)</SelectItem>
                              <SelectItem value="hard">Bot (Hard)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    <Button
                      size="lg"
                      className="glow-primary h-11 w-full rounded-xl font-semibold shadow-sm transition-all hover:brightness-105"
                      onClick={create}
                    >
                      {botDifficulty ? 'Play vs Bot' : 'Create game & get share link'} <ArrowRight className="size-4" />
                    </Button>

                    <div className="relative flex items-center gap-3 text-xs font-medium text-muted-foreground">
                      <span className="h-px flex-1 bg-border/80" />
                      or join a game
                      <span className="h-px flex-1 bg-border/80" />
                    </div>

                    <JoinCodeRow code={code} onChange={setCode} onJoin={join} />
                  </TabsContent>

                  <TabsContent
                    value="ranked"
                    forceMount
                    className="col-start-1 row-start-1 flex flex-col justify-between gap-5 py-1 data-[state=inactive]:pointer-events-none data-[state=inactive]:invisible"
                  >
                    {user ? (
                      <>
                        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
                          <div className="flex w-full items-center justify-center rounded-2xl border border-border/80 bg-muted/25 p-6">
                            <RankBadge rating={gameRank?.rating ?? null} size="md" />
                          </div>
                          <p className="px-2 text-sm leading-relaxed text-muted-foreground">
                            Win games to climb the ranks. Each win promotes you 1 rank, each loss demotes you 1 rank.
                          </p>
                        </div>
                        <Button
                          size="lg"
                          className="glow-primary h-11 w-full rounded-xl font-semibold shadow-sm transition-all hover:brightness-105"
                          onClick={async () => {
                            await fetch('/api/ranked/queue', {
                              method: 'POST',
                              headers: { 'content-type': 'application/json' },
                              body: JSON.stringify({ gameSlug }),
                            }).catch(() => { });
                            setMatchmaking(true);
                          }}
                        >
                          Find Ranked Match
                        </Button>
                      </>
                    ) : (
                      <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-border/60 bg-muted/15 px-5 py-8 text-center">
                        <div className="flex size-14 items-center justify-center rounded-2xl border border-laser/35 bg-laser/10 text-laser shadow-xs">
                          <Trophy className="size-7" aria-hidden="true" />
                        </div>
                        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                          Sign in to play ranked matches and climb the leaderboard.
                        </p>
                        <Button
                          variant="outline"
                          className="mt-1 rounded-lg border-border/80 px-6 font-semibold hover:border-laser/40"
                          onClick={() => (window.location.href = '/account')}
                        >
                          Sign in
                        </Button>
                      </div>
                    )}
                  </TabsContent>
                  </div>
                </Tabs>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer theme="laser" />

      {matchmaking && <MatchmakingModal gameSlug={gameSlug} onClose={() => setMatchmaking(false)} />}
    </section>
  );
}
