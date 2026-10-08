import { nativeLocalizations } from '@asobeast/shared';
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

export interface LocalizedTexts {
  localization: string;
  texts: ListingTexts;
}

export async function latestLocalizedTexts(
  prisma: PrismaService,
  appId: string,
  home: string,
  markets: readonly string[],
): Promise<Map<string, LocalizedTexts[]>> {
  const entries = await Promise.all(
    [...new Set(markets)].map(
      async (market): Promise<[string, LocalizedTexts[]]> => {
        const tags = nativeLocalizations(market);
        if (tags.length === 0) return [market, []];
        const rows = await prisma.appSnapshot.findMany({
          where: {
            appId,
            ...listingIn(home, market),
            localization: { in: [...tags] },
          },
          orderBy: NEWEST_FIRST,
          distinct: ['localization'],
          select: { ...TEXT_SELECT, localization: true },
        });
        return [
          market,
          tags.flatMap((localization) =>
            rows
              .filter((row) => row.localization === localization)
              .map((texts) => ({ localization, texts })),
          ),
        ];
      },
    ),
  );
  return new Map(entries);
}

export function relevanceText(listing: ListingTexts): string {
  return [listing.title, listing.subtitle, listing.summary]
    .filter((part): part is string => Boolean(part))
    .join(' ');
}
