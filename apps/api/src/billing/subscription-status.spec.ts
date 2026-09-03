import {
  effectOf,
  entitledBy,
  holdsSubscription,
  type SubscriptionStatus,
} from './subscription-status';

const EVERY_STATUS: SubscriptionStatus[] = [
  'trialing',
  'active',
  'past_due',
  'unpaid',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'paused',
];

describe('entitledBy', () => {
  it('entitles a trialing and an active subscription', () => {
    expect(entitledBy('trialing')).toBe(true);
    expect(entitledBy('active')).toBe(true);
  });

  it('keeps a past_due subscription entitled through the dunning window', () => {
    expect(entitledBy('past_due')).toBe(true);
  });

  it.each(['unpaid', 'canceled', 'incomplete_expired', 'paused'] as const)(
    'revokes a %s subscription',
    (status) => {
      expect(entitledBy(status)).toBe(false);
    },
  );

  it('refuses an incomplete subscription whose first payment never landed', () => {
    expect(entitledBy('incomplete')).toBe(false);
  });

  it('answers for every status Stripe can send', () => {
    expect(EVERY_STATUS.map(entitledBy)).toEqual([
      true,
      true,
      true,
      false,
      false,
      false,
      false,
      false,
    ]);
  });
});

describe('effectOf', () => {
  it.each(['trialing', 'active', 'past_due'] as const)(
    'lets a %s subscription pay for the plan',
    (status) => {
      expect(effectOf(status)).toBe('entitles');
    },
  );

  it.each(['unpaid', 'paused'] as const)(
    'calls a %s subscription recoverable rather than gone',
    (status) => {
      expect(effectOf(status)).toBe('recoverable');
    },
  );

  it.each(['canceled', 'incomplete', 'incomplete_expired'] as const)(
    'lets the customer buy again after a %s subscription',
    (status) => {
      expect(effectOf(status)).toBe('gone');
    },
  );

  it('holds a subscription whose status has not been read yet', () => {
    expect(effectOf(null)).toBe('recoverable');
  });

  it('frees a workspace from a status it cannot name', () => {
    expect(effectOf('something_stripe_invented')).toBe('gone');
  });
});

describe('holdsSubscription', () => {
  it('holds nothing without a subscription id', () => {
    expect(
      holdsSubscription({ subscriptionId: null, subscriptionStatus: 'active' }),
    ).toBe(false);
  });

  it.each(['trialing', 'active', 'past_due', 'unpaid', 'paused'])(
    'holds a %s subscription',
    (subscriptionStatus) => {
      expect(
        holdsSubscription({ subscriptionId: 'sub_1', subscriptionStatus }),
      ).toBe(true);
    },
  );

  it.each(['canceled', 'incomplete', 'incomplete_expired'])(
    'lets go of a %s subscription',
    (subscriptionStatus) => {
      expect(
        holdsSubscription({ subscriptionId: 'sub_1', subscriptionStatus }),
      ).toBe(false);
    },
  );

  it('holds a subscription recorded before its first status', () => {
    expect(
      holdsSubscription({ subscriptionId: 'sub_1', subscriptionStatus: null }),
    ).toBe(true);
  });
});
