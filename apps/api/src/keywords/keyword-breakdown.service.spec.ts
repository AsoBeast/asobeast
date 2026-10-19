import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Store } from '@prisma/client';
import { eventsOfMarket, HOME_LISTING, listingIn } from '../apps/listing';
import { PrismaService } from '../prisma/prisma.service';
import { KeywordBreakdownService } from './keyword-breakdown.service';

const snapshot = (title: string) => ({
  id: `snap-${title}`,
  title,
  subtitle: null,
  summary: null,
  description: '',
  ratingAvg: 4.5,
  ratingCount: 100,
  capturedAt: new Date('2026-10-17T03:00:00Z'),
});

const buildPrisma = (
  overrides: { market?: string; store?: Store; marketListing?: boolean } = {},
) => {
  const market = overrides.market ?? 'us';
  return {
    app: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'you',
        workspaceId: 'ws',
        store: overrides.store ?? Store.APP_STORE,
        country: 'us',
        storeAppId: '1',
        isCompetitor: false,
      }),
      findMany: jest.fn().mockResolvedValue([
        { id: 'you', name: 'You', iconUrl: null, country: 'us' },
        { id: 'rival', name: 'Rival', iconUrl: null, country: 'us' },
      ]),
    },
    trackedKeyword: {
      findUnique: jest.fn().mockResolvedValue({
        keyword: { text: 'habit tracker', country: market },
      }),
    },
    keywordRanking: {
      findMany: jest.fn().mockResolvedValue([
        {
          appId: 'you',
          position: 12,
          depth: 200,
          date: new Date('2026-10-18T00:00:00Z'),
        },
        {
          appId: 'rival',
          position: 3,
          depth: 200,
          date: new Date('2026-10-18T00:00:00Z'),
        },
      ]),
    },
    appSnapshot: {
      findFirst: jest
        .fn()
        .mockImplementation(
          ({ where }: { where: { appId: string; country: string | null } }) =>
            Promise.resolve(
              overrides.marketListing === false && where.country !== null
                ? null
                : snapshot(where.appId === 'rival' ? 'Habit Tracker' : 'Habit'),
            ),
        ),
      findMany: jest.fn().mockResolvedValue([]),
    },
    appLocalization: { findMany: jest.fn().mockResolvedValue([]) },
    keywordField: {
      findMany: jest.fn().mockResolvedValue([
        {
          localization: 'en-US',
          phrases: ['habit tracker'],
          updatedAt: new Date('2026-10-12T00:00:00Z'),
        },
        {
          localization: 'de',
          phrases: ['gewohnheit'],
          updatedAt: new Date('2026-10-16T00:00:00Z'),
        },
        {
          localization: 'fr',
          phrases: [],
          updatedAt: new Date('2026-10-17T00:00:00Z'),
        },
      ]),
    },
    changeEvent: { findFirst: jest.fn().mockResolvedValue(null) },
  };
};

const serviceFor = (prisma: ReturnType<typeof buildPrisma>) =>
  new KeywordBreakdownService(prisma as unknown as PrismaService);

