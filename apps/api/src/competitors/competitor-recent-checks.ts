import { PrismaService } from '../prisma/prisma.service';
import { toDateKey } from '../rankings/rankings.support';
import { RecentChecks } from './competitor-gap-lists';
import { Check } from './competitor-threats';

export interface RankingCheckRow {
  appId: string;
  keywordId: string;
  date: Date;
  position: number | null;
}

export function groupChecks(rows: readonly RankingCheckRow[]): RecentChecks {
  const byKeyword = new Map<string, Map<string, Check[]>>();
  for (const row of rows) {
    const byApp = byKeyword.get(row.keywordId) ?? new Map<string, Check[]>();
    const checks = byApp.get(row.appId) ?? [];
    checks.push({ date: toDateKey(row.date), position: row.position });
    byApp.set(row.appId, checks);
    byKeyword.set(row.keywordId, byApp);
  }
  return byKeyword;
}

export async function recentChecks(
  prisma: PrismaService,
  appIds: readonly string[],
  keywordIds: readonly string[],
  since: string,
): Promise<RecentChecks> {
  if (keywordIds.length === 0 || appIds.length < 2) return new Map();
  const rows = await prisma.keywordRanking.findMany({
    where: {
      appId: { in: [...appIds] },
      keywordId: { in: [...keywordIds] },
      date: { gte: new Date(`${since}T00:00:00.000Z`) },
    },
    orderBy: { date: 'desc' },
    select: { appId: true, keywordId: true, date: true, position: true },
  });
  return groupChecks(rows);
}
