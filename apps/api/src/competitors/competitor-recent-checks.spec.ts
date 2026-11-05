import { PrismaService } from '../prisma/prisma.service';
import { groupChecks, recentChecks } from './competitor-recent-checks';

const fakePrisma = (
  rows: {
    appId: string;
    keywordId: string;
    date: Date;
    position: number | null;
  }[] = [],
) => ({ keywordRanking: { findMany: jest.fn().mockResolvedValue(rows) } });

const load = (
  prisma: ReturnType<typeof fakePrisma>,
  appIds: string[],
  keywordIds: string[],
) =>
  recentChecks(
    prisma as unknown as PrismaService,
    appIds,
    keywordIds,
    '2026-10-26',
  );

describe('recentChecks', () => {
  it('reads the checks of every app since the first day in one query', async () => {
    const prisma = fakePrisma();

    await load(prisma, ['you', 'rival'], ['k1', 'k2']);

    expect(prisma.keywordRanking.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.keywordRanking.findMany).toHaveBeenCalledWith({
      where: {
        appId: { in: ['you', 'rival'] },
        keywordId: { in: ['k1', 'k2'] },
        date: { gte: new Date('2026-10-26T00:00:00.000Z') },
      },
      orderBy: { date: 'desc' },
      select: { appId: true, keywordId: true, date: true, position: true },
    });
  });

  it('groups the checks by keyword and app, newest first', async () => {
    const prisma = fakePrisma([
      {
        appId: 'you',
        keywordId: 'k1',
        date: new Date('2026-11-03'),
        position: 4,
      },
      {
        appId: 'rival',
        keywordId: 'k1',
        date: new Date('2026-11-03'),
        position: null,
      },
      {
        appId: 'you',
        keywordId: 'k1',
        date: new Date('2026-11-02'),
        position: 6,
      },
      {
        appId: 'you',
        keywordId: 'k2',
        date: new Date('2026-11-02'),
        position: 9,
      },
    ]);

    expect(await load(prisma, ['you', 'rival'], ['k1', 'k2'])).toEqual(
      new Map([
        [
          'k1',
          new Map([
            [
              'you',
              [
                { date: '2026-11-03', position: 4 },
                { date: '2026-11-02', position: 6 },
              ],
            ],
            ['rival', [{ date: '2026-11-03', position: null }]],
          ]),
        ],
        ['k2', new Map([['you', [{ date: '2026-11-02', position: 9 }]]])],
      ]),
    );
  });

  it('asks nothing without a keyword', async () => {
    const prisma = fakePrisma();

    expect(await load(prisma, ['you', 'rival'], [])).toEqual(new Map());
    expect(prisma.keywordRanking.findMany).not.toHaveBeenCalled();
  });

  it('asks nothing without a competitor', async () => {
    const prisma = fakePrisma();

    expect(await load(prisma, ['you'], ['k1'])).toEqual(new Map());
    expect(prisma.keywordRanking.findMany).not.toHaveBeenCalled();
  });
});

describe('groupChecks', () => {
  it('answers an empty map for no rows', () => {
    expect(groupChecks([])).toEqual(new Map());
  });
});
