// src/components/coup/art/CardFace.tsx
import { useId } from 'react';
import { abilityFontSize } from './abilityFontSize';

interface CardFaceProps {
  bg: string;
  icon: string;
  name: string;
  ability: string[]; // 1 or 2 lines, already uppercase
  label: string; // aria-label, e.g. "Duke card"
  children: React.ReactNode; // icon shapes only — CardFace owns the <svg>, border, and text
  // Index into `ability` of the line that dragging THIS card would claim (its
  // own turn action, as opposed to a reactive block-only line). Set only when
  // the card is shown as a playable hand card, so the line you're about to
  // claim stays legible while the other (block-only) line recedes — this is
  // what a raw drag gesture can't otherwise communicate.
  activeAbilityIndex?: number;
}

const ABILITY_Y: Record<number, number[]> = {
  1: [368],
  2: [360, 380],
};

// Shared SVG shell for every character card face: background, border,
// a faint top sheen, corner accents, and length-aware name/ability text
// layout. Each character file supplies only its accent colors, name,
// ability line(s), and icon shapes as children.
export default function CardFace({ bg, icon, name, ability, label, children, activeAbilityIndex }: CardFaceProps) {
  const gradientId = useId().replace(/:/g, '');
  const longest = ability.reduce((a, b) => (b.length > a.length ? b : a), '');
  const fontSize = abilityFontSize(longest.length);
  const abilityY = ABILITY_Y[ability.length] ?? ABILITY_Y[1];

  const corners = [
    { x: 22, y: 22, dx: 1, dy: 1 },
    { x: 278, y: 22, dx: -1, dy: 1 },
    { x: 22, y: 398, dx: 1, dy: -1 },
    { x: 278, y: 398, dx: -1, dy: -1 },
  ];

  return (
    <svg viewBox="0 0 300 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={label}>
      <defs>
        <linearGradient id={`${gradientId}-sheen`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.08" />
          <stop offset="35%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="300" height="420" rx="22" fill={bg} />
      <rect width="300" height="420" rx="22" fill={`url(#${gradientId}-sheen)`} />
      <rect x="1" y="1" width="298" height="418" rx="21.5" fill="none" stroke="white" strokeWidth="2" strokeOpacity="0.25" />

      {corners.map((c, i) => (
        <path
          key={i}
          d={`M ${c.x} ${c.y + 12 * c.dy} L ${c.x} ${c.y} L ${c.x + 12 * c.dx} ${c.y}`}
          fill="none"
          stroke={icon}
          strokeWidth="2"
          strokeOpacity="0.35"
          strokeLinecap="round"
        />
      ))}

      {children}

      <text
        x="150"
        y="328"
        textAnchor="middle"
        fontFamily="'Rajdhani', sans-serif"
        fontWeight="700"
        fontSize="26"
        letterSpacing="3"
        fill="white"
      >
        {name}
      </text>

      {ability.map((line, i) => {
        const dimmed = activeAbilityIndex != null && i !== activeAbilityIndex;
        return (
          <text
            key={line}
            x="150"
            y={abilityY[i]}
            textAnchor="middle"
            fontFamily="'Rajdhani', sans-serif"
            fontWeight={dimmed ? '400' : activeAbilityIndex != null ? '700' : '400'}
            fontSize={fontSize}
            letterSpacing="2"
            fill="white"
            fillOpacity={dimmed ? '0.4' : '0.85'}
          >
            {line}
          </text>
        );
      })}
    </svg>
  );
}
