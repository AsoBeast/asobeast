import type { PrismaService } from '../prisma/prisma.service';

export interface TrackedMarketRow {
  appId: string;
  country: string;
}

export function trackedMarkets(
  prisma: PrismaService,
): Promise<TrackedMarketRow[]> {
  return prisma.$queryRaw<TrackedMarketRow[]>`
    SELECT DISTINCT t."appId", k."country"
    FROM "TrackedKeyword" t
    JOIN "Keyword" k ON k."id" = t."keywordId"
    JOIN "App" a ON a."id" = t."appId"
    WHERE t."active" = true
      AND a."isCompetitor" = false
      AND k."country" <> a."country"
  `;
}
