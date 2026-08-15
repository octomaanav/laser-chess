'use client';
import { useEffect, useRef, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import CharacterCard, { cardRadius } from './CharacterCard';
import CardTilt from './CardTilt';
import type { Character } from '@/game/coup/types';

const HOLD_MS = 600;
// SVG border perimeter for a 100x100 viewBox rounded rect (approx, close
// enough for a progress-fill effect - exact perimeter math isn't the point).
const PERIMETER = 392;

interface HoldCardProps {
  character: Character | null;
  size?: 'sm' | 'lg';
  onCommit: () => void;
}

// Press and hold to reveal, used only by RevealPicker. Choosing which
// influence to lose is irreversible, so it deliberately costs a held press
// rather than a tap that could be mis-aimed. Declaring actions is NOT done
// this way - those go through the ActionRail buttons.
//
// The tilt effect goes flat once a hold is in progress (progress > 0) so
// the ring-fill and tilt don't compete visually.
export default function HoldCard({ character, size = 'lg', onCommit }: HoldCardProps) {
  const [progress, setProgress] = useState(0);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const controls = useAnimation();

  useEffect(() => {
    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

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
      onPointerCancel={stop}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onCommit();
        }
      }}
      style={{ position: 'relative', borderRadius: cardRadius(size), cursor: 'pointer' }}
    >
      <CardTilt disabled={progress > 0}>
        <CharacterCard character={character} size={size} />
      </CardTilt>
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
