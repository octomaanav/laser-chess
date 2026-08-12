'use client';
import { useRef, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import CharacterCard from './CharacterCard';
import type { Character } from '@/game/coup/types';

const HOLD_MS = 600;
// SVG border perimeter for a 100x100 viewBox rounded rect (approx, close
// enough for a progress-fill effect — exact perimeter math isn't the point).
const PERIMETER = 392;

interface HoldCardProps {
  character: Character | null;
  size?: 'sm' | 'lg';
  onCommit: () => void;
}

// Press and hold to reveal — there's no meaningful drag direction for a
// single reveal target, so this is a separate gesture from DraggableCard.
export default function HoldCard({ character, size = 'lg', onCommit }: HoldCardProps) {
  const [progress, setProgress] = useState(0);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const controls = useAnimation();

  const stop = () => {
    if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    startRef.current = null;
    setProgress(0);
  };

  const tick = (t: number) => {
    if (startRef.current == null) startRef.current = t;
    const elapsed = t - startRef.current;
    const pct = Math.min(1, elapsed / HOLD_MS);
    setProgress(pct);
    if (pct >= 1) {
      stop();
      controls.start({ scale: [1, 1.1, 1], transition: { duration: 0.3 } });
      onCommit();
      return;
    }
    frameRef.current = requestAnimationFrame(tick);
  };

  const start = () => {
    stop();
    frameRef.current = requestAnimationFrame(tick);
  };

  return (
    <motion.button
      type="button"
      animate={controls}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      style={{ position: 'relative', borderRadius: 8, cursor: 'pointer' }}
    >
      <CharacterCard character={character} size={size} />
      {progress > 0 && (
        <svg
          width="100%"
          height="100%"
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <rect
            x="1"
            y="1"
            width="98"
            height="98"
            rx="8"
            fill="none"
            stroke="var(--coup-success)"
            strokeWidth="3"
            strokeDasharray={PERIMETER}
            strokeDashoffset={PERIMETER * (1 - progress)}
          />
        </svg>
      )}
    </motion.button>
  );
}
