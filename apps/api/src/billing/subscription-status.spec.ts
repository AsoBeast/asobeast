import {
  effectOf,
  entitledBy,
  holdsSubscription,
  pendingBy,
  stalledBy,
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
    expect(entitledBy('trialing', true)).toBe(true);
    expect(entitledBy('active', true)).toBe(true);
  });

  it('keeps a past_due subscription entitled through the dunning window', () => {
    expect(entitledBy('past_due', true)).toBe(true);
  });

  it.each(['unpaid', 'canceled', 'incomplete_expired', 'paused'] as const)(
    'revokes a %s subscription',
    (status) => {
      expect(entitledBy(status, true)).toBe(false);
    },
  );

  it('refuses an incomplete subscription whose first payment never landed', () => {
    expect(entitledBy('incomplete', true)).toBe(false);
  });

  it('answers for every status Stripe can send', () => {
    expect(EVERY_STATUS.map((status) => entitledBy(status, true))).toEqual([
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
      expect(effectOf(status, true)).toBe('entitles');
    },
  );

  it.each(['unpaid', 'paused'] as const)(
    'calls a %s subscription recoverable rather than gone',
    (status) => {
      expect(effectOf(status, true)).toBe('recoverable');
    },
  );

  it('holds an incomplete subscription as pending', () => {
    expect(effectOf('incomplete', true)).toBe('pending');
    expect(
      holdsSubscription({
        subscriptionId: 'sub_1',
        subscriptionStatus: 'incomplete',
      }),
    ).toBe(true);
    expect(stalledBy('incomplete', true)).toBe(false);
    expect(pendingBy('incomplete')).toBe(true);
    expect(pendingBy('active')).toBe(false);
    expect(pendingBy(null)).toBe(false);
    expect(effectOf('incomplete_expired', true)).toBe('gone');
  });

  it.each(['canceled', 'incomplete_expired'] as const)(
    'lets the customer buy again after a %s subscription',
    (status) => {
      expect(effectOf(status, true)).toBe('gone');
    },
  );

  it('holds a subscription whose status has not been read yet', () => {
    expect(effectOf(null, true)).toBe('recoverable');
  });

  it('frees a workspace from a status it cannot name', () => {
    expect(effectOf('something_stripe_invented', true)).toBe('gone');
  });

  it.each(['constructor', 'toString', '__proto__'])(
    'reads %s as a status rather than as a property of the lookup',
    (status) => {
      expect(effectOf(status, true)).toBe('gone');
    },
  );
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

  it.each(['canceled', 'incomplete_expired'])(
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

describe('a subscription that never paid', () => {
  it('pauses a past_due subscription that has never paid an invoice', () => {
    expect(effectOf('past_due', false)).toBe('recoverable');
    expect(entitledBy('past_due', false)).toBe(false);
    expect(stalledBy('past_due', false)).toBe(true);
  });

  it('keeps a paying customer entitled through dunning', () => {
    expect(effectOf('past_due', true)).toBe('entitles');
    expect(entitledBy('past_due', true)).toBe(true);
    expect(stalledBy('past_due', true)).toBe(false);
  });

  it('reads every other status the same whether it paid or not', () => {
    const others = EVERY_STATUS.filter((status) => status !== 'past_due');

    expect(others.map((status) => effectOf(status, false))).toEqual(
      others.map((status) => effectOf(status, true)),
    );
  });
});
