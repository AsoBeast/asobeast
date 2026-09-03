import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Workspace } from '@prisma/client';
import type Stripe from 'stripe';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { BillingReconciler } from './billing-reconciler.service';
import { PriceCatalog } from './price-catalog';
import { StripeService } from './stripe.service';

const PERIOD_END = 1_800_000_000;
const EXPIRES_AT = new Date(PERIOD_END * 1000);

const config = {
  get: (key: string) =>
    key === 'STRIPE_PRICE_INDIE_MONTHLY' ? 'price_indie_month' : undefined,
} as unknown as ConfigService<Env, true>;

const workspaceOf = (over: Partial<Workspace> = {}): Workspace =>
  ({
    id: 'ws_1',
    plan: 'indie',
    planExpiresAt: EXPIRES_AT,
    subscriptionId: 'sub_1',
    subscriptionStatus: 'active',
    cancelAtPeriodEnd: false,
    ...over,
  }) as Workspace;

const stripeErrorOf = (over: {
  type?: string;
  code?: string;
  statusCode?: number;
}): Error => Object.assign(new Error('stripe rejected the call'), over);

const subscriptionOf = (over: Record<string, unknown> = {}) =>
  ({
    id: 'sub_1',
    status: 'active',
    cancel_at_period_end: false,
    customer: 'cus_1',
    metadata: {},
    items: {
      data: [
        { current_period_end: PERIOD_END, price: { id: 'price_indie_month' } },
      ],
    },
    ...over,
  }) as unknown as Stripe.Subscription;

