import type { ClientCoupState } from '@/game/coup/redact';
import type { CoupController } from '@/client/coupController';
import { ACTIONS } from './actionDefinitions';

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
    <div className="flex flex-col gap-2 border-t p-3 lg:hidden" style={{ borderColor: 'var(--coup-panel-border)', background: 'var(--coup-panel-bg)' }}>
      {opponents.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {opponents.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelectTarget(p.id)}
              className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors"
              style={{
                borderColor: selectedTarget === p.id ? 'var(--coup-gold)' : 'var(--coup-panel-border)',
                color: selectedTarget === p.id ? 'var(--coup-gold-dark)' : 'var(--coup-text-muted)',
              }}
            >
              <span>{p.name}</span>
              <span
                className="flex items-center gap-0.5 rounded-full px-1.5 text-[10px] font-semibold"
                style={{ background: 'color-mix(in oklab, var(--coup-gold) 18%, transparent)', color: 'var(--coup-gold-dark)' }}
              >
                {p.coins}c
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {ACTIONS.filter((a) => !forcedCoup || a.type === 'coup').map((a) => {
          const target = a.needsTarget ? (selectedTarget ?? opponents[0]?.id ?? null) : null;
          const disabled = you.coins < a.minCoins || (a.needsTarget && !target);
          const Icon = a.icon;
          return (
            <button
              key={a.type}
              disabled={disabled}
              onClick={() => controller.declareAction(a.type, target)}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none"
              style={{ borderColor: a.accentVar, color: a.accentVar, background: 'var(--coup-panel-bg)' }}
            >
              <Icon className="h-3.5 w-3.5" />
              {a.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
