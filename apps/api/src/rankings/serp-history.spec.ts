import { serpExits, serpMovement } from './serp-history';

const capture = (...storeAppIds: string[]) =>
  storeAppIds.map((storeAppId, index) => ({
    position: index + 1,
    storeAppId,
  }));

const filler = (count: number, prefix: string) =>
  Array.from({ length: count }, (_, index) => `${prefix}-${index + 1}`);

describe('serpMovement', () => {
  it('answers no movement for every row without an earlier capture', () => {
    expect(serpMovement(capture('a', 'b'), null)).toEqual([
      {
        position: 1,
        storeAppId: 'a',
        previous: null,
        delta: null,
        movement: 'none',
      },
      {
        position: 2,
        storeAppId: 'b',
        previous: null,
        delta: null,
        movement: 'none',
      },
    ]);
  });

  describe('against a 10 row earlier capture', () => {
    const earlier = capture('x', 'b', 'c', 'a', 'e', 'f', 'g', 'h', 'i', 'j');
    const current = [
      ...capture('x', 'a', 'c', 'd', 'b', 'f', 'new-7', 'h', 'i', 'j'),
      ...filler(20, 'deep').map((storeAppId, index) => ({
        position: 11 + index,
        storeAppId,
      })),
    ];
    const moved = new Map(
      serpMovement(current, earlier).map((row) => [row.storeAppId, row]),
    );

    it('moves an app from 4 to 2 up', () => {
      expect(moved.get('a')).toMatchObject({
        previous: 4,
        delta: -2,
        movement: 'up',
      });
    });

    it('moves an app from 2 to 5 down', () => {
      expect(moved.get('b')).toMatchObject({
        previous: 2,
        delta: 3,
        movement: 'down',
      });
    });

    it('keeps an unchanged app the same', () => {
      expect(moved.get('c')).toMatchObject({
        previous: 3,
        delta: 0,
        movement: 'same',
      });
    });

    it('calls an app absent from the covered positions new', () => {
      expect(moved.get('new-7')).toMatchObject({
        previous: null,
        delta: null,
        movement: 'new',
      });
    });

    it('answers no movement for an app deeper than the earlier capture reached', () => {
      expect(moved.get('deep-20')).toMatchObject({
        position: 30,
        previous: null,
        delta: null,
        movement: 'none',
      });
    });
  });

  it('calls an app at 30 new against a 50 row earlier capture', () => {
    const earlier = capture(...filler(50, 'old'));
    const current = capture(...filler(29, 'old'), 'newcomer');

    expect(serpMovement(current, earlier)[29]).toMatchObject({
      position: 30,
      movement: 'new',
    });
  });

  it('reads the first position of an app listed twice in one capture', () => {
    const earlier = capture('a', 'b', 'a');

    expect(serpMovement(capture('b', 'a'), earlier)[1]).toMatchObject({
      previous: 1,
      delta: 1,
      movement: 'down',
    });
  });
});

describe('serpExits', () => {
  it('lists an app that left the covered positions with its earlier position', () => {
    const earlier = capture('a', 'b', 'gone', 'd');

    expect(serpExits(capture('a', 'b', 'd', 'e'), earlier)).toEqual([
      { position: 3, storeAppId: 'gone', previous: 3 },
    ]);
  });

  it('leaves out an app deeper than the current capture reaches', () => {
    const earlier = capture(...filler(39, 'kept'), 'deep-gone');
    const current = capture(...filler(10, 'kept'));

    expect(serpExits(current, earlier)).toEqual([]);
  });

  it('sorts the exits by their earlier position', () => {
    const earlier = [
      { position: 5, storeAppId: 'later' },
      { position: 2, storeAppId: 'sooner' },
    ];

    expect(
      serpExits(capture(...filler(5, 'now')), earlier).map(
        (row) => row.previous,
      ),
    ).toEqual([2, 5]);
  });

  it('answers no exit without an earlier capture', () => {
    expect(serpExits(capture('a'), null)).toEqual([]);
  });
});
