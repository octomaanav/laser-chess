export default function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <span className="mark" aria-hidden>
      <svg width={size} height={size} viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="12.5" fill="none" stroke="#23262e" strokeWidth="2.5" />
        <path d="M16 16 L16 3.5 A12.5 12.5 0 0 1 27 10 Z" fill="#ef5a40" />
      </svg>
    </span>
  );
}

export function PersonIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#23262e" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M5 21c0-3.9 3.1-7 7-7s7 3.1 7 7" />
    </svg>
  );
}
