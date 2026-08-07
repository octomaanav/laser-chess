'use client';
import { useEffect, useRef } from 'react';
import type { GameController } from '@/client/controller';

// Hosts the layered canvases. The imperative Renderer is created/destroyed by
// the controller so animations stay outside React's render cycle.
export default function Board({ controller }: { controller: GameController }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const cleanup = controller.attach(ref.current);
    return cleanup;
  }, [controller]);

  return <div ref={ref} className="board-wrap" />;
}
