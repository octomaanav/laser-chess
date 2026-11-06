'use client';

import GamePieceIcon from './tutorials/GamePieceIcon';
import type { Color, PieceType } from '@/game/types';

const COLS = [0, 1, 2, 3, 4, 5] as const;
const ROWS = [0, 1, 2] as const;
const CELL = 34;
const STEP = 38;
const ORIGIN_X = 15;
const ORIGIN_Y = 11;

const cx = (col: number) => ORIGIN_X + col * STEP + CELL / 2;
const cy = (row: number) => ORIGIN_Y + row * STEP + CELL / 2;

// Orientations follow the engine's mirror tables so the beam path below is exactly what the real game would do
// (checked with fireLaser): sphinx fires N, pyramid (0,0) N->E, pyramid (3,0) E->S, pyramid (3,2) S->E, hits pharaoh.
const HERO_PIECES: { col: number; row: number; type: PieceType; color: Color; orient: number; dim?: boolean }[] = [
  { col: 0, row: 2, type: 'sphinx', color: 'silver', orient: 0 },
  { col: 0, row: 0, type: 'pyramid', color: 'silver', orient: 1 },
  { col: 3, row: 0, type: 'pyramid', color: 'silver', orient: 2 },
  { col: 3, row: 2, type: 'pyramid', color: 'red', orient: 0 },
  { col: 5, row: 2, type: 'pharaoh', color: 'red', orient: 0 },
  { col: 1, row: 2, type: 'anubis', color: 'silver', orient: 0, dim: true },
  { col: 4, row: 1, type: 'pyramid', color: 'red', orient: 3, dim: true },
];

export default function LaserHeroArt() {
  const beamPath = `M ${cx(0)} ${cy(2) - 10} L ${cx(0)} ${cy(0)} L ${cx(3)} ${cy(0)} L ${cx(3)} ${cy(2)} L ${cx(5) - 11} ${cy(2)}`;

  return (
    <div
      aria-hidden="true"
      className="relative mx-auto mt-6 hidden w-full max-w-md overflow-hidden sm:block rounded-2xl border border-border/80 bg-card/70 p-3 shadow-xs backdrop-blur-sm md:mx-0"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,color-mix(in_oklab,var(--laser)_14%,transparent),transparent_55%),radial-gradient(circle_at_88%_78%,color-mix(in_oklab,var(--player-red)_14%,transparent),transparent_50%)]" />

      <div className="relative mb-2 flex items-center justify-between px-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 text-player-teal">
          <span className="size-1.5 rounded-full bg-player-teal" />
          Sphinx emitter
        </span>
        <span className="text-laser">3× mirror bounce</span>
        <span className="inline-flex items-center gap-1.5 text-player-red">
          Pharaoh hit
          <span className="size-1.5 rounded-full bg-player-red" />
        </span>
      </div>

      <svg
        viewBox="0 0 254 132"
        className="relative block h-auto w-full select-none"
        aria-hidden="true"
      >
        {/* Board grid cells */}
        {ROWS.map((r) =>
          COLS.map((c) => {
            const x = ORIGIN_X + c * STEP;
            const y = ORIGIN_Y + r * STEP;
            const isHighlighted =
              (c === 0 && r === 2) ||
              (c === 0 && r === 0) ||
              (c === 3 && r === 0) ||
              (c === 3 && r === 2) ||
              (c === 5 && r === 2);
            return (
              <rect
                key={`${c}-${r}`}
                x={x}
                y={y}
                width={CELL}
                height={CELL}
                rx={6}
                fill={
                  isHighlighted
                    ? 'color-mix(in oklab, var(--muted) 78%, var(--card))'
                    : 'color-mix(in oklab, var(--muted) 42%, var(--card))'
                }
                stroke="var(--border)"
                strokeWidth={1}
              />
            );
          }),
        )}

        {/* Pulse behind the Pharaoh target */}
        <circle
          cx={cx(5)}
          cy={cy(2)}
          r={15}
          fill="color-mix(in oklab, var(--player-red) 22%, transparent)"
          stroke="var(--player-red)"
          strokeOpacity={0.55}
          strokeWidth={1.25}
          className="laser-hero-pulse"
        />
        {/* Laser beam outer glow + core + animated dash */}
        <path
          d={beamPath}
          fill="none"
          stroke="var(--laser)"
          strokeOpacity={0.22}
          strokeWidth={7}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={beamPath}
          fill="none"
          stroke="var(--laser)"
          strokeOpacity={0.55}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={beamPath}
          fill="none"
          stroke="var(--laser)"
          strokeWidth={2.8}
          strokeDasharray="10 8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="laser-hero-beam"
        />

        {/* Real game pieces (same Renderer as the live board), drawn over the beam */}
        {HERO_PIECES.map((p) => (
          <foreignObject key={`${p.col}-${p.row}`} x={cx(p.col) - CELL / 2} y={cy(p.row) - CELL / 2} width={CELL} height={CELL}>
            <div style={{ width: CELL * 2, height: CELL * 2, transform: 'scale(0.5)', transformOrigin: 'top left' }}>
              <GamePieceIcon type={p.type} color={p.color} orient={p.orient} size={CELL * 2} className={p.dim ? 'opacity-60' : undefined} />
            </div>
          </foreignObject>
        ))}
      </svg>
    </div>
  );
}
