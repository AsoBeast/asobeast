import { PrismaClient } from '@prisma/client';
import { testDb } from '../helpers/test-db';

describe('Audit rows against an upgraded baseline database', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = testDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('reads a v1 insight as a completed run with no observations', async () => {
    const insight = await prisma.auditInsight.findUniqueOrThrow({
      where: { appId: 'app_ios' },
    });

    expect(insight).toMatchObject({
      model: 'gpt-4o',
      checks: { title: { verdict: 'pass' } },
      observations: null,
      inputHash: null,
      promptVersion: null,
      runState: 'completed',
      runError: null,
      requestedAt: null,
      generatedAt: new Date('2026-07-15T06:00:00.000Z'),
    });
  });

  it.each(['app_ios', 'app_play'])(
    'marks the stored %s score as rubric v1 with no confidence',
    async (appId) => {
      const [score] = await prisma.auditScore.findMany({ where: { appId } });

      expect(score).toMatchObject({ rubricVersion: 'v1', confidence: null });
    },
  );
});
