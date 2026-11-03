import type Stripe from 'stripe';
import {
  heldSubscription,
  periodEndOf,
  projectionOf,
  stateFrom,
  stateOf,
  type SubscriptionState,
} from './subscription-state';

const PERIOD_END = 1_800_000_000;

const subscription = (
  over: Partial<Stripe.Subscription> = {},
  periodEnds: number[] = [PERIOD_END],
): Stripe.Subscription =>
  ({
    id: 'sub_1',
    status: 'active',
    cancel_at_period_end: false,
    customer: 'cus_1',
    metadata: {},
    items: {
      data: periodEnds.map((current_period_end) => ({ current_period_end })),
    },
    ...over,
  }) as unknown as Stripe.Subscription;

describe('periodEndOf', () => {
  it('reads the period end the subscription items carry', () => {
    expect(periodEndOf(subscription())).toEqual(new Date(PERIOD_END * 1000));
  });

  it('takes the latest period when items renew apart', () => {
    expect(
      periodEndOf(subscription({}, [PERIOD_END, PERIOD_END + 60])),
    ).toEqual(new Date((PERIOD_END + 60) * 1000));
  });

  it('answers null for a subscription with no items', () => {
    expect(periodEndOf(subscription({}, []))).toBeNull();
  });
});

describe('stateOf', () => {
  it('carries the plan through while the subscription is entitled', () => {
    expect(stateOf(subscription(), 'ultimate', 'month', true)).toEqual({
      subscriptionId: 'sub_1',
      status: 'active',
      plan: 'ultimate',
      planExpiresAt: new Date(PERIOD_END * 1000),
      cancelAtPeriodEnd: false,
      trialStartedAt: null,
      trialEndsAt: null,
      endedAt: null,
      billingInterval: 'month',
    });
  });

  it('keeps a past_due subscription on its plan through dunning', () => {
    expect(
      stateOf(subscription({ status: 'past_due' }), 'indie', 'month', true)
        .plan,
    ).toBe('indie');
  });

  it('drops an unpaid subscription to free', () => {
    expect(
      stateOf(subscription({ status: 'unpaid' }), 'indie', 'month', true).plan,
    ).toBe('free');
  });

  it('records a pending cancellation without revoking access', () => {
    expect(
      stateOf(
        subscription({ cancel_at_period_end: true }),
        'indie',
        'month',
        true,
      ),
    ).toMatchObject({ plan: 'indie', cancelAtPeriodEnd: true });
  });

  it('records a cancellation the portal schedules through cancel_at', () => {
    expect(
      stateOf(
        subscription({ cancel_at_period_end: false, cancel_at: PERIOD_END }),
        'indie',
      ),
    ).toMatchObject({ plan: 'indie', cancelAtPeriodEnd: true });
  });
});

describe('heldSubscription', () => {
  it('prefers an entitled subscription over one still paying', () => {
    const pending = subscription({ id: 'sub_pending', status: 'incomplete' });
    const active = subscription({ id: 'sub_active', status: 'active' });

    expect(heldSubscription([pending, active])?.id).toBe('sub_active');
  });

  it('holds a subscription whose first payment is still confirming', () => {
    const pending = subscription({ id: 'sub_pending', status: 'incomplete' });

    expect(heldSubscription([pending])?.id).toBe('sub_pending');
  });
});

const TRIAL_START = 1_800_000_150;
const TRIAL_END = TRIAL_START + 7 * 24 * 60 * 60;
const at = (seconds: number) => new Date(seconds * 1000);

const trialing = (over: Partial<Stripe.Subscription> = {}) =>
  subscription(
    {
      status: 'trialing',
      trial_start: TRIAL_START,
      trial_end: TRIAL_END,
      ...over,
    },
    [TRIAL_END],
  );

describe('a trialing subscription', () => {
  it('carries the trial dates, the trial end as the period end and the interval', () => {
    expect(stateOf(trialing(), 'indie', 'month', true)).toMatchObject({
      status: 'trialing',
      plan: 'indie',
      trialStartedAt: at(TRIAL_START),
      trialEndsAt: at(TRIAL_END),
      planExpiresAt: at(TRIAL_END),
      cancelAtPeriodEnd: false,
      billingInterval: 'month',
    });
  });

  it('reads a cancel_at as cancelling and keeps the dates', () => {
    expect(
      stateOf(trialing({ cancel_at: TRIAL_END }), 'indie', 'year', true),
    ).toMatchObject({
      cancelAtPeriodEnd: true,
      trialStartedAt: at(TRIAL_START),
      trialEndsAt: at(TRIAL_END),
      billingInterval: 'year',
    });
  });

  it('never resolves the interval of a gone subscription', () => {
    const prices = {
      planOf: () => {
        throw new Error('planOf must not run');
      },
      intervalOf: () => {
        throw new Error('intervalOf must not run');
      },
    };

    expect(
      stateFrom(
        trialing({ status: 'canceled', ended_at: TRIAL_START }),
        prices,
      ),
    ).toMatchObject({
      plan: 'free',
      billingInterval: null,
      endedAt: at(TRIAL_START),
    });
  });
});