describe('KeywordBreakdownService.breakdown', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-10-18T12:00:00Z') });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('answers 404 for an unknown app', async () => {
    const prisma = buildPrisma();
    prisma.app.findFirst.mockResolvedValue(null);
    await expect(
      serviceFor(prisma).breakdown('nope', 'kw-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('answers 400 for a competitor app', async () => {
    const prisma = buildPrisma();
    prisma.app.findFirst.mockResolvedValue({
      ...(await prisma.app.findFirst()),
      isCompetitor: true,
    });
    await expect(serviceFor(prisma).breakdown('rival', 'kw-1')).rejects.toThrow(
      new BadRequestException(
        'A competitor app has no keyword breakdown; use its primary app',
      ),
    );
  });

  it('answers 404 for a keyword the app does not track', async () => {
    const prisma = buildPrisma();
    prisma.trackedKeyword.findUnique.mockResolvedValue(null);
    await expect(serviceFor(prisma).breakdown('you', 'kw-9')).rejects.toThrow(
      new NotFoundException('Keyword kw-9 is not tracked'),
    );
  });

  it('reads one ranking per app in one query', async () => {
    const prisma = buildPrisma();
    const result = await serviceFor(prisma).breakdown('you', 'kw-1');

    expect(prisma.keywordRanking.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.keywordRanking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { keywordId: 'kw-1', appId: { in: ['you', 'rival'] } },
        orderBy: { date: 'desc' },
        distinct: ['appId'],
      }),
    );
    expect(result.apps.map((app) => app.appId)).toEqual(['you', 'rival']);
    expect(result.standing).toMatchObject({ above: 1, competitors: 1 });
    expect(result.apps[1].insight).toEqual({
      rule: 'placement',
      theirs: 'title',
      yours: 'keywordField',
    });
  });

  it('reads the market listing before the home one', async () => {
    const prisma = buildPrisma({ market: 'de', marketListing: false });
    const result = await serviceFor(prisma).breakdown('you', 'kw-1');

    const wheres = prisma.appSnapshot.findFirst.mock.calls.map(
      ([query]: [{ where: object }]) => query.where,
    );
    expect(wheres).toContainEqual({ appId: 'you', ...listingIn('us', 'de') });
    expect(wheres).toContainEqual({ appId: 'you', ...HOME_LISTING });
    expect(result.apps[0].listingCountry).toBe('us');
  });

  it('skips the home read when the market is home', async () => {
    const prisma = buildPrisma();
    prisma.appSnapshot.findFirst.mockResolvedValue(null);
    await serviceFor(prisma).breakdown('you', 'kw-1');

    expect(prisma.appSnapshot.findFirst).toHaveBeenCalledTimes(2);
  });

  it('reads your keyword fields once and drops empty ones', async () => {
    const prisma = buildPrisma();
    const result = await serviceFor(prisma).breakdown('you', 'kw-1');

    expect(prisma.keywordField.findMany).toHaveBeenCalledTimes(1);
    const tags = result.apps[0].listings.map((listing) => listing.localization);
    expect(tags).not.toContain('fr');
    expect(
      result.apps[1].listings.flatMap((listing) =>
        listing.fields.map((field) => field.field),
      ),
    ).not.toContain('keywordField');
  });

  it('reads the newest listing change of the market and the newest field save it reads', async () => {
    const prisma = buildPrisma({ market: 'de' });
    prisma.changeEvent.findFirst.mockResolvedValue({
      capturedAt: new Date('2026-10-10T00:00:00Z'),
    });
    const result = await serviceFor(prisma).breakdown('you', 'kw-1');

    expect(prisma.changeEvent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          appId: 'you',
          ...eventsOfMarket('us', 'de'),
          field: { in: ['title', 'subtitle', 'summary', 'description'] },
        },
      }),
    );
    expect(result.standing.recentChange).toEqual({
      date: '2026-10-16',
      source: 'keywordField',
    });
  });

  it('counts only the fields the market reads', async () => {
    const prisma = buildPrisma();
    const result = await serviceFor(prisma).breakdown('you', 'kw-1');

    expect(result.standing.recentChange).toEqual({
      date: '2026-10-12',
      source: 'keywordField',
    });
  });

  it('answers the keyword, its market and its words', async () => {
    const result = await serviceFor(buildPrisma()).breakdown('you', 'kw-1');

    expect(result).toMatchObject({
      keywordId: 'kw-1',
      text: 'habit tracker',
      store: 'APP_STORE',
      country: 'us',
      words: ['habit', 'tracker'],
    });
  });

  it('reads no localized listing on Google Play', async () => {
    const prisma = buildPrisma({ store: Store.GOOGLE_PLAY });
    const result = await serviceFor(prisma).breakdown('you', 'kw-1');

    expect(prisma.appSnapshot.findMany).not.toHaveBeenCalled();
    expect(result.apps[0].listings[0].localization).toBeNull();
  });
});
