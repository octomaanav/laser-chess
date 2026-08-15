// src/components/coup/TurnOrder.tsx
import PlayerAvatar from './PlayerAvatar';
import type { ClientCoupState } from '@/game/coup/redact';

// A slim turn-order strip so players 3+ deep in a 4-6 player game can see
// who's up now AND who's next, instead of only ever knowing "whose turn is
// it right now" — the seat panels alone don't communicate sequence.
export default function TurnOrder({ state }: { state: ClientCoupState }) {
  const players = state.players;
  if (players.length <= 2) return null; // with 2 players "next" is just "the other one" — no queue needed

  const activeIndex = state.turn;
  const nextIndex = (() => {
    for (let step = 1; step <= players.length; step++) {
      const i = (activeIndex + step) % players.length;
      if (!players[i].eliminated) return i;
    }
    return -1;
  })();

  return (
    <div className="flex items-center justify-center gap-2 py-1.5">
      {players.map((p, i) => {
        const isActive = i === activeIndex;
        const isNext = i === nextIndex && !isActive;
        return (
          <div
            key={p.id}
            className="flex items-center justify-center rounded-full"
            style={{
              boxShadow: isActive
                ? '0 0 0 2px var(--coup-gold)'
                : isNext
                  ? '0 0 0 1.5px var(--coup-gold-dark)'
                  : undefined,
              opacity: isNext ? 0.85 : 1,
            }}
          >
            <PlayerAvatar id={p.id} name={p.name} size={isActive ? 26 : 22} muted={p.eliminated} />
          </div>
        );
      })}
    </div>
  );
}
