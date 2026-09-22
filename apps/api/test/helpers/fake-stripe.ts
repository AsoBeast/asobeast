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
  checkoutSessions: Recorded<Stripe.Checkout.SessionCreateParams>[];
  portalSessions: Recorded<Stripe.BillingPortal.SessionCreateParams>[];
  expired: string[];
  sessions: Map<string, Stripe.Checkout.Session>;
  subscriptionStore: Map<string, Stripe.Subscription>;
  schedules: Map<string, Stripe.SubscriptionSchedule>;
  failNext: Error | null;
  nextSessionUrl: string | null | undefined;
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

const createdFixture = JSON.parse(
  readFileSync(
    join(
      __dirname,
      '..',
      'fixtures',
      'stripe',
      'customer.subscription.created.json',
    ),
    'utf8',
  ),
) as Stripe.Event;

export function subscriptionFrom(
  overrides: Partial<Stripe.Subscription>,
): Stripe.Subscription {
  return {
    ...(createdFixture.data.object as Stripe.Subscription),
    ...overrides,
  };
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

export function fakeStripe(): FakeStripe {
  const signer = new Stripe(TEST_STRIPE_SECRET_KEY);
  let counter = 0;
  const next = () => (counter += 1);

  const fake: FakeStripe = {
    createdCustomers: [],
    deletedCustomers: [],
    checkoutSessions: [],
    portalSessions: [],
    expired: [],
    sessions: new Map(),
    subscriptionStore: new Map(),
    schedules: new Map(),
    failNext: null,
    nextSessionUrl: undefined,
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
          fake.checkoutSessions.push({
            params,
            idempotencyKey: options?.idempotencyKey,
          });
          const id = `cs_test_${next()}`;
          const session = checkoutSession({
            id,
            url:
              fake.nextSessionUrl === undefined
                ? `https://checkout.stripe.test/${id}`
                : fake.nextSessionUrl,
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
      list: (params = {}) =>
        listOf(
          [...fake.subscriptionStore.values()].filter(
            (subscription) =>
              !params.customer ||
              customerIdOf(subscription) === params.customer,
          ),
        ),
      retrieve: (id) => found(fake.subscriptionStore, 'subscription', id),
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
      fake.checkoutSessions.length = 0;
      fake.portalSessions.length = 0;
      fake.expired.length = 0;
      fake.sessions.clear();
      fake.subscriptionStore.clear();
      fake.schedules.clear();
      fake.failNext = null;
      fake.nextSessionUrl = undefined;
      fake.delayMs = 0;
      counter = 0;
    },
  };
  return fake;
}
