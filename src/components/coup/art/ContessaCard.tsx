import CardFace from './CardFace';

export default function ContessaCard({ activeAbilityIndex }: { activeAbilityIndex?: number }) {
  const bg = '#a84c35';
  const icon = '#e8a848';

  return (
    <CardFace
      bg={bg}
      icon={icon}
      name="CONTESSA"
      ability={['BLOCK ASSASSINATION']}
      label="Contessa card"
      activeAbilityIndex={activeAbilityIndex}
    >
      {/* Diamond gem — top portion of icon */}
      <polygon points="118,162 132,143 168,143 182,162 150,198" fill={icon} />

      {/* Arch / mask body below the gem */}
      <path
        d="M 118 162 L 118 242 L 138 242 L 138 210 A 12 12 0 0 1 162 210 L 162 242 L 182 242 L 182 162 A 32 32 0 0 0 118 162 Z"
        fill={icon}
      />

      {/* Inner arch cutout — background shows through */}
      <path d="M 128 162 A 22 22 0 0 0 172 162 L 172 205 L 128 205 Z" fill={bg} />
    </CardFace>
  );
}
