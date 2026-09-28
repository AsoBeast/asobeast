import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { PortfolioSignals } from './portfolio-signals.service';

describe('PortfolioSignals', () => {
  let signals: PortfolioSignals;
  const actionGroupBy = jest.fn();
  const auditScoreFindFirst = jest.fn();

  beforeEach(async () => {
    actionGroupBy.mockReset();
    auditScoreFindFirst.mockReset();

    const moduleRef = await Test.createTestingModule({
      providers: [
        PortfolioSignals,
        {
          provide: PrismaService,
          useValue: {
            actionItem: { groupBy: actionGroupBy },
            auditScore: { findFirst: auditScoreFindFirst },
          },
        },
      ],
    }).compile();
    signals = moduleRef.get(PortfolioSignals);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('counts open actions per app and priority', async () => {
    actionGroupBy.mockResolvedValue([
      { appId: 'app_1', priority: 'critical', _count: { _all: 1 } },
      { appId: 'app_1', priority: 'medium', _count: { _all: 4 } },
      { appId: 'app_2', priority: 'high', _count: { _all: 2 } },
    ]);

    const counts = await signals.actionCounts(['app_1', 'app_2']);

    expect(counts).toEqual(
      new Map([
        ['app_1', { open: 5, critical: 1, high: 0 }],
        ['app_2', { open: 2, critical: 0, high: 2 }],
      ]),
    );
  });

  it('returns null and logs when the count query fails', async () => {
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    actionGroupBy.mockRejectedValue(new Error('table missing'));

    await expect(signals.actionCounts(['app_1'])).resolves.toBeNull();
    expect(error).toHaveBeenCalledWith(
      'action counts unavailable for this digest',
      expect.any(Error),
    );
  });

  it('reports no audit delta when the baseline is the current score', async () => {
    const score = { date: new Date('2026-07-13T00:00:00Z'), overall: 64 };
    auditScoreFindFirst.mockResolvedValue(score);

    const trend = await signals.auditTrend(
      'app_1',
      new Date('2026-07-13T00:00:00Z'),
    );

    expect(trend).toEqual({ current: 64, delta7d: null });
  });
});
