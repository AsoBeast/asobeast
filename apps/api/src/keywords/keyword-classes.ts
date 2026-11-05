import type { KeywordClass } from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import { readScoreSignals } from '../scoring/score-signals';
import { classFacts } from './keywords.mapper';
import { KeywordApp } from './keywords.support';
import { listingFacts } from './listing-facts';

export async function trackedKeywordClasses(
  prisma: PrismaService,
  app: Pick<KeywordApp, 'id' | 'country' | 'store'>,
  country: string | undefined,
): Promise<ReadonlyMap<string, KeywordClass | undefined>> {
  const rows = await prisma.trackedKeyword.findMany({
    where: {
      appId: app.id,
      ...(country ? { keyword: { is: { country } } } : {}),
    },
    select: {
      keywordId: true,
      keywordClass: true,
      keyword: {
        select: {
          text: true,
          country: true,
          metrics: {
            orderBy: { date: 'desc' },
            take: 1,
            select: { stats: true },
          },
        },
      },
    },
  });
  const facts = await listingFacts(
    prisma,
    app,
    [...new Set(rows.map((row) => row.keyword.country))],
    { brand: true },
  );
  return new Map(
    rows.map((row) => [
      row.keywordId,
      classFacts(
        row,
        facts.classOf,
        readScoreSignals(row.keyword.metrics[0]?.stats),
      ).keywordClass,
    ]),
  );
}
