import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Stripe from 'stripe';
import {
  BILLING_INTERVALS,
  PAID_PLAN_NAMES,
  PLANS,
  type BillingInterval,
  type BillingPrice,
  type PaidPlanName,
} from '@asobeast/shared';
import { Env } from '../config/env';
import { reasonOf } from './stripe-errors';
import { StripeService } from './stripe.service';

export class UnknownPriceError extends Error {
  constructor(readonly priceId: string) {
    super(
      `Stripe price ${priceId} is not in the price catalog. Give it a catalog lookup key or name it in STRIPE_PRICE_*, or the subscription cannot be provisioned.`,
    );
    this.name = 'UnknownPriceError';
  }
}

export const CATALOG_RETRY_MS = 60_000;

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

interface CatalogSlot {
  plan: PaidPlanName;
  interval: BillingInterval;
}

const SLOTS: CatalogSlot[] = PAID_PLAN_NAMES.flatMap((plan) =>
  BILLING_INTERVALS.map((interval) => ({ plan, interval })),
);

export function lookupKeyOf(
  plan: PaidPlanName,
  interval: BillingInterval,
): string {
  return `asobeast_${plan}_${interval}`;
}

const SLOT_BY_LOOKUP_KEY = new Map(
  SLOTS.map((slot) => [lookupKeyOf(slot.plan, slot.interval), slot]),
);

export const ALL_LOOKUP_KEYS = [...SLOT_BY_LOOKUP_KEY.keys()];

export function amountFor(
  plan: PaidPlanName,
  interval: BillingInterval,
): number {
  const { monthlyUsd, annualUsd } = PLANS[plan].prices;
  return (interval === 'month' ? monthlyUsd : annualUsd) ?? 0;
}

function billingPrice(slot: CatalogSlot, priceId: string): BillingPrice {
  return {
    plan: slot.plan,
    interval: slot.interval,
    priceId,
    amountUsd: amountFor(slot.plan, slot.interval),
  };
}

@Injectable()
export class PriceCatalog implements OnModuleInit {
  private readonly logger = new Logger(PriceCatalog.name);
  private byPriceId = new Map<string, BillingPrice>();
  private readonly fromEnvironment: boolean;
  private attemptedAt: number | null = null;
  private inFlight: Promise<void> | null = null;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly stripe: StripeService,
  ) {
    this.fromEnvironment = this.readEnvironment();
  }

  onModuleInit(): void {
    void this.refresh();
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

  planOf(subscription: Stripe.Subscription): PaidPlanName {
    return this.require(subscription.items.data[0]?.price.id ?? '').plan;
  }

  refresh(): Promise<void> {
    if (this.fromEnvironment || !this.stripe.enabled) return Promise.resolve();
    this.inFlight ??= this.resolve().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  async refreshIfStale(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    if (this.configured) return;
    const since =
      this.attemptedAt === null ? null : Date.now() - this.attemptedAt;
    if (since !== null && since < CATALOG_RETRY_MS) return;
    await this.refresh();
  }

  private async resolve(): Promise<void> {
    this.attemptedAt = Date.now();
    try {
      const resolved = new Map<string, BillingPrice>();
      for (const price of await this.stripe.listPrices(ALL_LOOKUP_KEYS)) {
        const slot = SLOT_BY_LOOKUP_KEY.get(price.lookup_key ?? '');
        if (slot) resolved.set(price.id, billingPrice(slot, price.id));
      }
      if (resolved.size === 0) {
        this.logger.warn(
          `price catalog found no stripe price with the lookup keys ${ALL_LOOKUP_KEYS.join(', ')}; run pnpm --filter api stripe:catalog`,
        );
        return;
      }
      this.byPriceId = resolved;
      this.logger.log(
        `price catalog resolved ${resolved.size} prices from stripe lookup keys`,
      );
    } catch (error) {
      this.logger.error(
        `price catalog could not be resolved from stripe: ${reasonOf(error)}`,
      );
    }
  }

  private readEnvironment(): boolean {
    for (const slot of SLOTS) {
      const priceId = this.config.get(PRICE_KEYS[slot.plan][slot.interval], {
        infer: true,
      });
      if (priceId) this.byPriceId.set(priceId, billingPrice(slot, priceId));
    }
    return this.byPriceId.size > 0;
  }
}
