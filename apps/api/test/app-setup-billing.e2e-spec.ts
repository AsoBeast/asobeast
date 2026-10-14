import './helpers/enable-billing';
import { Store } from '@prisma/client';
import {
  resetBillingState,
  startBillingHarness,
  stopBillingHarness,
  WORKSPACE,
  type BillingHarness,
} from './helpers/billing-harness';

describe('App setup without a plan (e2e)', () => {
  let harness: BillingHarness;
  let appId: string;

  beforeAll(async () => {
    harness = await startBillingHarness(false);
  }, 60_000);

  beforeEach(async () => {
    await harness.prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
    appId = (
      await harness.prisma.app.create({
        data: {
          workspaceId: WORKSPACE,
          store: Store.APP_STORE,
          storeAppId: 'setup-billing',
          country: 'us',
        },
        select: { id: true },
      })
    ).id;
  });

  afterAll(() => stopBillingHarness(harness));

  it('answers 402 to the update when no plan is in force and still reads', async () => {
    await resetBillingState(harness, {
      plan: 'free',
      trialEndsAt: new Date(Date.now() - 1_000),
    });

    await harness.owner
      .patch(`/apps/${appId}/setup`)
      .send({ status: 'dismissed' })
      .expect(402);
    await harness.owner.get(`/apps/${appId}/setup`).expect(200);
    await expect(harness.prisma.appSetup.count()).resolves.toBe(0);
  });
});
