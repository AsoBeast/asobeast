import { movementOf, trendingOf } from './chart-movement';

const listing = (storeAppId: string, position: number) => ({
  storeAppId,
  position,
  title: storeAppId.toUpperCase(),
  developer: null,
  iconUrl: null,
});

describe('movementOf', () => {
  it('reads every row against its comparison position', () => {
    const rows = movementOf(
      [listing('a', 1), listing('b', 2), listing('c', 3), listing('d', 4)],
      [listing('b', 1), listing('a', 2), listing('c', 3)],
    );

    expect(
      rows.map(({ storeAppId, previous, delta, movement }) => ({
        storeAppId,
        previous,
        delta,
        movement,
      })),
    ).toEqual([
      { storeAppId: 'a', previous: 2, delta: -1, movement: 'up' },
      { storeAppId: 'b', previous: 1, delta: 1, movement: 'down' },
      { storeAppId: 'c', previous: 3, delta: 0, movement: 'same' },
      { storeAppId: 'd', previous: null, delta: null, movement: 'new' },
    ]);
  });

  it('marks every row none without a comparison', () => {
    expect(movementOf([listing('a', 1)], null)).toEqual([
      { ...listing('a', 1), previous: null, delta: null, movement: 'none' },
    ]);
  });
});

describe('trendingOf', () => {
  const previous = [
    listing('steady', 1),
    listing('slow', 2),
    listing('fast', 3),
    listing('gone', 4),
    listing('drop', 5),
    listing('faller', 6),
    listing('away', 7),
  ];
  const current = [
    listing('fast', 1),
    listing('steady', 2),
    listing('slow', 3),
    listing('fresh', 4),
    listing('newer', 5),
    listing('faller', 9),
    listing('drop', 10),
  ];

  it('lists climbers, fallers, new entries and exits', () => {
    const trending = trendingOf(current, previous, 10);

    expect(trending.climbers.map((row) => [row.storeAppId, row.delta])).toEqual(
      [['fast', -2]],
    );
    expect(trending.fallers.map((row) => [row.storeAppId, row.delta])).toEqual([
      ['drop', 5],
      ['faller', 3],
      ['steady', 1],
      ['slow', 1],
    ]);
    expect(trending.entries.map((row) => row.storeAppId)).toEqual([
      'fresh',
      'newer',
    ]);
    expect(trending.exits).toEqual([
      {
        storeAppId: 'gone',
        title: 'GONE',
        developer: null,
        iconUrl: null,
        position: null,
        previous: 4,
        delta: null,
      },
      {
        storeAppId: 'away',
        title: 'AWAY',
        developer: null,
        iconUrl: null,
        position: null,
        previous: 7,
        delta: null,
      },
    ]);
  });

  it('cuts every list at the limit', () => {
    const trending = trendingOf(current, previous, 1);

    expect(trending.fallers.map((row) => row.storeAppId)).toEqual(['drop']);
    expect(trending.entries).toHaveLength(1);
    expect(trending.exits).toHaveLength(1);
  });

  it('ignores a row that did not move', () => {
    const trending = trendingOf([listing('a', 1)], [listing('a', 1)], 10);

    expect(trending.climbers).toEqual([]);
    expect(trending.fallers).toEqual([]);
  });

  it('answers four empty lists without a comparison', () => {
    expect(trendingOf(current, null, 10)).toEqual({
      climbers: [],
      fallers: [],
      entries: [],
      exits: [],
    });
  });
});
