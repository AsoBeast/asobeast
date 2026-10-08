import { PrismaService } from '../prisma/prisma.service';
import { listingIn, NEWEST_FIRST } from './listing';

export interface ListingTexts {
  id: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  description: string;
}

const TEXT_SELECT = {
  id: true,
  title: true,
  subtitle: true,
  summary: true,
  description: true,
} as const;

export async function latestListingTexts(
  prisma: PrismaService,
  appId: string,
  home: string,
  markets: readonly string[],
): Promise<Map<string, ListingTexts>> {
  const found = await Promise.all(
    [...new Set(markets)].map(async (market) => {
      const row = await prisma.appSnapshot.findFirst({
        where: { appId, ...listingIn(home, market) },
        orderBy: NEWEST_FIRST,
        select: TEXT_SELECT,
      });
      return row ? ([market, row] as const) : null;
    }),
  );
  return new Map(found.flatMap((entry) => (entry ? [entry] : [])));
}

export function relevanceText(listing: ListingTexts): string {
  return [listing.title, listing.subtitle, listing.summary]
    .filter((part): part is string => Boolean(part))
    .join(' ');
}
