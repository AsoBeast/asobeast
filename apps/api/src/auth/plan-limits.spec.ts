import {
  PLAN_LIMITS,
  SELF_HOSTED_LIMITS,
  TRIAL_AI_CALLS_PER_MONTH,
  trialingLimits,
} from '@asobeast/shared';
import { planScopeOf, selfHostedLimits } from './plan-limits';

const NOW = new Date('2026-10-02T12:00:00.000Z');
const INDIE = {
  plan: 'indie',
  trialEndsAt: null,
  planExpiresAt: null,
  subscriptionStatus: 'active',
};

const FUTURE = new Date('2026-10-09T12:00:00.000Z');
const PAST = new Date('2026-10-01T12:00:00.000Z');

const ultimate = (
  subscriptionStatus: string | null,
  planExpiresAt = FUTURE,
) => ({
  plan: 'ultimate',
  trialEndsAt: FUTURE,
  planExpiresAt,
  subscriptionStatus,
});

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

  it('caps only the ai allowance while a paid plan is trialing', () => {
    const scope = planScopeOf(true, ultimate('trialing'), NOW);

    expect(scope.plan).toBe('ultimate');
    expect(scope.limits).toEqual(trialingLimits(PLAN_LIMITS.ultimate));
    expect(scope.limits.apps).toBe(PLAN_LIMITS.ultimate.apps);
    expect(scope.limits.aiCallsPerMonth).toBe(TRIAL_AI_CALLS_PER_MONTH);
  });

  it.each(['active', 'past_due'])(
    'keeps the full limits of a %s subscription',
    (status) => {
      expect(planScopeOf(true, ultimate(status), NOW).limits).toBe(
        PLAN_LIMITS.ultimate,
      );
    },
  );

  it('keeps no capacity for a trial whose plan already expired', () => {
    const scope = planScopeOf(
      true,
      { ...ultimate('trialing', PAST), trialEndsAt: PAST },
      NOW,
    );

    expect(scope).toEqual({ plan: 'free', limits: PLAN_LIMITS.free });
  });

  it('keeps the limits of a legacy trial', () => {
    expect(
      planScopeOf(
        true,
        {
          plan: 'trial',
          trialEndsAt: FUTURE,
          planExpiresAt: null,
          subscriptionStatus: null,
        },
        NOW,
      ).limits,
    ).toBe(PLAN_LIMITS.trial);
  });

  it('ignores the status on a self hosted instance', () => {
    expect(planScopeOf(false, ultimate('trialing'), NOW).limits).toBe(
      SELF_HOSTED_LIMITS,
    );
  });
});
