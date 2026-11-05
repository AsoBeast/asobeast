import './helpers/enable-billing';
import {
  resetBillingState,
  startBillingHarness,
  stopBillingHarness,
  WORKSPACE,
  type BillingHarness,
} from './helpers/billing-harness';

describe('Workspace checklist without a plan (e2e)', () => {
  let harness: BillingHarness;

  beforeAll(async () => {
    harness = await startBillingHarness(false);
  }, 60_000);

  afterAll(() => stopBillingHarness(harness));

  it('answers 402 to the update when no plan is in force and still reads', async () => {
    await resetBillingState(harness, {
      plan: 'free',
      trialEndsAt: new Date(Date.now() - 1_000),
    });
    await harness.prisma.workspace.update({
      where: { id: WORKSPACE },
      data: { checklistDismissedAt: null },
    });

    await harness.owner
      .patch('/workspace/checklist')
      .send({ dismissed: true })
      .expect(402);
    await harness.owner.get('/workspace/checklist').expect(200);
    await expect(
      harness.prisma.workspace.findUniqueOrThrow({
        where: { id: WORKSPACE },
        select: { checklistDismissedAt: true },
      }),
    ).resolves.toEqual({ checklistDismissedAt: null });
  });
});
