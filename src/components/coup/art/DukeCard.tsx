import CardFace from './CardFace';

export default function DukeCard({ activeAbilityIndex }: { activeAbilityIndex?: number }) {
  const bg = '#6e3578';
  const icon = '#d088c8';

  // 5-pointed star: outer r=70, inner r=28, centered at (150,185)
  const star = (() => {
    const cx = 150, cy = 185, outer = 70, inner = 28, n = 5;
    const pts: string[] = [];
    for (let i = 0; i < n * 2; i++) {
      const angle = (Math.PI / n) * i - Math.PI / 2;
      const r = i % 2 === 0 ? outer : inner;
      pts.push(`${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`);
    }
    return pts.join(' ');
  })();

  const innerStar = (() => {
    const cx = 150, cy = 185, outer = 16, inner = 7, n = 5;
    const pts: string[] = [];
    for (let i = 0; i < n * 2; i++) {
      const angle = (Math.PI / n) * i - Math.PI / 2;
      const r = i % 2 === 0 ? outer : inner;
      pts.push(`${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`);
    }
    return pts.join(' ');
  })();

  return (
    <CardFace bg={bg} icon={icon} name="DUKE" ability={['DRAW THREE COINS', 'BLOCK FOREIGN AID']} label="Duke card" activeAbilityIndex={activeAbilityIndex}>
      <circle cx="150" cy="185" r="55" fill="none" stroke={icon} strokeWidth="10" />
      <polygon points={star} fill={icon} />
      <circle cx="150" cy="185" r="22" fill={bg} />
      <polygon points={innerStar} fill={icon} />
    </CardFace>
  );
}
