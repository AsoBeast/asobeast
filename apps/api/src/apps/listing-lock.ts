import { Prisma } from '@prisma/client';

const LISTING_LOCK = 1_704_313;

export function lockListing(
  tx: Prisma.TransactionClient,
  appId: string,
  market: string,
): Promise<number> {
  return tx.$executeRaw`SELECT pg_advisory_xact_lock(${LISTING_LOCK}, hashtext(${`${appId}~${market}`}))`;
}
