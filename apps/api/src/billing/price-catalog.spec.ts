import { ConfigService } from '@nestjs/config';
import type Stripe from 'stripe';
import { PLANS } from '@asobeast/shared';
import { Env } from '../config/env';
import {
  PriceCatalog,
  UnknownPriceError,
  amountFor,
  lookupKeyOf,
} from './price-catalog';
import { StripeService } from './stripe.service';

const CONFIGURED = {
  STRIPE_PRICE_INDIE_MONTHLY: 'price_indie_month',
  STRIPE_PRICE_INDIE_YEARLY: 'price_indie_year',
  STRIPE_PRICE_ULTIMATE_MONTHLY: 'price_ultimate_month',
  STRIPE_PRICE_ULTIMATE_YEARLY: 'price_ultimate_year',
};

const LOOKUP_KEYS = [
  'asobeast_indie_month',
  'asobeast_indie_year',
  'asobeast_ultimate_month',
  'asobeast_ultimate_year',
];

const configOf = (values: Record<string, string | undefined>) =>
  ({
    get: (key: string) => values[key],
  }) as unknown as ConfigService<Env, true>;

const LIST_PRICE_CENTS: Record<string, number> = {
  asobeast_indie_month: 1_000,
  asobeast_indie_year: 10_000,
  asobeast_ultimate_month: 9_900,
  asobeast_ultimate_year: 99_000,
};

const price = (
  id: string,
  lookupKey: string | null,
  over: Partial<Stripe.Price> = {},
): Stripe.Price =>
  ({
    id,
    lookup_key: lookupKey,
    active: true,
    currency: 'usd',
    unit_amount: LIST_PRICE_CENTS[lookupKey ?? ''] ?? null,
    recurring: { interval: lookupKey?.endsWith('_year') ? 'year' : 'month' },
    ...over,
  }) as Stripe.Price;

const stripeDouble = (enabled = true) => ({
  enabled,
  listPrices: jest.fn<Promise<Stripe.Price[]>, [string[]]>(),
});

const catalogWith = (
  values: Record<string, string | undefined>,
  stripe = stripeDouble(false),
) => new PriceCatalog(configOf(values), stripe as unknown as StripeService);

describe('PriceCatalog', () => {
  it('maps every configured price onto its plan and interval', () => {
    const catalog = catalogWith(CONFIGURED);

    expect(catalog.require('price_indie_month')).toEqual({
      plan: 'indie',
      interval: 'month',
      priceId: 'price_indie_month',
      amountUsd: PLANS.indie.prices.monthlyUsd,
    });
    expect(catalog.require('price_ultimate_year')).toEqual({
      plan: 'ultimate',
      interval: 'year',
      priceId: 'price_ultimate_year',
      amountUsd: PLANS.ultimate.prices.annualUsd,
    });
  });

  it('fails loudly on a price it was never told about', () => {
    const catalog = catalogWith(CONFIGURED);

    expect(() => catalog.require('price_unknown')).toThrow(UnknownPriceError);
    expect(catalog.find('price_unknown')).toBeNull();
  });

  it('reports itself unconfigured when no price id is set', () => {
    const catalog = catalogWith({});

    expect(catalog.configured).toBe(false);
    expect(catalog.prices).toEqual([]);
  });

  it('offers only the prices that are configured', () => {
    const catalog = catalogWith({
      STRIPE_PRICE_INDIE_MONTHLY: 'price_indie_month',
    });

    expect(catalog.configured).toBe(true);
    expect(catalog.prices).toEqual([
      {
        plan: 'indie',
        interval: 'month',
        priceId: 'price_indie_month',
        amountUsd: PLANS.indie.prices.monthlyUsd,
      },
    ]);
  });

  it('prices each interval from the plan definitions', () => {
    expect(amountFor('indie', 'month')).toBe(PLANS.indie.prices.monthlyUsd);
    expect(amountFor('ultimate', 'year')).toBe(PLANS.ultimate.prices.annualUsd);
  });
});

