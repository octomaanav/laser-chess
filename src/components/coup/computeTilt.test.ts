import { describe, expect, it } from 'vitest';
import { computeTilt } from './computeTilt';

describe('computeTilt', () => {
  it('returns no rotation at the exact center', () => {
    expect(computeTilt(50, 50, 100, 100, 10)).toEqual({ rotateX: 0, rotateY: 0 });
  });

  it('tilts toward the top-left corner', () => {
    expect(computeTilt(0, 0, 100, 100, 10)).toEqual({ rotateX: 10, rotateY: -10 });
  });

  it('tilts toward the bottom-right corner', () => {
    expect(computeTilt(100, 100, 100, 100, 10)).toEqual({ rotateX: -10, rotateY: 10 });
  });

  it('returns no rotation for a zero-size card', () => {
    expect(computeTilt(10, 10, 0, 0, 10)).toEqual({ rotateX: 0, rotateY: 0 });
  });
});
