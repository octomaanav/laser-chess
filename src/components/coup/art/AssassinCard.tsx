export default function AssassinCard() {
  const bg = "#4b4d54"
  const icon = "#7c8189"

  return (
    <svg viewBox="0 0 300 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Assassin card">
      <rect width="300" height="420" rx="22" fill={bg} />
      <rect x="1" y="1" width="298" height="418" rx="21.5" fill="none" stroke="white" strokeWidth="2" strokeOpacity="0.25" />

      {/* Skull head — dome top, square body */}
      <path
        d="M 113 205 L 113 170 A 37 42 0 0 1 187 170 L 187 205 Z"
        fill={icon}
      />

      {/* X eye mark */}
      <line x1="139" y1="156" x2="153" y2="172" stroke={bg} strokeWidth="8" strokeLinecap="round" />
      <line x1="153" y1="156" x2="139" y2="172" stroke={bg} strokeWidth="8" strokeLinecap="round" />

      {/* Eye socket slots */}
      <rect x="118" y="185" width="20" height="13" rx="3" fill={bg} />
      <rect x="162" y="185" width="20" height="13" rx="3" fill={bg} />

      {/* Mouth line / chin gap */}
      <rect x="140" y="198" width="20" height="7" rx="2" fill={bg} />

      {/* Neck trapezoid */}
      <path d="M 129 205 L 171 205 L 165 229 L 135 229 Z" fill={icon} />

      {/* Name */}
      <text
        x="150" y="330"
        textAnchor="middle"
        fontFamily="'Rajdhani', sans-serif"
        fontWeight="700"
        fontSize="26"
        letterSpacing="4"
        fill="white"
      >ASSASSIN</text>

      {/* Ability */}
      <text
        x="150" y="365"
        textAnchor="middle"
        fontFamily="'Rajdhani', sans-serif"
        fontWeight="400"
        fontSize="13"
        letterSpacing="2.5"
        fill="white"
        fillOpacity="0.85"
      >PAY THREE COINS TO ASSASSINATE</text>
    </svg>
  )
}
