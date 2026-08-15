// src/components/coup/CoupLobby.tsx
'use client';
import { useEffect, useState } from 'react';
import { ArrowRight, Check, Copy, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CoupController, CoupView } from '@/client/coupController';
import { useSession } from '@/client/useSession';
import CoupLogoMark from './CoupLogoMark';
import ThemeToggle from '../ThemeToggle';

const PERKS = [
  { c: 'var(--coup-gold)', t: 'No account needed. Just share a link or code' },
  { c: 'var(--coup-danger)', t: 'Authoritative server resolves every bluff, block & challenge' },
  { c: 'var(--coup-success)', t: '2–6 players, live presence, reconnect if you drop' },
];

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`w-full max-w-md rounded-xl border p-6 backdrop-blur ${className ?? ''}`}
      style={{
        borderColor: 'var(--coup-panel-border)',
        background: 'color-mix(in oklab, var(--coup-panel-bg) 92%, transparent)',
        boxShadow: '0 20px 60px -30px rgba(0, 0, 0, 0.5)',
      }}
    >
      {children}
    </div>
  );
}

export default function CoupLobby({
  controller,
  view,
  initialRoomCode,
}: {
  controller: CoupController;
  view: CoupView;
  initialRoomCode?: string | null;
}) {
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState(initialRoomCode ?? '');
  const [copied, setCopied] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const invited = !!initialRoomCode;
  const { user } = useSession();

  // Signed-in players always play under their account's display name.
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

  const header = (
    <header className="flex items-center justify-between px-5 py-4 sm:px-8">
      <a href="/games/coup" className="flex items-center gap-2.5" style={{ color: 'var(--coup-text)' }}>
        <CoupLogoMark size={26} />
        <span className="font-display text-lg font-semibold tracking-tight">Coup</span>
      </a>
      <div className="flex items-center gap-1.5">
        <a
          href="/"
          className="mr-1 hidden text-sm font-medium transition-colors hover:opacity-80 sm:inline"
          style={{ color: 'var(--coup-text-muted)' }}
        >
          ← All games
        </a>
        <ThemeToggle />
      </div>
    </header>
  );

  if (view.screen === 'lobby') {
    return (
      <div className="flex min-h-dvh flex-col">
        {header}
        <main className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8">
          <div className="grid w-full max-w-5xl items-center gap-10 md:grid-cols-2 md:gap-16">
            {/* hero */}
            <div className="mx-auto max-w-lg text-center md:mx-0 md:text-left">
              <Badge
                variant="outline"
                className="mb-6 gap-2 py-1.5 pl-2.5 text-[12px] font-semibold"
                style={{ borderColor: 'color-mix(in oklab, var(--coup-gold) 40%, transparent)', background: 'color-mix(in oklab, var(--coup-gold) 12%, transparent)', color: 'var(--coup-gold-dark)' }}
              >
                <span className="relative flex size-2">
                  <span
                    className="absolute inline-flex size-full animate-ping rounded-full opacity-70"
                    style={{ background: 'var(--coup-gold)' }}
                  />
                  <span className="relative inline-flex size-2 rounded-full" style={{ background: 'var(--coup-gold)' }} />
                </span>
                Real-time multiplayer · free · no install
              </Badge>
              <h1
                className="font-display text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl"
                style={{ color: 'var(--coup-text)' }}
              >
                Bluff. Deduce.
                <br />
                <span style={{ color: 'var(--coup-gold)', textShadow: 'var(--coup-text-glow)' }}>Betray.</span>
              </h1>
              <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed md:mx-0" style={{ color: 'var(--coup-text-muted)' }}>
                Claim any character&apos;s power, bluff your way past challenges, and be the last player standing.
                2–6 players, right in the browser.
              </p>
              <ul className="mx-auto mt-7 hidden max-w-md flex-col gap-3 text-left sm:flex md:mx-0">
                {PERKS.map((p) => (
                  <li key={p.t} className="flex items-center gap-3 text-sm font-medium" style={{ color: 'var(--coup-text)' }}>
                    <span className="size-4 shrink-0 rounded-[5px] border-2" style={{ borderColor: p.c, background: `color-mix(in oklab, ${p.c} 15%, transparent)` }} />
                    {p.t}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <Button
                  variant="link"
                  className="h-auto p-0"
                  style={{ color: 'var(--coup-gold)' }}
                  onClick={() => setShowRules((s) => !s)}
                >
                  How to play {showRules ? '▴' : '▾'}
                </Button>
                {showRules && (
                  <div
                    className="mt-3 space-y-2 rounded-xl border p-4 text-left text-[13px] leading-relaxed animate-in fade-in slide-in-from-top-1"
                    style={{ borderColor: 'var(--coup-panel-border)', background: 'color-mix(in oklab, var(--coup-panel-bg) 60%, transparent)', color: 'var(--coup-text-muted)' }}
                  >
                    <p>
                      On your turn, <span style={{ color: 'var(--coup-text)' }}>claim</span> a character&apos;s power, even if you don&apos;t
                      hold that card. Opponents can <span style={{ color: 'var(--coup-text)' }}>challenge</span> or{' '}
                      <span style={{ color: 'var(--coup-text)' }}>block</span> you. Lose a challenge, lose an influence.
                    </p>
                    <ul className="list-disc space-y-1 pl-5">
                      <li>
                        <span style={{ color: 'var(--coup-text)' }}>Duke:</span> collect 3 coins; blocks foreign aid.
                      </li>
                      <li>
                        <span style={{ color: 'var(--coup-text)' }}>Assassin:</span> pay 3 coins to force a discard.
                      </li>
                      <li>
                        <span style={{ color: 'var(--coup-text)' }}>Captain:</span> steal 2 coins; blocks stealing.
                      </li>
                      <li>
                        <span style={{ color: 'var(--coup-text)' }}>Ambassador:</span> exchange cards; blocks stealing.
                      </li>
                      <li>
                        <span style={{ color: 'var(--coup-text)' }}>Contessa:</span> blocks assassination.
                      </li>
                    </ul>
                    <p>Lose both your influence cards and you&apos;re out. Last player standing wins.</p>
                  </div>
                )}
              </div>
            </div>

            {/* play card */}
            <Panel className="mx-auto">
            <h2 className="font-display text-2xl font-bold tracking-tight" style={{ color: 'var(--coup-text)' }}>
              {invited ? 'Join the game' : 'New game'}
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--coup-text-muted)' }}>
              {invited ? `You're invited to ${initialRoomCode}. Enter a name and join.` : 'Set your name, then create or join a room.'}
            </p>

            <div className="mt-5 grid gap-1.5">
              <Label htmlFor="coup-name" style={{ color: 'var(--coup-text)' }}>
                Your name
              </Label>
              <Input
                id="coup-name"
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
                style={{ background: 'var(--coup-gold)', color: '#1c1420' }}
                onClick={() => controller.start({ name, code: joinCode })}
              >
                Join room {initialRoomCode} <ArrowRight className="size-4" />
              </Button>
            ) : (
              <>
                <Button
                  size="lg"
                  className="mt-4 w-full font-semibold"
                  style={{ background: 'var(--coup-gold)', color: '#1c1420' }}
                  onClick={() => controller.start({ name })}
                >
                  Create room <ArrowRight className="size-4" />
                </Button>

                <div className="relative my-4 flex items-center gap-3 text-xs" style={{ color: 'var(--coup-text-muted)' }}>
                  <span className="h-px flex-1" style={{ background: 'var(--coup-panel-border)' }} />
                  or join a room
                  <span className="h-px flex-1" style={{ background: 'var(--coup-panel-border)' }} />
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
              <p className="mt-3 text-sm" style={{ color: 'var(--coup-danger)' }}>
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
  const maxSeats = lobby?.maxSeats ?? 6;

  return (
    <div className="flex min-h-dvh flex-col">
      {header}
      <main className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8">
        <Panel>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--coup-text-muted)' }}>
                Room code
              </p>
              <h1 className="font-display text-3xl font-bold tracking-[0.2em]" style={{ color: 'var(--coup-gold)' }}>
                {view.code}
              </h1>
            </div>
            <div
              className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold"
              style={{ borderColor: 'var(--coup-panel-border)', color: 'var(--coup-text-muted)' }}
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
                style={{ borderColor: 'var(--coup-panel-border)', background: 'var(--coup-table-bg)' }}
              >
                <span className="flex items-center gap-2 font-medium" style={{ color: 'var(--coup-text)' }}>
                  <span
                    className="size-2 rounded-full"
                    style={{ background: s.connected ? 'var(--coup-success)' : 'var(--coup-text-muted)' }}
                  />
                  {s.name}
                  {s.id === view.playerId && (
                    <span className="text-xs font-normal" style={{ color: 'var(--coup-text-muted)' }}>
                      (you)
                    </span>
                  )}
                </span>
                {!s.connected && (
                  <span className="text-xs" style={{ color: 'var(--coup-text-muted)' }}>
                    disconnected
                  </span>
                )}
              </li>
            ))}
          </ul>

          <Button
            size="lg"
            className="mt-5 w-full font-semibold"
            style={{ background: 'var(--coup-gold)', color: '#1c1420' }}
            disabled={!lobby?.canStart}
            onClick={() => controller.startGame()}
          >
            {lobby?.canStart
              ? 'Start game'
              : `Waiting for ${Math.max(2 - seatCount, 1)} more player${Math.max(2 - seatCount, 1) === 1 ? '' : 's'}…`}
          </Button>

          {view.error && (
            <p className="mt-3 text-sm" style={{ color: 'var(--coup-danger)' }}>
              {view.error}
            </p>
          )}
        </Panel>
      </main>
    </div>
  );
}
