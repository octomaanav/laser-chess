export default function CaptainCard() {
  const bg = "#2d4178"
  const icon = "#5db8e8"

  return (
    <svg viewBox="0 0 300 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Captain card">
      <rect width="300" height="420" rx="22" fill={bg} />
      <rect x="1" y="1" width="298" height="418" rx="21.5" fill="none" stroke="white" strokeWidth="2" strokeOpacity="0.25" />

      {/* Up arrow — pointing up */}
      {/* Arrowhead triangle */}
      <polygon points="150,138 122,172 178,172" fill={icon} />
      {/* Arrow shaft */}
      <rect x="140" y="170" width="20" height="38" fill={icon} />

      {/* First down-chevron (V) */}
      <polygon points="112,212 150,248 188,212 175,212 150,236 125,212" fill={icon} />

      {/* Second down-chevron, slightly lower and wider */}
      <polygon points="100,228 150,268 200,228 187,228 150,258 113,228" fill={icon} />

      {/* Name */}
      <text
        x="150" y="330"
        textAnchor="middle"
        fontFamily="'Rajdhani', sans-serif"
        fontWeight="700"
        fontSize="26"
        letterSpacing="4"
        fill="white"
      >CAPTAIN</text>

      {/* Abilities */}
      <text
        x="150" y="362"
        textAnchor="middle"
        fontFamily="'Rajdhani', sans-serif"
        fontWeight="400"
        fontSize="13"
        letterSpacing="2.5"
        fill="white"
        fillOpacity="0.85"
      >STEAL TWO COINS</text>
      <text
        x="150" y="382"
        textAnchor="middle"
        fontFamily="'Rajdhani', sans-serif"
        fontWeight="400"
        fontSize="13"
        letterSpacing="2.5"
        fill="white"
        fillOpacity="0.85"
      >BLOCK STEALING</text>
    </svg>
  )
}
