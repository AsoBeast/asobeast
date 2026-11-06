import { PrismaService } from '../prisma/prisma.service';
import { countDiscoveries } from './discovery-counts';

type GroupByArgs = {
  by: string[];
  where: { AND?: unknown[]; OR?: unknown[] };
  _count: { _all: true };
};

const prismaAnswering = (
  open: Array<[string, number]>,
  ranked: Array<[string, number]>,
) => {
  const groupBy = jest.fn((args: GroupByArgs) =>
    Promise.resolve(
      (args.where.AND ? ranked : open).map(([appId, all]) => ({
        appId,
        _count: { _all: all },
      })),
    ),
  );
  const prisma = {
    keywordDiscovery: { groupBy },
  } as unknown as PrismaService;
  return { prisma, groupBy };
};

const openFilter = (appId: string, country?: string) => ({
  appId,
  dismissedAt: null,
  keyword: {
    tracked: { none: { appId } },
    ...(country ? { country } : {}),
  },
});

describe('countDiscoveries', () => {
  it('counts the open and the ranked rows of every app in two queries', async () => {
    const { prisma, groupBy } = prismaAnswering(
      [
        ['app-1', 5],
        ['app-2', 2],
      ],
      [['app-1', 3]],
    );

    const counts = await countDiscoveries(prisma, ['app-1', 'app-2']);

    expect(counts).toEqual(
      new Map([
        ['app-1', { open: 5, ranked: 3 }],
        ['app-2', { open: 2, ranked: 0 }],
      ]),
    );
    expect(groupBy).toHaveBeenCalledTimes(2);
    const open = { OR: [openFilter('app-1'), openFilter('app-2')] };
    expect(groupBy).toHaveBeenCalledWith({
      by: ['appId'],
      where: open,
      _count: { _all: true },
    });
    expect(groupBy).toHaveBeenCalledWith({
      by: ['appId'],
      where: { AND: [open, { position: { not: null } }] },
      _count: { _all: true },
    });
  });

  it('answers zero for an app without rows', async () => {
    const { prisma } = prismaAnswering([], []);

    expect(await countDiscoveries(prisma, ['app-1'])).toEqual(
      new Map([['app-1', { open: 0, ranked: 0 }]]),
    );
  });

  it('scopes every app to one market', async () => {
    const { prisma, groupBy } = prismaAnswering([], []);

    await countDiscoveries(prisma, ['app-1'], 'de');

    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [openFilter('app-1', 'de')] },
      }),
    );
  });

  it('asks nothing without an app', async () => {
    const { prisma, groupBy } = prismaAnswering([], []);

    expect(await countDiscoveries(prisma, [])).toEqual(new Map());
    expect(groupBy).not.toHaveBeenCalled();
  });
});
