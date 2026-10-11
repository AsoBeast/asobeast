import { PrismaClient } from '@prisma/client';
import { testDb } from '../helpers/test-db';

describe('Email alert confirmation against an upgraded baseline database', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = testDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('counts an alert that existed before the rule as confirmed', async () => {
    const alert = await prisma.emailAlert.findUniqueOrThrow({
      where: { id: 'mail_ops' },
    });

    expect(alert.confirmedAt).toEqual(alert.createdAt);
    expect(alert.confirmationSentAt).toBeNull();
  });

  it('leaves a paused alert waiting for its recipient to confirm again', async () => {
    const alert = await prisma.emailAlert.findUniqueOrThrow({
      where: { id: 'mail_paused' },
    });

    expect(alert.active).toBe(false);
    expect(alert.confirmedAt).toBeNull();
  });
});
