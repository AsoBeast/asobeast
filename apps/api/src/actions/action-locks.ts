import { Prisma } from '@prisma/client';

export async function lockActions(
  tx: Prisma.TransactionClient,
  ids: readonly string[],
): Promise<void> {
  if (ids.length === 0) return;
  await tx.$queryRaw`
    SELECT "id" FROM "ActionItem"
    WHERE "id" IN (${Prisma.join([...ids])})
    ORDER BY "id"
    FOR UPDATE
  `;
}
