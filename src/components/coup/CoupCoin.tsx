// src/components/coup/CoupCoin.tsx
// Vector coin motif - radial spokes around a stamped center ring, echoing
// the look of a real embossed metal coin instead of a flat dot.
const RAY_COUNT = 8;

export function CoupCoinGlyph({ danger }: { danger?: boolean }) {
  const fill = danger ? 'var(--coup-danger)' : 'var(--coup-gold)';
  const dark = danger ? 'color-mix(in oklab, var(--coup-danger) 60%, black)' : 'var(--coup-gold-dark)';
  return (
    <>
      <circle cx="24" cy="24" r="22" fill={fill} stroke={dark} strokeWidth="2" />
      <g fill={dark} opacity="0.55">
        {Array.from({ length: RAY_COUNT }).map((_, i) => (
          <rect key={i} x="22.3" y="3.5" width="3.4" height="9" rx="1" transform={`rotate(${(i * 360) / RAY_COUNT} 24 24)`} />
        ))}
      </g>
      <circle cx="24" cy="24" r="13.5" fill="none" stroke={dark} strokeWidth="1.4" opacity="0.75" />
      <circle cx="24" cy="24" r="9.5" fill={dark} opacity="0.14" />
      <text x="24" y="28.5" textAnchor="middle" fontSize="12" fontWeight="800" fill={dark} fontFamily="var(--font-display), sans-serif">
        C
      </text>
    </>
  );
}

export default function CoupCoin({ className, danger }: { className?: string; danger?: boolean }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <CoupCoinGlyph danger={danger} />
    </svg>
  );
}
