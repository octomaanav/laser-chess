// src/components/coup/ReferenceGuide.tsx
// The cheat sheet, following the reference-guide layout: a titled card with
// Character / Action / Effect / Counteraction columns and striped rows.
//
// Two deliberate changes from the standalone mock it's based on:
//   - every surface is opaque and drawn from the coup theme tokens, so it
//     stays readable over the table in both light and dark;
//   - below `sm` the four columns stack into labelled rows, since the grid
//     can't hold four columns on a phone.
//
// Contrast note: the shared character colors (--coup-duke etc.) are a single
// dark saturated set used by BOTH themes. They're legible as a pill fill
// with white text and illegible as text on a light panel, so they're only
// ever used as fills here.
import type { Character } from '@/game/coup/types';
import { CHARACTER_LABEL } from './characterAccent';

const CHARACTER_VAR: Record<Character, string> = {
  duke: 'var(--coup-duke)',
  assassin: 'var(--coup-assassin)',
  captain: 'var(--coup-captain)',
  ambassador: 'var(--coup-ambassador)',
  contessa: 'var(--coup-contessa)',
};

interface Row {
  char: Character | null;
  action: string;
  effect: string;
  counter: string | null;
  forced?: boolean;
}

const ROWS: Row[] = [
  { char: null, action: 'Income', effect: 'Take 1 coin', counter: null },
  { char: null, action: 'Foreign Aid', effect: 'Take 2 coins', counter: 'Blocked by Duke' },
  { char: null, action: 'Coup', effect: 'Pay 7 coins · choose player to lose influence', counter: null, forced: true },
  { char: 'duke', action: 'Tax', effect: 'Take 3 coins', counter: 'Blocks Foreign Aid' },
  { char: 'assassin', action: 'Assassinate', effect: 'Pay 3 coins · choose player to lose influence', counter: 'Blocked by Contessa' },
  { char: 'ambassador', action: 'Exchange', effect: 'Exchange cards with Court Deck', counter: 'Blocks stealing' },
  { char: 'captain', action: 'Steal', effect: 'Take 2 coins from another player', counter: 'Blocks stealing' },
  { char: 'contessa', action: 'None', effect: 'None', counter: 'Blocks assassination' },
];

const COLUMNS = ['Character', 'Action', 'Effect', 'Counteraction'];

// `sm:` and up gets the real four-column grid; below that each row stacks.
const GRID = 'sm:grid sm:grid-cols-[136px_1fr_1.5fr_1.2fr] sm:items-center sm:gap-3';

// Opaque alternating stripe - mixing two opaque colors stays opaque, so the
// table never lets the board show through.
const STRIPE = 'color-mix(in oklab, var(--coup-text) 4%, var(--coup-panel-bg))';

export default function ReferenceGuide() {
  return (
    <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--coup-panel-border)', background: 'var(--coup-panel-bg)' }}>
      <div className="border-b px-5 py-4 text-center" style={{ borderColor: 'var(--coup-panel-border)' }}>
        <div
          className="font-display text-xl font-bold uppercase tracking-[0.22em]"
          style={{ color: 'var(--coup-text)' }}
        >
          Play
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--coup-text-muted)' }}>
          Take one action per turn · If 10+ coins you must launch a Coup
        </div>
      </div>

      <div
        className={`hidden px-5 py-2.5 sm:block ${GRID}`}
        style={{ background: STRIPE, borderBottom: '1px solid var(--coup-panel-border)' }}
      >
        {COLUMNS.map((label) => (
          <div key={label} className="text-[9px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--coup-text-muted)' }}>
            {label}
          </div>
        ))}
      </div>

      {ROWS.map((row, i) => (
        <div
          key={row.action + i}
          className={`px-5 py-3 ${GRID}`}
          style={{
            background: i % 2 === 0 ? 'var(--coup-panel-bg)' : STRIPE,
            borderBottom: i < ROWS.length - 1 ? '1px solid var(--coup-panel-border)' : undefined,
          }}
        >
          <div className="flex items-center">
            {row.char ? (
              <span
                className="inline-block rounded px-3 py-1 text-[12px] font-bold uppercase tracking-[0.08em] text-white"
                style={{ background: CHARACTER_VAR[row.char] }}
              >
                {CHARACTER_LABEL[row.char]}
              </span>
            ) : (
              <span className="h-0.5 w-8 rounded-full" style={{ background: 'var(--coup-panel-border)' }} aria-hidden />
            )}
          </div>

          <div
            className="mt-2 text-sm font-semibold tracking-[0.04em] sm:mt-0"
            style={{ color: row.forced ? 'var(--coup-danger)' : 'var(--coup-text)' }}
          >
            {row.action}
            {row.forced && (
              <span className="ml-1.5 text-[10px] font-normal tracking-[0.08em]" style={{ color: 'var(--coup-danger)' }}>
                (if 10+)
              </span>
            )}
          </div>

          <div
            className="mt-0.5 text-[13px] leading-snug sm:mt-0"
            style={{ color: row.effect === 'None' ? 'var(--coup-text-muted)' : 'var(--coup-text)' }}
          >
            {row.effect}
          </div>

          <div className="mt-0.5 text-[13px] font-medium sm:mt-0" style={{ color: row.counter ? 'var(--coup-success)' : 'var(--coup-text-muted)' }}>
            {row.counter ?? '✕'}
          </div>
        </div>
      ))}

      <div className="border-t px-5 py-2.5" style={{ borderColor: 'var(--coup-panel-border)', background: STRIPE }}>
        <span className="text-[9px] uppercase tracking-[0.1em]" style={{ color: 'var(--coup-text-muted)' }}>
          Any player may challenge any claimed action · Loser of challenge loses one influence
        </span>
      </div>
    </div>
  );
}
