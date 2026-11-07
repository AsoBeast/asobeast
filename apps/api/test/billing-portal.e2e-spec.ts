import './helpers/enable-billing';
import './helpers/enable-stripe';
import type { ApiErrorEnvelope, BillingSession } from '@asobeast/shared';
import { NO_BILLING_ACCOUNT } from '../src/billing/billing.service';
import {
  anonymously,
  asMember,
  resetBillingState,
  startBillingHarness,
  stopBillingHarness,
  workspaceRow,
  type BillingHarness,
} from './helpers/billing-harness';

const PORTAL = '/billing/portal';

describe('Billing portal (e2e)', () => {
  let harness: BillingHarness;

  const portal = () => harness.owner.post(PORTAL);

  const expectRefused = async (storedCustomer: string | null) => {
    const response = await portal().expect(409);

    expect((response.body as ApiErrorEnvelope).message).toBe(
      NO_BILLING_ACCOUNT,
    );
    expect(harness.fake.createdCustomers).toHaveLength(0);
    expect(harness.fake.portalSessions).toHaveLength(0);
    await expect(workspaceRow(harness)).resolves.toMatchObject({
      billingCustomerId: storedCustomer,
    });
  };

  beforeAll(async () => {
    harness = await startBillingHarness();
  }, 60_000);

  beforeEach(() => resetBillingState(harness));

  afterAll(() => stopBillingHarness(harness));

  it('opens the portal for the stored customer and returns to settings', async () => {
    await resetBillingState(harness, { billingCustomerId: 'cus_test_stored' });

    const response = await portal().expect(200);

    const [recorded] = harness.fake.portalSessions;
    expect((response.body as BillingSession).url).toBe(
      'https://portal.stripe.test/1',
    );
    expect(harness.fake.createdCustomers).toHaveLength(0);
    expect(recorded.params).toEqual({
      customer: 'cus_test_stored',
      return_url: 'https://app.example.test/settings',
    });
    expect(recorded.idempotencyKey).toMatch(/^portal:[^:]+:\d+$/);
  });

  it('refuses a workspace with no billing account and creates no customer', async () => {
    await expectRefused(null);
  });

  it('opens only for an owner, ten times a minute', async () => {
    await resetBillingState(harness, { billingCustomerId: 'cus_test_stored' });
    await asMember(harness, PORTAL).expect(403);
    await anonymously(harness, PORTAL).expect(401);

    for (let attempt = 1; attempt <= 10; attempt += 1) {
      await portal().expect(200);
    }
    await portal().expect(429);
  });

  it('refuses a stored customer stripe no longer knows', async () => {
    await resetBillingState(harness, {
      billingCustomerId: 'cus_from_another_account',
    });
    harness.fake.unknownCustomers.add('cus_from_another_account');

    await expectRefused('cus_from_another_account');
  });

  it('refuses a stored customer that was deleted', async () => {
    await resetBillingState(harness, { billingCustomerId: 'cus_deleted' });
    harness.fake.deletedCustomers.push('cus_deleted');

    await expectRefused('cus_deleted');
  });
});
