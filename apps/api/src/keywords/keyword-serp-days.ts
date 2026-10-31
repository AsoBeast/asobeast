import { PrismaService } from '../prisma/prisma.service';
import { TOP_TEN_ROWS } from '../rankings/top-ten';

const SERP_WINDOW_DAYS = 8;

export type SerpDays = Map<string, string[]>;

export type KeywordSerpDays = Map<string, SerpDays>;

export async function loadSerpDays(
  prisma: PrismaService,
  keywordIds: string[],
): Promise<KeywordSerpDays> {
  if (keywordIds.length === 0) {
    return new Map();
  }
  const latest = await prisma.serpEntry.findFirst({
    where: { keywordId: { in: keywordIds } },
    orderBy: { date: 'desc' },
    select: { date: true },
  });
  if (!latest) {
    return new Map();
  }
  const from = new Date(latest.date);
  from.setUTCDate(from.getUTCDate() - SERP_WINDOW_DAYS);
  const entries = await prisma.serpEntry.findMany({
    where: {
      keywordId: { in: keywordIds },
      date: { gte: from },
      ...TOP_TEN_ROWS,
    },
    orderBy: { date: 'asc' },
    select: { keywordId: true, date: true, storeAppId: true },
  });

  const byKeyword: KeywordSerpDays = new Map();
  for (const entry of entries) {
    const dateKey = entry.date.toISOString().slice(0, 10);
    const dates = byKeyword.get(entry.keywordId) ?? new Map<string, string[]>();
    byKeyword.set(entry.keywordId, dates);
    const storeAppIds = dates.get(dateKey);
    if (storeAppIds) {
      storeAppIds.push(entry.storeAppId);
    } else {
      dates.set(dateKey, [entry.storeAppId]);
    }
  }
  return byKeyword;
}
