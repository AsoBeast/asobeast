import { marketListingTargets } from './daily-targets.service';

const apps = [
  { id: 'primary', store: 'APP_STORE' as const, primaryAppId: null },
  { id: 'rival_a', store: 'APP_STORE' as const, primaryAppId: 'primary' },
  { id: 'rival_b', store: 'APP_STORE' as const, primaryAppId: 'primary' },
  { id: 'other', store: 'GOOGLE_PLAY' as const, primaryAppId: null },
];

describe('marketListingTargets', () => {
  it('targets the app and every competitor in each market the app tracks keywords in', () => {
    const targets = marketListingTargets(apps, [
      { appId: 'primary', country: 'de' },
      { appId: 'primary', country: 'pl' },
    ]);

    expect(targets).toHaveLength(6);
    expect(
      targets
        .filter((target) => target.country === 'de')
        .map((target) => target.id),
    ).toEqual(['primary', 'rival_a', 'rival_b']);
  });

  it('targets nothing when no market has a keyword', () => {
    expect(marketListingTargets(apps, [])).toEqual([]);
  });

  it('counts a market once however many rows name it', () => {
    const targets = marketListingTargets(apps, [
      { appId: 'primary', country: 'de' },
      { appId: 'primary', country: 'de' },
    ]);

    expect(targets).toHaveLength(3);
  });

  it('skips an app that is no longer tracked', () => {
    expect(
      marketListingTargets(apps, [{ appId: 'gone', country: 'de' }]),
    ).toEqual([]);
  });

  it('keeps the store of each target', () => {
    const [target] = marketListingTargets(apps, [
      { appId: 'other', country: 'de' },
    ]);

    expect(target).toEqual({
      id: 'other',
      store: 'GOOGLE_PLAY',
      country: 'de',
    });
  });
});
