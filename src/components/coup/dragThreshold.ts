// src/components/coup/dragThreshold.ts
// Pure decision logic for DraggableCard's drag gesture, split out from the
// framer-motion wrapper so the actual commit/no-commit rule is unit
// testable without a DOM or pointer events.
export function shouldCommitDrag(offsetY: number, thresholdPx: number): boolean {
  return offsetY <= -thresholdPx;
}
