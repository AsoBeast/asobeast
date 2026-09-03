import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import type { AccountUser } from '../auth/auth.types';
import { BillingService } from './billing.service';
import { BillingConflictError } from './billing.errors';
import { BillingReconciler } from './billing-reconciler.service';
import { PriceCatalog, UnknownPriceError } from './price-catalog';
import { StripeService } from './stripe.service';
import { WORKSPACE_METADATA_KEY } from './workspace-link';

const WORKSPACE = 'ws_billing';

const CONFIG: Record<string, string | undefined> = {
  STRIPE_SECRET_KEY: 'sk_test',
  STRIPE_PRICE_INDIE_MONTHLY: 'price_indie_month',
  STRIPE_WEBHOOK_SECRET: 'whsec_test',
  WEB_PUBLIC_URL: 'https://app.example.com',
  STRIPE_PORTAL_RETURN_URL: undefined,
};

const owner = (billingCustomerId: string | null): AccountUser =>
  ({
    id: 'usr_owner',
    email: 'owner@example.com',
    workspaceId: WORKSPACE,
    workspace: { id: WORKSPACE, name: 'Owner', billingCustomerId },
  }) as unknown as AccountUser;

function leaseIsFree(
  row: { checkoutClaimedAt: Date | null },
  clauses: Array<{ checkoutClaimedAt?: { lt?: Date } | null }>,
): boolean {
  return clauses.some((clause) => {
    if (clause.checkoutClaimedAt === null)
      return row.checkoutClaimedAt === null;
    const before = clause.checkoutClaimedAt?.lt;
    if (!before || row.checkoutClaimedAt === null) return false;
    return row.checkoutClaimedAt.getTime() < before.getTime();
  });
}

