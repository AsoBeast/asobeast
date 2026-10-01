import './helpers/enable-billing';
import './helpers/enable-stripe';
import './helpers/enable-managed-payments';
import type { BillingCatalog, BillingSession } from '@asobeast/shared';
import { WORKSPACE_METADATA_KEY } from '../src/billing/workspace-link';
import {
  resetBillingState,
  startBillingHarness,
  stopBillingHarness,
  WORKSPACE,
  type BillingHarness,
} from './helpers/billing-harness';

describe('Billing through managed payments (e2e)', () => {
  jest.setTimeout(30_000);

  let harness: BillingHarness;

  beforeAll(async () => {
    harness = await startBillingHarness();
  }, 60_000);

  beforeEach(() => resetBillingState(harness));

  afterAll(() => stopBillingHarness(harness));

  it('opens a checkout stripe sells as the merchant of record', async () => {
    const response = await harness.owner
      .post('/billing/checkout')
      .send({ priceId: 'price_TestIndieMonthly' })
      .expect(200);

    const [recorded] = harness.fake.checkoutSessions;
    expect((response.body as BillingSession).url).toMatch(
      /^https:\/\/checkout\.stripe\.test\//,
    );
    expect(recorded.params).toMatchObject({
      mode: 'subscription',
      client_reference_id: WORKSPACE,
      managed_payments: { enabled: true },
      subscription_data: { metadata: { [WORKSPACE_METADATA_KEY]: WORKSPACE } },
    });
    expect(recorded.params).not.toHaveProperty('automatic_tax');
    expect(recorded.params).not.toHaveProperty('tax_id_collection');
    expect(recorded.params).not.toHaveProperty('customer_update');
  });

  it('tells the paywall that stripe sells the plan', async () => {
    const response = await harness.owner.get('/billing/catalog').expect(200);

    expect((response.body as BillingCatalog).managedPayments).toBe(true);
  });
});
