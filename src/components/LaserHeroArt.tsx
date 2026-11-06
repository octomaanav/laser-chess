'use client';

const COLS = [0, 1, 2, 3, 4, 5] as const;
const ROWS = [0, 1, 2] as const;
const CELL = 34;
const STEP = 38;
const ORIGIN_X = 15;
const ORIGIN_Y = 11;

const cx = (col: number) => ORIGIN_X + col * STEP + CELL / 2;
const cy = (row: number) => ORIGIN_Y + row * STEP + CELL / 2;

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

        {/* Unhit tactical pieces for board depth */}
        {/* Teal Defender at (1, 2) */}
        <g transform={`translate(${cx(1)}, ${cy(2)})`}>
          <rect
            x={-10}
            y={-10}
            width={20}
            height={20}
            rx={4}
            fill="color-mix(in oklab, var(--player-teal) 18%, var(--card))"
            stroke="var(--player-teal)"
            strokeOpacity={0.55}
            strokeWidth={1.4}
          />
          <line
            x1={-7}
            y1={-10}
            x2={7}
            y2={-10}
            stroke="var(--player-teal)"
            strokeWidth={2.6}
            strokeLinecap="round"
          />
        </g>

        {/* Red Deflector at (4, 1) */}
        <g transform={`translate(${cx(4)}, ${cy(1)})`}>
          <polygon
            points="-9,-9 9,-9 -9,9"
            fill="color-mix(in oklab, var(--player-red) 20%, var(--card))"
            stroke="var(--player-red)"
            strokeOpacity={0.55}
            strokeWidth={1.3}
            strokeLinejoin="round"
          />
        </g>

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

        {/* Mirror 1 at (0, 0): '/' bounces North -> East */}
        <g transform={`translate(${cx(0)}, ${cy(0)})`}>
          <polygon
            points="-10,-10 10,-10 -10,10"
            fill="color-mix(in oklab, var(--player-teal) 26%, var(--card))"
            stroke="var(--player-teal)"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
          <line
            x1={-10}
            y1={10}
            x2={10}
            y2={-10}
            stroke="var(--laser)"
            strokeWidth={2.4}
            strokeLinecap="round"
          />
          <circle r={2.6} fill="var(--laser)" />
        </g>

        {/* Mirror 2 at (3, 0): '\' bounces East -> South */}
        <g transform={`translate(${cx(3)}, ${cy(0)})`}>
          <polygon
            points="-10,-10 10,-10 10,10"
            fill="color-mix(in oklab, var(--player-teal) 26%, var(--card))"
            stroke="var(--player-teal)"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
          <line
            x1={-10}
            y1={-10}
            x2={10}
            y2={10}
            stroke="var(--laser)"
            strokeWidth={2.4}
            strokeLinecap="round"
          />
          <circle r={2.6} fill="var(--laser)" />
        </g>

        {/* Mirror 3 at (3, 2): '\' bounces South -> East */}
        <g transform={`translate(${cx(3)}, ${cy(2)})`}>
          <polygon
            points="-10,-10 -10,10 10,10"
            fill="color-mix(in oklab, var(--player-red) 24%, var(--card))"
            stroke="var(--player-red)"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
          <line
            x1={-10}
            y1={-10}
            x2={10}
            y2={10}
            stroke="var(--laser)"
            strokeWidth={2.4}
            strokeLinecap="round"
          />
          <circle r={2.6} fill="var(--laser)" />
        </g>

        {/* Teal Sphinx at (0, 2) emitting North */}
        <g transform={`translate(${cx(0)}, ${cy(2)})`}>
          <rect
            x={-11}
            y={-11}
            width={22}
            height={22}
            rx={5}
            fill="color-mix(in oklab, var(--player-teal) 28%, var(--card))"
            stroke="var(--player-teal)"
            strokeWidth={1.75}
          />
          <polygon points="0,-13 -5,-4 5,-4" fill="var(--player-teal)" />
          <circle cy={2} r={3.5} fill="var(--laser)" />
        </g>

        {/* Red Pharaoh target at (5, 2) */}
        <g transform={`translate(${cx(5)}, ${cy(2)})`}>
          <circle
            r={15}
            fill="color-mix(in oklab, var(--player-red) 22%, transparent)"
            stroke="var(--player-red)"
            strokeOpacity={0.55}
            strokeWidth={1.25}
            className="laser-hero-pulse"
          />
          <rect
            x={-11}
            y={-11}
            width={22}
            height={22}
            rx={5}
            fill="color-mix(in oklab, var(--player-red) 28%, var(--card))"
            stroke="var(--player-red)"
            strokeWidth={1.75}
          />
          {/* Crown / Pharaoh emblem */}
          <path
            d="M -6 5 L -7 -4 L -3 0 L 0 -5 L 3 0 L 7 -4 L 6 5 Z"
            fill="var(--player-red)"
          />
          {/* Beam impact spark on west edge */}
          <circle cx={-11} cy={0} r={3.2} fill="var(--laser)" className="laser-hero-pulse" />
        </g>
      </svg>
    </div>
  );
}
