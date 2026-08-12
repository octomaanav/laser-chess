import { describe, expect, it } from 'vitest';
import { abilityFontSize } from './abilityFontSize';

describe('abilityFontSize', () => {
  it('returns the base size for short lines', () => {
    expect(abilityFontSize(15)).toBe(13);
    expect(abilityFontSize(20)).toBe(13);
  });

  it('shrinks gradually past 20 characters', () => {
    expect(abilityFontSize(30)).toBeCloseTo(10.5);
  });

  it('never shrinks below the 10px floor', () => {
    expect(abilityFontSize(100)).toBe(10);
  });
});
