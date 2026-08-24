import { entitledBy, type SubscriptionStatus } from './subscription-status';

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
