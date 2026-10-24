import { readFileSync } from 'fs';
import { join } from 'path';
import Stripe from 'stripe';
import type { StripeApi } from '../../src/billing/stripe.client';
import { TEST_STRIPE_SECRET_KEY } from './enable-stripe';

export interface Recorded<T> {
  params: T;
  idempotencyKey: string | undefined;
}

export interface FakeStripe extends StripeApi {
  createdCustomers: Recorded<Stripe.CustomerCreateParams>[];
  deletedCustomers: string[];
  unknownCustomers: Set<string>;
  checkoutSessions: Recorded<Stripe.Checkout.SessionCreateParams>[];
  portalSessions: Recorded<Stripe.BillingPortal.SessionCreateParams>[];
  expired: string[];
  sessions: Map<string, Stripe.Checkout.Session>;
  subscriptionStore: Map<string, Stripe.Subscription>;
  subscriptionUpdates: Recorded<
    { id: string } & Stripe.SubscriptionUpdateParams
  >[];
  paymentMethodStore: Map<string, Stripe.PaymentMethod>;
  invoiceStore: Map<string, Stripe.Invoice>;
  priceStore: Map<string, Stripe.Price>;
  schedules: Map<string, Stripe.SubscriptionSchedule>;
  failNext: Error | null;
  nextSessionUrl: string | null | undefined;
  nextClientSecret: string | null | undefined;
  delayMs: number;
  reset(): void;
}

class MissingResource extends Error {
  readonly code = 'resource_missing';
  readonly statusCode = 404;

  constructor(kind: string, id: string) {
    super(`No such ${kind}: '${id}'`);
  }
}

const REFUSED_UNDER_MANAGED_PAYMENTS = [
  'automatic_tax',
  'tax_id_collection',
  'customer_update',
  'custom_text',
] as const;

function refuseUnderManagedPayments(
  params: Stripe.Checkout.SessionCreateParams,
): void {
  if (!params.managed_payments?.enabled) return;
  const refused = REFUSED_UNDER_MANAGED_PAYMENTS.find((key) => key in params);
  if (!refused) return;
  throw new Stripe.errors.StripeInvalidRequestError({
    type: 'invalid_request_error',
    message: `You cannot use ${refused} with Managed Payments.`,
  });
}

function respond<T>(value: T): Promise<Stripe.Response<T>> {
  return Promise.resolve(value as Stripe.Response<T>);
}

function found<T>(
  store: Map<string, T>,
  kind: string,
  id: string,
): Promise<Stripe.Response<T>> {
  const value = store.get(id);
  if (!value) return Promise.reject(new MissingResource(kind, id));
  return respond(value);
}

function listOf<T>(items: T[]): Stripe.ApiListPromise<T> {
  const page: Stripe.ApiList<T> = {
    object: 'list',
    data: items,
    has_more: false,
    url: '',
  };
  const iterator = items[Symbol.iterator]();
  return Object.assign(respond(page), {
    next: () => Promise.resolve(iterator.next()),
    [Symbol.asyncIterator]() {
      return this;
    },
    autoPagingEach: async (
      handler: (item: T) => boolean | void | Promise<boolean | void>,
    ) => {
      for (const item of items) {
        if ((await handler(item)) === false) return;
      }
    },
    autoPagingToArray: ({ limit }: { limit: number }) =>
      Promise.resolve(items.slice(0, limit)),
  });
}

function rejectedList<T>(error: Error): Stripe.ApiListPromise<T> {
  return Object.assign(Promise.reject(error), {
    next: () => Promise.reject(error),
    [Symbol.asyncIterator]() {
      return this;
    },
    autoPagingEach: () => Promise.reject(error),
    autoPagingToArray: () => Promise.reject(error),
  });
}

function wait(ms: number): Promise<void> {
  return ms > 0
    ? new Promise((resolve) => setTimeout(resolve, ms))
    : Promise.resolve();
}

function customerIdOf(subscription: Stripe.Subscription): string {
  return typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id;
}

function fixtureObject(name: string): unknown {
  const event = JSON.parse(
    readFileSync(
      join(__dirname, '..', 'fixtures', 'stripe', `${name}.json`),
      'utf8',
    ),
  ) as Stripe.Event;
  return event.data.object;
}