describe('BillingService', () => {
  const build = (
    storedCustomer: string | null,
    subscription: {
      subscriptionId: string | null;
      subscriptionStatus: string | null;
    } = { subscriptionId: null, subscriptionStatus: null },
    env: Record<string, string | undefined> = {},
  ) => {
    const values = { ...CONFIG, ...env };
    const createCustomer = jest.fn().mockResolvedValue({ id: 'cus_created' });
    const createCheckoutSession = jest.fn().mockResolvedValue({
      id: 'cs_new',
      url: 'https://checkout.stripe.test/session',
    });
    const createPortalSession = jest
      .fn()
      .mockResolvedValue({ url: 'https://portal.stripe.test/session' });
    const listCustomerSubscriptions = jest.fn().mockResolvedValue([]);
    const retrieveCheckoutSession = jest
      .fn()
      .mockResolvedValue({ id: 'cs_old', status: 'open' });
    const expireCheckoutSession = jest.fn().mockResolvedValue(undefined);

    const row: {
      billingCustomerId: string | null;
      checkoutSessionId: string | null;
      checkoutClaimedAt: Date | null;
      checkoutClaimToken: string | null;
    } = {
      billingCustomerId: storedCustomer,
      checkoutSessionId: null,
      checkoutClaimedAt: null,
      checkoutClaimToken: null,
    };
    const updateMany = jest.fn(
      (args: {
        where: {
          OR?: Array<{ checkoutClaimedAt?: { lt?: Date } | null }>;
          checkoutClaimToken?: string;
        };
        data: Partial<typeof row>;
      }) => {
        if (args.where.OR !== undefined && !leaseIsFree(row, args.where.OR)) {
          return Promise.resolve({ count: 0 });
        }
        if (
          args.where.checkoutClaimToken !== undefined &&
          args.where.checkoutClaimToken !== row.checkoutClaimToken
        ) {
          return Promise.resolve({ count: 0 });
        }
        if (
          'billingCustomerId' in args.data &&
          row.billingCustomerId !== null
        ) {
          return Promise.resolve({ count: 0 });
        }
        Object.assign(row, args.data);
        return Promise.resolve({ count: 1 });
      },
    );
    const prisma = {
      workspace: {
        findFirst: jest.fn(() => Promise.resolve({ ...row, ...subscription })),
        updateMany,
      },
    } as unknown as PrismaService;

    const config = {
      get: (key: string) => values[key],
    } as unknown as ConfigService<Env, true>;

    const reconcileOne = jest.fn().mockResolvedValue({
      checked: 1,
      corrected: 1,
      orphanSubscriptions: [],
      unreconciled: [],
    });

    const service = new BillingService(
      {
        enabled: values['STRIPE_SECRET_KEY'] !== undefined,
        createCustomer,
        createCheckoutSession,
        createPortalSession,
        listCustomerSubscriptions,
        retrieveCheckoutSession,
        expireCheckoutSession,
      } as unknown as StripeService,
      new PriceCatalog(config),
      { reconcileOne } as unknown as BillingReconciler,
      prisma,
      config,
    );

    return {
      service,
      createCustomer,
      createCheckoutSession,
      createPortalSession,
      listCustomerSubscriptions,
      retrieveCheckoutSession,
      expireCheckoutSession,
      reconcileOne,
      row,
    };
  };

  it('refuses a price it does not recognise before it calls Stripe', async () => {
    const { service, createCheckoutSession } = build(null);

    await expect(
      service.checkout(owner(null), 'price_unknown'),
    ).rejects.toBeInstanceOf(UnknownPriceError);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it('links the session back to the workspace on both sides', async () => {
    const { service, createCheckoutSession } = build('cus_existing');

    await expect(
      service.checkout(owner('cus_existing'), 'price_indie_month'),
    ).resolves.toBe('https://checkout.stripe.test/session');

    const [params, key] = createCheckoutSession.mock.calls[0] as [
      Record<string, unknown>,
      string,
    ];
    expect(params).toMatchObject({
      mode: 'subscription',
      customer: 'cus_existing',
      client_reference_id: WORKSPACE,
      subscription_data: {
        metadata: { [WORKSPACE_METADATA_KEY]: WORKSPACE },
      },
    });
    expect(key).toMatch(new RegExp(`^checkout:${WORKSPACE}:[0-9a-f-]{36}$`));
  });

  it('reuses the stored customer rather than creating a second one', async () => {
    const { service, createCustomer } = build('cus_existing');

    await service.checkout(owner('cus_existing'), 'price_indie_month');

    expect(createCustomer).not.toHaveBeenCalled();
  });

  it('creates and claims a customer the first time a workspace pays', async () => {
    const { service, createCustomer, createCheckoutSession } = build(null);

    await service.checkout(owner(null), 'price_indie_month');

    expect(createCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { [WORKSPACE_METADATA_KEY]: WORKSPACE },
      }),
      `customer:${WORKSPACE}`,
    );
    const [params] = createCheckoutSession.mock.calls[0] as [
      Record<string, unknown>,
    ];
    expect(params).toMatchObject({ customer: 'cus_created' });
  });

  describe('one open checkout per workspace', () => {
    it('expires the previous session before opening another', async () => {
      const {
        service,
        retrieveCheckoutSession,
        expireCheckoutSession,
        createCheckoutSession,
      } = build('cus_existing');

      await service.checkout(owner('cus_existing'), 'price_indie_month');
      await service.checkout(owner('cus_existing'), 'price_indie_month');

      expect(retrieveCheckoutSession).toHaveBeenCalledWith('cs_new');
      expect(expireCheckoutSession).toHaveBeenCalledWith('cs_new');
      expect(createCheckoutSession).toHaveBeenCalledTimes(2);
    });

    it('gives each attempt its own idempotency key so the url is never a dead one', async () => {
      const { service, createCheckoutSession } = build('cus_existing');

      await service.checkout(owner('cus_existing'), 'price_indie_month');
      await service.checkout(owner('cus_existing'), 'price_indie_month');

      const keys = (
        createCheckoutSession.mock.calls as Array<[unknown, string]>
      ).map(([, key]) => key);
      expect(new Set(keys).size).toBe(2);
    });

    it('forgets a session Stripe no longer knows and opens a new one', async () => {
      const { service, retrieveCheckoutSession, createCheckoutSession, row } =
        build('cus_existing');
      row.checkoutSessionId = 'cs_from_another_account';
      retrieveCheckoutSession.mockRejectedValue(
        Object.assign(new Error('No such checkout.session'), {
          code: 'resource_missing',
        }),
      );

      await expect(
        service.checkout(owner('cus_existing'), 'price_indie_month'),
      ).resolves.toBe('https://checkout.stripe.test/session');
      expect(createCheckoutSession).toHaveBeenCalledTimes(1);
      expect(row.checkoutSessionId).toBe('cs_new');
    });

    it('keeps the stored session when Stripe is only unreachable', async () => {
      const { service, retrieveCheckoutSession, createCheckoutSession, row } =
        build('cus_existing');
      row.checkoutSessionId = 'cs_paused';
      retrieveCheckoutSession.mockRejectedValue(
        Object.assign(new Error('Request timed out'), {
          type: 'StripeConnectionError',
        }),
      );

      await expect(
        service.checkout(owner('cus_existing'), 'price_indie_month'),
      ).rejects.toThrow('Request timed out');
      expect(createCheckoutSession).not.toHaveBeenCalled();
      expect(row.checkoutSessionId).toBe('cs_paused');
    });

    it('keeps the stored session when Stripe rate limits the retrieval', async () => {
      const { service, retrieveCheckoutSession, createCheckoutSession, row } =
        build('cus_existing');
      row.checkoutSessionId = 'cs_paused';
      retrieveCheckoutSession.mockRejectedValue(
        Object.assign(new Error('Too many requests'), {
          type: 'StripeRateLimitError',
          statusCode: 429,
        }),
      );

      await expect(
        service.checkout(owner('cus_existing'), 'price_indie_month'),
      ).rejects.toThrow('Too many requests');
      expect(createCheckoutSession).not.toHaveBeenCalled();
      expect(row.checkoutSessionId).toBe('cs_paused');
    });

    it('forgets a session Stripe answers 404 for', async () => {
      const { service, retrieveCheckoutSession, createCheckoutSession, row } =
        build('cus_existing');
      row.checkoutSessionId = 'cs_from_another_account';
      retrieveCheckoutSession.mockRejectedValue(
        Object.assign(new Error('Not found'), { statusCode: 404 }),
      );

      await expect(
        service.checkout(owner('cus_existing'), 'price_indie_month'),
      ).resolves.toBe('https://checkout.stripe.test/session');
      expect(createCheckoutSession).toHaveBeenCalledTimes(1);
      expect(row.checkoutSessionId).toBe('cs_new');
    });

    it('leaves a session Stripe already completed alone', async () => {
      const { service, retrieveCheckoutSession, expireCheckoutSession } =
        build('cus_existing');
      retrieveCheckoutSession.mockResolvedValue({
        id: 'cs_new',
        status: 'complete',
      });

      await service.checkout(owner('cus_existing'), 'price_indie_month');
      await service.checkout(owner('cus_existing'), 'price_indie_month');

      expect(expireCheckoutSession).not.toHaveBeenCalled();
    });

    it('refuses to record a session once its lease has been taken over', async () => {
      const { service, createCheckoutSession, expireCheckoutSession, row } =
        build('cus_existing');
      createCheckoutSession.mockImplementation(() => {
        row.checkoutClaimedAt = new Date();
        row.checkoutClaimToken = 'newer-attempt';
        return Promise.resolve({
          id: 'cs_stale_owner',
          url: 'https://checkout.stripe.test/stale',
        });
      });

      await expect(
        service.checkout(owner('cus_existing'), 'price_indie_month'),
      ).rejects.toBeInstanceOf(BillingConflictError);
      expect(row.checkoutSessionId).toBeNull();
      expect(row.checkoutClaimToken).toBe('newer-attempt');
      expect(expireCheckoutSession).toHaveBeenCalledWith('cs_stale_owner');
    });

    it('leaves a newer lease alone when an older attempt fails', async () => {
      const { service, createCheckoutSession, row } = build('cus_existing');
      createCheckoutSession.mockImplementation(() => {
        row.checkoutClaimedAt = new Date();
        row.checkoutClaimToken = 'newer-attempt';
        return Promise.reject(new Error('Stripe is down'));
      });

      await expect(
        service.checkout(owner('cus_existing'), 'price_indie_month'),
      ).rejects.toThrow('Stripe is down');
      expect(row.checkoutClaimToken).toBe('newer-attempt');
      expect(row.checkoutClaimedAt).not.toBeNull();
    });

    it('hands the lease to the next caller once the holder goes stale', async () => {
      const { service, createCheckoutSession, row } = build('cus_existing');
      row.checkoutClaimedAt = new Date(Date.now() - 10 * 60_000);
      row.checkoutClaimToken = 'abandoned-attempt';

      await expect(
        service.checkout(owner('cus_existing'), 'price_indie_month'),
      ).resolves.toBe('https://checkout.stripe.test/session');
      expect(createCheckoutSession).toHaveBeenCalledTimes(1);
      expect(row.checkoutClaimToken).toBeNull();
      expect(row.checkoutSessionId).toBe('cs_new');
    });

    it('clears the lease it owns when the attempt succeeds', async () => {
      const { service, row } = build('cus_existing');

      await service.checkout(owner('cus_existing'), 'price_indie_month');

      expect(row.checkoutClaimedAt).toBeNull();
      expect(row.checkoutClaimToken).toBeNull();
    });

    it('refuses a second checkout while the first is still being opened', async () => {
      const { service, createCheckoutSession } = build('cus_existing');
      let release = () => {};
      createCheckoutSession.mockReturnValue(
        new Promise((resolve) => {
          release = () =>
            resolve({
              id: 'cs_new',
              url: 'https://checkout.stripe.test/session',
            });
        }),
      );

      const first = service.checkout(
        owner('cus_existing'),
        'price_indie_month',
      );
      const second = service.checkout(
        owner('cus_existing'),
        'price_indie_month',
      );

      await expect(second).rejects.toBeInstanceOf(BillingConflictError);
      release();
      await expect(first).resolves.toBe('https://checkout.stripe.test/session');
      expect(createCheckoutSession).toHaveBeenCalledTimes(1);
    });

    it('releases the claim when Stripe refuses, so the customer can retry', async () => {
      const { service, createCheckoutSession, row } = build('cus_existing');
      createCheckoutSession.mockRejectedValueOnce(new Error('stripe is down'));

      await expect(
        service.checkout(owner('cus_existing'), 'price_indie_month'),
      ).rejects.toThrow('stripe is down');
      expect(row.checkoutClaimedAt).toBeNull();

      createCheckoutSession.mockResolvedValue({
        id: 'cs_new',
        url: 'https://checkout.stripe.test/session',
      });
      await expect(
        service.checkout(owner('cus_existing'), 'price_indie_month'),
      ).resolves.toBe('https://checkout.stripe.test/session');
    });
  });

  describe('a subscription Stripe holds but no webhook recorded', () => {
    const liveSubscription = (status: string) => ({ id: 'sub_live', status });

    it.each(['active', 'trialing', 'past_due', 'unpaid', 'paused'])(
      'refuses a checkout while Stripe reports a %s subscription',
      async (status) => {
        const { service, listCustomerSubscriptions, createCheckoutSession } =
          build('cus_existing');
        listCustomerSubscriptions.mockResolvedValue([liveSubscription(status)]);

        await expect(
          service.checkout(owner('cus_existing'), 'price_indie_month'),
        ).rejects.toBeInstanceOf(BillingConflictError);
        expect(createCheckoutSession).not.toHaveBeenCalled();
      },
    );

    it.each(['canceled', 'incomplete', 'incomplete_expired'])(
      'lets the customer buy again after a %s subscription',
      async (status) => {
        const { service, listCustomerSubscriptions, createCheckoutSession } =
          build('cus_existing');
        listCustomerSubscriptions.mockResolvedValue([liveSubscription(status)]);

        await service.checkout(owner('cus_existing'), 'price_indie_month');

        expect(createCheckoutSession).toHaveBeenCalledTimes(1);
      },
    );

    it('names the subscription that pays when the customer holds more than one', async () => {
      const { service, listCustomerSubscriptions } = build('cus_existing');
      listCustomerSubscriptions.mockResolvedValue([
        liveSubscription('paused'),
        liveSubscription('active'),
      ]);

      await expect(
        service.checkout(owner('cus_existing'), 'price_indie_month'),
      ).rejects.toThrow(/change the plan or cancel it/i);
    });

    it('records what Stripe holds before it refuses the checkout', async () => {
      const { service, listCustomerSubscriptions, reconcileOne } =
        build('cus_existing');
      listCustomerSubscriptions.mockResolvedValue([liveSubscription('active')]);

      await expect(
        service.checkout(owner('cus_existing'), 'price_indie_month'),
      ).rejects.toBeInstanceOf(BillingConflictError);
      expect(reconcileOne).toHaveBeenCalledWith(WORKSPACE);
    });

    it('still refuses the checkout when reconciliation cannot reach Stripe', async () => {
      const { service, listCustomerSubscriptions, reconcileOne } =
        build('cus_existing');
      listCustomerSubscriptions.mockResolvedValue([liveSubscription('active')]);
      reconcileOne.mockRejectedValue(new Error('stripe is down'));

      await expect(
        service.checkout(owner('cus_existing'), 'price_indie_month'),
      ).rejects.toBeInstanceOf(BillingConflictError);
    });

    it('leaves the workspace alone when Stripe holds nothing', async () => {
      const { service, reconcileOne } = build('cus_existing');

      await service.checkout(owner('cus_existing'), 'price_indie_month');

      expect(reconcileOne).not.toHaveBeenCalled();
    });

    it('asks about the customer it is about to charge', async () => {
      const { service, listCustomerSubscriptions } = build('cus_existing');

      await service.checkout(owner('cus_existing'), 'price_indie_month');

      expect(listCustomerSubscriptions).toHaveBeenCalledWith('cus_existing');
    });
  });

  it('returns the customer to the portal rather than the paywall', async () => {
    const { service, createPortalSession } = build('cus_existing');

    await expect(service.portal(owner('cus_existing'))).resolves.toBe(
      'https://portal.stripe.test/session',
    );
    const [params] = createPortalSession.mock.calls[0] as [
      Record<string, unknown>,
    ];
    expect(params).toMatchObject({
      customer: 'cus_existing',
      return_url: 'https://app.example.com/settings',
    });
  });

  it('never asks Stripe for a trial, so a trialing workspace gets no second one', async () => {
    const { service, createCheckoutSession } = build('cus_existing');

    await service.checkout(owner('cus_existing'), 'price_indie_month');

    const [params] = createCheckoutSession.mock.calls[0] as [
      { subscription_data?: Record<string, unknown> },
    ];
    expect(params.subscription_data).not.toHaveProperty('trial_period_days');
    expect(params.subscription_data).not.toHaveProperty('trial_end');
    expect(params.subscription_data).not.toHaveProperty('trial_settings');
  });

  it.each(['active', 'trialing', 'past_due', 'unpaid', 'paused'])(
    'refuses a second checkout while a %s subscription is on the workspace',
    async (subscriptionStatus) => {
      const { service, createCheckoutSession } = build('cus_existing', {
        subscriptionId: 'sub_existing',
        subscriptionStatus,
      });

      await expect(
        service.checkout(owner('cus_existing'), 'price_indie_month'),
      ).rejects.toBeInstanceOf(BillingConflictError);
      expect(createCheckoutSession).not.toHaveBeenCalled();
    },
  );

  it.each(['unpaid', 'paused'])(
    'names the payment method a %s subscription is missing',
    async (subscriptionStatus) => {
      const { service } = build('cus_existing', {
        subscriptionId: 'sub_existing',
        subscriptionStatus,
      });

      await expect(
        service.checkout(owner('cus_existing'), 'price_indie_month'),
      ).rejects.toThrow(/add a payment method/i);
    },
  );

  it('sends a workspace that already pays to the portal to change plan', async () => {
    const { service } = build('cus_existing', {
      subscriptionId: 'sub_existing',
      subscriptionStatus: 'active',
    });

    await expect(
      service.checkout(owner('cus_existing'), 'price_indie_month'),
    ).rejects.toThrow(/change the plan or cancel it/i);
  });

  it('refuses a second checkout when the stored subscription has no status yet', async () => {
    const { service, createCheckoutSession } = build('cus_existing', {
      subscriptionId: 'sub_existing',
      subscriptionStatus: null,
    });

    await expect(
      service.checkout(owner('cus_existing'), 'price_indie_month'),
    ).rejects.toThrow(/change the plan or cancel it/i);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it.each(['canceled', 'incomplete', 'incomplete_expired'])(
    'lets a workspace buy again after a %s subscription',
    async (subscriptionStatus) => {
      const { service, createCheckoutSession } = build('cus_existing', {
        subscriptionId: 'sub_dead',
        subscriptionStatus,
      });

      await expect(
        service.checkout(owner('cus_existing'), 'price_indie_month'),
      ).resolves.toBe('https://checkout.stripe.test/session');
      expect(createCheckoutSession).toHaveBeenCalled();
    },
  );

  it('still opens the portal for a subscribed workspace', async () => {
    const { service, createPortalSession } = build('cus_existing', {
      subscriptionId: 'sub_existing',
      subscriptionStatus: 'active',
    });

    await expect(service.portal(owner('cus_existing'))).resolves.toBe(
      'https://portal.stripe.test/session',
    );
    expect(createPortalSession).toHaveBeenCalled();
  });

  it.each([
    ['the secret key', 'STRIPE_SECRET_KEY'],
    ['the webhook secret', 'STRIPE_WEBHOOK_SECRET'],
    ['a public web url', 'WEB_PUBLIC_URL'],
    ['a price catalog', 'STRIPE_PRICE_INDIE_MONTHLY'],
  ])('closes checkout and refuses to sell without %s', async (_, key) => {
    const noSubscription = {
      subscriptionId: null,
      subscriptionStatus: null,
    };
    const { service, createCheckoutSession } = build(
      'cus_existing',
      noSubscription,
      { [key]: undefined },
    );

    expect(service.catalog().enabled).toBe(false);
    await expect(
      service.checkout(owner('cus_existing'), 'price_indie_month'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it('advertises only the prices it can actually sell', () => {
    const { service } = build(null);

    expect(service.catalog()).toEqual({
      enabled: true,
      prices: [
        {
          plan: 'indie',
          interval: 'month',
          priceId: 'price_indie_month',
          amountUsd: 10,
        },
      ],
    });
  });
});
