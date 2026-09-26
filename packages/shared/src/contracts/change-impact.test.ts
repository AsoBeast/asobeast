import { describe, expect, it } from 'vitest';
import { CHANGE_IMPACT_WINDOWS } from './change-impact';

describe('change impact windows', () => {
  it('measures a week, a fortnight and four weeks after a change', () => {
    expect(CHANGE_IMPACT_WINDOWS).toEqual([7, 14, 28]);
  });

  it('lists the windows shortest first, each once', () => {
    expect([...CHANGE_IMPACT_WINDOWS].sort((a, b) => a - b)).toEqual([
      ...CHANGE_IMPACT_WINDOWS,
    ]);
    expect(new Set(CHANGE_IMPACT_WINDOWS).size).toBe(
      CHANGE_IMPACT_WINDOWS.length,
    );
  });
});
