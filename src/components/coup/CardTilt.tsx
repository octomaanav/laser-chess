'use client';
import { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { computeTilt } from './computeTilt';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

const MAX_TILT_DEG = 9;
const SHEEN_RADIUS_PX = 160;

interface CardTiltProps {
  children: React.ReactNode;
  disabled?: boolean; // true while an active drag/hold gesture owns the card's transform
}

// Pointer-tracking 3D tilt + light sheen, wrapped around CharacterCard at
// every render site (see Task 3). `disabled` goes flat while a drag or
// hold gesture is actively in progress, so the two transform systems
// never fight over the same frame.
export default function CardTilt({ children, disabled }: CardTiltProps) {
  const ref = useRef<HTMLDivElement>(null);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const sheenX = useMotionValue(50);
  const sheenY = useMotionValue(50);
  const sheenOpacity = useMotionValue(0);
  const springX = useSpring(rotateX, { stiffness: 300, damping: 20 });
  const springY = useSpring(rotateY, { stiffness: 300, damping: 20 });
  const sheenBackground = useTransform([sheenX, sheenY], ([x, y]) =>
    `radial-gradient(${SHEEN_RADIUS_PX}px circle at ${x}% ${y}%, rgba(255,255,255,0.28), transparent 70%)`,
  );
  const reducedMotion = usePrefersReducedMotion();

  if (reducedMotion) return <>{children}</>;

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || e.pointerType !== 'mouse' || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    const tilt = computeTilt(offsetX, offsetY, rect.width, rect.height, MAX_TILT_DEG);
    rotateX.set(tilt.rotateX);
    rotateY.set(tilt.rotateY);
    sheenX.set((offsetX / rect.width) * 100);
    sheenY.set((offsetY / rect.height) * 100);
    sheenOpacity.set(1);
  };

  const handlePointerLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
    sheenOpacity.set(0);
  };

  return (
    <div style={{ perspective: 800 }}>
      <motion.div
        ref={ref}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        style={{
          rotateX: springX,
          rotateY: springY,
          transformStyle: 'preserve-3d',
          position: 'relative',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        {children}
        <motion.div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: sheenBackground,
            opacity: sheenOpacity,
            pointerEvents: 'none',
            mixBlendMode: 'overlay',
          }}
        />
      </motion.div>
    </div>
  );
}
