'use client';

import { useEffect, useRef } from 'react';
import { Renderer } from '@/lib/render';
import { COLS, ROWS, fireLaser } from '@/game/engine';
import type { Action, Board, Color, Piece } from '@/game/types';
import { cn } from '@/lib/utils';

export function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<Piece | null>(COLS).fill(null));
}

export function place(board: Board, x: number, y: number, piece: Piece): Board {
  const next = board.map((row) => row.slice());
  next[y][x] = piece;
  return next;
}

let seq = 0;
export function piece(type: Piece['type'], color: Color, orient = 0): Piece {
  seq += 1;
  return { id: `tutorial-${seq}`, type, color, orient };
}

export interface DemoStep {
  board: Board;
  // Animates from the previous step's board to this one; omit for an instant cut (only used for the loop's first frame).
  action?: Action;
  // Fires the real laser for this color against `board` and plays the hit/explosion if it lands.
  fireColor?: Color;
  holdMs?: number;
}

interface BoardDemoProps {
  steps: DemoStep[];
  width?: number;
  height?: number;
  className?: string;
}

// A small looping demo scripted from real game state, animated with the same
// Renderer class and fireLaser physics the live game uses so what a player
// sees here is guaranteed to match how a real board actually behaves.
export default function BoardDemo({ steps, width = 360, height = 240, className }: BoardDemoProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || steps.length === 0) return;

    const renderer = new Renderer(host);
    let cancelled = false;
    const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    const ro = new ResizeObserver(() => {
      renderer.resize();
    });
    ro.observe(host);

    renderer.resize();
    renderer.setBoard(steps[0].board);

    (async () => {
      while (!cancelled) {
        for (let i = 0; i < steps.length; i++) {
          if (cancelled) return;
          const step = steps[i];
          if (i === 0) {
            renderer.setBoardQuiet(step.board);
          } else if (step.action) {
            await renderer.animatePieceAction(step.action, steps[i - 1].board, step.board);
          } else {
            renderer.setBoardQuiet(step.board);
          }
          if (cancelled) return;
          if (step.fireColor) {
            const { path, hit } = fireLaser(step.board, step.fireColor);
            await renderer.animateLaser(path, step.fireColor, () => {
              if (hit) void renderer.explode(hit.x, hit.y, hit.piece.color);
            });
          }
          if (cancelled) return;
          await wait(step.holdMs ?? 900);
        }
      }
    })();

    return () => {
      cancelled = true;
      ro.disconnect();
      renderer.cancelAnimations();
      renderer.destroy();
    };
  }, [steps]);

  return (
    <div
      ref={hostRef}
      style={{ width: '100%', maxWidth: width, height }}
      className={cn('relative mx-auto overflow-hidden rounded-xl border border-border/50 bg-card/60 shadow-md', className)}
    />
  );
}
