import type { CardData } from "./coupCardData"
import { abilityFontSize } from "./abilityFontSize"

function BadgeIcon({ type, accent, bg }: { type: CardData["badge"]; accent: string; bg: string }) {
  // Moved up (y=40) and slightly right (x=260) to clear wide silhouettes like the turban/hat
  return (
    <g transform="translate(260, 40)">
      {type === "chair" && (
        <>
          <polygon points="0,-28 7,-9 26,-8 10,3.5 16,22 0,11 -16,22 -10,3.5 -26,-8 -7,-9" fill={accent} />
          <circle cx="0" cy="0" r="12" fill={bg} />
          <polygon points="0,-8 2.2,-2.6 7.8,-2.4 3.5,1.2 4.8,6.5 0,3.8 -4.8,6.5 -3.5,1.2 -7.8,-2.4 -2.2,-2.6" fill={accent} />
        </>
      )}
      {type === "fixer" && (
        <>
          {/* Cranium + jaw — one filled body, tapered so the jaw reads narrower than the skull */}
          <path
            d="M 0,-28 C 20,-28 26,-14 26,-2 C 26,10 22,18 14,22 L 14,26 L -14,26 L -14,22 C -22,18 -26,10 -26,-2 C -26,-14 -20,-28 0,-28 Z"
            fill={accent}
          />
          {/* Eye sockets — circular, like the reference */}
          <circle cx="-11" cy="0" r="6" fill={bg} />
          <circle cx="11" cy="0" r="6" fill={bg} />
          {/* Nose triangle */}
          <polygon points="0,10 -3,17 3,17" fill={bg} />
          {/* Teeth separators (three vertical notches into the jaw) */}
          <rect x="-8.5" y="21" width="2" height="5" fill={bg} />
          <rect x="-1" y="21" width="2" height="5" fill={bg} />
          <rect x="6.5" y="21" width="2" height="5" fill={bg} />
        </>
      )}
      {type === "auditor" && (
        <>
          <polygon points="0,-28 12,-12 6,-12 6,0 -6,0 -6,-12 -12,-12" fill={accent} />
          <polygon points="-16,0 0,16 16,0 11,0 0,10 -11,0" fill={accent} />
          <polygon points="-16,12 0,28 16,12 11,12 0,22 -11,12" fill={accent} />
        </>
      )}
      {type === "broker" && (
        <>
          <polygon points="0,-13 13,0 0,13 -13,0" fill={accent} />
          <polygon points="-8,-15 8,-15 0,-26" fill={accent} />
          <polygon points="-5,-17 5,-17 0,-24" fill={accent} />
          <polygon points="-8,15 8,15 0,26" fill={accent} />
          <polygon points="-5,17 5,17 0,24" fill={accent} />
          <polygon points="15,-7 15,7 26,0" fill={accent} />
          <polygon points="-15,-7 -15,7 -26,0" fill={accent} />
        </>
      )}
      {type === "counsel" && (
        <>
          <polygon points="0,-28 26,-5.6 20,21 -20,21 -26,-5.6" fill={accent} />
          <path d="M -13,21 L -13,4.2 C -13,-9.8 13,-9.8 13,4.2 L 13,21 L 8,21 L 8,4.2 C 8,-2.8 -8,-2.8 -8,4.2 L -8,21 Z" fill={bg} />
        </>
      )}
    </g>
  )
}

interface CoupCardProps extends CardData {
  // Index into `abilities` of the line that dragging THIS card would claim
  // (its own turn action, as opposed to a reactive block-only line). Set
  // only when the card is shown as a playable hand card, so the line
  // you're about to claim stays legible while the other (block-only) line
  // recedes.
  activeAbilityIndex?: number
}

export default function CoupCard({
  bg,
  sil,
  det,
  accent,
  name,
  abilities,
  silhouette,
  cutouts,
  details,
  badge,
  divider,
  activeAbilityIndex,
}: CoupCardProps) {
  const longest = abilities.reduce((a, b) => (b.length > a.length ? b : a), "")
  const fontSize = abilityFontSize(longest.length)

  return (
    <svg
      viewBox="0 0 300 420"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`${name} card`}
      style={{ display: "block", width: "100%", height: "100%" }}
    >
      {/* Background */}
      <rect width="300" height="420" rx="22" fill={bg} />

      {/* Main silhouette — darker than background */}
      <path d={silhouette} fill={sil} />

      {/* Cutouts — bg color punched through silhouette */}
      {cutouts?.map((d, i) => (
        <path key={i} d={d} fill={bg} />
      ))}

      {/* Detail marks — even darker, within silhouette */}
      {details?.map((detail, i) =>
        detail.stroke ? (
          <path
            key={i}
            d={detail.d}
            fill="none"
            stroke={det}
            strokeWidth={detail.width ?? 2.5}
            strokeLinecap="round"
            opacity={detail.opacity ?? 1}
          />
        ) : (
          <path key={i} d={detail.d} fill={det} opacity={detail.opacity ?? 1} />
        )
      )}

      {/* Badge icon — top right */}
      <BadgeIcon type={badge} accent={accent} bg={bg} />

      {/* Footer divider — width matches body silhouette at this level */}
      <rect x={divider[0]} y="306" width={divider[1] - divider[0]} height="1" fill="white" fillOpacity="0.18" />

      {/* Character name */}
      <text
        x="150"
        y="334"
        textAnchor="middle"
        fontFamily="'Rajdhani', sans-serif"
        fontWeight="700"
        fontSize="26"
        letterSpacing="4"
        fill="white"
      >
        {name.toUpperCase()}
      </text>

      {/* Abilities */}
      {abilities.map((line, i) => {
        const dimmed = activeAbilityIndex != null && i !== activeAbilityIndex
        return (
          <text
            key={line}
            x="150"
            y={360 + i * 22}
            textAnchor="middle"
            fontFamily="'Rajdhani', sans-serif"
            fontWeight={dimmed ? "400" : activeAbilityIndex != null ? "700" : "600"}
            fontSize={fontSize}
            letterSpacing="1.8"
            fill="white"
            fillOpacity={dimmed ? 0.4 : 0.65}
          >
            {line}
          </text>
        )
      })}

      {/* Card border */}
      <rect
        x="1"
        y="1"
        width="298"
        height="418"
        rx="21.5"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeOpacity="0.18"
      />
    </svg>
  )
}
