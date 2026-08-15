// src/components/coup/MomentBanner.tsx
'use client';
import { CheckCircle2, ShieldCheck, Skull, VenetianMask, Flag } from 'lucide-react';
import type { ClientCoupState } from '@/game/coup/redact';
import { CHARACTER_LABEL } from './characterAccent';
import { useTableEvents } from './useTableEvents';
import type { TableEvent } from './tableEvents';
import type { StateWithCountdown } from './types';

// A big, hard-to-miss call-out for the moments the bottom log alone made
// easy to miss — losing a challenge, proving one, taking a hit, or a block
// going up. Sits centered over the table so every player sees the same
// story beat at the same time, not just whoever happened to be reading the
// log line at the bottom of the screen.
function nameOf(state: ClientCoupState, id: string): string {
  return state.players.find((p) => p.id === id)?.name ?? '?';
}

interface Moment {
  text: string;
  tone: 'danger' | 'success' | 'neutral';
  Icon: typeof CheckCircle2;
}

function momentFor(state: ClientCoupState, event: TableEvent): Moment | null {
  switch (event.kind) {
    case 'card-revealed': {
      if (event.cause === 'challenge-lost') {
        const claim = event.claimedCharacter ? CHARACTER_LABEL[event.claimedCharacter] : 'their claim';
        return { text: `${nameOf(state, event.playerId)} was bluffing about ${claim} — loses an influence!`, tone: 'danger', Icon: VenetianMask };
      }
      if (event.cause === 'hit') {
        return { text: `${nameOf(state, event.playerId)} is hit — loses an influence!`, tone: 'danger', Icon: Skull };
      }
      return null;
    }
    case 'claim-proved':
      return { text: `${nameOf(state, event.playerId)} proved ${CHARACTER_LABEL[event.character]}!`, tone: 'success', Icon: CheckCircle2 };
    case 'block-declared':
      return {
        text: `${nameOf(state, event.blockerId)} blocks with ${CHARACTER_LABEL[event.claimedCharacter]}!`,
        tone: 'neutral',
        Icon: ShieldCheck,
      };
    case 'player-eliminated':
      return { text: `${nameOf(state, event.playerId)} is eliminated!`, tone: 'danger', Icon: Flag };
    default:
      return null;
  }
}

const TONE_COLOR: Record<Moment['tone'], string> = {
  danger: 'var(--coup-danger)',
  success: 'var(--coup-success)',
  neutral: 'var(--coup-gold)',
};

export default function MomentBanner({ state }: { state: StateWithCountdown }) {
  const events = useTableEvents(state);
  // Priority: a challenge loss/hit is the most consequential thing that can
  // happen, so it wins over a same-tick block/proved banner.
  const priority: TableEvent['kind'][] = ['player-eliminated', 'card-revealed', 'claim-proved', 'block-declared'];
  let moment: Moment | null = null;
  for (const kind of priority) {
    const event = events.find((e) => e.kind === kind);
    if (event) {
      moment = momentFor(state, event);
      if (moment) break;
    }
  }

  if (!moment) return null;
  const { text, tone, Icon } = moment;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-3 lg:top-6">
      <div
        key={text}
        className="flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-lg animate-in fade-in slide-in-from-top-2"
        style={{
          borderColor: TONE_COLOR[tone],
          background: 'color-mix(in oklab, var(--coup-panel-bg) 90%, transparent)',
          color: 'var(--coup-text)',
          boxShadow: `0 0 0 1px color-mix(in oklab, ${TONE_COLOR[tone]} 40%, transparent), 0 10px 30px -10px rgba(0,0,0,0.5)`,
        }}
      >
        <Icon className="size-4 shrink-0" style={{ color: TONE_COLOR[tone] }} />
        <span>{text}</span>
      </div>
    </div>
  );
}
