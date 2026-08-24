import { aggregateDiscovery, DiscoveryRow } from './discovery';

const row = (over: Partial<DiscoveryRow>): DiscoveryRow => ({
  storeAppId: 'app-a',
  title: 'App A',
  developer: 'Dev A',
  ratingAvg: 4,
  ratingCount: 100,
  position: 5,
  date: new Date('2026-07-01T00:00:00.000Z'),
  keywordText: 'habit tracker',
  ...over,
});

describe('aggregateDiscovery', () => {
  it('aggregates appearances, best and average position per app', () => {
    const items = aggregateDiscovery([
      row({ position: 4, keywordText: 'habit tracker' }),
      row({ position: 6, keywordText: 'streak app' }),
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      storeAppId: 'app-a',
      appearances: 2,
      bestPosition: 4,
      avgPosition: 5,
      keywordCount: 2,
    });
    expect(items[0].keywords).toEqual(['habit tracker', 'streak app']);
  });

  it('dedupes keyword texts and samples at most five', () => {
    const rows = ['a', 'b', 'c', 'd', 'e', 'f', 'a'].map((keywordText) =>
      row({ keywordText }),
    );
    const items = aggregateDiscovery(rows);

    expect(items[0].keywordCount).toBe(6);
    expect(items[0].keywords).toHaveLength(5);
  });

  it('takes metadata from the most recent row', () => {
    const items = aggregateDiscovery([
      row({ date: new Date('2026-06-01T00:00:00.000Z'), title: 'Old' }),
      row({ date: new Date('2026-07-05T00:00:00.000Z'), title: 'New' }),
    ]);

    expect(items[0].title).toBe('New');
  });

  it('orders by appearances then best position', () => {
    const items = aggregateDiscovery([
      row({ storeAppId: 'app-a', position: 9 }),
      row({ storeAppId: 'app-a', position: 8 }),
      row({ storeAppId: 'app-b', position: 2 }),
      row({ storeAppId: 'app-c', position: 7 }),
      row({ storeAppId: 'app-c', position: 1 }),
    ]);

    expect(items.map((item) => item.storeAppId)).toEqual([
      'app-c',
      'app-a',
      'app-b',
    ]);
  });
});
