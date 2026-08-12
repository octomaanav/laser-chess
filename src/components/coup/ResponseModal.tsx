// src/components/coup/ResponseModal.tsx
'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { ClientCoupState } from '@/game/coup/redact';
import type { BlockCharacter } from '@/game/coup/types';
import type { CoupController } from '@/client/coupController';
import { CHARACTER_LABEL } from './characterAccent';
import { BLOCKERS_FOR } from '@/game/coup/types';
import type { StateWithCountdown } from './types';
import { useTableEvents } from './useTableEvents';

// Mirrors RESPONSE_WINDOW_MS in src/server/games/coup/roomServer.ts (off-limits
// to import from directly — that file isn't part of this UI-only redesign).
const RESPONSE_WINDOW_SECONDS = 7;

interface ResponseModalProps {
  state: StateWithCountdown;
  controller: CoupController;
}

export default function ResponseModal({ state, controller }: ResponseModalProps) {
  // Tracks whether *this* viewer has already sent a response for the current
  // action/block, so the buttons swap for a "waiting…" notice instead of
  // staying live and inviting a double-send the server would reject.
  const [responded, setResponded] = useState(false);
  const responseKey = `${state.phase}:${state.pendingAction?.actorId ?? ''}:${state.pendingAction?.type ?? ''}:${state.pendingBlock?.byId ?? ''}`;
  useEffect(() => {
    setResponded(false);
  }, [responseKey]);

  const events = useTableEvents(state);

  const open = state.phase === 'action_declared' || state.phase === 'block_declared';
  if (!open || !state.pendingAction) return null;

  const action = state.pendingAction;
  const isActor = action.actorId === state.you;
  const isTarget = action.targetId === state.you;
  const secondsLeft = state.responseSecondsRemaining ?? 0;
  const you = state.players.find((p) => p.id === state.you);
  const eliminated = you?.eliminated ?? false;
  const proved = events.find((e) => e.kind === 'claim-proved');

  const respond = (fn: () => void) => {
    setResponded(true);
    fn();
  };

  if (proved) {
    return <PassiveNotice text={`${nameOf(state, proved.playerId)} proved ${CHARACTER_LABEL[proved.character]}!`} secondsLeft={secondsLeft} tone="success" />;
  }

  if (state.phase === 'action_declared') {
    const canChallenge = !eliminated && !isActor && !!action.claimedCharacter;
    const blockers = BLOCKERS_FOR[action.type];
    const canBlock = !eliminated && !!blockers && (action.type === 'foreign-aid' ? !isActor : isTarget);
    if (!canChallenge && !canBlock) return <PassiveNotice text={describeAction(state, action)} secondsLeft={secondsLeft} />;
    if (responded) return <PassiveNotice text="You responded — waiting on others…" secondsLeft={secondsLeft} />;

    return (
      <Overlay>
        <div className="flex items-center gap-2">
          <CountdownRing secondsLeft={secondsLeft} />
          <p className="text-sm" style={{ color: 'var(--coup-text)' }}>{describeAction(state, action)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canChallenge && (
            <Button variant="destructive" size="sm" onClick={() => respond(() => controller.challenge())}>
              Challenge ({CHARACTER_LABEL[action.claimedCharacter!]}?)
            </Button>
          )}
          {canBlock &&
            blockers!.map((b: BlockCharacter) => (
              <Button key={b} size="sm" onClick={() => respond(() => controller.declareBlock(b))}>
                Block as {CHARACTER_LABEL[b]}
              </Button>
            ))}
          <Button variant="secondary" size="sm" onClick={() => respond(() => controller.pass())}>
            Pass
          </Button>
        </div>
      </Overlay>
    );
  }

  // block_declared: anyone (including the actor) may challenge the block
  const block = state.pendingBlock!;
  const canChallengeBlock = !eliminated && block.byId !== state.you;
  if (!canChallengeBlock) return <PassiveNotice text={`${nameOf(state, block.byId)} claims ${CHARACTER_LABEL[block.claimedCharacter]} to block.`} secondsLeft={secondsLeft} />;
  if (responded) return <PassiveNotice text="You responded — waiting on others…" secondsLeft={secondsLeft} />;

  return (
    <Overlay>
      <div className="flex items-center gap-2">
        <CountdownRing secondsLeft={secondsLeft} />
        <p className="text-sm" style={{ color: 'var(--coup-text)' }}>
          {nameOf(state, block.byId)} claims {CHARACTER_LABEL[block.claimedCharacter]} to block.
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="destructive" size="sm" onClick={() => respond(() => controller.challenge())}>
          Challenge
        </Button>
        <Button variant="secondary" size="sm" onClick={() => respond(() => controller.pass())}>
          Pass
        </Button>
      </div>
    </Overlay>
  );
}

function nameOf(state: ClientCoupState, id: string): string {
  return state.players.find((p) => p.id === id)?.name ?? '?';
}

function describeAction(state: ClientCoupState, action: NonNullable<ClientCoupState['pendingAction']>): string {
  const actor = nameOf(state, action.actorId);
  const target = action.targetId ? ` targeting ${nameOf(state, action.targetId)}` : '';
  const claim = action.claimedCharacter ? ` (claims ${CHARACTER_LABEL[action.claimedCharacter]})` : '';
  return `${actor} declared ${action.type}${target}${claim}.`;
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="absolute inset-x-0 bottom-0 flex flex-col gap-2 rounded-t-xl border p-3 backdrop-blur"
      style={{ borderColor: 'var(--coup-panel-border)', background: 'color-mix(in oklab, var(--coup-panel-bg) 92%, transparent)' }}
    >
      {children}
    </div>
  );
}

function PassiveNotice({ text, secondsLeft, tone }: { text: string; secondsLeft: number; tone?: 'success' }) {
  return (
    <Overlay>
      <div className="flex items-center gap-2">
        <CountdownRing secondsLeft={secondsLeft} />
        <p className="text-sm" style={{ color: tone === 'success' ? 'var(--coup-success)' : 'var(--coup-text-muted)' }}>{text}</p>
      </div>
    </Overlay>
  );
}

function CountdownRing({ secondsLeft }: { secondsLeft: number }) {
  const fraction = Math.max(0, Math.min(1, secondsLeft / RESPONSE_WINDOW_SECONDS));
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" className="shrink-0">
      <circle cx="16" cy="16" r={radius} fill="none" stroke="var(--coup-panel-border)" strokeWidth="3" />
      <circle
        cx="16"
        cy="16"
        r={radius}
        fill="none"
        stroke="var(--coup-gold)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - fraction)}
        transform="rotate(-90 16 16)"
        style={{ transition: 'stroke-dashoffset 200ms linear' }}
      />
      <text x="16" y="20" textAnchor="middle" fontSize="10" fill="var(--coup-text)">
        {secondsLeft}
      </text>
    </svg>
  );
}
