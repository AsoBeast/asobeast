import type { Prisma } from '@prisma/client';

export function revokeApiTokens(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<Prisma.BatchPayload> {
  return tx.apiToken.deleteMany({ where: { userId } });
}
