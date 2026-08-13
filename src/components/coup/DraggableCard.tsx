'use client';
import { useState } from 'react';
import { motion, useAnimation, type PanInfo } from 'framer-motion';
import CharacterCard from './CharacterCard';
import CardTilt from './CardTilt';
import type { Character } from '@/game/coup/types';
import { shouldCommitDrag } from './dragThreshold';

const COMMIT_THRESHOLD_PX = 60;

interface DraggableCardProps {
  character: Character | null;
  revealed?: boolean;
  size?: 'sm' | 'lg';
  disabled?: boolean;
  marked?: boolean; // e.g. "kept" outline in the exchange picker
  onCommit: () => void;
  // Index of the ability line this drag claims (see CardFace) — dims the
  // card's other ability line so it reads as inert while this one is live.
  activeAbilityIndex?: number;
  // Plain-language confirmation of exactly what committing will do, e.g.
  // "Steal 2 coins from Bob" — shown in a floating badge once the drag
  // crosses the commit threshold, so multi-ability cards (Captain,
  // Ambassador, Duke) never leave you guessing which effect you're about
  // to trigger.
  actionLabel?: string;
}

// Drag straight up to play a card. `disabled` still allows the drag
// gesture (so it doesn't feel broken/unresponsive) but refuses the
// commit with a shake instead of calling onCommit. The tilt effect goes
// flat for the duration of an active drag so the two transforms never
// compete for the same frame.
export default function DraggableCard({
  character,
  revealed,
  size = 'lg',
  disabled,
  marked,
  onCommit,
  activeAbilityIndex,
  actionLabel,
}: DraggableCardProps) {
  const controls = useAnimation();
  const [dragging, setDragging] = useState(false);
  const [armedLive, setArmedLive] = useState(false);

  const handleDrag = (_event: unknown, info: PanInfo) => {
    setArmedLive(shouldCommitDrag(info.offset.y, COMMIT_THRESHOLD_PX));
  };

  const handleDragEnd = (_event: unknown, info: PanInfo) => {
    setDragging(false);
    setArmedLive(false);
    const armed = shouldCommitDrag(info.offset.y, COMMIT_THRESHOLD_PX);

    if (armed && disabled) {
      controls.start({ x: [0, -6, 6, -4, 4, 0], y: 0, transition: { duration: 0.4 } });
      return;
    }
    if (armed) {
      controls.start({ y: [-20, -100, 0], scale: [1, 1.1, 1], transition: { duration: 0.5, times: [0, 0.4, 1], ease: 'easeOut' } });
      onCommit();
      return;
    }
    controls.start({ y: 0, scale: 1, transition: { type: 'spring', stiffness: 400, damping: 24 } });
  };

  return (
    <div style={{ position: 'relative' }}>
      {dragging && actionLabel && (
        <div
          className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold shadow-lg transition-opacity"
          style={{
            background: armedLive ? 'var(--coup-success)' : 'var(--coup-panel-bg)',
            color: armedLive ? '#0a1a0d' : 'var(--coup-text)',
            border: armedLive ? 'none' : '1px solid var(--coup-panel-border)',
            opacity: armedLive ? 1 : 0.85,
          }}
        >
          {armedLive ? actionLabel : 'Keep dragging to play…'}
        </div>
      )}
      <motion.div
        drag="y"
        dragConstraints={{ top: -160, bottom: 0 }}
        dragElastic={0.15}
        animate={controls}
        whileDrag={{ scale: 1.06 }}
        onDragStart={() => setDragging(true)}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        style={{
          cursor: 'grab',
          outline: marked ? '2px solid var(--coup-success)' : 'none',
          outlineOffset: 2,
          borderRadius: 8,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <CardTilt disabled={dragging}>
          <CharacterCard character={character} revealed={revealed} size={size} activeAbilityIndex={activeAbilityIndex} />
        </CardTilt>
      </motion.div>
    </div>
  );
}
