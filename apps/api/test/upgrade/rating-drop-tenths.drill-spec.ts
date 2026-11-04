import { PrismaClient } from '@prisma/client';
import { toEmailAlertItem } from '../../src/alerts/email-alerts.mapper';
import { toWebhookItem } from '../../src/alerts/webhooks.mapper';
import { testDb } from '../helpers/test-db';

describe('Rating drop threshold against an upgraded baseline database', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = testDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('leaves an existing webhook without a threshold and answers one tenth', async () => {
    const webhook = await prisma.webhook.findUniqueOrThrow({
      where: { id: 'wh_ops' },
    });

    expect(webhook.ratingDropTenths).toBeNull();
    expect(toWebhookItem(webhook).ratingDropTenths).toBe(1);
  });

  it('leaves an existing email alert without a threshold and answers one tenth', async () => {
    const alert = await prisma.emailAlert.findUniqueOrThrow({
      where: { id: 'mail_ops' },
    });

    expect(alert.ratingDropTenths).toBeNull();
    expect(toEmailAlertItem(alert).ratingDropTenths).toBe(1);
  });
});
