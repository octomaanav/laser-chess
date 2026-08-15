'use client';

import { useEffect, useRef } from 'react';
import { Renderer } from '@/lib/render';
import type { Color, Piece, PieceType } from '@/game/types';

// One Renderer instance shared by every static icon on the page - drawPiece()
// only reads ctx/geom.cell, so a single hidden instance is enough to paint
// pixel-identical piece art everywhere, without spinning up a full canvas
// stack (bg/pieces/fx layers) per icon.
let shared: Renderer | null = null;
function getRenderer(): Renderer {
  if (!shared) shared = new Renderer(document.createElement('div'));
  return shared;
}

interface GamePieceIconProps {
  type: PieceType;
  color: Color;
  orient?: number;
  size?: number;
  className?: string;
}

// Renders a single piece exactly as it appears on the real board, by reusing
// the live game's own Renderer.drawPiece - so the tutorial's piece art can
// never drift out of sync with what players actually see in a game.
export default function GamePieceIcon({ type, color, orient = 0, size = 56, className }: GamePieceIconProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const renderer = getRenderer();
    renderer.geom.cell = size * 0.82;
    const p: Piece = { id: 'icon', type, color, orient };
    renderer.drawPiece(ctx, p, size / 2, size / 2, orient * (Math.PI / 2));
  }, [type, color, orient, size]);

  return <canvas ref={canvasRef} className={className} />;
}
