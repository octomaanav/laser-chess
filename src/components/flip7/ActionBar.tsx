import { Snowflake, RotateCcw, ShieldPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ClientFlip7State } from '@/game/flip7/redact';
import type { Flip7Controller } from '@/client/flip7Controller';

const KIND_LABEL = { freeze: 'Freeze', 'flip-three': 'Flip Three', 'second-chance': 'Second Chance' } as const;
const KIND_ICON = { freeze: Snowflake, 'flip-three': RotateCcw, 'second-chance': ShieldPlus } as const;

export default function ActionBar({ state, controller }: { state: ClientFlip7State; controller: Flip7Controller }) {
  if (state.flipThreeQueue.length > 0) {
    const front = state.flipThreeQueue[0];
    const target = state.players.find((p) => p.id === front.targetId);
    return (
      <div className="flex items-center justify-center gap-2 border-t p-3 text-sm" style={{ borderColor: 'var(--flip7-panel-border)', background: 'var(--flip7-panel-bg)', color: 'var(--flip7-text-muted)' }}>
        <RotateCcw className="size-4 animate-spin" style={{ color: 'var(--flip7-danger)' }} />
        {target?.name} is forced to draw {front.remaining} more card{front.remaining === 1 ? '' : 's'}…
      </div>
    );
  }

  if (state.phase === 'awaiting_target' && state.pendingTarget) {
    const { drawerId, kind } = state.pendingTarget;
    const drawer = state.players.find((p) => p.id === drawerId);
    const Icon = KIND_ICON[kind];

    if (drawerId !== state.you) {
      return (
        <div className="flex items-center justify-center gap-2 border-t p-3 text-sm" style={{ borderColor: 'var(--flip7-panel-border)', background: 'var(--flip7-panel-bg)', color: 'var(--flip7-text-muted)' }}>
          <Icon className="size-4" style={{ color: 'var(--flip7-amber)' }} />
          Waiting for {drawer?.name} to choose a {KIND_LABEL[kind]} target…
        </div>
      );
    }

    const eligible = state.players.filter((p) => {
      if (p.status !== 'active') return false;
      if (kind === 'second-chance') {
        return p.id !== drawerId && !p.hand.some((c) => c.kind === 'action' && c.action === 'second-chance');
      }
      return true;
    });

    const choose = (targetId: string) => {
      if (kind === 'freeze') controller.chooseFreezeTarget(targetId);
      else if (kind === 'flip-three') controller.chooseFlipThreeTarget(targetId);
      else controller.chooseSecondChanceRecipient(targetId);
    };

    return (
      <div className="flex flex-col items-center gap-2 border-t p-3" style={{ borderColor: 'var(--flip7-panel-border)', background: 'var(--flip7-panel-bg)' }}>
        <p className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--flip7-text)' }}>
          <Icon className="size-4" style={{ color: 'var(--flip7-amber)' }} />
          {kind === 'second-chance' ? 'Give your extra Second Chance to…' : `Choose a target for ${KIND_LABEL[kind]}`}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {eligible.map((p) => (
            <Button key={p.id} variant="outline" onClick={() => choose(p.id)} style={{ borderColor: 'var(--flip7-amber)', color: 'var(--flip7-text)' }}>
              {p.name}
              {p.id === state.you ? ' (you)' : ''}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  if (state.phase !== 'round_active') return null;
  const you = state.players.find((p) => p.id === state.you);
  const yourTurn = state.players[state.turn]?.id === state.you;
  if (!you || !yourTurn || you.status !== 'active') return null;

  return (
    <div className="flex items-center justify-center gap-3 border-t p-3" style={{ borderColor: 'var(--flip7-panel-border)', background: 'var(--flip7-panel-bg)' }}>
      <Button size="lg" className="font-semibold" style={{ background: 'var(--flip7-amber)', color: '#1c1420' }} onClick={() => controller.hit()}>
        Hit
      </Button>
      <Button size="lg" variant="outline" className="font-semibold" style={{ borderColor: 'var(--flip7-green)', color: 'var(--flip7-green)' }} onClick={() => controller.stay()}>
        Stay
      </Button>
    </div>
  );
}