describe('BillingReconciler', () => {
  const build = (over: {
    workspaces?: Workspace[];
    subscription?: Stripe.Subscription;
    retrieveFails?: Error;
    remote?: Stripe.Subscription[];
    enabled?: boolean;
  }) => {
    const update = jest.fn().mockResolvedValue({});
    const prisma = {
      workspace: {
        findMany: jest.fn(() => Promise.resolve(over.workspaces ?? [])),
        findUnique: jest.fn(() =>
          Promise.resolve(over.workspaces?.[0] ?? null),
        ),
        update,
      },
    } as unknown as PrismaService;

    const reconciler = new BillingReconciler(
      {
        enabled: over.enabled ?? true,
        retrieveSubscription: jest.fn(() =>
          over.retrieveFails
            ? Promise.reject(over.retrieveFails)
            : Promise.resolve(over.subscription ?? subscriptionOf()),
        ),
        listActiveSubscriptions: () => over.remote ?? [],
      } as unknown as StripeService,
      new PriceCatalog(config),
      prisma,
      {
        becauseThisWorkIsNotOwnedByOneWorkspace: <T>(
          _justification: string,
          work: () => Promise<T>,
        ) => work(),
      } as unknown as CrossTenantAccess,
    );

    return { reconciler, update };
  };

  it('does nothing while Stripe is not configured', async () => {
    const { reconciler, update } = build({ enabled: false });

    await expect(reconciler.reconcile()).resolves.toEqual({
      checked: 0,
      corrected: 0,
      orphanSubscriptions: [],
      unreconciled: [],
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('leaves a workspace that already agrees with Stripe alone', async () => {
    const { reconciler, update } = build({ workspaces: [workspaceOf()] });

    await expect(reconciler.reconcile()).resolves.toMatchObject({
      checked: 1,
      corrected: 0,
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('treats Stripe as authoritative when the local state drifted', async () => {
    const { reconciler, update } = build({
      workspaces: [workspaceOf({ plan: 'ultimate' })],
    });

    await expect(reconciler.reconcile()).resolves.toMatchObject({
      corrected: 1,
    });
    const [args] = update.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(args.data).toMatchObject({
      plan: 'indie',
      subscriptionStatus: 'active',
      planExpiresAt: EXPIRES_AT,
    });
  });

  it('reopens the capacity a lapsed workspace lost when the paid plan comes back', async () => {
    const { reconciler, update } = build({
      workspaces: [
        workspaceOf({
          plan: 'free',
          overLimitSince: new Date('2026-01-01T00:00:00.000Z'),
          overLimitNotifiedAt: new Date('2026-01-02T00:00:00.000Z'),
        }),
      ],
    });

    await reconciler.reconcile();

    const [args] = update.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(args.data).toMatchObject({
      plan: 'indie',
      overLimitSince: null,
      overLimitNotifiedAt: null,
    });
  });

  it('revokes a plan whose subscription Stripe reports as missing', async () => {
    const { reconciler, update } = build({
      workspaces: [workspaceOf()],
      retrieveFails: stripeErrorOf({
        code: 'resource_missing',
        statusCode: 404,
      }),
    });

    await expect(reconciler.reconcile()).resolves.toMatchObject({
      corrected: 1,
      unreconciled: [],
    });
    const [args] = update.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(args.data).toMatchObject({ plan: 'free', subscriptionId: null });
  });

  it.each([
    ['a timeout', stripeErrorOf({ type: 'StripeConnectionError' })],
    ['a rate limit', stripeErrorOf({ code: 'rate_limit', statusCode: 429 })],
    [
      'a rejected api key',
      stripeErrorOf({ code: 'api_key_expired', statusCode: 401 }),
    ],
    ['an outage', stripeErrorOf({ type: 'StripeAPIError', statusCode: 500 })],
  ])('keeps the paid plan when Stripe answers with %s', async (_, failure) => {
    const { reconciler, update } = build({
      workspaces: [workspaceOf()],
      retrieveFails: failure,
    });

    await expect(reconciler.reconcile()).resolves.toMatchObject({
      checked: 1,
      corrected: 0,
      unreconciled: ['ws_1'],
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('keeps the paid plan when the local price catalog cannot name the plan', async () => {
    const { reconciler, update } = build({
      workspaces: [workspaceOf()],
      subscription: subscriptionOf({
        items: {
          data: [
            { current_period_end: PERIOD_END, price: { id: 'price_unmapped' } },
          ],
        },
      }),
    });

    await expect(reconciler.reconcile()).resolves.toMatchObject({
      corrected: 0,
      unreconciled: ['ws_1'],
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('refuses an on-demand reconcile rather than reporting an untouched workspace as checked', async () => {
    const { reconciler, update } = build({
      workspaces: [workspaceOf()],
      retrieveFails: stripeErrorOf({ type: 'StripeConnectionError' }),
    });

    await expect(reconciler.reconcileOne('ws_1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('reports a Stripe subscription that belongs to no workspace', async () => {
    const { reconciler } = build({
      workspaces: [workspaceOf()],
      remote: [subscriptionOf(), subscriptionOf({ id: 'sub_orphan' })],
    });

    await expect(reconciler.reconcile()).resolves.toMatchObject({
      orphanSubscriptions: ['sub_orphan'],
    });
  });

  it('ignores a cancelled remote subscription rather than calling it an orphan', async () => {
    const { reconciler } = build({
      workspaces: [workspaceOf()],
      remote: [subscriptionOf({ id: 'sub_gone', status: 'canceled' })],
    });

    await expect(reconciler.reconcile()).resolves.toMatchObject({
      orphanSubscriptions: [],
    });
  });

  it('reconciles a single workspace on demand', async () => {
    const { reconciler, update } = build({
      workspaces: [workspaceOf({ subscriptionStatus: 'past_due' })],
    });

    await expect(reconciler.reconcileOne('ws_1')).resolves.toEqual({
      checked: 1,
      corrected: 1,
      orphanSubscriptions: [],
      unreconciled: [],
    });
    expect(update).toHaveBeenCalled();
  });

  it('carries a pending cancellation back from Stripe', async () => {
    const { reconciler, update } = build({
      workspaces: [workspaceOf()],
      subscription: subscriptionOf({ cancel_at_period_end: true }),
    });

    await reconciler.reconcile();

    const [args] = update.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(args.data).toMatchObject({ cancelAtPeriodEnd: true });
  });
});
