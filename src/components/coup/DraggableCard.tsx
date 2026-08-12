'use client';
import { motion, useAnimation, type PanInfo } from 'framer-motion';
import CharacterCard from './CharacterCard';
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
}

// Drag straight up to play a card — used for declaring your action (Task 6)
// and the exchange keep/discard picker (Task 8). `disabled` still allows the
// drag gesture (so it doesn't feel broken/unresponsive) but refuses the
// commit with a shake instead of calling onCommit.
export default function DraggableCard({ character, revealed, size = 'lg', disabled, marked, onCommit }: DraggableCardProps) {
  const controls = useAnimation();

  const handleDragEnd = (_event: unknown, info: PanInfo) => {
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
    <motion.div
      drag="y"
      dragConstraints={{ top: -160, bottom: 0 }}
      dragElastic={0.15}
      animate={controls}
      whileDrag={{ scale: 1.06 }}
      onDragEnd={handleDragEnd}
      style={{
        cursor: 'grab',
        outline: marked ? '2px solid var(--coup-success)' : 'none',
        outlineOffset: 2,
        borderRadius: 8,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <CharacterCard character={character} revealed={revealed} size={size} />
    </motion.div>
  );
}
