import './helpers/enable-billing';
import type { BillingCatalog, BillingReconcileReport } from '@asobeast/shared';
import {
  resetBillingState,
  startBillingHarness,
  stopBillingHarness,
  type BillingHarness,
} from './helpers/billing-harness';

describe('Billing on an instance with no stripe key (e2e)', () => {
  let harness: BillingHarness;

  beforeAll(async () => {
    harness = await startBillingHarness(false);
  }, 60_000);

  beforeEach(() => resetBillingState(harness));

  afterAll(() => stopBillingHarness(harness));

  it('refuses checkout and the portal as unavailable', async () => {
    await harness.owner
      .post('/billing/checkout')
      .send({ priceId: 'price_TestIndieMonthly' })
      .expect(503);
    await harness.owner.post('/billing/portal').expect(503);
  });

  it('reports the catalog as switched off', async () => {
    const catalog = await harness.owner.get('/billing/catalog').expect(200);

    expect((catalog.body as BillingCatalog).enabled).toBe(false);
  });

  it('reconciles a workspace with no billing state without stripe', async () => {
    const report = await harness.owner.post('/billing/reconcile').expect(200);

    expect(report.body as BillingReconcileReport).toEqual({
      checked: 1,
      corrected: 0,
      orphanSubscriptions: [],
      unreconciled: [],
    });
  });
});
