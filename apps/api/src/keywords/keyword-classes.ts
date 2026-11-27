import type { KeywordClass } from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import { readScoreSignals } from '../scoring/score-signals';
import { AppFacts, classFacts } from './keywords.mapper';
import { KeywordApp } from './keywords.support';
import { listingFacts } from './listing-facts';

type ClassApp = Pick<
  KeywordApp,
  'id' | 'country' | 'defaultLocalization' | 'store'
>;

export type KeywordClasses = ReadonlyMap<string, KeywordClass | undefined>;

export interface ListingVerdicts {
  classes: KeywordClasses;
  uncovered: ReadonlySet<string>;
}

const classRows = (
  prisma: PrismaService,
  appId: string,
  country: string | undefined,
) =>
  prisma.trackedKeyword.findMany({
    where: {
      appId,
      ...(country ? { keyword: { is: { country } } } : {}),
    },
    select: {
      keywordId: true,
      keywordClass: true,
      active: true,
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

type ClassRow = Awaited<ReturnType<typeof classRows>>[number];

const marketsOf = (rows: readonly ClassRow[]): string[] => [
  ...new Set(rows.map((row) => row.keyword.country)),
];

const classesOf = (
  rows: readonly ClassRow[],
  facts: AppFacts,
): KeywordClasses =>
  new Map(
    rows.map((row) => [
      row.keywordId,
      classFacts(
        row,
        facts.classOf,
        readScoreSignals(row.keyword.metrics[0]?.stats),
      ).keywordClass,
    ]),
  );

export async function trackedKeywordClasses(
  prisma: PrismaService,
  app: ClassApp,
  country: string | undefined,
): Promise<KeywordClasses> {
  const rows = await classRows(prisma, app.id, country);
  const facts = await listingFacts(prisma, app, marketsOf(rows), {
    brand: true,
  });
  return classesOf(rows, facts);
}

export async function trackedListingVerdicts(
  prisma: PrismaService,
  app: ClassApp,
): Promise<ListingVerdicts> {
  const rows = await classRows(prisma, app.id, undefined);
  const facts = await listingFacts(prisma, app, marketsOf(rows), {
    brand: true,
    coverage: true,
  });
  return {
    classes: classesOf(rows, facts),
    uncovered: new Set(
      rows
        .filter((row) => row.active && facts.uncovered?.(row.keyword) === true)
        .map((row) => row.keywordId),
    ),
  };
}
