import './helpers/enable-billing';
import './helpers/enable-stripe-lookup-keys';
import type { BillingCatalog } from '@asobeast/shared';
import {
  resetBillingState,
  startBillingHarness,
  stopBillingHarness,
  type BillingHarness,
} from './helpers/billing-harness';
import { catalogPrice } from './helpers/fake-stripe';

const CATALOG = [
  catalogPrice('price_lookup_im', 'asobeast_indie_month', 1_000, 'month'),
  catalogPrice('price_lookup_iy', 'asobeast_indie_year', 10_000, 'year'),
  catalogPrice('price_lookup_um', 'asobeast_ultimate_month', 9_900, 'month'),
  catalogPrice('price_lookup_uy', 'asobeast_ultimate_year', 99_000, 'year'),
];

const ARCHIVED = {
  ...catalogPrice('price_archived', 'asobeast_indie_month', 1_000, 'month'),
  active: false,
};

describe('Billing catalog from stripe lookup keys (e2e)', () => {
  let harness: BillingHarness;

  const seed = (fake: BillingHarness['fake']) => {
    for (const price of CATALOG) fake.priceStore.set(price.id, price);
    fake.priceStore.set(ARCHIVED.id, ARCHIVED);
  };

  beforeAll(async () => {
    harness = await startBillingHarness(true, seed);
  }, 60_000);

  beforeEach(async () => {
    await resetBillingState(harness);
    seed(harness.fake);
  });

  afterAll(() => stopBillingHarness(harness));

  it('sells the four prices stripe holds under the lookup keys', async () => {
    const response = await harness.owner.get('/billing/catalog').expect(200);

    const catalog = response.body as BillingCatalog;
    expect(catalog.enabled).toBe(true);
    expect(catalog.prices.map((price) => price.priceId).sort()).toEqual(
      CATALOG.map((price) => price.id).sort(),
    );
  });

  it('opens a checkout for a price resolved by its lookup key', async () => {
    await harness.owner
      .post('/billing/checkout')
      .send({ priceId: 'price_lookup_um' })
      .expect(200);

    expect(harness.fake.checkoutSessions[0].params.line_items).toEqual([
      { price: 'price_lookup_um', quantity: 1 },
    ]);
  });

  it('never sells an archived price that still carries a lookup key', async () => {
    await harness.owner
      .post('/billing/checkout')
      .send({ priceId: 'price_archived' })
      .expect(400);
  });
});
