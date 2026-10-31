import { PrismaService } from '../prisma/prisma.service';
import { loadSerpDays } from './keyword-serp-days';

const fakePrisma = (
  latest: { date: Date } | null,
  entries: { keywordId: string; date: Date; storeAppId: string }[] = [],
) => ({
  serpEntry: {
    findFirst: jest.fn().mockResolvedValue(latest),
    findMany: jest.fn().mockResolvedValue(entries),
  },
});

const load = (prisma: ReturnType<typeof fakePrisma>, keywordIds: string[]) =>
  loadSerpDays(prisma as unknown as PrismaService, keywordIds);

describe('loadSerpDays', () => {
  it('answers an empty map without a query when no keyword is asked for', async () => {
    const prisma = fakePrisma({ date: new Date('2026-10-28') });

    expect(await load(prisma, [])).toEqual(new Map());
    expect(prisma.serpEntry.findFirst).not.toHaveBeenCalled();
    expect(prisma.serpEntry.findMany).not.toHaveBeenCalled();
  });

  it('answers an empty map without reading rows when no snapshot exists', async () => {
    const prisma = fakePrisma(null);

    expect(await load(prisma, ['k1'])).toEqual(new Map());
    expect(prisma.serpEntry.findMany).not.toHaveBeenCalled();
  });

  it('groups the store app ids by keyword and UTC day in row order', async () => {
    const prisma = fakePrisma({ date: new Date('2026-10-28') }, [
      { keywordId: 'k1', date: new Date('2026-10-27'), storeAppId: 'a' },
      { keywordId: 'k1', date: new Date('2026-10-27'), storeAppId: 'b' },
      { keywordId: 'k1', date: new Date('2026-10-28'), storeAppId: 'c' },
      { keywordId: 'k2', date: new Date('2026-10-28'), storeAppId: 'a' },
    ]);

    const days = await load(prisma, ['k1', 'k2']);

    expect(days).toEqual(
      new Map([
        [
          'k1',
          new Map([
            ['2026-10-27', ['a', 'b']],
            ['2026-10-28', ['c']],
          ]),
        ],
        ['k2', new Map([['2026-10-28', ['a']]])],
      ]),
    );
  });

  it('reads from eight days before the newest snapshot', async () => {
    const prisma = fakePrisma({ date: new Date('2026-10-28T00:00:00.000Z') });

    await load(prisma, ['k1']);

    const [query] = prisma.serpEntry.findMany.mock.calls[0] as [
      { where: { date: { gte: Date } } },
    ];
    expect(query.where.date.gte).toEqual(new Date('2026-10-20T00:00:00.000Z'));
  });

  it('reads only the top 10 of each day', async () => {
    const prisma = fakePrisma({ date: new Date('2026-10-28T00:00:00.000Z') });

    await load(prisma, ['k1']);

    const [query] = prisma.serpEntry.findMany.mock.calls[0] as [
      { where: { position: unknown } },
    ];
    expect(query.where.position).toEqual({ lte: 10 });
    expect(prisma.serpEntry.findFirst).toHaveBeenCalledWith({
      where: { keywordId: { in: ['k1'] }, position: 1 },
      orderBy: { date: 'desc' },
      select: { date: true },
    });
  });
});
