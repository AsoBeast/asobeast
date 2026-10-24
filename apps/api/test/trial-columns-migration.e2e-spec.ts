import { execSync } from 'child_process';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { migrationSql } from './helpers/migration-sql';
import { testDb } from './helpers/test-db';

const DAY = 24 * 60 * 60 * 1000;

describe('the record trial claims, first payment and interval migration', () => {
  const sql = migrationSql('record_trial_claims_first_payment_and_interval');
  const repairs = sql.slice(sql.indexOf('UPDATE'));
  let prisma: PrismaClient;

  beforeAll(() => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });
    prisma = testDb();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "Workspace" WHERE "id" LIKE 'ws_migration_%'`,
    );
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "Workspace" WHERE "id" LIKE 'ws_migration_%'`,
    );
    await prisma.$disconnect();
  });

  const seed = (id: string, data: Record<string, unknown>) =>
    prisma.workspace.create({
      data: { id: `ws_migration_${id}`, name: id, ...data },
    });

  const read = (id: string) =>
    prisma.workspace.findUniqueOrThrow({ where: { id: `ws_migration_${id}` } });

  it('marks paying, legacy and ended trials so the card trial reads them right', async () => {
    const now = Date.now();
    const started = new Date(now - 2 * DAY);
    const eventAt = new Date('2026-09-01T00:00:00.000Z');
    await seed('paying', {
      subscriptionStatus: 'active',
      subscriptionEventAt: eventAt,
    });
    await seed('dunning', {
      subscriptionStatus: 'past_due',
      subscriptionEventAt: null,
    });
    await seed('trialing', { subscriptionStatus: 'trialing' });
    await seed('running', {
      trialStartedAt: started,
      trialEndsAt: new Date(now + 5 * DAY),
      subscriptionId: null,
      trialNoticeDay: 0,
    });
    await seed('bought', {
      trialStartedAt: started,
      trialEndsAt: new Date(now + 5 * DAY),
      subscriptionId: 'sub_migration_bought',
      trialNoticeDay: 3,
    });
    await seed('ended', {
      trialStartedAt: new Date(now - 8 * DAY),
      trialEndsAt: new Date(now - DAY),
      trialNoticeDay: null,
    });

    await prisma.$executeRawUnsafe(repairs);

    expect((await read('paying')).firstPaidAt).toEqual(eventAt);
    const dunning = (await read('dunning')).firstPaidAt;
    expect(Math.abs((dunning?.getTime() ?? 0) - now)).toBeLessThan(60_000);
    expect((await read('trialing')).firstPaidAt).toBeNull();
    const running = await read('running');
    expect(running.trialClaimedAt).toEqual(started);
    expect(running.trialNoticeDay).toBe(0);
    const bought = await read('bought');
    expect(bought.trialClaimedAt).toEqual(started);
    expect(bought.trialNoticeDay).toBe(8);
    expect((await read('ended')).trialNoticeDay).toBe(8);
  });
});