describe('projectionOf', () => {
  const NOW = at(TRIAL_START + 3600);
  const state = (over: Partial<SubscriptionState> = {}): SubscriptionState => ({
    ...stateOf(trialing(), 'indie', 'month', true),
    ...over,
  });
  const untried = { trialStartedAt: null, trialEndsAt: null };

  it('writes the interval and the trial dates of a fresh trial', () => {
    expect(projectionOf(state(), untried, NOW)).toEqual({
      plan: 'indie',
      planExpiresAt: at(TRIAL_END),
      subscriptionId: 'sub_1',
      subscriptionStatus: 'trialing',
      cancelAtPeriodEnd: false,
      billingInterval: 'month',
      trialStartedAt: at(TRIAL_START),
      trialEndsAt: at(TRIAL_END),
    });
  });

  it('never changes a trial start that is already set', () => {
    const held = { trialStartedAt: at(1_700_000_000), trialEndsAt: null };

    expect(projectionOf(state(), held, NOW)).not.toHaveProperty(
      'trialStartedAt',
    );
  });

  it('clamps a stored trial end that is still ahead when the subscription is gone', () => {
    const gone = state({
      status: 'canceled',
      plan: 'free',
      endedAt: at(TRIAL_START + 60),
    });
    const held = {
      trialStartedAt: at(TRIAL_START),
      trialEndsAt: at(TRIAL_END),
    };

    expect(projectionOf(gone, held, NOW)).toMatchObject({
      trialEndsAt: at(TRIAL_START + 60),
    });
    expect(projectionOf({ ...gone, endedAt: null }, held, NOW)).toMatchObject({
      trialEndsAt: NOW,
    });
  });

  it('never keeps a trial end ahead for a trial that stopped entitling', () => {
    const stalled = state({
      status: 'past_due',
      plan: 'free',
      trialEndsAt: at(TRIAL_END),
    });

    expect(projectionOf(stalled, untried, NOW)).toMatchObject({
      trialEndsAt: NOW,
    });
    expect(projectionOf(stalled, untried, at(TRIAL_END + 60))).toMatchObject({
      trialEndsAt: at(TRIAL_END),
    });
  });

  it('keeps a legacy trial running while a purchase confirms', () => {
    const confirming = state({
      status: 'incomplete',
      plan: 'free',
      trialStartedAt: null,
      trialEndsAt: null,
    });
    const held = {
      trialStartedAt: at(TRIAL_START),
      trialEndsAt: at(TRIAL_END),
    };

    expect(projectionOf(confirming, held, NOW)).not.toHaveProperty(
      'trialEndsAt',
    );
  });

  it('writes no trial end for a gone subscription without one ahead', () => {
    const gone = state({ status: 'canceled', plan: 'free', endedAt: NOW });

    expect(projectionOf(gone, untried, NOW)).not.toHaveProperty('trialEndsAt');
    expect(
      projectionOf(
        gone,
        { trialStartedAt: at(TRIAL_START), trialEndsAt: at(TRIAL_START) },
        NOW,
      ),
    ).not.toHaveProperty('trialEndsAt');
  });

  it('keeps the date of a legacy trial through a plain purchase', () => {
    const purchase = state({ trialStartedAt: null, trialEndsAt: null });
    const held = {
      trialStartedAt: at(TRIAL_START),
      trialEndsAt: at(TRIAL_END),
    };

    const projected = projectionOf(purchase, held, NOW);

    expect(projected).not.toHaveProperty('trialEndsAt');
    expect(projected).not.toHaveProperty('trialStartedAt');
  });
});

describe('a past_due subscription', () => {
  const prices = {
    planOf: () => 'indie' as const,
    intervalOf: () => 'month' as const,
  };

  it('drops to free with no interval when it never paid', () => {
    expect(
      stateFrom(subscription({ status: 'past_due' }), prices, false),
    ).toMatchObject({ plan: 'free', billingInterval: null });
  });

  it('keeps the plan and the interval once it has paid', () => {
    expect(
      stateFrom(subscription({ status: 'past_due' }), prices, true),
    ).toMatchObject({ plan: 'indie', billingInterval: 'month' });
  });

  it('is still held, whether it paid or not', () => {
    expect(
      heldSubscription([subscription({ status: 'past_due' })]),
    ).toBeDefined();
  });
});
