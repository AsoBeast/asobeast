import { Store } from '@prisma/client';
import {
  AppStoreLocalization,
  isAppStoreLocalization,
  storefrontLocalizations,
} from '@asobeast/shared';
import {
  EVERY_LISTING,
  listingIn,
  listingMarket,
  NEWEST_FIRST,
} from '../apps/listing';
import { PrismaService } from '../prisma/prisma.service';

export interface ListingCopy {
  title: string;
  subtitle: string | null;
}

export interface LocalizedCopy extends ListingCopy {
  localization: AppStoreLocalization;
  sourceCountry: string;
}

export interface LocalizedRead {
  listings: LocalizedCopy[];
  unread: AppStoreLocalization[];
}

const NOTHING_READ: LocalizedRead = { listings: [], unread: [] };

export function pickLocalized(
  market: string,
  captured: ReadonlyMap<string, ListingCopy>,
  defaults: ReadonlyMap<string, ListingCopy>,
): LocalizedRead {
  const additional = storefrontLocalizations(market)?.additional ?? [];
  const listings: LocalizedCopy[] = [];
  const unread: AppStoreLocalization[] = [];
  for (const localization of additional) {
    const inMarket = captured.get(localization);
    if (inMarket) {
      listings.push({ ...inMarket, localization, sourceCountry: market });
      continue;
    }
    const elsewhere = [...defaults.entries()].find(
      ([country]) =>
        country !== market &&
        storefrontLocalizations(country)?.primary === localization,
    );
    if (elsewhere) {
      const [sourceCountry, copy] = elsewhere;
      listings.push({ ...copy, localization, sourceCountry });
    } else {
      unread.push(localization);
    }
  }
  return { listings, unread };
}

export async function localizedCopies(
  prisma: PrismaService,
  store: Store,
  subject: { id: string; country: string },
  market: string,
): Promise<LocalizedRead> {
  if (store !== Store.APP_STORE) {
    return NOTHING_READ;
  }
  const select = {
    country: true,
    localization: true,
    title: true,
    subtitle: true,
  } as const;
  const [inMarket, defaults] = await Promise.all([
    prisma.appSnapshot.findMany({
      where: {
        appId: subject.id,
        ...listingIn(subject.country, market),
        localization: { not: null },
      },
      orderBy: NEWEST_FIRST,
      distinct: ['localization'],
      select,
    }),
    prisma.appSnapshot.findMany({
      where: { appId: subject.id, ...EVERY_LISTING, localization: null },
      orderBy: NEWEST_FIRST,
      distinct: ['country'],
      select,
    }),
  ]);
  return pickLocalized(
    market,
    new Map(
      inMarket.flatMap((row) =>
        isAppStoreLocalization(row.localization)
          ? [[row.localization, row] as const]
          : [],
      ),
    ),
    new Map(
      defaults.map((row) => [listingMarket(subject.country, row.country), row]),
    ),
  );
}
