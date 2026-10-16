import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  CHANGE_IMPACT_WINDOWS,
  type ChangeImpactFunnel,
  type ChangeImpactWindow,
} from './change-impact';

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

describe('the funnel block of a window', () => {
  it('keeps every existing window field and adds an optional funnel block', () => {
    expectTypeOf<ChangeImpactWindow['funnel']>().toEqualTypeOf<
      ChangeImpactFunnel | null | undefined
    >();
    expectTypeOf<ChangeImpactWindow['visibilityChange']>().toEqualTypeOf<
      number | null
    >();
  });

  it('carries a status, the complete days and the counts on each side', () => {
    const funnel: ChangeImpactFunnel = {
      status: 'pending',
      completeDays: 1,
      before: null,
      after: null,
      change: null,
    };

    expect(funnel.completeDays).toBe(1);
    expectTypeOf<ChangeImpactFunnel['status']>().toEqualTypeOf<
      'measured' | 'pending' | 'unmeasured'
    >();
  });
});
