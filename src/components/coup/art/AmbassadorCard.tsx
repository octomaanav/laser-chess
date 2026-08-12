export default function AmbassadorCard() {
  const bg = "#4b8c5c"
  const icon = "#6aad7c"

  return (
    <svg viewBox="0 0 300 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Ambassador card">
      {/* Card background */}
      <rect width="300" height="420" rx="22" fill={bg} />
      {/* Border */}
      <rect x="1" y="1" width="298" height="418" rx="21.5" fill="none" stroke="white" strokeWidth="2" strokeOpacity="0.25" />

      {/* Icon — compass exchange symbol */}
      {/* Center diamond */}
      <polygon points="150,127 208,184 150,241 92,184" fill={icon} />

      {/* Top: two downward-pointing triangles */}
      <polygon points="130,101 170,101 150,122" fill={icon} />
      <polygon points="138,114 162,114 150,127" fill={icon} />

      {/* Bottom: two upward-pointing triangles */}
      <polygon points="130,267 170,267 150,246" fill={icon} />
      <polygon points="138,254 162,254 150,241" fill={icon} />

      {/* Left: right-pointing triangle */}
      <polygon points="82,165 82,203 101,184" fill={icon} />

      {/* Right: left-pointing triangle */}
      <polygon points="218,165 218,203 199,184" fill={icon} />

      {/* Name */}
      <text
        x="150" y="330"
        textAnchor="middle"
        fontFamily="'Rajdhani', sans-serif"
        fontWeight="700"
        fontSize="26"
        letterSpacing="4"
        fill="white"
      >AMBASSADOR</text>

      {/* Abilities */}
      <text
        x="150" y="360"
        textAnchor="middle"
        fontFamily="'Rajdhani', sans-serif"
        fontWeight="400"
        fontSize="13"
        letterSpacing="2.5"
        fill="white"
        fillOpacity="0.85"
      >EXCHANGE TWO CARDS</text>
      <text
        x="150" y="380"
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
