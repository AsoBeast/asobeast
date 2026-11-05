import {
  addUtcDays,
  KeywordComparison,
  THREAT_WINDOW_DAYS,
  utcDayOf,
} from '@asobeast/shared';
import { AppCaptureService } from '../apps/app-capture.service';
import { QuotaService } from '../auth/quota.service';
import { KeywordsService } from '../keywords/keywords.service';
import { PrismaService } from '../prisma/prisma.service';
import { CompetitorsService } from './competitors.service';
import { gapEntry, PRIMARY, RIVAL } from './competitor-gaps.fixture';

const appRow = (id: string, delistedAt: Date | null = null) => ({
  id,
  name: id,
  delistedAt,
  snapshots: [],
});

const build = (delistedAt: Date | null, you: number | null = null) => {
  const entry = gapEntry({ you, positions: { [RIVAL]: 5 } });
  const comparison: KeywordComparison = {
    competitors: [{ id: RIVAL, name: RIVAL }],
    rows: [entry.row],
  };
  const prisma = {
    app: {
      findFirst: jest.fn().mockResolvedValue(appRow(PRIMARY)),
      findMany: jest.fn().mockResolvedValue([appRow(RIVAL, delistedAt)]),
    },
    keywordRanking: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const keywords = {
    compare: jest.fn().mockResolvedValue(comparison),
    listTracked: jest.fn().mockResolvedValue([entry.item]),
  };
  const service = new CompetitorsService(
    prisma as unknown as PrismaService,
    keywords as unknown as KeywordsService,
    {} as AppCaptureService,
    {} as QuotaService,
  );
  return { prisma, service };
};

describe('CompetitorsService.analysis', () => {
  it('reads the checks since the day before the threat window', async () => {
    const { prisma, service } = build(null, 7);

    await service.analysis(PRIMARY);

    const since = addUtcDays(utcDayOf(new Date()), -(THREAT_WINDOW_DAYS + 1));
    const [rankings] = prisma.keywordRanking.findMany.mock.calls[0] as [
      { where: { appId: unknown; date: unknown } },
    ];
    const [competitors] = prisma.app.findMany.mock.calls[0] as [
      { select: { delistedAt?: boolean } },
    ];
    expect(rankings.where.appId).toEqual({ in: [PRIMARY, RIVAL] });
    expect(rankings.where.date).toEqual({
      gte: new Date(`${since}T00:00:00.000Z`),
    });
    expect(competitors.select.delistedAt).toBe(true);
  });

  it('reads no checks for a keyword the app is outside the top 30 on', async () => {
    const { prisma, service } = build(null, 31);

    await service.analysis(PRIMARY);

    expect(prisma.keywordRanking.findMany).not.toHaveBeenCalled();
  });

  it('reads no checks of a delisted competitor', async () => {
    const { prisma, service } = build(new Date('2026-10-01'), 7);

    await service.analysis(PRIMARY);

    expect(prisma.keywordRanking.findMany).not.toHaveBeenCalled();
  });

  it('answers the gap lists beside the older ones', async () => {
    const { service } = build(null);

    const { gaps } = await service.analysis(PRIMARY);

    expect(gaps.theyRankYouDont).toHaveLength(1);
    expect(gaps.keywordGaps).toHaveLength(1);
    expect(gaps.winnable).toEqual([]);
    expect(gaps.threats).toEqual([]);
    expect(gaps.lead).toEqual([]);
    expect(gaps.coverage).toEqual({
      competitors: 1,
      delisted: 0,
      markets: [{ country: 'us', keywords: 1, compared: 1 }],
    });
  });

  it('counts a delisted competitor apart and judges nothing against it', async () => {
    const { service } = build(new Date('2026-10-01'));

    const { gaps } = await service.analysis(PRIMARY);

    expect(gaps.theyRankYouDont).toHaveLength(1);
    expect(gaps.keywordGaps).toEqual([]);
    expect(gaps.coverage).toMatchObject({ competitors: 0, delisted: 1 });
  });
});
