// src/components/coup/CoupTable.tsx
import CharacterCard from './CharacterCard';
import Treasury from './Treasury';
import { useTableEvents } from './useTableEvents';
import type { StateWithCountdown } from './types';

export default function CoupTable({ state }: { state: StateWithCountdown }) {
  const you = state.players.find((p) => p.id === state.you)!;
  const opponents = state.players.filter((p) => p.id !== state.you);
  const activeId = state.players[state.turn]?.id;
  const events = useTableEvents(state);

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <div className="flex flex-wrap justify-center gap-2">
        {opponents.map((p) => {
          const isActive = p.id === activeId;
          const stolenFrom = events.find((e) => e.kind === 'coins-stolen' && e.fromId === p.id);
          const proved = events.find((e) => e.kind === 'claim-proved' && e.playerId === p.id);
          const blocked = events.find((e) => e.kind === 'block-declared' && e.actorId === p.id);
          const hit = events.find((e) => e.kind === 'card-revealed' && e.playerId === p.id && e.cause === 'hit');

          return (
            <div
              key={p.id}
              className="relative flex flex-col items-center gap-1 rounded-xl border p-2"
              style={{
                background: 'var(--coup-panel-bg)',
                borderColor: proved ? 'var(--coup-success)' : hit ? 'var(--coup-danger)' : 'var(--coup-panel-border)',
                boxShadow: isActive ? 'var(--coup-glow-ring)' : undefined,
                animation: [
                  isActive && 'coup-pulse-glow 1.8s ease-in-out infinite',
                  stolenFrom && 'coup-shake 400ms ease-in-out',
                  hit && 'coup-shake 400ms ease-in-out',
                ]
                  .filter(Boolean)
                  .join(', ') || undefined,
              }}
            >
              {isActive && (
                <span
                  className="absolute -top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
                  style={{ background: 'var(--coup-gold)' }}
                >
                  their turn
                </span>
              )}
              {blocked && (
                <span
                  className="absolute -right-2 -top-2 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
                  style={{ background: 'var(--coup-danger)', animation: 'coup-float-up 1.1s ease-out forwards' }}
                >
                  blocked
                </span>
              )}
              <div className="text-xs font-medium" style={{ color: 'var(--coup-text)' }}>
                {p.name} {p.eliminated && '(out)'}
                {!p.connected && !p.eliminated && ' · reconnecting…'}
              </div>
              <CoinChips coins={p.coins} danger={!!stolenFrom} />
              <div className="flex gap-1">
                {p.influence.map((c, i) => {
                  const revealedNow = events.find((e) => e.kind === 'card-revealed' && e.playerId === p.id && e.cardIndex === i);
                  return (
                    <CharacterCard
                      key={i}
                      character={c.character}
                      revealed={c.revealed}
                      size="sm"
                      className={revealedNow ? 'animate-[coup-card-flip_500ms_ease-in-out]' : undefined}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-1 items-center justify-center">
        <Treasury amount={state.treasury} events={events} />
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--coup-text)' }}>
          <span>{you.name}</span>
          <CoinChips coins={you.coins} danger={!!events.find((e) => e.kind === 'coins-stolen' && e.fromId === you.id)} />
          {activeId === you.id && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
              style={{ background: 'var(--coup-gold)' }}
            >
              your turn
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {you.influence.map((c, i) => {
            const revealedNow = events.find((e) => e.kind === 'card-revealed' && e.playerId === you.id && e.cardIndex === i);
            return (
              <CharacterCard
                key={i}
                character={c.character}
                revealed={c.revealed}
                size="lg"
                className={revealedNow ? 'animate-[coup-card-flip_500ms_ease-in-out]' : undefined}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CoinChips({ coins, danger }: { coins: number; danger?: boolean }) {
  const visible = Math.min(coins, 8);
  return (
    <div className="flex items-center" style={{ animation: danger ? 'coup-shake 400ms ease-in-out' : undefined }}>
      {Array.from({ length: visible }).map((_, i) => (
        <span
          key={i}
          className="-ml-1.5 inline-block h-3.5 w-3.5 rounded-full border first:ml-0"
          style={{ background: danger ? 'var(--coup-danger)' : 'var(--coup-gold)', borderColor: 'var(--coup-gold-dark)' }}
        />
      ))}
      <span className="ml-1 text-[11px]" style={{ color: 'var(--coup-text-muted)' }}>
        {coins}
      </span>
    </div>
  );
}
