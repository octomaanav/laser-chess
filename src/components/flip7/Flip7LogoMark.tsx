// Flip 7's mark: the same fanned-card glyph as its GameCardIcon on the Game
// Night catalogue (src/components/GameCardIcon.tsx, 'flip7' case), on a dark
// badge to match LogoMark's treatment - self-contained colors so it reads on
// both themes wherever the game's icon shows up.
export default function Flip7LogoMark({ size = 28 }: { size?: number }) {
  const accent = '#ffb020';
  return (
    <span className="inline-flex" aria-hidden>
      <svg width={size} height={size} viewBox="0 0 32 32">
        <rect width="32" height="32" rx="7" fill="#151b24" />
        <defs>
          <linearGradient id="f7-mark-grad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffe08a" />
            <stop offset="1" stopColor={accent} />
          </linearGradient>
        </defs>
        <rect x="4" y="8" width="14" height="19" rx="2.5" transform="rotate(-10 11 17.5)" fill={accent} fillOpacity="0.2" stroke={accent} strokeWidth="1.4" />
        <rect x="13" y="6" width="15" height="20" rx="2.5" fill="url(#f7-mark-grad)" fillOpacity="0.32" stroke="url(#f7-mark-grad)" strokeWidth="1.8" />
        <path d="M17.5 11H24.5L19 23" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
