// src/components/coup/art/CardBack.tsx
// The face-down side of every card - opponent hands, the deck pile, an
// exchange offer before it's dealt. Previously a flat #161b22 rectangle,
// which read as "blank" rather than "a card, back-side up." Mirrors
// CardFace's shell language (corner accents, faint sheen) so front and back
// clearly belong to the same deck, with a diamond lattice + centered crest
// standing in for real card-back art.
export default function CardBack() {
  const line = '#e0b35433'; // coup-gold at low opacity, fixed (theme-independent navy base)
  const crest = '#e0b354';

  const corners = [
    { x: 22, y: 22, dx: 1, dy: 1 },
    { x: 278, y: 22, dx: -1, dy: 1 },
    { x: 22, y: 398, dx: 1, dy: -1 },
    { x: 278, y: 398, dx: -1, dy: -1 },
  ];

  // A small diamond lattice tiled across the card - cheap to describe as one
  // repeating <pattern> rather than dozens of individual shapes.
  const tile = 30;

  return (
    <svg viewBox="0 0 300 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="face-down card">
      <defs>
        <pattern id="coup-cardback-lattice" width={tile} height={tile} patternUnits="userSpaceOnUse">
          <path d={`M ${tile / 2} 0 L ${tile} ${tile / 2} L ${tile / 2} ${tile} L 0 ${tile / 2} Z`} fill="none" stroke={line} strokeWidth="1" />
        </pattern>
        <radialGradient id="coup-cardback-glow" cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor="#e0b3541a" />
          <stop offset="100%" stopColor="#e0b35400" />
        </radialGradient>
      </defs>

      <rect width="300" height="420" rx="22" fill="#161b22" />
      <rect x="14" y="14" width="272" height="392" rx="14" fill="url(#coup-cardback-lattice)" />
      <rect width="300" height="420" rx="22" fill="url(#coup-cardback-glow)" />
      <rect x="1" y="1" width="298" height="418" rx="21.5" fill="none" stroke="#262c36" strokeWidth="2" />
      <rect x="14" y="14" width="272" height="392" rx="14" fill="none" stroke={line} strokeWidth="1.5" />

      {corners.map((c, i) => (
        <path
          key={i}
          d={`M ${c.x} ${c.y + 12 * c.dy} L ${c.x} ${c.y} L ${c.x + 12 * c.dx} ${c.y}`}
          fill="none"
          stroke={crest}
          strokeWidth="2"
          strokeOpacity="0.4"
          strokeLinecap="round"
        />
      ))}

      {/* Centered crest: two nested diamonds, echoing the Broker icon /
          the game's card-suit motif, without depicting any one character. */}
      <g transform="translate(150 210)">
        <polygon points="0,-46 46,0 0,46 -46,0" fill="none" stroke={crest} strokeWidth="2" strokeOpacity="0.55" />
        <polygon points="0,-24 24,0 0,24 -24,0" fill={crest} fillOpacity="0.14" stroke={crest} strokeWidth="1.5" strokeOpacity="0.5" />
      </g>
    </svg>
  );
}
