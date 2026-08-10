// The Laser Chess mark: a teal sphinx emitter firing a red laser across a dark
// rounded badge (matches src/app/icon.svg, the favicon). Self-contained colors so
// it reads as a logo on both the light and dark themes.
export default function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <span className="mark inline-flex" aria-hidden>
      <svg width={size} height={size} viewBox="0 0 32 32">
        <rect width="32" height="32" rx="7" fill="#182034" />
        <g strokeLinecap="round">
          <line x1="12.5" y1="19.5" x2="28.5" y2="5" stroke="#ff5a40" strokeOpacity="0.35" strokeWidth="6" />
          <line x1="12.5" y1="19.5" x2="28.5" y2="5" stroke="#ff5a40" strokeWidth="2.6" />
          <line x1="12.5" y1="19.5" x2="28.5" y2="5" stroke="#fff0e8" strokeWidth="1" />
        </g>
        <circle cx="28.5" cy="5" r="4" fill="#ff5a40" fillOpacity="0.35" />
        <circle cx="28.5" cy="5" r="2.2" fill="#fff0e8" />
        <rect x="3" y="17" width="12" height="12" rx="4" fill="#2fb0ab" stroke="#0e1424" strokeWidth="2" />
        <line x1="9" y1="23" x2="13.5" y2="18.5" stroke="#0e1424" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function PersonIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M5 21c0-3.9 3.1-7 7-7s7 3.1 7 7" />
    </svg>
  );
}
