import type { TableEvent } from './tableEvents';

const MAX_VISIBLE_COINS = 14;

export default function Treasury({ amount, events }: { amount: number; events: TableEvent[] }) {
  const paidEvent = events.find((e) => e.kind === 'treasury-paid');
  const gainedEvents = events.filter((e) => e.kind === 'coins-gained');
  const visibleCoins = Math.min(amount, MAX_VISIBLE_COINS);

  return (
    <div className="relative flex flex-col items-center gap-1">
      <div
        className="flex max-w-[140px] flex-wrap-reverse justify-center gap-1 lg:max-w-[280px] lg:gap-3"
        style={{ animation: paidEvent ? 'coup-treasury-pay 500ms ease-out' : undefined }}
      >
        {Array.from({ length: visibleCoins }).map((_, i) => (
          <span
            key={i}
            className="h-4 w-4 rounded-full border-2 lg:h-8 lg:w-8"
            style={{ background: 'var(--coup-gold)', borderColor: 'var(--coup-gold-dark)' }}
          />
        ))}
      </div>
      <div className="text-xs font-semibold uppercase tracking-wide lg:text-lg" style={{ color: 'var(--coup-text-muted)' }}>
        Treasury · {amount}
      </div>
      {gainedEvents.map((e) => (
        <span
          key={e.id}
          className="pointer-events-none absolute -top-2 text-sm font-bold"
          style={{ color: 'var(--coup-gold)', animation: 'coup-float-up 1.1s ease-out forwards' }}
        >
          +{e.amount}
        </span>
      ))}
    </div>
  );
}
