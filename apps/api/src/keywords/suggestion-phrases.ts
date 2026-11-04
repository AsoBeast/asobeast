import { KeywordSuggestion } from '@asobeast/shared';
import { LATEST_HOME_LISTING } from '../apps/listing';
import { PrismaService } from '../prisma/prisma.service';
import { extractCandidates } from './extraction';
import { mineReviewPhrases } from './review-mining';

export const REVIEW_MINING_CAP = 500;

export async function recentReviewPhrases(
  prisma: PrismaService,
  appId: string,
  excluded: Set<string>,
  languages: readonly string[],
  limit: number,
): Promise<KeywordSuggestion[]> {
  const reviews = await prisma.review.findMany({
    where: { appId },
    orderBy: { reviewedAt: 'desc' },
    take: REVIEW_MINING_CAP,
    select: { title: true, text: true },
  });
  return mineReviewPhrases(reviews, excluded, languages).slice(0, limit);
}

export async function competitorPhrases(
  prisma: PrismaService,
  appId: string,
  excluded: ReadonlySet<string>,
  languages: readonly string[],
  limit: number,
): Promise<KeywordSuggestion[]> {
  const competitors = await prisma.app.findMany({
    where: { primaryAppId: appId },
    select: {
      snapshots: {
        ...LATEST_HOME_LISTING,
        select: { title: true, subtitle: true },
      },
    },
  });

  const counts = new Map<string, number>();
  for (const competitor of competitors) {
    const snapshot = competitor.snapshots[0];
    if (!snapshot) {
      continue;
    }
    const texts = new Set(
      extractCandidates(
        {
          title: snapshot.title,
          subtitle: snapshot.subtitle ?? undefined,
        },
        languages,
      ).map((candidate) => candidate.text),
    );
    for (const text of texts) {
      if (excluded.has(text)) {
        continue;
      }
      counts.set(text, (counts.get(text) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([text, usedByCount]) => ({
      text,
      strategy: 'competitors' as const,
      usedByCount,
    }));
}
