import { Prisma } from '@prisma/client';

export const HOME_LISTING = {
  country: null,
} satisfies Prisma.AppSnapshotWhereInput;

export const HOME_EVENTS = {
  country: null,
} satisfies Prisma.ChangeEventWhereInput;

export const EVERY_LISTING = {} satisfies Prisma.AppSnapshotWhereInput;

export const NEWEST_FIRST = {
  capturedAt: 'desc',
} satisfies Prisma.AppSnapshotOrderByWithRelationInput;

export const LATEST_HOME_LISTING = {
  where: HOME_LISTING,
  orderBy: NEWEST_FIRST,
  take: 1,
} as const;

export function storedMarket(home: string, market: string): string | null {
  return market === home ? null : market;
}

export function listingMarket(home: string, stored: string | null): string {
  return stored ?? home;
}

export function listingIn(home: string, market: string) {
  return {
    country: storedMarket(home, market),
  } satisfies Prisma.AppSnapshotWhereInput;
}

export function eventsIn(home: string, market: string) {
  return {
    country: storedMarket(home, market),
  } satisfies Prisma.ChangeEventWhereInput;
}

export function latestListingIn(home: string, market: string) {
  return {
    where: listingIn(home, market),
    orderBy: NEWEST_FIRST,
    take: 1,
  } as const;
}
