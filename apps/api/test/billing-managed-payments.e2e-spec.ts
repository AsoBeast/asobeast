import './helpers/enable-billing';
import './helpers/enable-stripe';
import './helpers/enable-managed-payments';
import {
  CHECKOUT_BRAND,
  type BillingCatalog,
  type BillingSession,
} from '@asobeast/shared';
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

  it('asks for the trial under managed payments without a removed key', async () => {
    await resetBillingState(harness, { trialEndsAt: null });

    await harness.owner
      .post('/billing/checkout')
      .send({ priceId: 'price_TestIndieMonthly' })
      .expect(200);

    const [recorded] = harness.fake.checkoutSessions;
    expect(recorded.params).toMatchObject({
      managed_payments: { enabled: true },
      payment_method_collection: 'always',
      subscription_data: {
        trial_period_days: 7,
        trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
      },
    });
    for (const key of [
      'automatic_tax',
      'tax_id_collection',
      'customer_update',
      'custom_text',
    ]) {
      expect(recorded.params).not.toHaveProperty(key);
    }
  });

  it('opens an embedded managed session without a removed key', async () => {
    await harness.owner
      .post('/billing/checkout')
      .send({ priceId: 'price_TestIndieMonthly', ui: 'embedded' })
      .expect(200);

    const [recorded] = harness.fake.checkoutSessions;
    expect(recorded.params).toMatchObject({
      ui_mode: 'embedded_page',
      managed_payments: { enabled: true },
    });
    for (const key of [
      'automatic_tax',
      'tax_id_collection',
      'customer_update',
    ]) {
      expect(recorded.params).not.toHaveProperty(key);
    }
  });

  it('brands a managed session after the page and still sends no submit text', async () => {
    await harness.owner
      .post('/billing/checkout')
      .send({
        priceId: 'price_TestIndieMonthly',
        ui: 'embedded',
        theme: 'dark',
      })
      .expect(200);

    const [recorded] = harness.fake.checkoutSessions;
    expect(recorded.params).toMatchObject({
      managed_payments: { enabled: true },
      locale: 'en',
      branding_settings: {
        background_color: CHECKOUT_BRAND.dark.backgroundColor,
        button_color: CHECKOUT_BRAND.dark.buttonColor,
        border_style: 'rounded',
        font_family: 'inter',
        display_name: 'AsoBeast',
      },
    });
    expect(recorded.params).not.toHaveProperty('custom_text');
  });

  it('tells the paywall that stripe sells the plan', async () => {
    const response = await harness.owner.get('/billing/catalog').expect(200);

    expect((response.body as BillingCatalog).managedPayments).toBe(true);
  });
});
