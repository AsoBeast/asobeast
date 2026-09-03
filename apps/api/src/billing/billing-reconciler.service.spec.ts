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
import { WORKSPACE_METADATA_KEY } from './workspace-link';

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
    billingCustomerId: 'cus_1',
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
    customerSubscriptions?: Stripe.Subscription[];
    remote?: Stripe.Subscription[];
    enabled?: boolean;
  }) => {
    const rows = over.workspaces ?? [];
    const update = jest.fn(
      (args: { where: { id: string }; data: Partial<Workspace> }) => {
        const row = rows.find((workspace) => workspace.id === args.where.id);
        if (row) Object.assign(row, args.data);
        return Promise.resolve({});
      },
    );
    const listCustomerSubscriptions = jest.fn(() =>
      Promise.resolve(over.customerSubscriptions ?? []),
    );
    const findMany = jest.fn(() => Promise.resolve(rows));
    const prisma = {
      workspace: {
        findMany,
        findUnique: jest.fn(() => Promise.resolve(rows[0] ?? null)),
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
        listCustomerSubscriptions,
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

    return { reconciler, update, listCustomerSubscriptions, findMany, rows };
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

  it('leaves the over limit clock alone when it corrects a plan', async () => {
    const { reconciler, update } = build({
      workspaces: [
        workspaceOf({
          plan: 'ultimate',
          overLimitSince: new Date('2026-01-01T00:00:00.000Z'),
        }),
      ],
    });

    await reconciler.reconcile();

    const [args] = update.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(args.data).toMatchObject({ plan: 'indie' });
    expect(args.data).not.toHaveProperty('overLimitSince');
  });

  describe('a subscription no webhook recorded', () => {
    const lapsed = () =>
      workspaceOf({
        plan: 'trial',
        planExpiresAt: null,
        subscriptionId: null,
        subscriptionStatus: null,
      });

    it('adopts the one Stripe links to the workspace', async () => {
      const { reconciler, rows } = build({
        workspaces: [lapsed()],
        customerSubscriptions: [
          subscriptionOf({
            id: 'sub_live',
            metadata: { [WORKSPACE_METADATA_KEY]: 'ws_1' },
          }),
        ],
      });

      await expect(reconciler.reconcile()).resolves.toMatchObject({
        corrected: 1,
        orphanSubscriptions: [],
      });
      expect(rows[0]).toMatchObject({
        plan: 'indie',
        subscriptionId: 'sub_live',
        subscriptionStatus: 'active',
      });
    });

    it('is looked for even after an earlier sweep revoked the workspace', async () => {
      const { reconciler, rows } = build({
        workspaces: [{ ...lapsed(), plan: 'free' }],
        customerSubscriptions: [subscriptionOf({ id: 'sub_live' })],
      });

      await reconciler.reconcile();

      expect(rows[0]).toMatchObject({ subscriptionId: 'sub_live' });
    });

    it('replaces a stored subscription Stripe has forgotten with the live one', async () => {
      const { reconciler, rows } = build({
        workspaces: [workspaceOf()],
        retrieveFails: stripeErrorOf({
          code: 'resource_missing',
          statusCode: 404,
        }),
        customerSubscriptions: [subscriptionOf({ id: 'sub_new' })],
      });

      await expect(reconciler.reconcile()).resolves.toMatchObject({
        corrected: 1,
        orphanSubscriptions: [],
      });
      expect(rows[0]).toMatchObject({ subscriptionId: 'sub_new' });
    });

    it('adopts one the customer holds without naming a workspace', async () => {
      const { reconciler, rows } = build({
        workspaces: [lapsed()],
        customerSubscriptions: [subscriptionOf({ id: 'sub_live' })],
      });

      await reconciler.reconcile();

      expect(rows[0]).toMatchObject({ subscriptionId: 'sub_live' });
    });

    it('refuses one whose metadata names another workspace', async () => {
      const { reconciler, rows } = build({
        workspaces: [lapsed()],
        customerSubscriptions: [
          subscriptionOf({
            id: 'sub_theirs',
            metadata: { [WORKSPACE_METADATA_KEY]: 'ws_2' },
          }),
        ],
      });

      await reconciler.reconcile();

      expect(rows[0]).toMatchObject({ subscriptionId: null });
    });

    it('prefers the subscription that pays for the plan', async () => {
      const { reconciler, rows } = build({
        workspaces: [lapsed()],
        customerSubscriptions: [
          subscriptionOf({ id: 'sub_paused', status: 'paused' }),
          subscriptionOf({ id: 'sub_live' }),
        ],
      });

      await reconciler.reconcile();

      expect(rows[0]).toMatchObject({ subscriptionId: 'sub_live' });
    });

    it('adopts a paused subscription rather than leaving the workspace stranded', async () => {
      const { reconciler, rows } = build({
        workspaces: [lapsed()],
        customerSubscriptions: [
          subscriptionOf({ id: 'sub_paused', status: 'paused' }),
        ],
      });

      await reconciler.reconcile();

      expect(rows[0]).toMatchObject({
        plan: 'free',
        subscriptionId: 'sub_paused',
        subscriptionStatus: 'paused',
      });
    });

    it('ignores a subscription the customer has already lost', async () => {
      const { reconciler, rows } = build({
        workspaces: [lapsed()],
        customerSubscriptions: [
          subscriptionOf({ id: 'sub_dead', status: 'canceled' }),
        ],
      });

      await reconciler.reconcile();

      expect(rows[0]).toMatchObject({ subscriptionId: null });
    });

    it('asks Stripe nothing extra for a workspace with no billing account', async () => {
      const { reconciler, listCustomerSubscriptions } = build({
        workspaces: [{ ...lapsed(), billingCustomerId: null }],
      });

      await reconciler.reconcile();

      expect(listCustomerSubscriptions).not.toHaveBeenCalled();
    });
  });

  it('leaves a trialing workspace alone rather than revoking a plan it never claimed', async () => {
    const { reconciler, update } = build({
      workspaces: [
        workspaceOf({
          plan: 'trial',
          planExpiresAt: null,
          billingCustomerId: null,
          subscriptionId: null,
          subscriptionStatus: null,
        }),
      ],
    });

    await expect(reconciler.reconcile()).resolves.toMatchObject({
      checked: 1,
      corrected: 0,
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('still revokes a paid plan Stripe cannot back', async () => {
    const { reconciler, rows } = build({
      workspaces: [
        workspaceOf({ billingCustomerId: null, subscriptionId: null }),
      ],
    });

    await expect(reconciler.reconcile()).resolves.toMatchObject({
      corrected: 1,
    });
    expect(rows[0]).toMatchObject({ plan: 'free' });
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