describe('PriceCatalog from stripe lookup keys', () => {
  const everyPrice = [
    price('price_im', 'asobeast_indie_month'),
    price('price_iy', 'asobeast_indie_year'),
    price('price_um', 'asobeast_ultimate_month'),
    price('price_uy', 'asobeast_ultimate_year'),
  ];

  it('resolves the four prices from their lookup keys', async () => {
    const stripe = stripeDouble();
    stripe.listPrices.mockResolvedValue(everyPrice);
    const catalog = catalogWith({}, stripe);

    await catalog.refresh();

    expect(stripe.listPrices).toHaveBeenCalledWith(LOOKUP_KEYS);
    expect(catalog.find('price_um')).toEqual({
      plan: 'ultimate',
      interval: 'month',
      priceId: 'price_um',
      amountUsd: PLANS.ultimate.prices.monthlyUsd,
    });
    expect(catalog.prices).toHaveLength(4);
    expect(catalog.configured).toBe(true);
  });

  it('ignores a price whose lookup key it does not know', async () => {
    const stripe = stripeDouble();
    stripe.listPrices.mockResolvedValue([
      price('price_im', 'asobeast_indie_month'),
      price('price_week', 'asobeast_indie_week'),
      price('price_bare', null),
    ]);
    const catalog = catalogWith({}, stripe);

    await catalog.refresh();

    expect(catalog.prices.map((known) => known.priceId)).toEqual(['price_im']);
  });

  it('ignores a lookup key on a price that disagrees with its plan', async () => {
    const stripe = stripeDouble();
    stripe.listPrices.mockResolvedValue([
      price('price_im', 'asobeast_indie_month'),
      price('price_cheap', 'asobeast_ultimate_month', { unit_amount: 100 }),
      price('price_eur', 'asobeast_indie_year', { currency: 'eur' }),
      price('price_weekly', 'asobeast_ultimate_year', {
        recurring: { interval: 'week' } as Stripe.Price.Recurring,
      }),
    ]);
    const catalog = catalogWith({}, stripe);

    await catalog.refresh();

    expect(catalog.prices.map((known) => known.priceId)).toEqual(['price_im']);
  });

  it('never asks stripe when the environment names the prices', async () => {
    const stripe = stripeDouble();
    const catalog = catalogWith(CONFIGURED, stripe);

    await catalog.refresh();
    await catalog.refreshIfStale();

    expect(stripe.listPrices).not.toHaveBeenCalled();
    expect(catalog.find('price_indie_month')?.plan).toBe('indie');
  });

  it('never asks stripe when billing is not configured', async () => {
    const stripe = stripeDouble(false);
    const catalog = catalogWith({}, stripe);

    await catalog.refresh();

    expect(stripe.listPrices).not.toHaveBeenCalled();
    expect(catalog.configured).toBe(false);
  });

  it('stays empty when stripe cannot answer and fills on the next refresh', async () => {
    const stripe = stripeDouble();
    stripe.listPrices.mockRejectedValueOnce(new Error('stripe is down'));
    stripe.listPrices.mockResolvedValueOnce(everyPrice);
    const catalog = catalogWith({}, stripe);

    await catalog.refresh();
    expect(catalog.configured).toBe(false);

    await catalog.refresh();
    expect(catalog.configured).toBe(true);
  });

  it('keeps what it resolved when a later refresh finds nothing', async () => {
    const stripe = stripeDouble();
    stripe.listPrices.mockResolvedValueOnce(everyPrice);
    stripe.listPrices.mockResolvedValueOnce([]);
    const catalog = catalogWith({}, stripe);

    await catalog.refresh();
    await catalog.refresh();

    expect(catalog.prices).toHaveLength(4);
  });

  it('retries an empty catalog at most once a minute', async () => {
    const stripe = stripeDouble();
    stripe.listPrices.mockRejectedValue(new Error('stripe is down'));
    const catalog = catalogWith({}, stripe);

    await catalog.refreshIfStale();
    await catalog.refreshIfStale();

    expect(stripe.listPrices).toHaveBeenCalledTimes(1);
  });

  it('shares its lookup key format with the catalog script', () => {
    expect(lookupKeyOf('indie', 'month')).toBe('asobeast_indie_month');
  });
});

describe('PriceCatalog naming the plan of a subscription', () => {
  const subscribedTo = (price: Partial<Stripe.Price>) =>
    ({
      items: { data: [{ price }] },
    }) as unknown as Stripe.Subscription;

  it('names a catalogued price by its id', () => {
    expect(
      catalogWith(CONFIGURED).planOf(
        subscribedTo({ id: 'price_ultimate_month' }),
      ),
    ).toBe('ultimate');
  });

  it('names a retired price from the plan its metadata carries', () => {
    const catalog = catalogWith(CONFIGURED);

    expect(
      catalog.planOf(
        subscribedTo({
          id: 'price_old',
          metadata: { asobeast_plan: 'ultimate' },
        }),
      ),
    ).toBe('ultimate');
  });

  it('refuses a price that names no paid plan anywhere', () => {
    const catalog = catalogWith(CONFIGURED);

    expect(() =>
      catalog.planOf(
        subscribedTo({
          id: 'price_stray',
          metadata: { asobeast_plan: 'free' },
        }),
      ),
    ).toThrow(UnknownPriceError);
    expect(() => catalog.planOf(subscribedTo({ id: 'price_bare' }))).toThrow(
      UnknownPriceError,
    );
  });
});
