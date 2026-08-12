// src/components/coup/ActionBar.tsx
import { Button } from '@/components/ui/button';
import type { ClientCoupState } from '@/game/coup/redact';
import type { ActionType } from '@/game/coup/types';
import type { CoupController } from '@/client/coupController';

const ACTIONS: { type: ActionType; label: string; needsTarget: boolean; minCoins: number }[] = [
  { type: 'income', label: 'Income (+1)', needsTarget: false, minCoins: 0 },
  { type: 'foreign-aid', label: 'Foreign Aid (+2)', needsTarget: false, minCoins: 0 },
  { type: 'tax', label: 'Tax — Duke (+3)', needsTarget: false, minCoins: 0 },
  { type: 'exchange', label: 'Exchange — Ambassador', needsTarget: false, minCoins: 0 },
  { type: 'steal', label: 'Steal — Captain', needsTarget: true, minCoins: 0 },
  { type: 'assassinate', label: 'Assassinate — Assassin (3)', needsTarget: true, minCoins: 3 },
  { type: 'coup', label: 'Coup (7)', needsTarget: true, minCoins: 7 },
];

interface ActionBarProps {
  state: ClientCoupState;
  controller: CoupController;
  selectedTarget: string | null;
  onSelectTarget: (id: string | null) => void;
}

export default function ActionBar({ state, controller, selectedTarget, onSelectTarget }: ActionBarProps) {
  const you = state.players.find((p) => p.id === state.you)!;
  const yourTurn = state.players[state.turn]?.id === state.you;
  if (!yourTurn || state.phase !== 'idle') return null;

  const forcedCoup = you.coins >= 10;
  const opponents = state.players.filter((p) => p.id !== state.you && !p.eliminated);

  return (
    <div className="flex flex-col gap-2 border-t border-[#262c36] p-3">
      {opponents.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {opponents.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelectTarget(p.id)}
              className="rounded-full border px-2 py-0.5 text-xs"
              style={{ borderColor: selectedTarget === p.id ? '#c8155e' : '#262c36', color: selectedTarget === p.id ? '#c8155e' : '#8a909b' }}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {ACTIONS.filter((a) => !forcedCoup || a.type === 'coup').map((a) => {
          const target = a.needsTarget ? (selectedTarget ?? opponents[0]?.id ?? null) : null;
          const disabled = you.coins < a.minCoins || (a.needsTarget && !target);
          return (
            <Button
              key={a.type}
              size="sm"
              disabled={disabled}
              onClick={() => controller.declareAction(a.type, target)}
            >
              {a.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
