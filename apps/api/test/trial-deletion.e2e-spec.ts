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
import type Stripe from 'stripe';

const CUSTOMER = 'cus_test_trial';

describe('Deleting a workspace that holds a subscription (e2e)', () => {
  let harness: BillingHarness;

  const holdSubscription = async (
    subscriptionStatus: Stripe.Subscription.Status,
    over: Partial<Stripe.Subscription> = {},
  ) => {
    await resetBillingState(harness, {
      plan: 'indie',
      planExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      billingCustomerId: CUSTOMER,
      subscriptionId: 'sub_trial',
      subscriptionStatus,
    });
    harness.fake.subscriptionStore.set(
      'sub_trial',
      trialingSubscription({
        id: 'sub_trial',
        customer: CUSTOMER,
        status: subscriptionStatus,
        ...over,
      }),
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

    expect(harness.fake.subscriptionUpdates).toHaveLength(1);
    const [update] = harness.fake.subscriptionUpdates;
    expect(update.params).toEqual({
      id: 'sub_trial',
      cancel_at_period_end: true,
    });
    expect(update.idempotencyKey).toMatch(/^cancel-at-end:sub_trial:\d+$/);
    const status = await harness.owner.get('/account/deletion').expect(200);
    expect((status.body as WorkspaceDeletionStatus).scheduled).toBe(true);
  });

  it('renews again when the deletion is cancelled', async () => {
    await holdSubscription('trialing');
    await harness.owner
      .post('/account/deletion')
      .send({ confirm: 'DELETE' })
      .expect(201);
    harness.fake.subscriptionUpdates.length = 0;

    await harness.owner.delete('/account/deletion').expect(200);

    expect(harness.fake.subscriptionUpdates).toHaveLength(1);
    const [update] = harness.fake.subscriptionUpdates;
    expect(update.params).toEqual({
      id: 'sub_trial',
      cancel_at_period_end: false,
    });
    expect(update.idempotencyKey).toMatch(/^keep-renewing:sub_trial:\d+$/);
  });

  it('cancels the trial again when a deletion is scheduled after one was cancelled', async () => {
    await holdSubscription('trialing');
    await harness.owner
      .post('/account/deletion')
      .send({ confirm: 'DELETE' })
      .expect(201);
    await harness.owner.delete('/account/deletion').expect(200);

    await harness.owner
      .post('/account/deletion')
      .send({ confirm: 'DELETE' })
      .expect(201);

    const keys = harness.fake.subscriptionUpdates.map(
      ({ idempotencyKey }) => idempotencyKey,
    );
    expect(keys).toHaveLength(3);
    expect(new Set(keys).size).toBe(3);
  });

  it('stops a paying subscription renewing and restores it when asked', async () => {
    await holdSubscription('active');

    await harness.owner
      .post('/account/deletion')
      .send({ confirm: 'DELETE' })
      .expect(201);

    expect(
      harness.fake.subscriptionUpdates.map(({ params }) => params),
    ).toEqual([{ id: 'sub_trial', cancel_at_period_end: true }]);

    await harness.owner.delete('/account/deletion').expect(200);

    expect(
      harness.fake.subscriptionStore.get('sub_trial')?.cancel_at_period_end,
    ).toBe(false);
  });

  it('never restarts a subscription the owner had already cancelled', async () => {
    await holdSubscription('active', { cancel_at_period_end: true });
    await harness.owner
      .post('/account/deletion')
      .send({ confirm: 'DELETE' })
      .expect(201);

    await harness.owner.delete('/account/deletion').expect(200);

    expect(harness.fake.subscriptionUpdates).toEqual([]);
    expect(
      harness.fake.subscriptionStore.get('sub_trial')?.cancel_at_period_end,
    ).toBe(true);
  });

  it('releases a scheduled plan change before it stops the renewal', async () => {
    await holdSubscription('active', {
      schedule: 'sub_sched_TestDowngrade',
    });
    harness.fake.schedules.set('sub_sched_TestDowngrade', {
      id: 'sub_sched_TestDowngrade',
    } as Stripe.SubscriptionSchedule);

    await harness.owner
      .post('/account/deletion')
      .send({ confirm: 'DELETE' })
      .expect(201);

    expect(harness.fake.releasedSchedules).toEqual(['sub_sched_TestDowngrade']);
    expect(harness.fake.subscriptionUpdates).toHaveLength(1);
  });
});
