import { Crown } from 'lucide-react';
import type { Player } from '@/game/flip7/types';
import { computeHandScore } from '@/game/flip7/engine';
import Flip7Card from './art/Flip7Card';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<Player['status'], string> = {
  active: 'Active',
  stayed: 'Stayed',
  busted: 'Busted',
  frozen: 'Frozen',
  forfeited: 'Left',
};

const STATUS_COLOR: Record<Player['status'], string> = {
  active: 'var(--flip7-amber)',
  stayed: 'var(--flip7-green)',
  busted: 'var(--flip7-danger)',
  frozen: '#7dd3fc',
  forfeited: 'var(--flip7-text-muted)',
};

export default function PlayerHand({
  player,
  isYou,
  isTurn,
  isDealer,
}: {
  player: Player;
  isYou: boolean;
  isTurn: boolean;
  isDealer: boolean;
}) {
  const score = computeHandScore(player.hand);
  const numbers = player.hand.filter((c) => c.kind === 'number').length;

  return (
    <div
      className={cn('flex min-w-0 flex-col gap-2 rounded-xl border p-3 transition-shadow', isTurn && 'shadow-lg')}
      style={{
        borderColor: isTurn ? 'var(--flip7-amber)' : 'var(--flip7-panel-border)',
        background: 'color-mix(in oklab, var(--flip7-panel-bg) 92%, transparent)',
        boxShadow: isTurn ? 'var(--flip7-glow-ring)' : undefined,
        opacity: player.status === 'forfeited' ? 0.5 : 1,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 truncate text-sm font-semibold" style={{ color: 'var(--flip7-text)' }}>
          {isDealer && <Crown className="size-3.5 shrink-0" style={{ color: 'var(--flip7-amber)' }} />}
          <span className="truncate">{player.name}</span>
          {isYou && <span className="shrink-0 text-xs font-normal" style={{ color: 'var(--flip7-text-muted)' }}>(you)</span>}
          {!player.connected && player.status !== 'forfeited' && (
            <span className="shrink-0 text-xs font-normal" style={{ color: 'var(--flip7-danger)' }}>
              offline
            </span>
          )}
        </span>
        <span
          className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
          style={{ borderColor: STATUS_COLOR[player.status], color: STATUS_COLOR[player.status] }}
        >
          {STATUS_LABEL[player.status]}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {player.hand.length === 0 ? (
          <span className="text-xs" style={{ color: 'var(--flip7-text-muted)' }}>
            No cards yet
          </span>
        ) : (
          player.hand.map((c, i) => <Flip7Card key={i} card={c} size="sm" />)
        )}
      </div>

      <div className="flex items-center justify-between text-xs" style={{ color: 'var(--flip7-text-muted)' }}>
        <span>{numbers}/7 numbers</span>
        <span className="font-bold" style={{ color: 'var(--flip7-text)' }}>
          {score} pt{score === 1 ? '' : 's'}
        </span>
      </div>
    </div>
  );
}
