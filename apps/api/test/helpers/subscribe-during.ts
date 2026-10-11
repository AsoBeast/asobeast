import type { PrismaClient } from '@prisma/client';

const waitForBlockedWorkspaceUpdate = async (prisma: PrismaClient) => {
  for (let attempt = 0; attempt < 250; attempt += 1) {
    const [{ waiting }] = await prisma.$queryRaw<{ waiting: bigint }[]>`
      SELECT COUNT(*) AS waiting
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND wait_event_type = 'Lock'
        AND query LIKE 'UPDATE %"Workspace"%'
    `;
    if (waiting > 0n) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('The trial never waited on the held workspace');
};

export async function subscribeDuring<T>(
  prisma: PrismaClient,
  workspaceId: string,
  startTrial: () => Promise<T>,
): Promise<T> {
  const { pending } = await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Workspace" WHERE "id" = ${workspaceId} FOR UPDATE`;
      const pending = startTrial();
      pending.catch(() => undefined);
      await waitForBlockedWorkspaceUpdate(prisma);
      await tx.workspace.update({
        where: { id: workspaceId },
        data: { plan: 'indie', subscriptionId: 'sub_landed' },
      });
      return { pending };
    },
    { timeout: 30_000 },
  );
  return pending;
}
