// Overlays for the three phases that have no server-side timeout and
// therefore MUST have a reachable UI path, or the room deadlocks forever:
//   - variant-setup: 2-player-only starting-character draft (blocks move zero
//     of every 2p game)
//   - awaiting_reveal: choosing which influence card to flip face up
//   - exchange_choice: Ambassador exchange (choosing which cards to keep)
'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import type { ClientCoupState } from '@/game/coup/redact';
import type { Character } from '@/game/coup/types';
import type { CoupController } from '@/client/coupController';
import CharacterCard, { cardRadius } from './CharacterCard';
import CardTilt from './CardTilt';
import HoldCard from './HoldCard';

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="absolute inset-x-0 bottom-0 z-30 flex flex-col gap-3 rounded-t-xl border p-3 backdrop-blur"
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
      className="flex flex-1 flex-col items-center justify-center gap-4 p-6"
      style={{ color: 'var(--coup-text)' }}
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
              <CardTilt>
                <CharacterCard character={c} size="lg" />
              </CardTilt>
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
        {submitted ? 'Revealing…' : 'Hold a card to reveal it.'}
      </p>
      {!submitted && (
        <div className="flex justify-center gap-3">
          {options.map((c) => {
            const commit = () => {
              setSubmitted(true);
              controller.chooseReveal(c.index);
            };
            return (
              <div key={c.index}>
                {/* Below `lg`: original tap-to-reveal behavior, unchanged from before hold-to-reveal. */}
                <button type="button" className="lg:hidden" onClick={commit}>
                  <CharacterCard character={c.character} size="lg" />
                </button>
                {/* `lg` and up: press-and-hold to reveal. */}
                <div className="hidden lg:block">
                  <HoldCard character={c.character} size="lg" onCommit={commit} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Overlay>
  );
}

export function ExchangePicker({ state, controller }: { state: ClientCoupState; controller: CoupController }) {
  const active = state.phase === 'exchange_choice' && state.exchangeOffer != null && state.players[state.turn]?.id === state.you;
  const [selected, setSelected] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [dealt, setDealt] = useState(false);

  // Same class of bug as VariantSetupPicker: key on the offer's *contents*,
  // not the array reference, since state.exchangeOffer is a fresh array on
  // every broadcast (e.g. an unrelated opponent reconnect) even when the
  // offer itself hasn't changed - keying on the reference wiped in-progress
  // selections for no reason.
  useEffect(() => {
    setSelected([]);
    setSubmitted(false);
    setConfirming(false);
    setDealt(false);
    if (active) {
      // Deck-draw beat: cards start face-down, then flip up a moment later.
      const id = setTimeout(() => setDealt(true), 280);
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
        {submitted
          ? 'Exchanging…'
          : confirming
            ? 'Swapping cards…'
            : `Tap to keep ${requiredKeep} card${requiredKeep === 1 ? '' : 's'}.`}
      </p>
      {!submitted && (
        <>
          <div className="flex flex-wrap justify-center gap-3 lg:pt-6">
            {candidates.map((c, i) => {
              const marked = selected.includes(i);
              const disabled = !marked && selected.length >= requiredKeep;
              // Once confirmed: returned cards flip face-down first (reads
              // as "going back into the deck") before sinking toward the
              // deck pile; kept cards stay face-up and lift into your hand.
              const returning = confirming && !marked;
              const settledAnimate = confirming
                ? marked
                  ? { x: 0, y: -36, scale: 1.08, opacity: 1 }
                  : { x: 0, y: 64, scale: 0.78, opacity: 0 }
                : { x: 0, y: 0, scale: 1, opacity: 1 };
              const displayCharacter = returning ? null : dealt ? c : null;
              const flipping = (dealt && !confirming) || returning;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: -18, scale: 0.6 }}
                  animate={settledAnimate}
                  transition={{
                    duration: 0.5,
                    ease: 'easeOut',
                    delay: confirming ? (returning ? 0.1 : 0) : i * 0.09,
                  }}
                  style={{ pointerEvents: confirming ? 'none' : undefined }}
                >
                  <div className={flipping ? 'animate-[coup-card-flip_400ms_ease-in-out]' : undefined}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => toggle(i)}
                      style={{
                        outline: marked ? '2px solid var(--coup-success)' : 'none',
                        outlineOffset: 2,
                        borderRadius: cardRadius('lg'),
                        opacity: disabled ? 0.6 : 1,
                        cursor: disabled ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <CardTilt>
                        <CharacterCard character={displayCharacter} size="lg" />
                      </CardTilt>
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
          <Button
            size="sm"
            disabled={selected.length !== requiredKeep || confirming}
            onClick={() => {
              setConfirming(true);
              setTimeout(() => {
                setSubmitted(true);
                controller.chooseExchange(selected);
              }, 520);
            }}
          >
            Confirm
          </Button>
        </>
      )}
    </Overlay>
  );
}
