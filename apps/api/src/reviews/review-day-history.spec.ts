import type { Prisma } from '@prisma/client';
import { readDayHistory } from './review-day-history';

const build = (
  rows: { day: Date; count: number; low: number }[] = [],
  oldest: Date | null = new Date('2026-09-01T10:00:00.000Z'),
) => {
  const queryRaw = jest.fn().mockResolvedValue(rows);
  const aggregate = jest
    .fn()
    .mockResolvedValue({ _min: { reviewedAt: oldest } });
  const tx = {
    $queryRaw: queryRaw,
    review: { aggregate },
  } as unknown as Prisma.TransactionClient;
  return { tx, queryRaw, aggregate };
};

describe('readDayHistory', () => {
  it('reads the four weeks before the day through the next midnight', async () => {
    const { tx, queryRaw } = build();

    await readDayHistory(tx, 'app_1', '2026-11-02', 2);

    const [, scoreMax, appId, from, to] = queryRaw.mock.calls[0] as unknown[];
    expect([scoreMax, appId, from, to]).toEqual([
      2,
      'app_1',
      new Date('2026-10-05T00:00:00.000Z'),
      new Date('2026-11-03T00:00:00.000Z'),
    ]);
  });

  it('maps each row to its UTC day', async () => {
    const { tx } = build([
      { day: new Date('2026-11-01T00:00:00.000Z'), count: 4, low: 1 },
      { day: new Date('2026-11-02T00:00:00.000Z'), count: 9, low: 7 },
    ]);

    const history = await readDayHistory(tx, 'app_1', '2026-11-02', 2);

    expect([...history.counts]).toEqual([
      ['2026-11-01', { count: 4, low: 1 }],
      ['2026-11-02', { count: 9, low: 7 }],
    ]);
    expect(history.oldestDay).toBe('2026-09-01');
  });

  it('answers no oldest day for an app without dated reviews', async () => {
    const { tx } = build([], null);

    await expect(readDayHistory(tx, 'app_1', '2026-11-02', 2)).resolves.toEqual(
      { counts: new Map(), oldestDay: null },
    );
  });

  it('reads through the transaction client it was given', async () => {
    const { tx, queryRaw, aggregate } = build();

    await readDayHistory(tx, 'app_1', '2026-11-02', 2);

    expect(aggregate).toHaveBeenCalledWith({
      where: { appId: 'app_1' },
      _min: { reviewedAt: true },
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });
});
