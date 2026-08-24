import type Stripe from 'stripe';
import { periodEndOf, stateOf } from './subscription-state';

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
    expect(stateOf(subscription(), 'ultimate')).toEqual({
      subscriptionId: 'sub_1',
      status: 'active',
      plan: 'ultimate',
      planExpiresAt: new Date(PERIOD_END * 1000),
      cancelAtPeriodEnd: false,
    });
  });

  it('keeps a past_due subscription on its plan through dunning', () => {
    expect(stateOf(subscription({ status: 'past_due' }), 'indie').plan).toBe(
      'indie',
    );
  });

  it('drops an unpaid subscription to free', () => {
    expect(stateOf(subscription({ status: 'unpaid' }), 'indie').plan).toBe(
      'free',
    );
  });

  it('records a pending cancellation without revoking access', () => {
    expect(
      stateOf(subscription({ cancel_at_period_end: true }), 'indie'),
    ).toMatchObject({ plan: 'indie', cancelAtPeriodEnd: true });
  });
});
