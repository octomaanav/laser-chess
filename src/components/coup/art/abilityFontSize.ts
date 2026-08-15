// src/components/coup/art/abilityFontSize.ts
// Pure text-length → font-size math for card ability lines, split out so
// the sizing rule is unit testable without rendering SVG. The longest
// current ability line ("PAY THREE COINS TO ASSASSINATE", 30 chars) was
// visibly crowding the card edges at a fixed 13px — this shrinks only
// lines past the 20-character mark that fit comfortably at full size.
export function abilityFontSize(charCount: number): number {
  if (charCount <= 20) return 13;
  return Math.max(10, 13 - (charCount - 20) * 0.25);
}
