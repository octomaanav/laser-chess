// Pure decision logic for CardTilt's pointer-tracking rotation, split out
// from the framer-motion wrapper so the angle math is unit testable
// without a DOM or pointer events.
export function computeTilt(
  offsetX: number,
  offsetY: number,
  width: number,
  height: number,
  maxDeg: number,
): { rotateX: number; rotateY: number } {
  if (width <= 0 || height <= 0) return { rotateX: 0, rotateY: 0 };
  const px = offsetX / width - 0.5;
  const py = offsetY / height - 0.5;
  return {
    rotateX: -py * 2 * maxDeg || 0,
    rotateY: px * 2 * maxDeg || 0,
  };
}
