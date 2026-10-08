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
    [...new Set(markets)].map(async (market) => {
      const found = await Promise.all(
        nativeLocalizations(market).map(async (localization) => {
          const texts = await prisma.appSnapshot.findFirst({
            where: { appId, ...listingIn(home, market, localization) },
            orderBy: NEWEST_FIRST,
            select: TEXT_SELECT,
          });
          return texts ? [{ localization, texts }] : [];
        }),
      );
      return [market, found.flat()] as const;
    }),
  );
  return new Map(entries);
}

export function relevanceText(listing: ListingTexts): string {
  return [listing.title, listing.subtitle, listing.summary]
    .filter((part): part is string => Boolean(part))
    .join(' ');
}
