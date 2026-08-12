// Overlays for the three phases that have no server-side timeout and
// therefore MUST have a reachable UI path, or the room deadlocks forever:
//   - variant-setup: 2-player-only starting-character draft (blocks move zero
//     of every 2p game)
//   - awaiting_reveal: choosing which influence card to flip face up
//   - exchange_choice: Ambassador exchange (choosing which cards to keep)
'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { ClientCoupState } from '@/game/coup/redact';
import type { Character } from '@/game/coup/types';
import type { CoupController } from '@/client/coupController';
import CharacterCard from './CharacterCard';

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="absolute inset-x-0 bottom-0 flex flex-col gap-3 rounded-t-xl border p-3 backdrop-blur"
      style={{ borderColor: 'var(--coup-panel-border)', background: 'color-mix(in oklab, var(--coup-panel-bg) 92%, transparent)' }}
    >
      {children}
    </div>
  );
}

export function VariantSetupPicker({ state, controller }: { state: ClientCoupState; controller: CoupController }) {
  const [chosen, setChosen] = useState(false);
  const pool = state.variantPoolForYou;

  // Reset if the server ever cycles us back into a fresh draft (e.g. rematch).
  // Keyed on state.phase (not `pool`) deliberately: `pool` is a freshly
  // parsed array on every single state broadcast (including the ones fired
  // right after the choice this player just made, while waiting on the
  // other player), so keying on its identity re-armed the picker and let a
  // second click hit the server's "already chosen" rejection. `state.phase`
  // only changes when we actually leave/re-enter variant-setup.
  useEffect(() => {
    setChosen(false);
  }, [state.phase]);

  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-4 p-6"
      style={{ background: 'var(--coup-table-bg)', color: 'var(--coup-text)' }}
    >
      <h2 className="text-lg font-bold" style={{ color: 'var(--coup-gold)' }}>
        Choose your starting character
      </h2>
      {!pool || chosen ? (
        <p className="text-sm" style={{ color: 'var(--coup-text-muted)' }}>Waiting for your opponent to choose…</p>
      ) : (
        <div className="flex flex-wrap justify-center gap-3">
          {pool.map((c, i) => (
            <button
              key={`${c}-${i}`}
              onClick={() => {
                setChosen(true);
                controller.chooseStartingCharacter(c);
              }}
            >
              <CharacterCard character={c} size="lg" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function RevealPicker({ state, controller }: { state: ClientCoupState; controller: CoupController }) {
  const active = state.pendingRevealPlayerId === state.you;
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!active) setSubmitted(false);
  }, [active]);

  if (!active) return null;

  const you = state.players.find((p) => p.id === state.you);
  const options = (you?.influence ?? [])
    .map((c, i) => ({ ...c, index: i as 0 | 1 }))
    .filter((c) => !c.revealed);

  return (
    <Overlay>
      <p className="text-sm" style={{ color: 'var(--coup-text)' }}>
        {submitted ? 'Revealing…' : 'You must reveal one of your influence cards.'}
      </p>
      {!submitted && (
        <div className="flex justify-center gap-3">
          {options.map((c) => (
            <button
              key={c.index}
              onClick={() => {
                setSubmitted(true);
                controller.chooseReveal(c.index);
              }}
            >
              <CharacterCard character={c.character} size="lg" />
            </button>
          ))}
        </div>
      )}
    </Overlay>
  );
}

export function ExchangePicker({ state, controller }: { state: ClientCoupState; controller: CoupController }) {
  const active = state.phase === 'exchange_choice' && state.exchangeOffer != null && state.players[state.turn]?.id === state.you;
  const [selected, setSelected] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [dealt, setDealt] = useState(false);

  // Same class of bug as VariantSetupPicker: key on the offer's *contents*,
  // not the array reference, since state.exchangeOffer is a fresh array on
  // every broadcast (e.g. an unrelated opponent reconnect) even when the
  // offer itself hasn't changed — keying on the reference wiped in-progress
  // selections for no reason.
  useEffect(() => {
    setSelected([]);
    setSubmitted(false);
    setDealt(false);
    if (active) {
      // Deck-draw beat: cards start face-down (deck icon), then flip up a
      // moment later — matches the spec's "flip back down once confirmed"
      // sequence by giving the reveal a visible starting state.
      const id = setTimeout(() => setDealt(true), 250);
      return () => clearTimeout(id);
    }
  }, [active, state.exchangeOffer?.join(',')]);

  if (!active) return null;

  const you = state.players.find((p) => p.id === state.you);
  const ownUnrevealed = (you?.influence ?? []).filter((c) => !c.revealed).map((c) => c.character) as Character[];
  const candidates: Character[] = [...ownUnrevealed, ...(state.exchangeOffer ?? [])];
  const requiredKeep = ownUnrevealed.length;

  const toggle = (i: number) => {
    setSelected((prev) => {
      if (prev.includes(i)) return prev.filter((x) => x !== i);
      if (prev.length >= requiredKeep) return prev;
      return [...prev, i];
    });
  };

  return (
    <Overlay>
      <p className="text-sm" style={{ color: 'var(--coup-text)' }}>
        {submitted ? 'Exchanging…' : `Choose ${requiredKeep} card${requiredKeep === 1 ? '' : 's'} to keep.`}
      </p>
      {!submitted && (
        <>
          <div className="flex flex-wrap justify-center gap-3">
            {candidates.map((c, i) => (
              <button
                key={i}
                onClick={() => toggle(i)}
                className="rounded-lg"
                style={{
                  outline: selected.includes(i) ? '2px solid var(--coup-success)' : 'none',
                  outlineOffset: 2,
                  animation: dealt ? undefined : 'coup-card-flip 400ms ease-in-out',
                }}
              >
                <CharacterCard character={dealt ? c : null} size="lg" />
              </button>
            ))}
          </div>
          <Button
            size="sm"
            disabled={selected.length !== requiredKeep}
            onClick={() => {
              setSubmitted(true);
              controller.chooseExchange(selected);
            }}
          >
            Confirm
          </Button>
        </>
      )}
    </Overlay>
  );
}
