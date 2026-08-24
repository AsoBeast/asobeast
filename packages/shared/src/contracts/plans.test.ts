import { describe, expect, it } from 'vitest';
import {
  ON_DEMAND_ACTIONS,
  PAID_PLAN_NAMES,
  PLANS,
  PLAN_LIMITS,
  PLAN_NAMES,
  SELF_HOSTED_LIMITS,
  effectivePlan,
  isPaidPlan,
  nextPlan,
  paidPlanOf,
  planOf,
} from './plans';

describe('effectivePlan', () => {
  const now = new Date('2026-08-09T00:00:00Z');
  const past = new Date('2026-08-01T00:00:00Z');
  const future = new Date('2026-08-20T00:00:00Z');

  it('runs a paid plan with no expiry at its own tier', () => {
    expect(
      effectivePlan(
        { plan: 'ultimate', planExpiresAt: null, trialEndsAt: null },
        now,
      ),
    ).toBe('ultimate');
  });

  it('drops an expired paid plan to free', () => {
    expect(
      effectivePlan(
        { plan: 'ultimate', planExpiresAt: past, trialEndsAt: null },
        now,
      ),
    ).toBe('free');
  });

  it('prefers a live paid plan over a live trial', () => {
    expect(
      effectivePlan(
        { plan: 'indie', planExpiresAt: future, trialEndsAt: future },
        now,
      ),
    ).toBe('indie');
  });

  it('falls back to the trial when a paid plan has lapsed', () => {
    expect(
      effectivePlan(
        { plan: 'indie', planExpiresAt: past, trialEndsAt: future },
        now,
      ),
    ).toBe('trial');
  });

  it('runs an unpaid workspace with a live trial at trial limits', () => {
    expect(
      effectivePlan(
        { plan: 'free', planExpiresAt: null, trialEndsAt: future },
        now,
      ),
    ).toBe('trial');
  });

  it('treats a trial ending exactly now as over', () => {
    expect(
      effectivePlan(
        { plan: 'free', planExpiresAt: null, trialEndsAt: now },
        now,
      ),
    ).toBe('free');
  });

  it('treats a paid plan expiring exactly now as over', () => {
    expect(
      effectivePlan(
        { plan: 'indie', planExpiresAt: now, trialEndsAt: null },
        now,
      ),
    ).toBe('free');
  });

  it('resolves the legacy premium value at indie limits', () => {
    expect(
      effectivePlan(
        { plan: 'premium', planExpiresAt: null, trialEndsAt: null },
        now,
      ),
    ).toBe('indie');
  });
});

describe('nextPlan', () => {
  it('walks the ladder in order', () => {
    expect(nextPlan('indie')).toBe('ultimate');
  });

  it('returns null at the top of the ladder', () => {
    expect(nextPlan('ultimate')).toBeNull();
  });

  it('sends every unpaid plan to the entry tier', () => {
    expect(nextPlan('free')).toBe('indie');
    expect(nextPlan('trial')).toBe('indie');
  });

  it('offers a paid upgrade to every plan but the last', () => {
    expect(PLAN_NAMES.filter((plan) => nextPlan(plan) === null)).toEqual([
      'ultimate',
    ]);
  });
});

describe('planOf', () => {
  it('maps the legacy premium value onto indie', () => {
    expect(planOf('premium')).toBe('indie');
  });

  it('accepts padded, mixed-case plan names', () => {
    expect(planOf('  Ultimate ')).toBe('ultimate');
  });

  it('treats an unknown or missing plan as free', () => {
    expect(planOf('enterprise')).toBe('free');
    expect(planOf(null)).toBe('free');
    expect(planOf(undefined)).toBe('free');
    expect(planOf('')).toBe('free');
  });

  it('resolves every stored plan name to itself', () => {
    expect(PLAN_NAMES.map(planOf)).toEqual([...PLAN_NAMES]);
  });
});

describe('paidPlanOf', () => {
  it('maps the legacy premium value onto indie', () => {
    expect(paidPlanOf('premium')).toBe('indie');
  });

  it('rejects the unpaid plans and unknown values', () => {
    expect(paidPlanOf('free')).toBeNull();
    expect(paidPlanOf('trial')).toBeNull();
    expect(paidPlanOf('enterprise')).toBeNull();
    expect(paidPlanOf(null)).toBeNull();
  });

  it('agrees with isPaidPlan on every plan', () => {
    expect(PLAN_NAMES.filter(isPaidPlan)).toEqual([...PAID_PLAN_NAMES]);
  });
});

describe('plan limits', () => {
  it('gives the trial the indie limits it is sold as', () => {
    expect(PLAN_LIMITS.trial).toEqual(PLAN_LIMITS.indie);
  });

  it('holds the limits C0-02 validated', () => {
    expect(PLAN_LIMITS.indie).toMatchObject({
      apps: 5,
      keywordMarkets: 1_000,
      competitorsPerApp: 10,
    });
    expect(PLAN_LIMITS.ultimate).toMatchObject({
      apps: 50,
      keywordMarkets: 10_000,
      competitorsPerApp: 25,
    });
  });

  it('leaves a free workspace no capacity to spend', () => {
    expect(PLAN_LIMITS.free.apps).toBe(0);
    expect(PLAN_LIMITS.free.keywordMarkets).toBe(0);
  });

  it('rates every on-demand action on every plan that has capacity', () => {
    for (const plan of PLAN_NAMES) {
      const rules = PLAN_LIMITS[plan].onDemand;
      expect(rules).not.toBeNull();
      for (const action of ON_DEMAND_ACTIONS) {
        expect(rules?.[action].windowSeconds).toBeGreaterThan(0);
      }
    }
  });

  it('leaves a self hosted instance unmetered on every paid axis', () => {
    expect(SELF_HOSTED_LIMITS).toMatchObject({
      apps: null,
      keywordMarkets: null,
      apiRequestsPerMinute: null,
      apiWritesPerMinute: null,
      apiRequestsPerDay: null,
      apiConcurrentRequests: null,
      mcpRequestsPerMinute: null,
      onDemand: null,
    });
  });

  it('keeps the competitor cap on a self hosted instance', () => {
    expect(SELF_HOSTED_LIMITS.competitorsPerApp).toBe(
      PLAN_LIMITS.indie.competitorsPerApp,
    );
  });
});

describe('plan definitions', () => {
  it('prices the paid plans at two months free on the annual term', () => {
    for (const plan of PAID_PLAN_NAMES) {
      const { monthlyUsd, annualUsd } = PLANS[plan].prices;
      expect(annualUsd).toBe((monthlyUsd as number) * 10);
    }
  });

  it('leaves the unpaid plans unpriced', () => {
    expect(PLANS.free.prices).toEqual({ monthlyUsd: null, annualUsd: null });
    expect(PLANS.trial.prices).toEqual({ monthlyUsd: null, annualUsd: null });
  });

  it('names every plan it defines', () => {
    expect(PLAN_NAMES.map((plan) => PLANS[plan].name)).toEqual([...PLAN_NAMES]);
    expect(PLAN_NAMES.every((plan) => PLANS[plan].displayName.length > 0)).toBe(
      true,
    );
  });
});
