import { PLAN_LIMITS } from '@asobeast/shared';
import { overLimitAfter, planAfterChange, warningDue } from './downgrade';

const NOW = new Date('2026-08-10T00:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(NOW.getTime() + days * DAY_MS);

const change = (over: Partial<Parameters<typeof warningDue>[0]> = {}) => ({
  plan: 'ultimate',
  pendingPlan: 'indie',
  cancelAtPeriodEnd: false,
  planExpiresAt: inDays(3),
  downgradeWarnedAt: null,
  ...over,
});

describe('planAfterChange', () => {
  it('reads the plan the customer switched to', () => {
    expect(planAfterChange(change())).toBe('indie');
  });

  it('treats a pending cancellation as a drop to free', () => {
    expect(
      planAfterChange(change({ cancelAtPeriodEnd: true, pendingPlan: null })),
    ).toBe('free');
  });

  it('keeps the current plan when nothing is pending', () => {
    expect(planAfterChange(change({ pendingPlan: null }))).toBe('ultimate');
  });
});

describe('warningDue', () => {
  it('warns inside the week before the change takes effect', () => {
    expect(warningDue(change(), NOW)).toBe(true);
  });

  it('stays quiet while the effective date is still far off', () => {
    expect(warningDue(change({ planExpiresAt: inDays(20) }), NOW)).toBe(false);
  });

  it('warns only once', () => {
    expect(warningDue(change({ downgradeWarnedAt: NOW }), NOW)).toBe(false);
  });

  it('says nothing when the plan is not shrinking', () => {
    expect(warningDue(change({ pendingPlan: 'ultimate' }), NOW)).toBe(false);
  });

  it('leaves a pending cancellation to the cancellation flow', () => {
    expect(
      warningDue(change({ pendingPlan: null, cancelAtPeriodEnd: true }), NOW),
    ).toBe(false);
  });

  it('says nothing once the effective date has passed', () => {
    expect(warningDue(change({ planExpiresAt: inDays(-1) }), NOW)).toBe(false);
  });

  it('says nothing for a subscription with no period end', () => {
    expect(warningDue(change({ planExpiresAt: null }), NOW)).toBe(false);
  });
});

describe('overLimitAfter', () => {
  it('names only the resources that would be over the smaller plan', () => {
    expect(overLimitAfter('indie', { apps: 40, keywordMarkets: 100 })).toEqual([
      { resource: 'apps', used: 40, limit: PLAN_LIMITS.indie.apps },
    ]);
  });

  it('names every resource that would be over', () => {
    expect(
      overLimitAfter('indie', { apps: 40, keywordMarkets: 8_000 }),
    ).toHaveLength(2);
  });

  it('says nothing when the workspace already fits', () => {
    expect(overLimitAfter('indie', { apps: 2, keywordMarkets: 10 })).toEqual(
      [],
    );
  });

  it('never reports an unlimited axis as exceeded', () => {
    expect(overLimitAfter('ultimate', { apps: 1, keywordMarkets: 1 })).toEqual(
      [],
    );
  });
});
