import { positionKey, uncheckedApps } from './keyword-gaps';

describe('uncheckedApps', () => {
  const latest = new Map<string, number | null>([
    [positionKey('you', 'kw'), null],
    [positionKey('rival', 'kw'), 4],
  ]);

  it('keeps an app checked and not found out of the list', () => {
    expect(uncheckedApps(latest, ['you', 'rival'], 'kw')).toEqual([]);
  });

  it('lists an app with no check, in the order given', () => {
    expect(
      uncheckedApps(latest, ['you', 'fresh', 'rival', 'newer'], 'kw'),
    ).toEqual(['fresh', 'newer']);
  });

  it('lists every app for a keyword nobody has checked', () => {
    expect(uncheckedApps(latest, ['you', 'rival'], 'other')).toEqual([
      'you',
      'rival',
    ]);
  });
});
