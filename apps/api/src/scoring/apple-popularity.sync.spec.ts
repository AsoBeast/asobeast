import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import { ApplePopularityClient, PopularityRow } from './apple-popularity';
import { ApplePopularitySync } from './apple-popularity.sync';

const NOW = new Date('2026-09-21T09:00:00Z');

const rows = (country: string, week: string, count: number): PopularityRow[] =>
  Array.from({ length: count }, (_, index) => ({
    country,
    term: `term ${index}`,
    week,
    genre: 'GAMES',
    rankInGenre: index + 1,
    popularity: 50,
    popularityInGenre: null,
  }));

const build = (
  countries: string[],
  weekOf: ApplePopularityClient['weekOf'],
) => {
  const prisma = {
    keyword: {
      findMany: jest
        .fn()
        .mockResolvedValue(countries.map((country) => ({ country }))),
    },
    searchTermPopularity: {
      createMany: jest
        .fn()
        .mockImplementation(({ data }: { data: unknown[] }) =>
          Promise.resolve({ count: data.length }),
        ),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const client = { enabled: true, weekOf: jest.fn(weekOf) };
  const sync = new ApplePopularitySync(
    prisma as unknown as PrismaService,
    new CrossTenantAccess(new WorkspaceContext()),
    client,
  );
  return { sync, prisma, client };
};

describe('ApplePopularitySync', () => {
  it('syncs the newest complete week of every tracked app store market', async () => {
    const { sync, prisma, client } = build(['us', 'gb'], (country, week) =>
      Promise.resolve(rows(country, week, 2)),
    );

    await expect(sync.run(NOW)).resolves.toEqual({
      countries: 2,
      rows: 4,
      week: '2026-09-13',
    });

    expect(prisma.keyword.findMany).toHaveBeenCalledWith({
      where: { store: 'APP_STORE', tracked: { some: { active: true } } },
      distinct: ['country'],
      select: { country: true },
    });
    expect(client.weekOf.mock.calls).toEqual([
      ['us', '2026-09-13'],
      ['gb', '2026-09-13'],
    ]);
  });

  it('falls back one week when the newest is still empty', async () => {
    const { sync, client } = build(['us'], (country, week) =>
      Promise.resolve(week === '2026-09-13' ? [] : rows(country, week, 1)),
    );

    await expect(sync.run(NOW)).resolves.toMatchObject({ rows: 1 });
    expect(client.weekOf.mock.calls).toEqual([
      ['us', '2026-09-13'],
      ['us', '2026-09-06'],
    ]);
  });

  it('asks no further back than one week', async () => {
    const { sync, client, prisma } = build(['us'], () => Promise.resolve([]));

    await expect(sync.run(NOW)).resolves.toMatchObject({ rows: 0 });
    expect(client.weekOf).toHaveBeenCalledTimes(2);
    expect(prisma.searchTermPopularity.createMany).not.toHaveBeenCalled();
    expect(prisma.searchTermPopularity.deleteMany).not.toHaveBeenCalled();
  });

  it('writes in chunks without duplicates and prunes old weeks', async () => {
    const { sync, prisma } = build(['us'], (country, week) =>
      Promise.resolve(rows(country, week, 2500)),
    );

    await sync.run(NOW);

    const calls = prisma.searchTermPopularity.createMany.mock.calls as [
      { data: Array<{ week: Date }>; skipDuplicates: boolean },
    ][];
    expect(calls.map(([args]) => args.data.length)).toEqual([1000, 1000, 500]);
    expect(calls.every(([args]) => args.skipDuplicates)).toBe(true);
    expect(calls[0][0].data[0]).toMatchObject({
      country: 'us',
      term: 'term 0',
      week: new Date('2026-09-13T00:00:00Z'),
      genre: 'GAMES',
      rankInGenre: 1,
      popularity: 50,
      popularityInGenre: null,
    });
    expect(prisma.searchTermPopularity.deleteMany).toHaveBeenCalledWith({
      where: { country: 'us', week: { lt: new Date('2026-07-26T00:00:00Z') } },
    });
  });

  it('removes a week whose write failed part way', async () => {
    const { sync, prisma } = build(['us'], (country, week) =>
      Promise.resolve(rows(country, week, 1001)),
    );
    prisma.searchTermPopularity.createMany
      .mockResolvedValueOnce({ count: 1000 })
      .mockRejectedValueOnce(new Error('connection lost'));

    await expect(sync.run(NOW)).rejects.toThrow('every market');

    expect(prisma.searchTermPopularity.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.searchTermPopularity.deleteMany).toHaveBeenCalledWith({
      where: { country: 'us', week: new Date('2026-09-13T00:00:00Z') },
    });
  });

  it('stores the week it asked for whatever form apple echoes', async () => {
    const { sync, prisma } = build(['us'], (country) =>
      Promise.resolve(rows(country, 'Sep 13, 2026', 1)),
    );

    await sync.run(NOW);

    const [[args]] = prisma.searchTermPopularity.createMany.mock.calls as [
      [{ data: Array<{ week: Date }> }],
    ];
    expect(args.data[0].week).toEqual(new Date('2026-09-13T00:00:00Z'));
  });

  it('keeps going when one market fails', async () => {
    const { sync, prisma } = build(['gb', 'us'], (country, week) =>
      country === 'gb'
        ? Promise.reject(new Error('status 500'))
        : Promise.resolve(rows(country, week, 1)),
    );

    await expect(sync.run(NOW)).resolves.toMatchObject({
      countries: 2,
      rows: 1,
    });
    expect(prisma.searchTermPopularity.createMany).toHaveBeenCalledTimes(1);
  });

  it('rejects when every market fails', async () => {
    const { sync } = build(['gb', 'us'], () =>
      Promise.reject(new Error('status 401')),
    );

    await expect(sync.run(NOW)).rejects.toThrow(
      'Apple search popularity failed for every market',
    );
  });

  it('does nothing when no app store keyword is tracked', async () => {
    const { sync, client } = build([], () => Promise.resolve([]));

    await expect(sync.run(NOW)).resolves.toEqual({
      countries: 0,
      rows: 0,
      week: '2026-09-13',
    });
    expect(client.weekOf).not.toHaveBeenCalled();
  });
});
