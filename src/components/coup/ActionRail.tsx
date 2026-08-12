'use client';
import { useState } from 'react';
import type { ClientCoupState } from '@/game/coup/redact';
import type { CoupController } from '@/client/coupController';
import { ACTIONS } from './actionDefinitions';

interface ActionRailProps {
  state: ClientCoupState;
  controller: CoupController;
  selectedTarget: string | null;
  onSelectTarget: (id: string | null) => void;
}

// Desktop-only (rendered hidden below `lg`, see CoupGamePlay.tsx) home for
// turn-taking actions: the three character-less actions as buttons, the
// target picker, and a "claim a character" popover for declaring a
// character action you don't actually hold (bluffing) or without dragging.
export default function ActionRail({ state, controller, selectedTarget, onSelectTarget }: ActionRailProps) {
  const [claimOpen, setClaimOpen] = useState(false);
  const you = state.players.find((p) => p.id === state.you)!;
  const yourTurn = state.players[state.turn]?.id === state.you;
  const active = yourTurn && state.phase === 'idle';

  const forcedCoup = you.coins >= 10;
  const opponents = state.players.filter((p) => p.id !== state.you && !p.eliminated);
  const neutralActions = ACTIONS.filter((a) => a.type === 'income' || a.type === 'foreign-aid' || a.type === 'coup');
  const characterActions = ACTIONS.filter((a) => a.type !== 'income' && a.type !== 'foreign-aid' && a.type !== 'coup');

  return (
    <div
      className="relative hidden w-64 shrink-0 flex-col gap-4 border-l p-4 lg:flex"
      style={{ borderColor: 'var(--coup-panel-border)', background: 'var(--coup-panel-bg)' }}
    >
      {active && (
        <>
          {opponents.length > 1 && (
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--coup-text-muted)' }}>
                Target
              </div>
              <div className="flex flex-wrap gap-1">
                {opponents.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onSelectTarget(p.id)}
                    className="rounded-full border px-2 py-0.5 text-xs transition-colors"
                    style={{
                      borderColor: selectedTarget === p.id ? 'var(--coup-gold)' : 'var(--coup-panel-border)',
                      color: selectedTarget === p.id ? 'var(--coup-gold-dark)' : 'var(--coup-text-muted)',
                    }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {neutralActions
              .filter((a) => !forcedCoup || a.type === 'coup')
              .map((a) => {
                const target = a.needsTarget ? (selectedTarget ?? opponents[0]?.id ?? null) : null;
                const disabled = you.coins < a.minCoins || (a.needsTarget && !target);
                const Icon = a.icon;
                return (
                  <button
                    key={a.type}
                    disabled={disabled}
                    onClick={() => controller.declareAction(a.type, target)}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                    style={{ borderColor: a.accentVar, color: a.accentVar, background: 'var(--coup-panel-bg)' }}
                  >
                    <Icon className="h-4 w-4" />
                    {a.label}
                  </button>
                );
              })}
          </div>

          {!forcedCoup && (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setClaimOpen((o) => !o)}
                className="rounded-lg border px-3 py-2 text-sm font-semibold transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
                style={{ borderColor: 'var(--coup-gold)', color: 'var(--coup-gold-dark)', background: 'var(--coup-panel-bg)' }}
              >
                Claim a character…
              </button>
              {claimOpen && (
                <div
                  className="flex flex-col gap-1 rounded-lg border p-2"
                  style={{ borderColor: 'var(--coup-panel-border)', background: 'var(--coup-table-bg)' }}
                >
                  {characterActions.map((a) => {
                    const target = a.needsTarget ? (selectedTarget ?? opponents[0]?.id ?? null) : null;
                    const disabled = you.coins < a.minCoins || (a.needsTarget && !target);
                    const Icon = a.icon;
                    return (
                      <button
                        key={a.type}
                        disabled={disabled}
                        onClick={() => {
                          controller.declareAction(a.type, target);
                          setClaimOpen(false);
                        }}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                        style={{ color: a.accentVar }}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {a.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
