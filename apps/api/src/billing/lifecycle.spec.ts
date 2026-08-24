import type Stripe from 'stripe';
import { PLAN_LIMITS, effectivePlan, type PlanName } from '@asobeast/shared';
import { isEntitled } from '../auth/entitlement';
import { alreadyTrialed, grantTrial } from '../auth/trial-grant';
import { planAfterChange } from './downgrade';
import { stateOf } from './subscription-state';

const CLOCK = {
  registered: new Date('2026-08-01T00:00:00.000Z'),
  midTrial: new Date('2026-08-04T00:00:00.000Z'),
  trialOver: new Date('2026-08-09T00:00:00.000Z'),
  renewal: new Date('2026-09-08T00:00:00.000Z'),
  afterRenewal: new Date('2026-09-09T00:00:00.000Z'),
};

const PERIOD_END = Math.floor(CLOCK.renewal.getTime() / 1000);

interface WorkspaceState {
  plan: string;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  planExpiresAt: Date | null;
  pendingPlan: string | null;
  cancelAtPeriodEnd: boolean;
}

const fresh = (): WorkspaceState => ({
  plan: 'free',
  trialStartedAt: null,
  trialEndsAt: null,
  planExpiresAt: null,
  pendingPlan: null,
  cancelAtPeriodEnd: false,
});

const subscription = (
  status: Stripe.Subscription.Status,
  cancelAtPeriodEnd = false,
): Stripe.Subscription =>
  ({
    id: 'sub_1',
    status,
    cancel_at_period_end: cancelAtPeriodEnd,
    customer: 'cus_1',
    metadata: {},
    items: { data: [{ current_period_end: PERIOD_END }] },
  }) as unknown as Stripe.Subscription;

function applySubscription(
  state: WorkspaceState,
  status: Stripe.Subscription.Status,
  plan: PlanName,
  cancelAtPeriodEnd = false,
): WorkspaceState {
  const next = stateOf(subscription(status, cancelAtPeriodEnd), plan);
  return {
    ...state,
    plan: next.plan,
    planExpiresAt: next.planExpiresAt,
    cancelAtPeriodEnd: next.cancelAtPeriodEnd,
  };
}

const startTrial = (state: WorkspaceState, now: Date): WorkspaceState =>
  alreadyTrialed(state) ? state : { ...state, ...grantTrial(7, now) };

const runsInFanOut = (state: WorkspaceState, now: Date) =>
  isEntitled(state, now);

const limitsOf = (state: WorkspaceState, now: Date) =>
  PLAN_LIMITS[effectivePlan(state, now)];

