import { PrismaService } from '../prisma/prisma.service';
import { serpVolatility } from '../rankings/serp-volatility';
import { KeywordSerpDays, loadSerpDays } from './keyword-serp-days';

export function volatilities(
  days: KeywordSerpDays,
): Map<string, number | null> {
  const result = new Map<string, number | null>();
  for (const [keywordId, dates] of days) {
    const dailySets = [...dates.keys()]
      .sort()
      .map((key) => dates.get(key) ?? []);
    result.set(keywordId, serpVolatility(dailySets));
  }
  return result;
}

export async function serpVolatilities(
  prisma: PrismaService,
  keywordIds: string[],
): Promise<Map<string, number | null>> {
  return volatilities(await loadSerpDays(prisma, keywordIds));
}
