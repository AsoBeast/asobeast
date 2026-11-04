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
      checkedOn: TODAY,
    });
  });

  it('reads an app missing from a capture as not found within it', () => {
    expect(captureReading([TODAY], new Map())).toEqual({
      position: null,
      depth: DISCOVERY_CAPTURE_DEPTH,
      checkedOn: TODAY,
    });
  });

  it('trusts the newest capture over an older one', () => {
    expect(
      captureReading([YESTERDAY, TODAY], new Map([[YESTERDAY, 7]])),
    ).toEqual({
      position: null,
      depth: DISCOVERY_CAPTURE_DEPTH,
      checkedOn: TODAY,
    });
  });

  it('never reads a position past the capture depth', () => {
    expect(captureReading([YESTERDAY], new Map([[YESTERDAY, 51]]))).toEqual({
      position: null,
      depth: DISCOVERY_CAPTURE_DEPTH,
      checkedOn: YESTERDAY,
    });
  });
});

describe('captureResolves', () => {
  it('settles a candidate the capture placed and leaves an absent one due', () => {
    expect(captureResolves({ position: 4, depth: 50, checkedOn: TODAY })).toBe(
      true,
    );
    expect(
      captureResolves({ position: null, depth: 50, checkedOn: TODAY }),
    ).toBe(false);
  });
});

describe('DiscoveryCaptures.read', () => {
  const setup = (
    captured: { keywordId: string; date: Date }[],
    placed: { keywordId: string; date: Date; position: number }[],
  ) => {
    const findMany = jest.fn((args: { where: { position?: number } }) =>
      Promise.resolve(args.where.position === 1 ? captured : placed),
    );
    const captures = new DiscoveryCaptures({
      serpEntry: { findMany },
    } as unknown as PrismaService);
    return { captures, findMany };
  };

  it('reads the captures of today and yesterday for the given keywords', async () => {
    const { captures, findMany } = setup(
      [
        { keywordId: 'kw-ranked', date: at(TODAY) },
        { keywordId: 'kw-absent', date: at(YESTERDAY) },
      ],
      [{ keywordId: 'kw-ranked', date: at(TODAY), position: 12 }],
    );

    const readings = await captures.read(
      'store1',
      ['kw-ranked', 'kw-absent', 'kw-unseen'],
      TODAY,
    );

    expect([...readings]).toEqual([
      ['kw-ranked', { position: 12, depth: 50, checkedOn: TODAY }],
      ['kw-absent', { position: null, depth: 50, checkedOn: YESTERDAY }],
    ]);
    const fresh = {
      keywordId: { in: ['kw-ranked', 'kw-absent', 'kw-unseen'] },
      date: { gte: at(YESTERDAY) },
    };
    expect(findMany).toHaveBeenCalledWith({
      where: { ...fresh, position: 1 },
      select: { keywordId: true, date: true },
    });
    expect(findMany).toHaveBeenCalledWith({
      where: { ...fresh, storeAppId: 'store1' },
      select: { keywordId: true, date: true, position: true },
    });
  });

  it('makes no query for no keywords', async () => {
    const { captures, findMany } = setup([], []);

    await expect(captures.read('store1', [], TODAY)).resolves.toEqual(
      new Map(),
    );
    expect(findMany).not.toHaveBeenCalled();
  });
});
