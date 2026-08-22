// src/components/flip7/Flip7Lobby.tsx
'use client';
import { useEffect, useState } from 'react';
import { ArrowRight, Check, Copy, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Flip7Controller, Flip7View } from '@/client/flip7Controller';
import { useSession } from '@/client/useSession';
import Navbar from '../Navbar';
import Footer from '../Footer';
import TutorialModal from '../tutorials/TutorialModal';
import { FLIP7_TUTORIAL_STEPS } from '../tutorials/flip7Tutorial';

const PERKS = [
  { c: 'var(--flip7-amber)', t: 'No account needed. Just share a link or code' },
  { c: 'var(--flip7-danger)', t: 'Authoritative server resolves every draw, bust & bonus' },
  { c: 'var(--flip7-green)', t: '2–7 players, live presence, reconnect if you drop' },
];

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`w-full max-w-md rounded-xl border p-6 backdrop-blur ${className ?? ''}`}
      style={{
        borderColor: 'var(--flip7-panel-border)',
        background: 'color-mix(in oklab, var(--flip7-panel-bg) 92%, transparent)',
        boxShadow: '0 20px 60px -30px rgba(0, 0, 0, 0.5)',
      }}
    >
      {children}
    </div>
  );
}

export default function Flip7Lobby({
  controller,
  view,
  initialRoomCode,
}: {
  controller: Flip7Controller;
  view: Flip7View;
  initialRoomCode?: string | null;
}) {
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState(initialRoomCode ?? '');
  const [copied, setCopied] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const invited = !!initialRoomCode;
  const { user } = useSession();

  useEffect(() => {
    if (user) setName(user.displayName);
  }, [user]);

  const copyLink = async () => {
    if (!view.shareUrl) return;
    try {
      await navigator.clipboard.writeText(view.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard permission denied - the room code is still visible to copy manually */
    }
  };

  const navbar = <Navbar game="flip7" showBackToGames className="border-b-0" />;

  if (view.screen === 'lobby') {
    return (
      <div className="flex min-h-dvh flex-col w-full max-w-full overflow-x-hidden">
        {navbar}
        <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8">
          <div className="grid w-full max-w-5xl items-center gap-10 md:grid-cols-2 md:gap-16">
            <div className="mx-auto max-w-lg text-center md:mx-0 md:text-left">
              <Badge
                variant="outline"
                className="mb-6 gap-2 py-1.5 pl-2.5 text-[12px] font-semibold"
                style={{
                  borderColor: 'color-mix(in oklab, var(--flip7-amber) 40%, transparent)',
                  background: 'color-mix(in oklab, var(--flip7-amber) 12%, transparent)',
                  color: 'var(--flip7-amber-dark)',
                }}
              >
                <span className="relative flex size-2">
                  <span
                    className="absolute inline-flex size-full animate-ping rounded-full opacity-70"
                    style={{ background: 'var(--flip7-amber)' }}
                  />
                  <span className="relative inline-flex size-2 rounded-full" style={{ background: 'var(--flip7-amber)' }} />
                </span>
                Real-time multiplayer · free · no install
              </Badge>
              <h1 className="font-display text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl" style={{ color: 'var(--flip7-text)' }}>
                Push your luck.
                <br />
                <span style={{ color: 'var(--flip7-amber)', textShadow: 'var(--flip7-text-glow)' }}>Don&apos;t flip twice.</span>
              </h1>
              <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed md:mx-0" style={{ color: 'var(--flip7-text-muted)' }}>
                Draw cards, chase 7 unique numbers for the bonus, and bank your score before a duplicate busts you.
                2–7 players, right in the browser.
              </p>
              <ul className="mx-auto mt-7 hidden max-w-md flex-col gap-3 text-left sm:flex md:mx-0">
                {PERKS.map((p) => (
                  <li key={p.t} className="flex items-center gap-3 text-sm font-medium" style={{ color: 'var(--flip7-text)' }}>
                    <span className="size-4 shrink-0 rounded-[5px] border-2" style={{ borderColor: p.c, background: `color-mix(in oklab, ${p.c} 15%, transparent)` }} />
                    {p.t}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <Button variant="link" className="h-auto p-0" style={{ color: 'var(--flip7-amber)' }} onClick={() => setTutorialOpen(true)}>
                  How to play →
                </Button>
                <TutorialModal open={tutorialOpen} onOpenChange={setTutorialOpen} gameTitle="Flip 7" steps={FLIP7_TUTORIAL_STEPS} theme="flip7" />
              </div>
            </div>

            <Panel className="mx-auto">
              <h2 className="font-display text-2xl font-bold tracking-tight" style={{ color: 'var(--flip7-text)' }}>
                {invited ? 'Join the game' : 'New game'}
              </h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--flip7-text-muted)' }}>
                {invited ? `You're invited to ${initialRoomCode}. Enter a name and join.` : 'Set your name, then create or join a room.'}
              </p>

              <div className="mt-5 grid gap-1.5">
                <Label htmlFor="flip7-name" style={{ color: 'var(--flip7-text)' }}>
                  Your name
                </Label>
                <Input
                  id="flip7-name"
                  maxLength={24}
                  placeholder="Player"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && invited && controller.start({ name, code: joinCode })}
                />
              </div>

              {invited ? (
                <Button
                  size="lg"
                  className="mt-4 w-full font-semibold"
                  style={{ background: 'var(--flip7-amber)', color: '#1c1420' }}
                  onClick={() => controller.start({ name, code: joinCode })}
                >
                  Join room {initialRoomCode} <ArrowRight className="size-4" />
                </Button>
              ) : (
                <>
                  <Button
                    size="lg"
                    className="mt-4 w-full font-semibold"
                    style={{ background: 'var(--flip7-amber)', color: '#1c1420' }}
                    onClick={() => controller.start({ name })}
                  >
                    Create room <ArrowRight className="size-4" />
                  </Button>

                  <div className="relative my-4 flex items-center gap-3 text-xs" style={{ color: 'var(--flip7-text-muted)' }}>
                    <span className="h-px flex-1" style={{ background: 'var(--flip7-panel-border)' }} />
                    or join a room
                    <span className="h-px flex-1" style={{ background: 'var(--flip7-panel-border)' }} />
                  </div>

                  <div className="flex gap-2.5">
                    <Input
                      maxLength={5}
                      placeholder="CODE"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === 'Enter' && controller.start({ name, code: joinCode })}
                      className="text-center font-mono text-base font-bold uppercase tracking-[0.35em]"
                    />
                    <Button variant="secondary" onClick={() => controller.start({ name, code: joinCode })}>
                      Join
                    </Button>
                  </div>
                </>
              )}

              {view.error && (
                <p className="mt-3 text-sm" style={{ color: 'var(--flip7-danger)' }}>
                  {view.error}
                </p>
              )}
            </Panel>
          </div>
        </main>
      </div>
    );
  }

  const lobby = view.lobby;
  const seatCount = lobby?.seats.length ?? 0;
  const maxSeats = lobby?.maxSeats ?? 7;

  return (
    <div className="flex min-h-dvh flex-col">
      {navbar}
      <main className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8">
        <Panel>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--flip7-text-muted)' }}>
                Room code
              </p>
              <h1 className="font-display text-3xl font-bold tracking-[0.2em]" style={{ color: 'var(--flip7-amber)' }}>
                {view.code}
              </h1>
            </div>
            <div
              className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold"
              style={{ borderColor: 'var(--flip7-panel-border)', color: 'var(--flip7-text-muted)' }}
            >
              <Users className="size-3.5" />
              {seatCount} / {maxSeats}
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Input readOnly value={view.shareUrl ?? ''} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
            <Button variant="secondary" onClick={copyLink} className="shrink-0">
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          </div>

          <ul className="mt-5 space-y-1.5">
            {lobby?.seats.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--flip7-panel-border)', background: 'var(--flip7-table-bg)' }}
              >
                <span className="flex items-center gap-2 font-medium" style={{ color: 'var(--flip7-text)' }}>
                  <span className="size-2 rounded-full" style={{ background: s.connected ? 'var(--flip7-success)' : 'var(--flip7-text-muted)' }} />
                  {s.name}
                  {s.id === view.playerId && (
                    <span className="text-xs font-normal" style={{ color: 'var(--flip7-text-muted)' }}>
                      (you)
                    </span>
                  )}
                </span>
                {!s.connected && (
                  <span className="text-xs" style={{ color: 'var(--flip7-text-muted)' }}>
                    disconnected
                  </span>
                )}
              </li>
            ))}
          </ul>

          <Button
            size="lg"
            className="mt-5 w-full font-semibold"
            style={{ background: 'var(--flip7-amber)', color: '#1c1420' }}
            disabled={!lobby?.canStart}
            onClick={() => controller.startGame()}
          >
            {lobby?.canStart ? 'Start game' : `Waiting for ${Math.max(2 - seatCount, 1)} more player${Math.max(2 - seatCount, 1) === 1 ? '' : 's'}…`}
          </Button>

          {view.error && (
            <p className="mt-3 text-sm" style={{ color: 'var(--flip7-danger)' }}>
              {view.error}
            </p>
          )}
        </Panel>
      </main>

      <Footer theme="flip7" />
    </div>
  );
}
