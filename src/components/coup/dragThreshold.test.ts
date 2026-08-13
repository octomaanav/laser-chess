import { describe, expect, it } from 'vitest';
import { shouldCommitDrag } from './dragThreshold';

describe('shouldCommitDrag', () => {
  it('commits when dragged up past the threshold', () => {
    expect(shouldCommitDrag(-61, 60)).toBe(true);
    expect(shouldCommitDrag(-60, 60)).toBe(true);
  });

  it('does not commit when dragged up but short of the threshold', () => {
    expect(shouldCommitDrag(-59, 60)).toBe(false);
    expect(shouldCommitDrag(0, 60)).toBe(false);
  });

  it('does not commit when dragged downward', () => {
    expect(shouldCommitDrag(40, 60)).toBe(false);
  });
});