function fixtureSubscription(name: string): Stripe.Subscription {
  return fixtureObject(name) as Stripe.Subscription;
}

const CREATED = fixtureSubscription('customer.subscription.created');

const TRIALING = fixtureSubscription('customer.subscription.trialing');

export function fixtureInvoice(
  name: string,
  overrides: Partial<Stripe.Invoice> = {},
): Stripe.Invoice {
  return {
    ...(fixtureObject(name) as Stripe.Invoice),
    ...overrides,
  };
}

export function subscriptionFrom(
  overrides: Partial<Stripe.Subscription>,
): Stripe.Subscription {
  return { ...CREATED, ...overrides };
}

export function trialingSubscription(
  overrides: Partial<Stripe.Subscription> = {},
): Stripe.Subscription {
  return { ...TRIALING, ...overrides };
}

export function checkoutSession(
  overrides: Partial<Stripe.Checkout.Session>,
): Stripe.Checkout.Session {
  return {
    id: 'cs_test_session',
    object: 'checkout.session',
    status: 'open',
    url: null,
    client_reference_id: null,
    subscription: null,
    ...overrides,
  } as Stripe.Checkout.Session;
}

export function catalogPrice(
  id: string,
  lookupKey: string,
  unitAmount: number,
  interval: 'month' | 'year',
): Stripe.Price {
  return {
    id,
    object: 'price',
    active: true,
    lookup_key: lookupKey,
    currency: 'usd',
    unit_amount: unitAmount,
    recurring: { interval },
  } as Stripe.Price;
}

const MONTH_SECONDS = 30 * 24 * 60 * 60;

function applySubscriptionUpdate(
  subscription: Stripe.Subscription,
  params: Stripe.SubscriptionUpdateParams,
): Stripe.Subscription {
  if (params.trial_end !== 'now') {
    return {
      ...subscription,
      cancel_at_period_end:
        params.cancel_at_period_end ?? subscription.cancel_at_period_end,
    };
  }
  const now = Math.floor(Date.now() / 1000);
  return {
    ...subscription,
    status: 'active',
    trial_end: now,
    items: {
      ...subscription.items,
      data: subscription.items.data.map((item) => ({
        ...item,
        current_period_start: now,
        current_period_end: now + MONTH_SECONDS,
      })),
    },
  };
}

export function paymentMethod(
  overrides: Partial<Stripe.PaymentMethod>,
): Stripe.PaymentMethod {
  return {
    id: 'pm_TestCard',
    object: 'payment_method',
    type: 'card',
    ...overrides,
  } as Stripe.PaymentMethod;
}

