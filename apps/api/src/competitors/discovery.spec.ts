import { aggregateDiscovery, DiscoveryRow } from './discovery';

const row = (over: Partial<DiscoveryRow>): DiscoveryRow => ({
  storeAppId: 'app-a',
  title: 'App A',
  developer: 'Dev A',
  iconUrl: null,
  ratingAvg: 4,
  ratingCount: 100,
  position: 5,
  date: new Date('2026-07-01T00:00:00.000Z'),
  country: 'us',
  keywordText: 'habit tracker',
  ...over,
});

describe('aggregateDiscovery', () => {
  it('aggregates appearances, best and average position per app', () => {
    const items = aggregateDiscovery(
      [
        row({ position: 4, keywordText: 'habit tracker' }),
        row({ position: 6, keywordText: 'streak app' }),
      ],
      'us',
    );

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
    const items = aggregateDiscovery(rows, 'us');

    expect(items[0].keywordCount).toBe(6);
    expect(items[0].keywords).toHaveLength(5);
  });

  it('takes metadata from the most recent row', () => {
    const items = aggregateDiscovery(
      [
        row({ date: new Date('2026-06-01T00:00:00.000Z'), title: 'Old' }),
        row({ date: new Date('2026-07-05T00:00:00.000Z'), title: 'New' }),
      ],
      'us',
    );

    expect(items[0].title).toBe('New');
  });

  it('takes the icon from the most recent row', () => {
    const items = aggregateDiscovery(
      [
        row({
          date: new Date('2026-07-05T00:00:00.000Z'),
          iconUrl: 'https://icon/new.jpg',
        }),
        row({ date: new Date('2026-06-01T00:00:00.000Z') }),
      ],
      'us',
    );

    expect(items[0].iconUrl).toBe('https://icon/new.jpg');
  });

  it('orders by appearances then best position', () => {
    const items = aggregateDiscovery(
      [
        row({ storeAppId: 'app-a', position: 9 }),
        row({ storeAppId: 'app-a', position: 8 }),
        row({ storeAppId: 'app-b', position: 2 }),
        row({ storeAppId: 'app-c', position: 7 }),
        row({ storeAppId: 'app-c', position: 1 }),
      ],
      'us',
    );

    expect(items.map((item) => item.storeAppId)).toEqual([
      'app-c',
      'app-a',
      'app-b',
    ]);
  });

  describe('which market describes an app', () => {
    const D = (day: number) => new Date(`2026-07-0${day}T00:00:00.000Z`);

    it('takes the title from the home market even when another market is newer', () => {
      const [item] = aggregateDiscovery(
        [
          row({ country: 'us', date: D(1), title: 'Email by Google' }),
          row({ country: 'de', date: D(5), title: 'E-Mail von Google' }),
        ],
        'us',
      );

      expect(item.title).toBe('Email by Google');
    });

    it('takes the newest home market row when the app ranked at home on several days', () => {
      const [item] = aggregateDiscovery(
        [
          row({ country: 'us', date: D(1), title: 'Old' }),
          row({ country: 'us', date: D(3), title: 'New' }),
          row({ country: 'de', date: D(5), title: 'Foreign' }),
        ],
        'us',
      );

      expect(item.title).toBe('New');
    });

    it('takes developer and rating from the same row as the title', () => {
      const [item] = aggregateDiscovery(
        [
          row({
            country: 'us',
            date: D(1),
            developer: 'US Dev',
            ratingAvg: 4.5,
            ratingCount: 900,
          }),
          row({
            country: 'de',
            date: D(5),
            developer: 'DE Dev',
            ratingAvg: 3,
            ratingCount: 12,
          }),
        ],
        'us',
      );

      expect(item).toMatchObject({
        developer: 'US Dev',
        ratingAvg: 4.5,
        ratingCount: 900,
      });
    });

    it('falls back to the newest row when the app never ranked at home', () => {
      const [item] = aggregateDiscovery(
        [
          row({ country: 'gb', date: D(1), title: 'Older' }),
          row({ country: 'de', date: D(5), title: 'Newer' }),
        ],
        'us',
      );

      expect(item.title).toBe('Newer');
    });

    it('answers the same row whatever the order of equally new rows', () => {
      const de = row({ country: 'de', date: D(2), title: 'Deutsch' });
      const gb = row({ country: 'gb', date: D(2), title: 'English' });

      expect(aggregateDiscovery([de, gb], 'us')[0].title).toBe('Deutsch');
      expect(aggregateDiscovery([gb, de], 'us')[0].title).toBe('Deutsch');
    });

    it('counts every market while describing the app from one', () => {
      const [item] = aggregateDiscovery(
        [
          row({ country: 'us', position: 8, keywordText: 'a', title: 'Home' }),
          row({ country: 'de', position: 3, keywordText: 'b', date: D(5) }),
          row({ country: 'gb', position: 5, keywordText: 'c', date: D(4) }),
        ],
        'us',
      );

      expect(item).toMatchObject({
        title: 'Home',
        appearances: 3,
        keywordCount: 3,
        bestPosition: 3,
        avgPosition: 5.3,
        keywords: ['a', 'b', 'c'],
      });
    });

    it('borrows the newest icon when the chosen row has none', () => {
      const [item] = aggregateDiscovery(
        [
          row({ country: 'us', date: D(1), title: 'Home', iconUrl: null }),
          row({ country: 'de', date: D(5), iconUrl: 'https://icon/de.jpg' }),
          row({ country: 'gb', date: D(3), iconUrl: 'https://icon/gb.jpg' }),
        ],
        'us',
      );

      expect(item).toMatchObject({
        title: 'Home',
        iconUrl: 'https://icon/de.jpg',
      });
    });

    it('prefers the icon of the chosen row', () => {
      const [item] = aggregateDiscovery(
        [
          row({ country: 'us', date: D(1), iconUrl: 'https://icon/us.jpg' }),
          row({ country: 'de', date: D(5), iconUrl: 'https://icon/de.jpg' }),
        ],
        'us',
      );

      expect(item.iconUrl).toBe('https://icon/us.jpg');
    });

    it('borrows the same icon whatever the order of equally new rows', () => {
      const home = row({ country: 'us', date: D(1), iconUrl: null });
      const de = row({
        country: 'de',
        date: D(4),
        iconUrl: 'https://icon/de.jpg',
      });
      const gb = row({
        country: 'gb',
        date: D(4),
        iconUrl: 'https://icon/gb.jpg',
      });

      expect(aggregateDiscovery([home, de, gb], 'us')[0].iconUrl).toBe(
        'https://icon/de.jpg',
      );
      expect(aggregateDiscovery([home, gb, de], 'us')[0].iconUrl).toBe(
        'https://icon/de.jpg',
      );
    });

    it('leaves the icon empty when no row has one', () => {
      const [item] = aggregateDiscovery(
        [row({ country: 'us' }), row({ country: 'de', date: D(5) })],
        'us',
      );

      expect(item.iconUrl).toBeNull();
    });
  });
});
