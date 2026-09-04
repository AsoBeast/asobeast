import { ConfigService } from '@nestjs/config';
import type { Workspace } from '@prisma/client';
import type Stripe from 'stripe';
import { effectivePlan } from '@asobeast/shared';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import type { AccountUser } from '../auth/auth.types';
import { BillingConflictError } from './billing.errors';
import { BillingReconciler } from './billing-reconciler.service';
import { BillingService } from './billing.service';
import { PriceCatalog } from './price-catalog';
import { StripeService } from './stripe.service';
import { WORKSPACE_METADATA_KEY } from './workspace-link';

const WORKSPACE = 'ws_lapsed';
const DAY_MS = 24 * 60 * 60 * 1000;
const PERIOD_END = 1_800_000_000;

const NOW = new Date('2026-09-10T00:00:00.000Z');
const REGISTERED_AT = new Date(NOW.getTime() - 8 * DAY_MS);

const CONFIG: Record<string, string | undefined> = {
  STRIPE_SECRET_KEY: 'sk_test',
  STRIPE_PRICE_INDIE_MONTHLY: 'price_indie_month',
  STRIPE_WEBHOOK_SECRET: 'whsec_test',
  WEB_PUBLIC_URL: 'https://app.example.com',
};

const owner = () =>
  ({
    id: 'usr_owner',
    email: 'owner@example.com',
    workspaceId: WORKSPACE,
    workspace: { id: WORKSPACE, name: 'Owner' },
  }) as unknown as AccountUser;

const paidFor = (over: Record<string, unknown> = {}) =>
  ({
    id: 'sub_live',
    status: 'active',
    cancel_at_period_end: false,
    customer: 'cus_indie',
    metadata: { [WORKSPACE_METADATA_KEY]: WORKSPACE },
    items: {
      data: [
        { current_period_end: PERIOD_END, price: { id: 'price_indie_month' } },
      ],
    },
    ...over,
  }) as unknown as Stripe.Subscription;

function build(held: Stripe.Subscription[]) {
  const workspace = {
    id: WORKSPACE,
    plan: 'trial',
    trialEndsAt: new Date(REGISTERED_AT.getTime() + 7 * DAY_MS),
    planExpiresAt: null,
    billingCustomerId: 'cus_indie',
    checkoutSessionId: null,
    checkoutClaimedAt: null,
    checkoutClaimToken: null,
    subscriptionId: null,
    subscriptionStatus: null,
    cancelAtPeriodEnd: false,
  } as unknown as Workspace;

  const write = (data: Partial<Workspace>) => {
    Object.assign(workspace, data);
    return Promise.resolve({ count: 1 });
  };
  const prisma = {
    workspace: {
      findFirst: jest.fn(() => Promise.resolve(workspace)),
      findUnique: jest.fn(() => Promise.resolve(workspace)),
      findMany: jest.fn(() => Promise.resolve([workspace])),
      update: jest.fn((args: { data: Partial<Workspace> }) => write(args.data)),
      updateMany: jest.fn((args: { data: Partial<Workspace> }) =>
        write(args.data),
      ),
    },
  } as unknown as PrismaService;

  const createCheckoutSession = jest.fn();
  const stripe = {
    enabled: true,
    createCheckoutSession,
    createCustomer: jest.fn(),
    retrieveCheckoutSession: jest.fn(),
    expireCheckoutSession: jest.fn(),
    listCustomerSubscriptions: jest.fn(() => Promise.resolve(held)),
    listActiveSubscriptions: () => held,
    retrieveSubscription: jest.fn(() => Promise.resolve(held[0])),
  } as unknown as StripeService;

  const config = {
    get: (key: string) => CONFIG[key],
  } as unknown as ConfigService<Env, true>;

  const reconciler = new BillingReconciler(
    stripe,
    new PriceCatalog(config),
    prisma,
    {
      becauseThisWorkIsNotOwnedByOneWorkspace: <T>(
        _justification: string,
        work: () => Promise<T>,
      ) => work(),
    } as unknown as CrossTenantAccess,
  );

  const service = new BillingService(
    stripe,
    new PriceCatalog(config),
    reconciler,
    prisma,
    config,
  );

  return { service, reconciler, workspace, createCheckoutSession };
}

describe('an indie plan bought during a trial whose webhook never landed', () => {
  it('leaves the workspace unentitled until something reconciles it', () => {
    const { workspace } = build([paidFor()]);

    expect(effectivePlan(workspace, NOW)).toBe('free');
  });

  it('restores the plan the customer already pays for when they try to buy again', async () => {
    const { service, workspace, createCheckoutSession } = build([paidFor()]);

    await expect(
      service.checkout(owner(), 'price_indie_month'),
    ).rejects.toBeInstanceOf(BillingConflictError);

    expect(workspace).toMatchObject({
      plan: 'indie',
      subscriptionId: 'sub_live',
      subscriptionStatus: 'active',
    });
    expect(effectivePlan(workspace, NOW)).toBe('indie');
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it('restores it from the nightly sweep without the customer doing anything', async () => {
    const { reconciler, workspace } = build([paidFor()]);

    await expect(reconciler.reconcile()).resolves.toMatchObject({
      corrected: 1,
      orphanSubscriptions: [],
    });
    expect(effectivePlan(workspace, NOW)).toBe('indie');
  });

  it('sends a paused subscription to the portal rather than a second checkout', async () => {
    const { service, workspace } = build([paidFor({ status: 'paused' })]);

    const refusal = await service
      .checkout(owner(), 'price_indie_month')
      .catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(BillingConflictError);
    expect((refusal as BillingConflictError).detail).toEqual({
      reason: 'subscription_exists',
      recovery: 'portal',
    });
    expect((refusal as BillingConflictError).message).toMatch(
      /add a payment method/i,
    );
    expect(workspace.subscriptionId).toBe('sub_live');
  });
});
