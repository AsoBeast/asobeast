import './helpers/enable-billing';
import './helpers/enable-stripe';
import type { BillingSession } from '@asobeast/shared';
import { WORKSPACE_METADATA_KEY } from '../src/billing/workspace-link';
import {
  anonymously,
  asMember,
  resetBillingState,
  startBillingHarness,
  stopBillingHarness,
  workspaceRow,
  WORKSPACE,
  type BillingHarness,
} from './helpers/billing-harness';
import { OWNER } from './helpers/session';

const PORTAL = '/billing/portal';

describe('Billing portal (e2e)', () => {
  let harness: BillingHarness;

  const portal = () => harness.owner.post(PORTAL);

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

  it('creates and stores the customer of a workspace that has none yet', async () => {
    await portal().expect(200);

    const [customer] = harness.fake.createdCustomers;
    expect(customer.params).toEqual({
      email: OWNER.email,
      name: 'Default',
      metadata: { [WORKSPACE_METADATA_KEY]: WORKSPACE },
    });
    expect(harness.fake.portalSessions[0].params.customer).toBe('cus_test_1');
    await expect(workspaceRow(harness)).resolves.toMatchObject({
      billingCustomerId: 'cus_test_1',
    });
  });

  it('opens only for an owner, ten times a minute', async () => {
    await asMember(harness, PORTAL).expect(403);
    await anonymously(harness, PORTAL).expect(401);

    for (let attempt = 1; attempt <= 10; attempt += 1) {
      await portal().expect(200);
    }
    await portal().expect(429);
  });
});
