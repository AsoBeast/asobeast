import { PLAN_LIMITS, SELF_HOSTED_LIMITS } from '@asobeast/shared';
import { planScopeOf, selfHostedLimits } from './plan-limits';

const NOW = new Date('2026-10-02T12:00:00.000Z');
const INDIE = { plan: 'indie', trialEndsAt: null, planExpiresAt: null };

describe('selfHostedLimits', () => {
  it('applies the self hosted ai cap', () => {
    expect(selfHostedLimits(40)).toEqual({
      ...SELF_HOSTED_LIMITS,
      aiCallsPerMonth: 40,
    });
  });

  it('stays unlimited without a cap', () => {
    expect(selfHostedLimits(null)).toEqual(SELF_HOSTED_LIMITS);
  });
});

describe('planScopeOf', () => {
  it('uses the configured self hosted limits when billing is off', () => {
    expect(
      planScopeOf(false, INDIE, NOW, selfHostedLimits(40)).limits
        .aiCallsPerMonth,
    ).toBe(40);
  });

  it('keeps the plan allowance when billing is on', () => {
    expect(planScopeOf(true, INDIE, NOW, selfHostedLimits(40)).limits).toBe(
      PLAN_LIMITS.indie,
    );
  });
});
