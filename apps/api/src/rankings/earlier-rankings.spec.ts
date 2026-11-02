import { PrismaService } from '../prisma/prisma.service';
import { EarlierRankings } from './earlier-rankings';
import { RankCheck } from './rank-confirmation';

const PREVIOUS_DAY = new Date('2026-10-27T00:00:00.000Z');

function setup(rows: RankCheck[] = []) {
  const findMany = jest.fn().mockResolvedValue(rows);
  const prisma = { keywordRanking: { findMany } };
  return {
    rankings: new EarlierRankings(prisma as unknown as PrismaService),
    findMany,
  };
}

describe('EarlierRankings', () => {
  it('asks for the two newest checks strictly before the date', async () => {
    const { rankings, findMany } = setup();

    await rankings.before('app1', 'kw1', PREVIOUS_DAY);

    expect(findMany).toHaveBeenCalledWith({
      where: { appId: 'app1', keywordId: 'kw1', date: { lt: PREVIOUS_DAY } },
      orderBy: { date: 'desc' },
      take: 2,
      select: { position: true, depth: true },
    });
  });

  it('reads no calendar distance between checks', async () => {
    const { rankings, findMany } = setup();

    await rankings.before('app1', 'kw1', PREVIOUS_DAY);

    const [query] = findMany.mock.calls[0] as [{ where: { date: object } }];
    expect(Object.keys(query.where.date)).toEqual(['lt']);
  });

  it('passes the rows through in order and keeps a missing position', async () => {
    const rows = [
      { position: 11, depth: 200 },
      { position: null, depth: 200 },
    ];
    const { rankings } = setup(rows);

    await expect(rankings.before('app1', 'kw1', PREVIOUS_DAY)).resolves.toEqual(
      rows,
    );
  });
});
