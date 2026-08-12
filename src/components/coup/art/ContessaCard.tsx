export default function ContessaCard() {
  const bg = "#a84c35"
  const icon = "#e8a848"

  return (
    <svg viewBox="0 0 300 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Contessa card">
      <rect width="300" height="420" rx="22" fill={bg} />
      <rect x="1" y="1" width="298" height="418" rx="21.5" fill="none" stroke="white" strokeWidth="2" strokeOpacity="0.25" />

      {/* Diamond gem — top portion of icon */}
      {/* Hexagonal cut-gem shape: flat top, angled sides, pointed bottom */}
      <polygon
        points="118,162 132,143 168,143 182,162 150,198"
        fill={icon}
      />

      {/* Arch / mask body below the gem */}
      {/* Outer arch shape */}
      <path
        d="M 118 162 L 118 242 L 138 242 L 138 210 A 12 12 0 0 1 162 210 L 162 242 L 182 242 L 182 162 A 32 32 0 0 0 118 162 Z"
        fill={icon}
      />

      {/* Inner arch cutout — background shows through */}
      <path
        d="M 128 162 A 22 22 0 0 0 172 162 L 172 205 L 128 205 Z"
        fill={bg}
      />

      {/* Name */}
      <text
        x="150" y="330"
        textAnchor="middle"
        fontFamily="'Rajdhani', sans-serif"
        fontWeight="700"
        fontSize="26"
        letterSpacing="4"
        fill="white"
      >CONTESSA</text>

      {/* Ability */}
      <text
        x="150" y="368"
        textAnchor="middle"
        fontFamily="'Rajdhani', sans-serif"
        fontWeight="400"
        fontSize="13"
        letterSpacing="2.5"
        fill="white"
        fillOpacity="0.85"
      >BLOCK ASSASSINATION</text>
    </svg>
  )
}
