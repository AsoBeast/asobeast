import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import type Stripe from 'stripe';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { BillingWebhookService } from './billing-webhook.service';
import { WORKSPACE_METADATA_KEY } from './billing.service';
import { AccountNotifier } from './account-notifier.service';
import { PriceCatalog } from './price-catalog';
import { StripeService } from './stripe.service';

const WORKSPACE = 'ws_paid';
const PERIOD_END = 1_800_000_000;

const CONFIG = {
  STRIPE_WEBHOOK_SECRET: 'whsec_test',
  STRIPE_PRICE_INDIE_MONTHLY: 'price_indie_month',
  STRIPE_PRICE_ULTIMATE_MONTHLY: 'price_ultimate_month',
};

const config = {
  get: (key: keyof typeof CONFIG) => CONFIG[key],
} as unknown as ConfigService<Env, true>;

const subscriptionOf = (over: Record<string, unknown> = {}) =>
  ({
    id: 'sub_1',
    status: 'active',
    cancel_at_period_end: false,
    customer: 'cus_1',
    metadata: { [WORKSPACE_METADATA_KEY]: WORKSPACE },
    items: {
      data: [
        {
          current_period_end: PERIOD_END,
          price: { id: 'price_indie_month' },
        },
      ],
    },
    ...over,
  }) as unknown as Stripe.Subscription;

const eventOf = (over: Partial<Stripe.Event> = {}): Stripe.Event =>
  ({
    id: 'evt_1',
    type: 'customer.subscription.updated',
    created: 1_700_000_000,
    data: { object: subscriptionOf() },
    ...over,
  }) as Stripe.Event;

