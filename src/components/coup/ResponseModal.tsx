// src/components/coup/ResponseModal.tsx
'use client';
import { Button } from '@/components/ui/button';
import type { ClientCoupState } from '@/game/coup/redact';
import type { BlockCharacter } from '@/game/coup/types';
import type { CoupController } from '@/client/coupController';
import { CHARACTER_LABEL } from './characterAccent';
import { BLOCKERS_FOR } from '@/game/coup/types';

// See CoupTable.tsx — same derived-countdown widening, synthesized client-side
// in CoupGamePlay.tsx and not part of the ClientCoupState wire payload.
export type StateWithCountdown = ClientCoupState & { responseDeadlineMsRemaining: number };

interface ResponseModalProps {
  state: StateWithCountdown;
  controller: CoupController;
}

export default function ResponseModal({ state, controller }: ResponseModalProps) {
  const open = state.phase === 'action_declared' || state.phase === 'block_declared';
  if (!open || !state.pendingAction) return null;

  const action = state.pendingAction;
  const isActor = action.actorId === state.you;
  const isTarget = action.targetId === state.you;
  const secondsLeft = state.responseDeadlineMsRemaining ?? 0;

  if (state.phase === 'action_declared') {
    const canChallenge = !isActor && !!action.claimedCharacter;
    const blockers = BLOCKERS_FOR[action.type];
    const canBlock = !!blockers && (action.type === 'foreign-aid' ? !isActor : isTarget);
    if (!canChallenge && !canBlock) return <PassiveNotice text={describeAction(state, action)} secondsLeft={secondsLeft} />;

    return (
      <Overlay>
        <p className="text-sm text-white/80">{describeAction(state, action)}</p>
        <div className="flex flex-wrap gap-2">
          {canChallenge && (
            <Button variant="destructive" size="sm" onClick={() => controller.challenge()}>
              Challenge ({CHARACTER_LABEL[action.claimedCharacter!]}?)
            </Button>
          )}
          {canBlock &&
            blockers!.map((b: BlockCharacter) => (
              <Button key={b} size="sm" onClick={() => controller.declareBlock(b)}>
                Block as {CHARACTER_LABEL[b]}
              </Button>
            ))}
          <Button variant="secondary" size="sm" onClick={() => controller.pass()}>
            Pass
          </Button>
        </div>
        <div className="text-xs text-[#5a6070]">{secondsLeft}s</div>
      </Overlay>
    );
  }

  // block_declared: anyone (including the actor) may challenge the block
  const block = state.pendingBlock!;
  const canChallengeBlock = block.byId !== state.you;
  if (!canChallengeBlock) return <PassiveNotice text={`${nameOf(state, block.byId)} claims ${CHARACTER_LABEL[block.claimedCharacter]} to block.`} secondsLeft={secondsLeft} />;

  return (
    <Overlay>
      <p className="text-sm text-white/80">
        {nameOf(state, block.byId)} claims {CHARACTER_LABEL[block.claimedCharacter]} to block.
      </p>
      <div className="flex gap-2">
        <Button variant="destructive" size="sm" onClick={() => controller.challenge()}>
          Challenge
        </Button>
        <Button variant="secondary" size="sm" onClick={() => controller.pass()}>
          Pass
        </Button>
      </div>
      <div className="text-xs text-[#5a6070]">{secondsLeft}s</div>
    </Overlay>
  );
}

function nameOf(state: ClientCoupState, id: string): string {
  return state.players.find((p) => p.id === id)?.name ?? '?';
}

function describeAction(state: ClientCoupState, action: NonNullable<ClientCoupState['pendingAction']>): string {
  const actor = nameOf(state, action.actorId);
  const target = action.targetId ? ` targeting ${nameOf(state, action.targetId)}` : '';
  const claim = action.claimedCharacter ? ` (claims ${CHARACTER_LABEL[action.claimedCharacter]})` : '';
  return `${actor} declared ${action.type}${target}${claim}.`;
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 rounded-t-xl border border-[#c8155e55] bg-[#0d1117]/95 p-3 backdrop-blur">
      {children}
    </div>
  );
}

function PassiveNotice({ text, secondsLeft }: { text: string; secondsLeft: number }) {
  return (
    <Overlay>
      <p className="text-sm text-white/60">{text}</p>
      <div className="text-xs text-[#5a6070]">Waiting… {secondsLeft}s</div>
    </Overlay>
  );
}
