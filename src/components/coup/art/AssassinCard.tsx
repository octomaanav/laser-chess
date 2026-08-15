import CardFace from './CardFace';

export default function AssassinCard({ activeAbilityIndex }: { activeAbilityIndex?: number }) {
  const bg = '#4b4d54';
  const icon = '#7c8189';

  return (
    <CardFace
      bg={bg}
      icon={icon}
      name="ASSASSIN"
      ability={['PAY THREE COINS TO ASSASSINATE']}
      label="Assassin card"
      activeAbilityIndex={activeAbilityIndex}
    >
      {/* Skull head — dome top, square body */}
      <path d="M 113 205 L 113 170 A 37 42 0 0 1 187 170 L 187 205 Z" fill={icon} />

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

      {/* Hood shading — thin inset arc for a bit of dimensional detail */}
      <path d="M 121 172 A 29 34 0 0 1 179 172" fill="none" stroke={bg} strokeWidth="3" strokeOpacity="0.4" />
    </CardFace>
  );
}
