import { DISCOVERY_CAPTURE_DEPTH } from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  captureReading,
  captureResolves,
  DiscoveryCaptures,
} from './discovery-captures';

const TODAY = '2026-11-04';
const YESTERDAY = '2026-11-03';
const at = (day: string) => new Date(`${day}T00:00:00.000Z`);

describe('captureReading', () => {
  it('reads nothing without a capture', () => {
    expect(captureReading([], new Map())).toBeNull();
  });

  it("reads the app's position from a capture", () => {
    expect(captureReading([TODAY], new Map([[TODAY, 7]]))).toEqual({
      position: 7,
      depth: DISCOVERY_CAPTURE_DEPTH,
      ownSearch: false,
      checkedOn: TODAY,
    });
  });

  it('reads an app missing from a capture as not found within it', () => {
    expect(captureReading([TODAY], new Map())).toEqual({
      position: null,
      depth: DISCOVERY_CAPTURE_DEPTH,
      ownSearch: false,
      checkedOn: TODAY,
    });
  });

  it('trusts the newest capture over an older one', () => {
    expect(
      captureReading([YESTERDAY, TODAY], new Map([[YESTERDAY, 7]])),
    ).toEqual({
      position: null,
      depth: DISCOVERY_CAPTURE_DEPTH,
      ownSearch: false,
      checkedOn: TODAY,
    });
  });

  it.each([
    [1, 1],
    [DISCOVERY_CAPTURE_DEPTH, DISCOVERY_CAPTURE_DEPTH],
    [0, null],
  ])('reads a captured position %i as %p', (position, read) => {
    expect(
      captureReading([TODAY], new Map([[TODAY, position]]))?.position,
    ).toBe(read);
  });

  it('never reads a position past the capture depth', () => {
    expect(captureReading([YESTERDAY], new Map([[YESTERDAY, 51]]))).toEqual({
      position: null,
      depth: DISCOVERY_CAPTURE_DEPTH,
      ownSearch: false,
      checkedOn: YESTERDAY,
    });
  });
});

describe('captureReading held depth', () => {
  it('reads the depth a short capture held', () => {
    expect(captureReading([TODAY], new Map(), new Map([[TODAY, 26]]))).toEqual({
      position: null,
      depth: 26,
      ownSearch: false,
      checkedOn: TODAY,
    });
  });

  it('reads the depth held on the newest capture day', () => {
    expect(
      captureReading(
        [YESTERDAY, TODAY],
        new Map([[TODAY, 9]]),
        new Map([
          [YESTERDAY, 50],
          [TODAY, 18],
        ]),
      ),
    ).toEqual({
      position: 9,
      depth: 18,
      ownSearch: false,
      checkedOn: TODAY,
    });
  });

  it('never reads deeper than the capture depth', () => {
    expect(
      captureReading([TODAY], new Map(), new Map([[TODAY, 80]]))?.depth,
    ).toBe(DISCOVERY_CAPTURE_DEPTH);
    expect(
      captureReading(
        [TODAY],
        new Map(),
        new Map([[TODAY, DISCOVERY_CAPTURE_DEPTH]]),
      )?.depth,
    ).toBe(DISCOVERY_CAPTURE_DEPTH);
  });
});

describe('captureResolves', () => {
  it('settles a candidate the capture placed and leaves an absent one due', () => {
    expect(
      captureResolves({
        position: 4,
        depth: 50,
        ownSearch: false,
        checkedOn: TODAY,
      }),
    ).toBe(true);
    expect(
      captureResolves({
        position: null,
        depth: 50,
        ownSearch: false,
        checkedOn: TODAY,
      }),
    ).toBe(false);
  });
});

describe('DiscoveryCaptures.read', () => {
  const row = (
    keywordId: string,
    day: string,
    position: number,
    storeAppId = `other-${position}`,
  ) => ({ keywordId, date: at(day), position, storeAppId });

  const held = (keywordId: string, day: string, deepest: number) => ({
    keywordId,
    date: at(day),
    _max: { position: deepest },
  });

  const setup = (
    rows: ReturnType<typeof row>[],
    depths: ReturnType<typeof held>[] = [],
  ) => {
    const findMany = jest.fn().mockResolvedValue(rows);
    const groupBy = jest.fn().mockResolvedValue(depths);
    const captures = new DiscoveryCaptures({
      serpEntry: { findMany, groupBy },
    } as unknown as PrismaService);
    return { captures, findMany, groupBy };
  };

  it('reads the depth each capture held beside its rows', async () => {
    const { captures, groupBy } = setup(
      [
        row('kw-short', TODAY, 1),
        row('kw-full', TODAY, 1),
        row('kw-old', YESTERDAY, 1),
        row('kw-old', TODAY, 1),
      ],
      [
        held('kw-short', TODAY, 26),
        held('kw-full', TODAY, 50),
        held('kw-old', YESTERDAY, 50),
        held('kw-old', TODAY, 30),
      ],
    );

    const readings = await captures.read(
      'store1',
      ['kw-short', 'kw-full', 'kw-old'],
      TODAY,
    );

    expect(readings.get('kw-short')?.depth).toBe(26);
    expect(readings.get('kw-full')?.depth).toBe(50);
    expect(readings.get('kw-old')?.depth).toBe(30);
    expect(groupBy).toHaveBeenCalledWith({
      by: ['keywordId', 'date'],
      where: {
        keywordId: { in: ['kw-short', 'kw-full', 'kw-old'] },
        date: { gte: at(YESTERDAY), lte: at(TODAY) },
      },
      _max: { position: true },
    });
  });

  it('reads the captures of today and yesterday and the depth they held in two queries', async () => {
    const { captures, findMany, groupBy } = setup([
      row('kw-ranked', TODAY, 1),
      row('kw-ranked', TODAY, 12, 'store1'),
      row('kw-absent', YESTERDAY, 1),
    ]);

    const readings = await captures.read(
      'store1',
      ['kw-ranked', 'kw-absent', 'kw-unseen'],
      TODAY,
    );

    expect([...readings]).toEqual([
      [
        'kw-ranked',
        { position: 12, depth: 50, ownSearch: false, checkedOn: TODAY },
      ],
      [
        'kw-absent',
        { position: null, depth: 50, ownSearch: false, checkedOn: YESTERDAY },
      ],
    ]);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(groupBy).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        keywordId: { in: ['kw-ranked', 'kw-absent', 'kw-unseen'] },
        date: { gte: at(YESTERDAY), lte: at(TODAY) },
        OR: [{ position: 1 }, { storeAppId: 'store1' }],
      },
      select: { keywordId: true, date: true, position: true, storeAppId: true },
    });
  });

  it('reads an app at the top of a capture', async () => {
    const { captures } = setup([row('kw-top', TODAY, 1, 'store1')]);

    await expect(captures.read('store1', ['kw-top'], TODAY)).resolves.toEqual(
      new Map([
        [
          'kw-top',
          { position: 1, depth: 50, ownSearch: false, checkedOn: TODAY },
        ],
      ]),
    );
  });

  it('makes no query for no keywords', async () => {
    const { captures, findMany, groupBy } = setup([]);

    await expect(captures.read('store1', [], TODAY)).resolves.toEqual(
      new Map(),
    );
    expect(findMany).not.toHaveBeenCalled();
    expect(groupBy).not.toHaveBeenCalled();
  });
});
