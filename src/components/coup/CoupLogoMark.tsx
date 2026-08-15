// Coup's mark: the same gold crown glyph as its GameCardIcon on the Game
// Night catalogue (src/components/GameCardIcon.tsx, 'coup' case), on a dark
// badge to match LogoMark's treatment - self-contained colors so it reads
// on both themes and stays visually identical wherever the game's icon shows up.
export default function CoupLogoMark({ size = 28 }: { size?: number }) {
  const accent = '#c8155e';
  return (
    <span className="inline-flex" aria-hidden>
      <svg width={size} height={size} viewBox="0 0 32 32">
        <rect width="32" height="32" rx="7" fill="#1c1420" />
        <defs>
          <linearGradient id="coup-mark-gold" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffd700" />
            <stop offset="1" stopColor={accent} />
          </linearGradient>
        </defs>
        <path
          d="M5 23L7 11L12 17L16 8L20 17L25 11L27 23H5Z"
          fill="url(#coup-mark-gold)"
          fillOpacity="0.25"
          stroke="url(#coup-mark-gold)"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <circle cx="16" cy="7" r="1.5" fill="#ffffff" />
        <circle cx="7" cy="10" r="1.2" fill={accent} />
        <circle cx="25" cy="10" r="1.2" fill={accent} />
        <path d="M9 25C13 27 19 27 23 25" stroke="url(#coup-mark-gold)" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </span>
  );
}
