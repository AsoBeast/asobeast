import { PrismaService } from '../prisma/prisma.service';
import { ranksByCompetitor, rivalRankings } from './rival-rankings';

const D0 = new Date('2026-11-03T00:00:00Z');
const D7 = new Date('2026-10-27T00:00:00Z');

const fakePrisma = (
  rows: {
    appId: string;
    keywordId: string;
    date: Date;
    position: number | null;
    depth: number;
  }[] = [],
) => ({ keywordRanking: { findMany: jest.fn().mockResolvedValue(rows) } });

const asPrisma = (prisma: ReturnType<typeof fakePrisma>) =>
  prisma as unknown as PrismaService;

describe('rivalRankings', () => {
  it('reads the named days of every competitor in one query', async () => {
    const prisma = fakePrisma();

    await rivalRankings(
      asPrisma(prisma),
      { competitorIds: ['a', 'b'], keywordIds: ['k1'] },
      { in: [D0, D7] },
    );

    expect(prisma.keywordRanking.findMany).toHaveBeenCalledWith({
      where: {
        appId: { in: ['a', 'b'] },
        keywordId: { in: ['k1'] },
        date: { in: [D0, D7] },
      },
      orderBy: { date: 'desc' },
      select: {
        appId: true,
        keywordId: true,
        date: true,
        position: true,
        depth: true,
      },
    });
  });

  it('reads a range of days', async () => {
    const prisma = fakePrisma();

    await rivalRankings(
      asPrisma(prisma),
      { competitorIds: ['a'], keywordIds: ['k1'] },
      { from: D7, to: D0 },
    );

    const [query] = prisma.keywordRanking.findMany.mock.calls[0] as [
      { where: { date: unknown } },
    ];
    expect(query.where.date).toEqual({ gte: D7, lte: D0 });
  });

  it.each([
    ['no competitor', [], ['k1']],
    ['no keyword', ['a'], []],
  ])('asks nothing with %s', async (_, competitorIds, keywordIds) => {
    const prisma = fakePrisma();

    expect(
      await rivalRankings(
        asPrisma(prisma),
        { competitorIds, keywordIds },
        { in: [D0] },
      ),
    ).toEqual(new Map());
    expect(prisma.keywordRanking.findMany).not.toHaveBeenCalled();
  });
});

describe('ranksByCompetitor', () => {
  it('groups by competitor then keyword in row order', () => {
    expect(
      ranksByCompetitor([
        { appId: 'a', keywordId: 'k1', date: D0, position: 3, depth: 200 },
        { appId: 'a', keywordId: 'k1', date: D7, position: null, depth: 200 },
        { appId: 'b', keywordId: 'k2', date: D0, position: 9, depth: 100 },
      ]),
    ).toEqual(
      new Map([
        [
          'a',
          new Map([
            [
              'k1',
              [
                { date: D0, position: 3, depth: 200 },
                { date: D7, position: null, depth: 200 },
              ],
            ],
          ]),
        ],
        ['b', new Map([['k2', [{ date: D0, position: 9, depth: 100 }]]])],
      ]),
    );
  });
});
