import type { PrismaClient } from '@prisma/client';

const WAIT_ATTEMPTS = 250;
const WAIT_INTERVAL_MS = 20;
const HOLD_TIMEOUT_MS = 30_000;

const waitForUpdateBlockedBy = async (prisma: PrismaClient, holder: number) => {
  for (let attempt = 0; attempt < WAIT_ATTEMPTS; attempt += 1) {
    const [{ waiting }] = await prisma.$queryRaw<{ waiting: bigint }[]>`
      SELECT COUNT(*) AS waiting
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND ${holder}::int = ANY(pg_blocking_pids(pid))
        AND query LIKE 'UPDATE %"Workspace"%'
    `;
    if (waiting > 0n) return;
    await new Promise((resolve) => setTimeout(resolve, WAIT_INTERVAL_MS));
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
      const [{ holder }] = await tx.$queryRaw<{ holder: number }[]>`
        SELECT pg_backend_pid() AS holder
      `;
      const pending = startTrial();
      pending.catch(() => undefined);
      await waitForUpdateBlockedBy(prisma, holder);
      await tx.workspace.update({
        where: { id: workspaceId },
        data: { plan: 'indie', subscriptionId: 'sub_landed' },
      });
      return { pending };
    },
    { timeout: HOLD_TIMEOUT_MS },
  );
  return pending;
}
