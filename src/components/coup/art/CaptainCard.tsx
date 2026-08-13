import CardFace from './CardFace';

export default function CaptainCard() {
  const bg = '#2d4178';
  const icon = '#5db8e8';

  return (
    <CardFace bg={bg} icon={icon} name="CAPTAIN" ability={['STEAL TWO COINS', 'BLOCK STEALING']} label="Captain card">
      {/* Up arrow — pointing up */}
      <polygon points="150,138 122,172 178,172" fill={icon} />
      <rect x="140" y="170" width="20" height="38" fill={icon} />

      {/* First down-chevron (V) */}
      <polygon points="112,212 150,248 188,212 175,212 150,236 125,212" fill={icon} />

      {/* Second down-chevron, slightly lower and wider */}
      <polygon points="100,228 150,268 200,228 187,228 150,258 113,228" fill={icon} />
    </CardFace>
  );
}
