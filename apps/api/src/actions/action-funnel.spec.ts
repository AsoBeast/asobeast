import type { PrismaService } from '../prisma/prisma.service';
import type { StoreFunnelService } from '../store-connect/store-funnel.service';
import { ActionFunnelReader } from './action-funnel';

const NOW = new Date('2026-10-16T08:00:00.000Z');

const day = (
  appId: string,
  date: string,
  overrides: Record<string, unknown> = {},
) => ({
  appId,
  date: new Date(`${date}T00:00:00.000Z`),
  country: 'us',
  sourceType: 'search',
  pageType: 'productPage',
  impressions: 100,
  uniqueImpressions: 80,
  pageViews: 20,
  uniquePageViews: 18,
  gets: 4,
  uniqueGets: 4,
  ...overrides,
});

function build(connected: string[]) {
  const prisma = {
    storeFunnelDay: {
      findMany: jest.fn().mockResolvedValue([
        day('app_1', '2026-10-12'),
        day('app_1', '2026-10-12', {
          pageType: 'noPage',
          pageViews: 99,
          gets: 1,
        }),
        day('app_1', '2026-10-11'),
      ]),
    },
    storeFunnelPageDay: {
      findMany: jest.fn().mockResolvedValue([
        {
          appId: 'app_1',
          date: new Date('2026-10-12T00:00:00.000Z'),
          pageTitle: 'Summer sale',
          pageViews: 25,
          uniqueImpressions: 40,
          gets: 1,
        },
      ]),
    },
  };
  const funnel = {
    connectedApps: jest.fn().mockResolvedValue(new Set(connected)),
  };
  const reader = new ActionFunnelReader(
    prisma as unknown as PrismaService,
    funnel as unknown as StoreFunnelService,
  );
  return { reader, prisma, funnel };
}

const WINDOW = {
  gte: new Date('2026-09-09T00:00:00.000Z'),
  lte: new Date('2026-10-13T00:00:00.000Z'),
};

const APPS = [
  { id: 'app_1', store: 'APP_STORE' as const, country: 'us' },
  { id: 'app_2', store: 'APP_STORE' as const, country: 'de' },
];

describe('ActionFunnelReader', () => {
  it('reads nothing without apps', async () => {
    const { reader, prisma } = build([]);

    await expect(reader.forApps([], NOW, 35)).resolves.toEqual(new Map());
    expect(prisma.storeFunnelDay.findMany).not.toHaveBeenCalled();
  });

  it('keeps the rows of an app whose connection stopped reporting it, marked as not reporting', async () => {
    const { reader } = build([]);

    const funnels = await reader.forApps(APPS, NOW, 35);

    expect(funnels.get('app_1')).toMatchObject({ reporting: false });
    expect(funnels.get('app_1')?.pages[0]?.pageTitle).toBe('Summer sale');
  });

  it('loads the complete days of the home market of each connected app', async () => {
    const { reader, prisma } = build(['app_1']);

    const funnels = await reader.forApps(APPS, NOW, 35);

    expect(prisma.storeFunnelDay.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { appId: 'app_1', country: 'us', date: WINDOW },
            { appId: 'app_2', country: 'de', date: WINDOW },
          ],
        },
      }),
    );
    expect(funnels.get('app_1')).toEqual({
      reporting: true,
      completeThrough: '2026-10-13',
      days: [
        { date: '2026-10-11', pageViews: 20, gets: 4, uniqueImpressions: 80 },
        { date: '2026-10-12', pageViews: 20, gets: 5, uniqueImpressions: 160 },
      ],
      pages: [
        {
          date: '2026-10-12',
          pageTitle: 'Summer sale',
          pageViews: 25,
          uniqueImpressions: 40,
          gets: 1,
        },
      ],
    });
    expect(funnels.get('app_2')).toMatchObject({
      reporting: false,
      days: [],
      pages: [],
    });
  });
  it('reads a google play app from the visitors of every market through the last day google has posted', async () => {
    const { reader, prisma } = build(['app_play']);

    const funnels = await reader.forApps(
      [{ id: 'app_play', store: 'GOOGLE_PLAY', country: 'us' }],
      NOW,
      35,
    );

    expect(prisma.storeFunnelDay.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            {
              appId: 'app_play',
              territory: 'all',
              date: {
                gte: new Date('2026-09-05T00:00:00.000Z'),
                lte: new Date('2026-10-09T00:00:00.000Z'),
              },
            },
          ],
        },
      }),
    );
    expect(funnels.get('app_play')).toMatchObject({
      reporting: true,
      completeThrough: '2026-10-09',
    });
  });
});
