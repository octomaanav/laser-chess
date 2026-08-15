// src/components/coup/ResponseModal.tsx
'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { ClientCoupState } from '@/game/coup/redact';
import type { BlockCharacter, Character } from '@/game/coup/types';
import type { CoupController } from '@/client/coupController';
import { CHARACTER_LABEL } from './characterAccent';
import { BLOCKERS_FOR } from '@/game/coup/types';
import type { StateWithCountdown } from './types';
import { useTableEvents } from './useTableEvents';
import CharacterCard from './CharacterCard';
import CardTilt from './CardTilt';

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
    return (
      <PassiveNotice
        character={proved.character}
        text={`${nameOf(state, proved.playerId)} proved ${CHARACTER_LABEL[proved.character]}!`}
        secondsLeft={secondsLeft}
        tone="success"
      />
    );
  }

  if (state.phase === 'action_declared') {
    const canChallenge = !eliminated && !isActor && !!action.claimedCharacter;
    const blockers = BLOCKERS_FOR[action.type];
    const canBlock = !eliminated && !!blockers && (action.type === 'foreign-aid' ? !isActor : isTarget);
    if (!canChallenge && !canBlock) {
      return <PassiveNotice character={action.claimedCharacter} text={describeAction(state, action)} secondsLeft={secondsLeft} />;
    }
    if (responded) {
      const othersLeft = state.players.filter((p) => !p.eliminated && p.id !== state.you && p.id !== action.actorId).length;
      return (
        <PassiveNotice
          character={action.claimedCharacter}
          text={othersLeft > 0 ? 'You responded — waiting on others…' : 'You responded — resolving…'}
          secondsLeft={secondsLeft}
        />
      );
    }

    return (
      <DecisionCard character={action.claimedCharacter} secondsLeft={secondsLeft} headline={describeAction(state, action)}>
        {canChallenge && (
          <Button variant="destructive" size="lg" className="font-semibold" onClick={() => respond(() => controller.challenge())}>
            Challenge ({CHARACTER_LABEL[action.claimedCharacter!]}?)
          </Button>
        )}
        {canBlock &&
          blockers!.map((b: BlockCharacter) => (
            <Button key={b} size="lg" className="font-semibold" onClick={() => respond(() => controller.declareBlock(b))}>
              Block as {CHARACTER_LABEL[b]}
            </Button>
          ))}
        <Button variant="secondary" size="lg" className="font-semibold" onClick={() => respond(() => controller.pass())}>
          Pass
        </Button>
      </DecisionCard>
    );
  }

  // block_declared: anyone (including the actor) may challenge the block
  const block = state.pendingBlock!;
  const canChallengeBlock = !eliminated && block.byId !== state.you;
  if (!canChallengeBlock) {
    return (
      <PassiveNotice
        character={block.claimedCharacter}
        text={`${nameOf(state, block.byId)} claims ${CHARACTER_LABEL[block.claimedCharacter]} to block.`}
        secondsLeft={secondsLeft}
      />
    );
  }
  if (responded) {
    const othersLeft = state.players.filter((p) => !p.eliminated && p.id !== state.you && p.id !== block.byId).length;
    return (
      <PassiveNotice
        character={block.claimedCharacter}
        text={othersLeft > 0 ? 'You responded — waiting on others…' : 'You responded — resolving…'}
        secondsLeft={secondsLeft}
      />
    );
  }

  return (
    <DecisionCard
      character={block.claimedCharacter}
      secondsLeft={secondsLeft}
      headline={`${nameOf(state, block.byId)} claims ${CHARACTER_LABEL[block.claimedCharacter]} to block.`}
    >
      <Button variant="destructive" size="lg" className="font-semibold" onClick={() => respond(() => controller.challenge())}>
        Challenge
      </Button>
      <Button variant="secondary" size="lg" className="font-semibold" onClick={() => respond(() => controller.pass())}>
        Pass
      </Button>
    </DecisionCard>
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

// The moment someone else's claim is on the table is the emotional peak of
// a turn — it gets center stage with a dimmed scrim and the actual claimed
// card's art, not a squeezed-in bottom toolbar competing with the hand and
// the log for the same few inches of screen.
function DecisionCard({
  character,
  secondsLeft,
  headline,
  children,
}: {
  character: Character | null;
  secondsLeft: number;
  headline: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center p-4"
      style={{ background: 'color-mix(in oklab, black 45%, transparent)' }}
    >
      <div
        className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border p-5 text-center shadow-2xl animate-in fade-in zoom-in-95"
        style={{ borderColor: 'var(--coup-gold)', background: 'var(--coup-panel-bg)' }}
      >
        <CountdownRing secondsLeft={secondsLeft} size={44} />
        {character && (
          <CardTilt>
            <CharacterCard character={character} size="sm" />
          </CardTilt>
        )}
        <p className="text-sm font-medium" style={{ color: 'var(--coup-text)' }}>
          {headline}
        </p>
        <div className="flex w-full flex-col gap-2">{children}</div>
      </div>
    </div>
  );
}

// Shown to players who can't act on this decision (or already responded) —
// stays out of the way instead of dimming the whole table, since there's
// nothing for them to decide.
function PassiveNotice({
  character,
  text,
  secondsLeft,
  tone,
}: {
  character: Character | null;
  text: string;
  secondsLeft: number;
  tone?: 'success';
}) {
  const accent = tone === 'success' ? 'var(--coup-success)' : 'var(--coup-gold)';
  return (
    <div className="pointer-events-none absolute inset-x-0 top-16 z-20 flex justify-center px-3 lg:top-20">
      <div
        className="flex items-center gap-2.5 overflow-hidden rounded-lg border shadow-lg backdrop-blur"
        style={{
          borderColor: 'var(--coup-panel-border)',
          background: 'color-mix(in oklab, var(--coup-panel-bg) 92%, transparent)',
        }}
      >
        <span className="self-stretch" style={{ width: 3, background: accent }} aria-hidden />
        <div className="flex items-center gap-2.5 py-2 pr-3.5">
          {character && <CharacterMini character={character} />}
          <p className="text-xs font-medium sm:text-sm" style={{ color: tone === 'success' ? 'var(--coup-success)' : 'var(--coup-text)' }}>
            {text}
          </p>
          <CountdownRing secondsLeft={secondsLeft} size={22} />
        </div>
      </div>
    </div>
  );
}

// A properly-cropped small card thumbnail (not a scaled-down "lg" card with
// negative margins) so it sits cleanly next to a line of text at toast size.
function CharacterMini({ character }: { character: Character }) {
  return (
    <div
      className="hidden shrink-0 items-center justify-center overflow-hidden rounded sm:flex"
      style={{ width: 21, height: 30 }}
    >
      <div style={{ width: 56, height: 80, transform: 'scale(0.375)', transformOrigin: 'top left' }}>
        <CharacterCard character={character} size="sm" />
      </div>
    </div>
  );
}

function CountdownRing({ secondsLeft, size = 32 }: { secondsLeft: number; size?: number }) {
  const fraction = Math.max(0, Math.min(1, secondsLeft / RESPONSE_WINDOW_SECONDS));
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className="shrink-0">
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
