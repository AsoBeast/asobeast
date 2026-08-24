import { KeywordComparisonRow } from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';

const GAP_COMPETITOR_TOP = 10;
const GAP_PRIMARY_WORSE_THAN = 30;

export function positionKey(appId: string, keywordId: string): string {
  return `${appId}:${keywordId}`;
}

export async function latestPositions(
  prisma: PrismaService,
  appIds: string[],
  keywordIds: string[],
): Promise<Map<string, number | null>> {
  if (keywordIds.length === 0) {
    return new Map();
  }
  const rankings = await prisma.keywordRanking.findMany({
    where: { appId: { in: appIds }, keywordId: { in: keywordIds } },
    orderBy: { date: 'desc' },
    select: { appId: true, keywordId: true, position: true },
  });
  const latest = new Map<string, number | null>();
  for (const ranking of rankings) {
    const key = positionKey(ranking.appId, ranking.keywordId);
    if (!latest.has(key)) {
      latest.set(key, ranking.position);
    }
  }
  return latest;
}

export function isGap(
  you: number | null,
  positions: Record<string, number | null>,
): boolean {
  const primaryWeak = you === null || you > GAP_PRIMARY_WORSE_THAN;
  if (!primaryWeak) {
    return false;
  }
  return Object.values(positions).some(
    (position) => position !== null && position <= GAP_COMPETITOR_TOP,
  );
}

export function sortComparison(
  rows: KeywordComparisonRow[],
): KeywordComparisonRow[] {
  return [...rows].sort((a, b) => {
    if (a.gap !== b.gap) {
      return a.gap ? -1 : 1;
    }
    return (b.traffic ?? 0) - (a.traffic ?? 0);
  });
}
