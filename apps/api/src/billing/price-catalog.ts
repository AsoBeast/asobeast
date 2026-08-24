import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PAID_PLAN_NAMES,
  PLANS,
  type BillingInterval,
  type BillingPrice,
  type PaidPlanName,
} from '@asobeast/shared';
import { Env } from '../config/env';

export class UnknownPriceError extends Error {
  constructor(readonly priceId: string) {
    super(
      `Stripe price ${priceId} is not in the configured catalog. Add it to STRIPE_PRICE_* or the subscription cannot be provisioned.`,
    );
    this.name = 'UnknownPriceError';
  }
}

const PRICE_KEYS = {
  indie: {
    month: 'STRIPE_PRICE_INDIE_MONTHLY',
    year: 'STRIPE_PRICE_INDIE_YEARLY',
  },
  ultimate: {
    month: 'STRIPE_PRICE_ULTIMATE_MONTHLY',
    year: 'STRIPE_PRICE_ULTIMATE_YEARLY',
  },
} as const satisfies Record<PaidPlanName, Record<BillingInterval, keyof Env>>;

export function amountFor(
  plan: PaidPlanName,
  interval: BillingInterval,
): number {
  const { monthlyUsd, annualUsd } = PLANS[plan].prices;
  return (interval === 'month' ? monthlyUsd : annualUsd) ?? 0;
}

@Injectable()
export class PriceCatalog {
  private readonly byPriceId = new Map<string, BillingPrice>();

  constructor(private readonly config: ConfigService<Env, true>) {
    for (const plan of PAID_PLAN_NAMES) {
      for (const interval of ['month', 'year'] as const) {
        const priceId = this.config.get(PRICE_KEYS[plan][interval], {
          infer: true,
        });
        if (!priceId) continue;
        this.byPriceId.set(priceId, {
          plan,
          interval,
          priceId,
          amountUsd: amountFor(plan, interval),
        });
      }
    }
  }

  get prices(): BillingPrice[] {
    return [...this.byPriceId.values()];
  }

  get configured(): boolean {
    return this.byPriceId.size > 0;
  }

  find(priceId: string): BillingPrice | null {
    return this.byPriceId.get(priceId) ?? null;
  }

  require(priceId: string): BillingPrice {
    const price = this.find(priceId);
    if (!price) throw new UnknownPriceError(priceId);
    return price;
  }
}
