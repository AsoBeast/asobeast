import { PrismaService } from '../prisma/prisma.service';

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
    where: { keywordId: { in: keywordIds }, date: { gte: from } },
    orderBy: { date: 'asc' },
    select: { keywordId: true, date: true, storeAppId: true },
  });

  const byKeyword: KeywordSerpDays = new Map();
  for (const entry of entries) {
    const dateKey = entry.date.toISOString().slice(0, 10);
    const dates = byKeyword.get(entry.keywordId) ?? new Map<string, string[]>();
    dates.set(dateKey, [...(dates.get(dateKey) ?? []), entry.storeAppId]);
    byKeyword.set(entry.keywordId, dates);
  }
  return byKeyword;
}
