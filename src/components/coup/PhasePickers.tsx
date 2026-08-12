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
    <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 rounded-t-xl border border-[#c8155e55] bg-[#0d1117]/95 p-3 backdrop-blur">
      {children}
    </div>
  );
}

export function VariantSetupPicker({ state, controller }: { state: ClientCoupState; controller: CoupController }) {
  const [chosen, setChosen] = useState(false);
  const pool = state.variantPoolForYou;

  // Reset if the server ever cycles us back into a fresh draft (e.g. rematch).
  useEffect(() => {
    setChosen(false);
  }, [pool]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
      <h2 className="text-lg font-bold" style={{ color: '#c8155e' }}>
        Choose your starting character
      </h2>
      {!pool || chosen ? (
        <p className="text-sm text-[#8a909b]">Waiting for your opponent to choose…</p>
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
      <p className="text-sm text-white/80">
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

  useEffect(() => {
    setSelected([]);
    setSubmitted(false);
  }, [active, state.exchangeOffer]);

  if (!active) return null;

  const you = state.players.find((p) => p.id === state.you);
  const ownUnrevealed = (you?.influence ?? []).filter((c) => !c.revealed).map((c) => c.character) as Character[];
  // Index convention matches engine.ts's chooseExchange: own unrevealed
  // characters first, then the offered cards.
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
      <p className="text-sm text-white/80">
        {submitted
          ? 'Exchanging…'
          : `Choose ${requiredKeep} card${requiredKeep === 1 ? '' : 's'} to keep.`}
      </p>
      {!submitted && (
        <>
          <div className="flex flex-wrap justify-center gap-3">
            {candidates.map((c, i) => (
              <button
                key={i}
                onClick={() => toggle(i)}
                className="rounded-lg"
                style={{ outline: selected.includes(i) ? '2px solid #c3f53b' : 'none', outlineOffset: 2 }}
              >
                <CharacterCard character={c} size="lg" />
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
