import { PrismaClient } from '@prisma/client';
import { testDb } from '../helpers/test-db';

describe('Default alerts against an upgraded baseline database', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = testDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('settles every workspace that existed before the upgrade', async () => {
    await expect(
      prisma.workspace.count({ where: { defaultAlertsAt: null } }),
    ).resolves.toBe(0);
  });

  it('leaves an existing email alert without a threshold, origin or intro', async () => {
    const alert = await prisma.emailAlert.findUniqueOrThrow({
      where: { id: 'mail_ops' },
    });

    expect(alert).toMatchObject({
      defaultOrigin: false,
      introSentAt: null,
      rankDropThreshold: null,
    });
  });

  it('leaves an existing webhook without a threshold', async () => {
    const webhook = await prisma.webhook.findUniqueOrThrow({
      where: { id: 'wh_ops' },
    });

    expect(webhook.rankDropThreshold).toBeNull();
  });
});
