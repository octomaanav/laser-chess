import CardFace from './CardFace';

export default function AmbassadorCard() {
  const bg = '#4b8c5c';
  const icon = '#6aad7c';

  return (
    <CardFace bg={bg} icon={icon} name="AMBASSADOR" ability={['EXCHANGE TWO CARDS', 'BLOCK STEALING']} label="Ambassador card">
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
    </CardFace>
  );
}