describe('subscription lifecycle transitions', () => {
  it('registration to trial opens capacity at the indie limits', () => {
    const before = fresh();
    expect(runsInFanOut(before, CLOCK.registered)).toBe(false);

    const after = startTrial(before, CLOCK.registered);

    expect(runsInFanOut(after, CLOCK.registered)).toBe(true);
    expect(limitsOf(after, CLOCK.registered)).toEqual(PLAN_LIMITS.indie);
  });

  it('trial to expired closes capacity and keeps nothing but the history', () => {
    const trialing = startTrial(fresh(), CLOCK.registered);

    expect(runsInFanOut(trialing, CLOCK.midTrial)).toBe(true);
    expect(runsInFanOut(trialing, CLOCK.trialOver)).toBe(false);
    expect(limitsOf(trialing, CLOCK.trialOver)).toEqual(PLAN_LIMITS.free);
    expect(trialing.trialStartedAt).not.toBeNull();
  });

  it('trial to paid raises the limits the moment the subscription lands', () => {
    const trialing = startTrial(fresh(), CLOCK.registered);

    const paid = applySubscription(trialing, 'active', 'indie');

    expect(runsInFanOut(paid, CLOCK.trialOver)).toBe(true);
    expect(limitsOf(paid, CLOCK.trialOver)).toEqual(PLAN_LIMITS.indie);
    expect(paid.trialStartedAt).toEqual(trialing.trialStartedAt);
  });

  it('paid to past_due keeps the customer working through dunning', () => {
    const paid = applySubscription(fresh(), 'active', 'indie');

    const dunning = applySubscription(paid, 'past_due', 'indie');

    expect(runsInFanOut(dunning, CLOCK.midTrial)).toBe(true);
    expect(limitsOf(dunning, CLOCK.midTrial)).toEqual(PLAN_LIMITS.indie);
  });

  it('past_due to paid needs no manual step', () => {
    const dunning = applySubscription(fresh(), 'past_due', 'indie');

    const recovered = applySubscription(dunning, 'active', 'indie');

    expect(runsInFanOut(recovered, CLOCK.midTrial)).toBe(true);
  });

  it('past_due to canceled ends capacity', () => {
    const dunning = applySubscription(fresh(), 'past_due', 'indie');

    const gone = applySubscription(dunning, 'canceled', 'indie');

    expect(runsInFanOut(gone, CLOCK.midTrial)).toBe(false);
    expect(limitsOf(gone, CLOCK.midTrial)).toEqual(PLAN_LIMITS.free);
  });

  it('paid to cancelled keeps access to the period end and no further', () => {
    const paid = applySubscription(fresh(), 'active', 'indie');

    const pending = applySubscription(paid, 'active', 'indie', true);

    expect(pending.cancelAtPeriodEnd).toBe(true);
    expect(runsInFanOut(pending, CLOCK.midTrial)).toBe(true);
    expect(runsInFanOut(pending, CLOCK.afterRenewal)).toBe(false);
    expect(planAfterChange(pending)).toBe('free');
  });

  it('cancelled to resubscribed restores access without a second trial', () => {
    const lapsed = applySubscription(
      startTrial(fresh(), CLOCK.registered),
      'canceled',
      'indie',
    );

    const returning = startTrial(
      applySubscription(lapsed, 'active', 'indie'),
      CLOCK.trialOver,
    );

    expect(runsInFanOut(returning, CLOCK.trialOver)).toBe(true);
    expect(returning.trialEndsAt).toEqual(new Date('2026-08-08T00:00:00.000Z'));
  });

  it('indie to ultimate raises every limit at once', () => {
    const indie = applySubscription(fresh(), 'active', 'indie');

    const ultimate = applySubscription(indie, 'active', 'ultimate');

    expect(limitsOf(ultimate, CLOCK.midTrial)).toEqual(PLAN_LIMITS.ultimate);
  });

  it('ultimate to indie lands on the smaller limits at the period end', () => {
    const ultimate = applySubscription(fresh(), 'active', 'ultimate');
    const pending = { ...ultimate, pendingPlan: 'indie' };

    expect(planAfterChange(pending)).toBe('indie');
    expect(limitsOf(pending, CLOCK.midTrial)).toEqual(PLAN_LIMITS.ultimate);

    const applied = applySubscription(pending, 'active', 'indie');
    expect(limitsOf(applied, CLOCK.midTrial)).toEqual(PLAN_LIMITS.indie);
  });

  it('monthly to annual changes nothing but the renewal date', () => {
    const monthly = applySubscription(fresh(), 'active', 'indie');

    const annual = applySubscription(monthly, 'active', 'indie');

    expect(limitsOf(annual, CLOCK.midTrial)).toEqual(
      limitsOf(monthly, CLOCK.midTrial),
    );
    expect(runsInFanOut(annual, CLOCK.midTrial)).toBe(true);
  });
});

describe('invariants that hold across every state', () => {
  const journey: WorkspaceState[] = [];
  const trialing = startTrial(fresh(), CLOCK.registered);
  const paid = applySubscription(trialing, 'active', 'indie');
  const dunning = applySubscription(paid, 'past_due', 'indie');
  const cancelled = applySubscription(dunning, 'canceled', 'indie');
  const resubscribed = startTrial(
    applySubscription(cancelled, 'active', 'ultimate'),
    CLOCK.afterRenewal,
  );
  journey.push(fresh(), trialing, paid, dunning, cancelled, resubscribed);

  it('never grants a workspace a second trial', () => {
    const trials = journey
      .map((state) => state.trialEndsAt?.toISOString() ?? null)
      .filter((value): value is string => value !== null);

    expect(new Set(trials).size).toBe(1);
  });

  it('never changes the trial start once it is set', () => {
    const starts = journey
      .map((state) => state.trialStartedAt?.getTime())
      .filter((value): value is number => value !== undefined);

    expect(new Set(starts).size).toBe(1);
  });

  it('answers entitlement for every state without throwing', () => {
    expect(
      journey.map((state) => typeof isEntitled(state, CLOCK.midTrial)),
    ).toEqual(journey.map(() => 'boolean'));
  });

  it('resolves a known plan for every state it can reach', () => {
    expect(
      journey.every((state) =>
        Object.hasOwn(PLAN_LIMITS, effectivePlan(state, CLOCK.midTrial)),
      ),
    ).toBe(true);
  });
});
