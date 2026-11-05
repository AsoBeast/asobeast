import { PrismaService } from '../prisma/prisma.service';
import { Ranking } from './analytics.support';

export interface RivalScope {
  competitorIds: readonly string[];
  keywordIds: readonly string[];
}

export type RivalDates = { in: readonly Date[] } | { from: Date; to: Date };

export type RankingsByKeyword = ReadonlyMap<string, Ranking[]>;

export interface RivalRankingRow extends Ranking {
  appId: string;
  keywordId: string;
}

export function ranksByCompetitor(
  rows: readonly RivalRankingRow[],
): ReadonlyMap<string, RankingsByKeyword> {
  const byCompetitor = new Map<string, Map<string, Ranking[]>>();
  for (const { appId, keywordId, date, position, depth } of rows) {
    const byKeyword = byCompetitor.get(appId) ?? new Map<string, Ranking[]>();
    const rankings = byKeyword.get(keywordId) ?? [];
    rankings.push({ date, position, depth });
    byKeyword.set(keywordId, rankings);
    byCompetitor.set(appId, byKeyword);
  }
  return byCompetitor;
}

const dateWhere = (dates: RivalDates) =>
  'in' in dates ? { in: [...dates.in] } : { gte: dates.from, lte: dates.to };

export async function rivalRankings(
  prisma: PrismaService,
  scope: RivalScope,
  dates: RivalDates,
): Promise<ReadonlyMap<string, RankingsByKeyword>> {
  if (scope.competitorIds.length === 0 || scope.keywordIds.length === 0) {
    return new Map();
  }
  const rows = await prisma.keywordRanking.findMany({
    where: {
      appId: { in: [...scope.competitorIds] },
      keywordId: { in: [...scope.keywordIds] },
      date: dateWhere(dates),
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
  return ranksByCompetitor(rows);
}
