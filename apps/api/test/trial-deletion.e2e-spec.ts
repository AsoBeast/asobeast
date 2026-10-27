import './helpers/enable-billing';
import './helpers/enable-stripe';
import type { WorkspaceDeletionStatus } from '@asobeast/shared';
import {
  resetBillingState,
  startBillingHarness,
  stopBillingHarness,
  type BillingHarness,
} from './helpers/billing-harness';
import { trialingSubscription } from './helpers/fake-stripe';

const CUSTOMER = 'cus_test_trial';

describe('Deleting a workspace during its trial (e2e)', () => {
  let harness: BillingHarness;

  const holdSubscription = async (subscriptionStatus: string) => {
    await resetBillingState(harness, {
      plan: 'indie',
      planExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      billingCustomerId: CUSTOMER,
      subscriptionId: 'sub_trial',
      subscriptionStatus,
    });
    harness.fake.subscriptionStore.set(
      'sub_trial',
      trialingSubscription({ id: 'sub_trial', customer: CUSTOMER }),
    );
  };

  beforeAll(async () => {
    harness = await startBillingHarness();
  }, 60_000);

  afterEach(() => harness.owner.delete('/account/deletion'));

  afterAll(() => stopBillingHarness(harness));

  it('cancels the trial at its end when the deletion is scheduled', async () => {
    await holdSubscription('trialing');

    await harness.owner
      .post('/account/deletion')
      .send({ confirm: 'DELETE' })
      .expect(201);

    expect(harness.fake.subscriptionUpdates).toEqual([
      {
        params: { id: 'sub_trial', cancel_at_period_end: true },
        idempotencyKey: 'cancel-at-end:sub_trial',
      },
    ]);
    const status = await harness.owner.get('/account/deletion').expect(200);
    expect((status.body as WorkspaceDeletionStatus).scheduled).toBe(true);
  });

  it('asks stripe nothing when the schedule is cancelled', async () => {
    await holdSubscription('trialing');
    await harness.owner
      .post('/account/deletion')
      .send({ confirm: 'DELETE' })
      .expect(201);
    harness.fake.subscriptionUpdates.length = 0;

    await harness.owner.delete('/account/deletion').expect(200);

    expect(harness.fake.subscriptionUpdates).toEqual([]);
  });

  it('leaves a paying subscription alone', async () => {
    await holdSubscription('active');

    await harness.owner
      .post('/account/deletion')
      .send({ confirm: 'DELETE' })
      .expect(201);

    expect(harness.fake.subscriptionUpdates).toEqual([]);
  });
});
