export default function DukeCard() {
  const bg = "#6e3578"
  const icon = "#d088c8"

  // 5-pointed star: outer r=70, inner r=28, centered at (150,185)
  const star = (() => {
    const cx = 150, cy = 185, outer = 70, inner = 28, n = 5
    const pts: string[] = []
    for (let i = 0; i < n * 2; i++) {
      const angle = (Math.PI / n) * i - Math.PI / 2
      const r = i % 2 === 0 ? outer : inner
      pts.push(`${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`)
    }
    return pts.join(" ")
  })()

  return (
    <svg viewBox="0 0 300 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Duke card">
      <rect width="300" height="420" rx="22" fill={bg} />
      <rect x="1" y="1" width="298" height="418" rx="21.5" fill="none" stroke="white" strokeWidth="2" strokeOpacity="0.25" />

      {/* Circle ring behind star */}
      <circle cx="150" cy="185" r="55" fill="none" stroke={icon} strokeWidth="10" />

      {/* 5-pointed star */}
      <polygon points={star} fill={icon} />

      {/* Inner circle */}
      <circle cx="150" cy="185" r="22" fill={bg} />

      {/* Inner star (small, outline) */}
      <polygon
        points={(() => {
          const cx = 150, cy = 185, outer = 16, inner = 7, n = 5
          const pts: string[] = []
          for (let i = 0; i < n * 2; i++) {
            const angle = (Math.PI / n) * i - Math.PI / 2
            const r = i % 2 === 0 ? outer : inner
            pts.push(`${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`)
          }
          return pts.join(" ")
        })()}
        fill={icon}
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
      >DUKE</text>

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
      >DRAW THREE COINS</text>
      <text
        x="150" y="382"
        textAnchor="middle"
        fontFamily="'Rajdhani', sans-serif"
        fontWeight="400"
        fontSize="13"
        letterSpacing="2.5"
        fill="white"
        fillOpacity="0.85"
      >BLOCK FOREIGN AID</text>
    </svg>
  )
}
