import { PrismaClient } from '@prisma/client';
import { testDb } from '../helpers/test-db';

describe('Billing events against an upgraded baseline database', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = testDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const settlement = (id: string) =>
    prisma.billingEvent.findUniqueOrThrow({
      where: { id },
      select: { processedAt: true, outcome: true, failure: true },
    });

  it('backfills applied onto every event that was already processed', async () => {
    await expect(settlement('evt_drill_applied')).resolves.toMatchObject({
      outcome: 'applied',
      failure: null,
    });
  });

  it.each(['evt_drill_orphan', 'evt_drill_foreign'])(
    'settles %s, which failed only because no workspace could take it, as orphaned',
    async (id) => {
      const row = await settlement(id);

      expect(row.outcome).toBe('orphaned');
      expect(row.processedAt).not.toBeNull();
      expect(row.failure).toBeNull();
    },
  );

  it('leaves an event that failed for a passing reason waiting for its retry', async () => {
    await expect(settlement('evt_drill_retrying')).resolves.toEqual({
      processedAt: null,
      outcome: null,
      failure: 'connect ECONNREFUSED',
    });
  });
});
