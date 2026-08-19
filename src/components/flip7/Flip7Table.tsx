import { Layers } from 'lucide-react';
import type { ClientFlip7State } from '@/game/flip7/redact';
import PlayerHand from './PlayerHand';

export default function Flip7Table({ state }: { state: ClientFlip7State }) {
  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4">
      <div className="flex items-center justify-between text-xs" style={{ color: 'var(--flip7-text-muted)' }}>
        <span>
          Round {state.round} · Dealer: {state.players[state.dealerIndex]?.name}
        </span>
        <span className="flex items-center gap-1.5">
          <Layers className="size-3.5" />
          {state.deckCount} left in deck
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {state.players.map((p, i) => (
          <PlayerHand key={p.id} player={p} isYou={p.id === state.you} isTurn={i === state.turn && state.phase === 'round_active'} isDealer={i === state.dealerIndex} />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--flip7-panel-border)', color: 'var(--flip7-text-muted)' }}>
        {[...state.players]
          .sort((a, b) => b.totalScore - a.totalScore)
          .map((p) => (
            <span key={p.id}>
              <span style={{ color: 'var(--flip7-text)' }} className="font-semibold">
                {p.name}
              </span>
              : {p.totalScore}
            </span>
          ))}
      </div>
    </div>
  );
}
