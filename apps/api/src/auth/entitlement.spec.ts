import { UPGRADE_PATH } from '@asobeast/shared';
import { entitlementDetail, isEntitled } from './entitlement';

describe('isEntitled', () => {
  const now = new Date('2026-07-23T00:00:00Z');
  const past = new Date('2026-07-01T00:00:00Z');
  const future = new Date('2026-08-01T00:00:00Z');

  it('entitles a premium plan with no expiry', () => {
    expect(
      isEntitled(
        { plan: 'premium', planExpiresAt: null, trialEndsAt: null },
        now,
      ),
    ).toBe(true);
  });

  it('entitles a premium plan that expires in the future', () => {
    expect(
      isEntitled(
        { plan: 'premium', planExpiresAt: future, trialEndsAt: null },
        now,
      ),
    ).toBe(true);
  });

  it('rejects a premium plan that has expired', () => {
    expect(
      isEntitled(
        { plan: 'premium', planExpiresAt: past, trialEndsAt: null },
        now,
      ),
    ).toBe(false);
  });

  it('entitles an ultimate plan with no expiry', () => {
    expect(
      isEntitled(
        { plan: 'ultimate', planExpiresAt: null, trialEndsAt: null },
        now,
      ),
    ).toBe(true);
  });

  it('entitles an ultimate plan whose trial has lapsed', () => {
    expect(
      isEntitled(
        { plan: 'ultimate', planExpiresAt: null, trialEndsAt: past },
        now,
      ),
    ).toBe(true);
  });

  it('rejects an ultimate plan that has expired', () => {
    expect(
      isEntitled(
        { plan: 'ultimate', planExpiresAt: past, trialEndsAt: null },
        now,
      ),
    ).toBe(false);
  });

  it('entitles the indie plan the quota tiers are named after', () => {
    expect(
      isEntitled(
        { plan: 'indie', planExpiresAt: null, trialEndsAt: null },
        now,
      ),
    ).toBe(true);
  });

  it('entitles an active trial', () => {
    expect(
      isEntitled(
        { plan: 'free', planExpiresAt: null, trialEndsAt: future },
        now,
      ),
    ).toBe(true);
  });

  it('rejects an expired trial', () => {
    expect(
      isEntitled({ plan: 'free', planExpiresAt: null, trialEndsAt: past }, now),
    ).toBe(false);
  });

  it('rejects a free plan with no trial', () => {
    expect(
      isEntitled({ plan: 'free', planExpiresAt: null, trialEndsAt: null }, now),
    ).toBe(false);
  });
});

describe('entitlementDetail', () => {
  const now = new Date('2026-07-23T00:00:00Z');
  const past = new Date('2026-07-01T00:00:00Z');
  const future = new Date('2026-08-01T00:00:00Z');

  it('offers the first paid plan to a lapsed workspace and dates every marker', () => {
    expect(
      entitlementDetail(
        { plan: 'free', planExpiresAt: past, trialEndsAt: past },
        now,
      ),
    ).toEqual({
      plan: 'free',
      trialEndsAt: '2026-07-01T00:00:00.000Z',
      planExpiresAt: '2026-07-01T00:00:00.000Z',
      upgradeTo: 'indie',
      upgradePath: UPGRADE_PATH,
    });
  });

  it('reports an absent trial and expiry as null rather than omitting them', () => {
    expect(
      entitlementDetail(
        { plan: 'free', planExpiresAt: null, trialEndsAt: null },
        now,
      ),
    ).toEqual({
      plan: 'free',
      trialEndsAt: null,
      planExpiresAt: null,
      upgradeTo: 'indie',
      upgradePath: UPGRADE_PATH,
    });
  });

  it('offers the higher plan to an active trial', () => {
    expect(
      entitlementDetail(
        { plan: 'free', planExpiresAt: null, trialEndsAt: future },
        now,
      ),
    ).toMatchObject({ plan: 'trial', upgradeTo: 'indie' });
  });

  it('offers the higher plan to the lower paid plan', () => {
    expect(
      entitlementDetail(
        { plan: 'indie', planExpiresAt: future, trialEndsAt: null },
        now,
      ),
    ).toMatchObject({ plan: 'indie', upgradeTo: 'ultimate' });
  });

  it('offers nothing above the highest plan', () => {
    expect(
      entitlementDetail(
        { plan: 'ultimate', planExpiresAt: null, trialEndsAt: null },
        now,
      ),
    ).toMatchObject({ plan: 'ultimate', upgradeTo: null });
  });
});
