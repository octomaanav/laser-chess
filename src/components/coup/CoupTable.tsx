// src/components/coup/CoupTable.tsx
import type { ClientCoupState } from '@/game/coup/redact';
import CharacterCard from './CharacterCard';
import GameLog from './GameLog';

// ResponseModal (Task 13)/CoupGamePlay (Task 14) synthesize a countdown field
// client-side that isn't part of the wire payload — see CoupGamePlay.tsx.
export type StateWithCountdown = ClientCoupState & { responseDeadlineMsRemaining: number };

export default function CoupTable({ state }: { state: StateWithCountdown }) {
  const you = state.players.find((p) => p.id === state.you)!;
  const opponents = state.players.filter((p) => p.id !== state.you);
  const yourTurn = state.players[state.turn]?.id === state.you;

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <div className="flex flex-wrap justify-center gap-2">
        {opponents.map((p) => (
          <div
            key={p.id}
            className="flex flex-col items-center gap-1 rounded-lg border p-2"
            style={{ borderColor: state.players[state.turn]?.id === p.id ? '#c8155e88' : '#262c36' }}
          >
            <div className="text-xs text-[#8a909b]">
              {p.name} {p.eliminated ? '(out)' : `· ${p.coins}c`}
              {!p.connected && !p.eliminated && ' · reconnecting…'}
            </div>
            <div className="flex gap-1">
              {p.influence.map((c, i) => (
                <CharacterCard key={i} character={c.character} revealed={c.revealed} size="sm" />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-[#333] text-xs text-[#5a6070]">
        <GameLog entries={state.log} />
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="text-sm font-semibold" style={{ color: yourTurn ? '#c3f53b' : '#c8155e' }}>
          {you.name} · {you.coins} coins {yourTurn && '· your turn'}
        </div>
        <div className="flex gap-2">
          {you.influence.map((c, i) => (
            <CharacterCard key={i} character={c.character} revealed={c.revealed} size="lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
