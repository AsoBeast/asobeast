import { ConfigService } from '@nestjs/config';
import { PLANS } from '@asobeast/shared';
import { Env } from '../config/env';
import { PriceCatalog, UnknownPriceError, amountFor } from './price-catalog';

const CONFIGURED = {
  STRIPE_PRICE_INDIE_MONTHLY: 'price_indie_month',
  STRIPE_PRICE_INDIE_YEARLY: 'price_indie_year',
  STRIPE_PRICE_ULTIMATE_MONTHLY: 'price_ultimate_month',
  STRIPE_PRICE_ULTIMATE_YEARLY: 'price_ultimate_year',
};

const catalogWith = (values: Record<string, string | undefined>) =>
  new PriceCatalog({
    get: (key: string) => values[key],
  } as unknown as ConfigService<Env, true>);

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
