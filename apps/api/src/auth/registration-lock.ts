import type { Prisma } from '@prisma/client';

const REGISTRATION_LOCK = 8_294_113;

export function lockRegistration(
  tx: Pick<Prisma.TransactionClient, '$executeRaw'>,
): Promise<unknown> {
  return tx.$executeRaw`SELECT pg_advisory_xact_lock(${REGISTRATION_LOCK}::bigint)`;
}
