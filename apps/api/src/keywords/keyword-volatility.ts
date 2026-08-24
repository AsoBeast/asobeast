import { PrismaService } from '../prisma/prisma.service';
import { serpVolatility } from '../rankings/serp-volatility';

const VOLATILITY_WINDOW_DAYS = 8;

export async function serpVolatilities(
  prisma: PrismaService,
  keywordIds: string[],
): Promise<Map<string, number | null>> {
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
  from.setUTCDate(from.getUTCDate() - VOLATILITY_WINDOW_DAYS);
  const entries = await prisma.serpEntry.findMany({
    where: { keywordId: { in: keywordIds }, date: { gte: from } },
    orderBy: { date: 'asc' },
    select: { keywordId: true, date: true, storeAppId: true },
  });

  const byKeyword = new Map<string, Map<string, string[]>>();
  for (const entry of entries) {
    const dateKey = entry.date.toISOString().slice(0, 10);
    let dates = byKeyword.get(entry.keywordId);
    if (!dates) {
      dates = new Map();
      byKeyword.set(entry.keywordId, dates);
    }
    const set = dates.get(dateKey);
    if (set) {
      set.push(entry.storeAppId);
    } else {
      dates.set(dateKey, [entry.storeAppId]);
    }
  }

  const result = new Map<string, number | null>();
  for (const [keywordId, dates] of byKeyword) {
    const dailySets = [...dates.keys()]
      .sort()
      .map((key) => dates.get(key) ?? []);
    result.set(keywordId, serpVolatility(dailySets));
  }
  return result;
}