export function fakeStripe(): FakeStripe {
  const signer = new Stripe(TEST_STRIPE_SECRET_KEY);
  let counter = 0;
  const next = () => (counter += 1);

  const fake: FakeStripe = {
    createdCustomers: [],
    deletedCustomers: [],
    unknownCustomers: new Set(),
    checkoutSessions: [],
    portalSessions: [],
    expired: [],
    sessions: new Map(),
    subscriptionStore: new Map(),
    subscriptionUpdates: [],
    paymentMethodStore: new Map(),
    invoiceStore: new Map(),
    priceStore: new Map(),
    schedules: new Map(),
    failNext: null,
    nextSessionUrl: undefined,
    nextClientSecret: undefined,
    delayMs: 0,

    customers: {
      create: (params = {}, options) => {
        fake.createdCustomers.push({
          params,
          idempotencyKey: options?.idempotencyKey,
        });
        return respond({
          id: `cus_test_${next()}`,
          object: 'customer',
          email: params.email ?? null,
          name: params.name ?? null,
          metadata: params.metadata ?? {},
        } as Stripe.Customer);
      },
      retrieve: (id) => {
        if (fake.unknownCustomers.has(id)) {
          return Promise.reject(new MissingResource('customer', id));
        }
        if (fake.deletedCustomers.includes(id)) {
          return respond({ id, object: 'customer', deleted: true });
        }
        return respond({
          id,
          object: 'customer',
          metadata: {},
        } as unknown as Stripe.Customer);
      },
      del: (id) => {
        fake.deletedCustomers.push(id);
        return respond({ id, object: 'customer', deleted: true });
      },
    },

    checkout: {
      sessions: {
        create: async (params = {}, options) => {
          await wait(fake.delayMs);
          const failure = fake.failNext;
          if (failure) {
            fake.failNext = null;
            throw failure;
          }
          refuseUnderManagedPayments(params);
          fake.checkoutSessions.push({
            params,
            idempotencyKey: options?.idempotencyKey,
          });
          const id = `cs_test_${next()}`;
          const embedded = params.ui_mode === 'embedded_page';
          const session = checkoutSession({
            id,
            url: embedded
              ? null
              : fake.nextSessionUrl === undefined
                ? `https://checkout.stripe.test/${id}`
                : fake.nextSessionUrl,
            client_secret: embedded
              ? fake.nextClientSecret === undefined
                ? `${id}_secret`
                : fake.nextClientSecret
              : null,
            ui_mode: embedded ? 'embedded_page' : 'hosted_page',
            client_reference_id: params.client_reference_id ?? null,
          });
          fake.sessions.set(id, session);
          return respond(session);
        },
        retrieve: (id) => found(fake.sessions, 'checkout.session', id),
        expire: async (id) => {
          const session = await found(fake.sessions, 'checkout.session', id);
          const expired = { ...session, status: 'expired' as const };
          fake.sessions.set(id, expired);
          fake.expired.push(id);
          return respond(expired);
        },
      },
    },

    subscriptions: {
      list: (params = {}) => {
        if (params.customer && fake.unknownCustomers.has(params.customer)) {
          return rejectedList(new MissingResource('customer', params.customer));
        }
        return listOf(
          [...fake.subscriptionStore.values()].filter(
            (subscription) =>
              !params.customer ||
              customerIdOf(subscription) === params.customer,
          ),
        );
      },
      retrieve: (id) => found(fake.subscriptionStore, 'subscription', id),
      update: async (id, params = {}, options) => {
        const stored = await found(fake.subscriptionStore, 'subscription', id);
        fake.subscriptionUpdates.push({
          params: { id, ...params },
          idempotencyKey: options?.idempotencyKey,
        });
        const updated = applySubscriptionUpdate(stored, params);
        fake.subscriptionStore.set(id, updated);
        return respond(updated);
      },
    },

    paymentMethods: {
      retrieve: (id) => found(fake.paymentMethodStore, 'payment_method', id),
    },

    invoices: {
      retrieve: (id) => found(fake.invoiceStore, 'invoice', id),
    },

    prices: {
      list: (params = {}) =>
        listOf(
          [...fake.priceStore.values()].filter(
            (price) =>
              (params.active === undefined || price.active === params.active) &&
              (!params.lookup_keys ||
                params.lookup_keys.includes(price.lookup_key ?? '')),
          ),
        ),
    },

    subscriptionSchedules: {
      retrieve: (id) => found(fake.schedules, 'subscription_schedule', id),
    },

    billingPortal: {
      sessions: {
        create: (params, options) => {
          if (!params) throw new Error('a portal session names its customer');
          fake.portalSessions.push({
            params,
            idempotencyKey: options?.idempotencyKey,
          });
          return respond({
            id: `bps_test_${next()}`,
            object: 'billing_portal.session',
            customer: params.customer,
            url: `https://portal.stripe.test/${counter}`,
          } as Stripe.BillingPortal.Session);
        },
      },
    },

    webhooks: {
      constructEvent: (...args) => signer.webhooks.constructEvent(...args),
    },

    reset() {
      fake.createdCustomers.length = 0;
      fake.deletedCustomers.length = 0;
      fake.unknownCustomers.clear();
      fake.checkoutSessions.length = 0;
      fake.portalSessions.length = 0;
      fake.expired.length = 0;
      fake.sessions.clear();
      fake.subscriptionStore.clear();
      fake.subscriptionUpdates.length = 0;
      fake.paymentMethodStore.clear();
      fake.invoiceStore.clear();
      fake.priceStore.clear();
      fake.schedules.clear();
      fake.failNext = null;
      fake.nextSessionUrl = undefined;
      fake.nextClientSecret = undefined;
      fake.delayMs = 0;
      counter = 0;
    },
  };
  return fake;
}
