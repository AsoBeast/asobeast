import { topAppsByKeyword, TopAppRow } from './keyword-top-apps';

const ROLES = { own: 'me', competitors: new Set(['c1']) };

const row = (
  keywordId: string,
  day: string,
  position: number,
  storeAppId: string,
): TopAppRow => ({
  keywordId,
  date: new Date(`${day}T00:00:00.000Z`),
  position,
  storeAppId,
  title: `App ${storeAppId}`,
  iconUrl: storeAppId === 'x' ? null : `https://img.test/${storeAppId}.png`,
});

describe('topAppsByKeyword', () => {
  it('keeps only the newest day of each keyword, in position order', () => {
    const apps = topAppsByKeyword(
      [
        row('k1', '2026-10-28', 2, 'x'),
        row('k1', '2026-10-28', 1, 'c1'),
        row('k1', '2026-10-27', 1, 'me'),
        row('k2', '2026-10-27', 3, 'me'),
      ],
      ROLES,
    );

    expect(apps.get('k1')).toEqual([
      {
        storeAppId: 'c1',
        title: 'App c1',
        iconUrl: 'https://img.test/c1.png',
        position: 1,
        role: 'competitor',
      },
      {
        storeAppId: 'x',
        title: 'App x',
        iconUrl: null,
        position: 2,
        role: 'other',
      },
    ]);
    expect(apps.get('k2')?.map((app) => app.role)).toEqual(['own']);
  });

  it('reads the newest day whatever order the rows arrive in', () => {
    const apps = topAppsByKeyword(
      [row('k1', '2026-10-27', 1, 'me'), row('k1', '2026-10-28', 1, 'c1')],
      ROLES,
    );

    expect(apps.get('k1')?.map((app) => app.storeAppId)).toEqual(['c1']);
  });

  it('leaves a keyword without rows out of the map', () => {
    expect(topAppsByKeyword([], ROLES)).toEqual(new Map());
  });
});
