import './helpers/enable-billing';
import { Store } from '@prisma/client';
import type { AppRunStatus } from '@asobeast/shared';
import {
  resetBillingState,
  startBillingHarness,
  stopBillingHarness,
  WORKSPACE,
  type BillingHarness,
} from './helpers/billing-harness';

describe('App run status without a plan (e2e)', () => {
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
          storeAppId: 'run-status-billing',
          country: 'us',
        },
        select: { id: true },
      })
    ).id;
    await harness.prisma.app.create({
      data: {
        workspaceId: WORKSPACE,
        store: Store.APP_STORE,
        storeAppId: 'run-status-billing-rival',
        country: 'us',
        isCompetitor: true,
        primaryAppId: appId,
      },
    });
  });

  afterAll(() => stopBillingHarness(harness));

  const statusOf = async (): Promise<AppRunStatus> =>
    (await harness.owner.get(`/apps/${appId}/run-status`).expect(200))
      .body as AppRunStatus;

  it('reports a lapsed trial as paused and still answers', async () => {
    await resetBillingState(harness, {
      plan: 'free',
      trialEndsAt: new Date(Date.now() - 1_000),
    });

    const status = await statusOf();

    expect(status.paused).toBe(true);
    expect(status.stages.find((row) => row.stage === 'listings')).toMatchObject(
      { ready: 0, total: 2 },
    );
  });

  it('reports a trial in force as not paused', async () => {
    await resetBillingState(harness, {
      plan: 'free',
      trialEndsAt: new Date(Date.now() + 86_400_000),
    });

    expect((await statusOf()).paused).toBe(false);
  });
});