describe('BillingWebhookService', () => {
  const build = (
    over: {
      stored?: Record<string, unknown> | null;
      workspace?: Record<string, unknown> | null;
      subscription?: Stripe.Subscription;
      duplicate?: boolean;
    } = {},
  ) => {
    const create = jest.fn(() =>
      over.duplicate
        ? Promise.reject(
            new Prisma.PrismaClientKnownRequestError('duplicate', {
              code: 'P2002',
              clientVersion: 'test',
            }),
          )
        : Promise.resolve({}),
    );
    const update = jest.fn().mockResolvedValue({});
    const workspaceUpdate = jest.fn().mockResolvedValue({});
    const constructEvent = jest.fn().mockReturnValue(eventOf());
    const notify = jest.fn().mockResolvedValue('delivered');
    const notifier = {
      notify,
      appUrl: 'https://app.example.com',
    } as unknown as AccountNotifier;

    const prisma = {
      billingEvent: {
        create,
        update,
        findUnique: jest.fn(() =>
          Promise.resolve(over.stored === undefined ? null : over.stored),
        ),
      },
      workspace: {
        findUnique: jest.fn(() =>
          Promise.resolve(
            over.workspace === undefined
              ? {
                  id: WORKSPACE,
                  subscriptionEventAt: null,
                  dunningNotifiedAt: null,
                }
              : over.workspace,
          ),
        ),
        update: workspaceUpdate,
      },
    } as unknown as PrismaService;

    const service = new BillingWebhookService(
      {
        enabled: true,
        constructEvent,
        retrieveSubscription: jest
          .fn()
          .mockResolvedValue(over.subscription ?? subscriptionOf()),
      } as unknown as StripeService,
      new PriceCatalog(config),
      prisma,
      {
        becauseThisWorkIsNotOwnedByOneWorkspace: <T>(
          _justification: string,
          work: () => Promise<T>,
        ) => work(),
      } as unknown as CrossTenantAccess,
      notifier,
      config,
    );

    return { service, create, update, workspaceUpdate, constructEvent, notify };
  };

  it('refuses a delivery with no signature', () => {
    const { service } = build();

    expect(() => service.verify(Buffer.from('{}'), undefined)).toThrow(
      BadRequestException,
    );
  });

  it('refuses a delivery whose signature does not verify', () => {
    const { service, constructEvent } = build();
    constructEvent.mockImplementation(() => {
      throw new Error('no signatures found matching the expected signature');
    });

    expect(() => service.verify(Buffer.from('{}'), 'sig')).toThrow(
      BadRequestException,
    );
  });

  it('refuses every delivery when billing is not configured', () => {
    const service = new BillingWebhookService(
      { enabled: false } as unknown as StripeService,
      new PriceCatalog(config),
      {} as unknown as PrismaService,
      {} as unknown as CrossTenantAccess,
      {} as unknown as AccountNotifier,
      { get: () => undefined } as unknown as ConfigService<Env, true>,
    );

    expect(() => service.verify(Buffer.from('{}'), 'sig')).toThrow(
      ServiceUnavailableException,
    );
  });

  it('records a first delivery and asks for it to be processed', async () => {
    const { service, create } = build();

    await expect(service.receive(eventOf())).resolves.toEqual({
      received: true,
      pending: true,
    });
    expect(create).toHaveBeenCalled();
  });

  it('asks a replay of an unprocessed delivery to be processed again', async () => {
    const { service } = build({
      duplicate: true,
      stored: { id: 'evt_1', processedAt: null },
    });

    await expect(service.receive(eventOf())).resolves.toEqual({
      received: true,
      pending: true,
    });
  });

  it('acknowledges a replay of an applied delivery without asking for more work', async () => {
    const { service } = build({
      duplicate: true,
      stored: { id: 'evt_1', processedAt: new Date() },
    });

    await expect(service.receive(eventOf())).resolves.toEqual({
      received: true,
      pending: false,
    });
  });

  it('asks for processing when the stored receipt is gone', async () => {
    const { service } = build({ duplicate: true, stored: null });

    await expect(service.receive(eventOf())).resolves.toEqual({
      received: true,
      pending: true,
    });
  });

  it('applies a stored event onto the workspace it names', async () => {
    const { service, workspaceUpdate } = build({
      stored: { id: 'evt_1', processedAt: null, payload: eventOf() },
    });

    await service.process('evt_1');

    const [args] = workspaceUpdate.mock.calls[0] as [
      { where: { id: string }; data: Record<string, unknown> },
    ];
    expect(args.where.id).toBe(WORKSPACE);
    expect(args.data).toMatchObject({
      plan: 'indie',
      subscriptionId: 'sub_1',
      subscriptionStatus: 'active',
      cancelAtPeriodEnd: false,
      billingCustomerId: 'cus_1',
      planExpiresAt: new Date(PERIOD_END * 1000),
    });
  });

  it('reopens truncated capacity when a paid plan takes effect', async () => {
    const { service, workspaceUpdate } = build({
      stored: { id: 'evt_1', processedAt: null, payload: eventOf() },
    });

    await service.process('evt_1');

    const [args] = workspaceUpdate.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(args.data).toMatchObject({
      overLimitSince: null,
      overLimitNotifiedAt: null,
    });
  });

  it('leaves the over-limit clock alone when the plan drops to free', async () => {
    const { service, workspaceUpdate } = build({
      stored: { id: 'evt_1', processedAt: null, payload: eventOf() },
      subscription: subscriptionOf({ status: 'canceled' }),
    });

    await service.process('evt_1');

    const [args] = workspaceUpdate.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(args.data).not.toHaveProperty('overLimitSince');
  });

  it('warns the owner the first time a charge fails', async () => {
    const { service, notify, workspaceUpdate } = build({
      stored: { id: 'evt_1', processedAt: null, payload: eventOf() },
      subscription: subscriptionOf({ status: 'past_due' }),
    });

    await service.process('evt_1');

    expect(notify).toHaveBeenCalledWith(
      WORKSPACE,
      'billing.payment_failed',
      expect.objectContaining({
        subject: 'Your asobeast payment did not go through',
      }) as Record<string, unknown>,
    );
    const [args] = workspaceUpdate.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(args.data.dunningNotifiedAt).toBeInstanceOf(Date);
    expect(args.data.plan).toBe('indie');
  });

  it('leaves dunning unmarked when the warning could not be sent', async () => {
    const { service, workspaceUpdate, notify } = build({
      stored: { id: 'evt_1', processedAt: null, payload: eventOf() },
      subscription: subscriptionOf({ status: 'past_due' }),
    });
    notify.mockResolvedValue('failed');

    await service.process('evt_1');

    const [args] = workspaceUpdate.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(args.data).not.toHaveProperty('dunningNotifiedAt');
    expect(args.data.subscriptionStatus).toBe('past_due');
  });

  it('warns only once through the whole retry window', async () => {
    const { service, notify } = build({
      stored: { id: 'evt_1', processedAt: null, payload: eventOf() },
      subscription: subscriptionOf({ status: 'past_due' }),
      workspace: {
        id: WORKSPACE,
        subscriptionEventAt: null,
        dunningNotifiedAt: new Date('2026-08-01T00:00:00.000Z'),
      },
    });

    await service.process('evt_1');

    expect(notify).not.toHaveBeenCalled();
  });

  it('clears the dunning flag the moment payment recovers', async () => {
    const { service, workspaceUpdate } = build({
      stored: { id: 'evt_1', processedAt: null, payload: eventOf() },
      workspace: {
        id: WORKSPACE,
        subscriptionEventAt: null,
        dunningNotifiedAt: new Date('2026-08-01T00:00:00.000Z'),
      },
    });

    await service.process('evt_1');

    const [args] = workspaceUpdate.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(args.data).toMatchObject({ dunningNotifiedAt: null });
  });

  it('leaves a sent downgrade warning alone when nothing pending changed', async () => {
    const { service, workspaceUpdate } = build({
      stored: { id: 'evt_1', processedAt: null, payload: eventOf() },
      workspace: {
        id: WORKSPACE,
        subscriptionEventAt: null,
        dunningNotifiedAt: null,
        pendingPlan: null,
        downgradeWarnedAt: new Date('2026-08-01T00:00:00.000Z'),
      },
    });

    await service.process('evt_1');

    const [args] = workspaceUpdate.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(args.data).not.toHaveProperty('downgradeWarnedAt');
    expect(args.data).not.toHaveProperty('pendingPlan');
  });

  it('ignores an event older than the state already stored', async () => {
    const { service, workspaceUpdate } = build({
      stored: { id: 'evt_1', processedAt: null, payload: eventOf() },
      workspace: {
        id: WORKSPACE,
        subscriptionEventAt: new Date(1_900_000_000 * 1000),
      },
    });

    await service.process('evt_1');

    expect(workspaceUpdate).not.toHaveBeenCalled();
  });

  it('never applies the same stored event twice', async () => {
    const { service, workspaceUpdate } = build({
      stored: { id: 'evt_1', processedAt: new Date(), payload: eventOf() },
    });

    await service.process('evt_1');

    expect(workspaceUpdate).not.toHaveBeenCalled();
  });

  it('ignores an event type it does not act on', async () => {
    const { service, workspaceUpdate, update } = build({
      stored: {
        id: 'evt_1',
        processedAt: null,
        payload: eventOf({ type: 'customer.discount.created' }),
      },
    });

    await service.process('evt_1');

    expect(workspaceUpdate).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ failure: null }) as Record<
          string,
          unknown
        >,
      }),
    );
  });

  it('retries rather than silently dropping a subscription it cannot place', async () => {
    const { service, workspaceUpdate } = build({
      stored: { id: 'evt_1', processedAt: null, payload: eventOf() },
      workspace: null,
    });

    await expect(service.process('evt_1')).rejects.toThrow(
      /belongs to no known workspace/,
    );
    expect(workspaceUpdate).not.toHaveBeenCalled();
  });

  it('refuses to move a subscription onto a workspace another customer owns', async () => {
    const { service, workspaceUpdate } = build({
      stored: { id: 'evt_1', processedAt: null, payload: eventOf() },
      workspace: {
        id: WORKSPACE,
        subscriptionEventAt: null,
        dunningNotifiedAt: null,
        billingCustomerId: 'cus_someone_else',
      },
    });

    await expect(service.process('evt_1')).rejects.toThrow(
      /different customer/,
    );
    expect(workspaceUpdate).not.toHaveBeenCalled();
  });

  it('revokes the plan when the subscription is unpaid', async () => {
    const { service, workspaceUpdate } = build({
      stored: { id: 'evt_1', processedAt: null, payload: eventOf() },
      subscription: subscriptionOf({ status: 'unpaid' }),
    });

    await service.process('evt_1');

    const [args] = workspaceUpdate.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(args.data).toMatchObject({
      plan: 'free',
      subscriptionStatus: 'unpaid',
    });
  });

  it('records the failure when an unknown price blocks provisioning', async () => {
    const { service, update } = build({
      stored: { id: 'evt_1', processedAt: null, payload: eventOf() },
      subscription: subscriptionOf({
        items: {
          data: [
            { current_period_end: PERIOD_END, price: { id: 'price_mystery' } },
          ],
        },
      }),
    });

    await expect(service.process('evt_1')).rejects.toThrow(/price_mystery/);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          failure: expect.stringContaining('price_mystery') as string,
        }) as Record<string, unknown>,
      }),
    );
  });
});
