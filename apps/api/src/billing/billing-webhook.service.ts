import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type Workspace } from '@prisma/client';
import { UnrecoverableError } from 'bullmq';
import type Stripe from 'stripe';
import { isPaidPlan, type PlanName } from '@asobeast/shared';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { AccountNotifier, noticeSettled } from './account-notifier.service';
import { paymentFailed } from './account-mail';
import { type BillingEventOutcome } from './billing-event-outcome';
import { BillingEventQueue } from './billing-event-queue';
import { entersDunning, leavesDunning } from './dunning';
import { PriceCatalog, UnknownPriceError } from './price-catalog';
import { nextPhasePlan, scheduleIdOf } from './scheduled-plan';
import type { SubscriptionStatus } from './subscription-status';
import { projectionOf, stateFrom } from './subscription-state';
import { StripeService } from './stripe.service';
import {
  customerIdOfEvent,
  isHandled,
  subscriptionIdOf,
  workspaceIdOf,
} from './webhook-events';
import { WORKSPACE_METADATA_KEY, workspaceNamedBy } from './workspace-link';

const SETTINGS_PATH = '/settings';

const RECEIPT_JUSTIFICATION =
  'a stripe delivery names its workspace in metadata, not in the request scope';

export interface WebhookReceipt {
  received: true;
  pending: boolean;
}

@Injectable()
export class BillingWebhookService {
  private readonly logger = new Logger(BillingWebhookService.name);

  constructor(
    private readonly stripe: StripeService,
    private readonly prices: PriceCatalog,
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
    private readonly notifier: AccountNotifier,
    private readonly config: ConfigService<Env, true>,
    private readonly events: BillingEventQueue,
  ) {}

  verify(payload: Buffer, signature: string | undefined): Stripe.Event {
    const secret = this.config.get('STRIPE_WEBHOOK_SECRET', { infer: true });
    if (!this.stripe.enabled || !secret) {
      throw new ServiceUnavailableException('Billing is not configured');
    }
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }
    try {
      return this.stripe.constructEvent(payload, signature, secret);
    } catch (error) {
      this.logger.warn(
        `rejected a webhook delivery: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadRequestException('Invalid stripe signature');
    }
  }

  receive(event: Stripe.Event): Promise<WebhookReceipt> {
    return this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      RECEIPT_JUSTIFICATION,
      () => this.record(event),
    );
  }

  private async record(event: Stripe.Event): Promise<WebhookReceipt> {
    try {
      await this.prisma.billingEvent.create({
        data: {
          id: event.id,
          type: event.type,
          workspaceId: workspaceIdOf(event, WORKSPACE_METADATA_KEY),
          createdAt: new Date(event.created * 1000),
          payload: event as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (!isDuplicate(error)) throw error;
      return { received: true, pending: await this.awaitingWork(event.id) };
    }
    return { received: true, pending: true };
  }

  private async awaitingWork(eventId: string): Promise<boolean> {
    const stored = await this.prisma.billingEvent.findUnique({
      where: { id: eventId },
      select: { processedAt: true, outcome: true },
    });
    const pending = !stored?.processedAt;
    this.logger.log(
      `stripe event ${eventId} was already received and is ${pending ? 'still unprocessed' : `already settled as ${stored.outcome}`}`,
    );
    return pending;
  }

  process(eventId: string): Promise<void> {
    return this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      RECEIPT_JUSTIFICATION,
      () => this.apply(eventId),
    );
  }

  replay(eventId: string, workspaceId: string): Promise<void> {
    return this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      RECEIPT_JUSTIFICATION,
      async () => {
        const [row, workspace] = await Promise.all([
          this.prisma.billingEvent.findUnique({ where: { id: eventId } }),
          this.prisma.workspace.findUnique({ where: { id: workspaceId } }),
        ]);
        if (!row || !workspace || !namesWorkspace(row, workspace)) {
          throw new NotFoundException(
            'No such billing event for this workspace',
          );
        }
        await this.prisma.billingEvent.update({
          where: { id: eventId },
          data: { processedAt: null, outcome: null, failure: null },
        });
        await this.events.enqueue(eventId, `replay-${Date.now()}`);
        this.logger.log(
          `stripe event ${eventId} replayed for workspace ${workspaceId}`,
        );
      },
    );
  }

  private async apply(eventId: string): Promise<void> {
    const row = await this.prisma.billingEvent.findUnique({
      where: { id: eventId },
    });
    if (!row || row.processedAt) return;

    try {
      const outcome = await this.dispatch(
        row.payload as unknown as Stripe.Event,
      );
      await this.prisma.billingEvent.update({
        where: { id: eventId },
        data: { processedAt: new Date(), outcome, failure: null },
      });
    } catch (error) {
      const failure = error instanceof Error ? error.message : String(error);
      this.logger.error(`stripe event ${eventId} failed: ${failure}`);
      await this.prisma.billingEvent.update({
        where: { id: eventId },
        data: { failure },
      });
      if (this.awaitsAnOperator(error)) {
        this.logger.error(
          `stripe event ${eventId} failed and will not be retried until an operator replays it: ${failure}`,
        );
        throw new UnrecoverableError(failure);
      }
      throw error;
    }
  }

  private awaitsAnOperator(error: unknown): boolean {
    return error instanceof UnknownPriceError && this.prices.configured;
  }

  private async dispatch(event: Stripe.Event): Promise<BillingEventOutcome> {
    if (!isHandled(event.type)) {
      this.logger.debug(`ignoring unhandled stripe event ${event.type}`);
      return 'ignored';
    }
    const subscriptionId = subscriptionIdOf(event);
    if (!subscriptionId) {
      this.logger.warn(`stripe event ${event.id} names no subscription`);
      return 'ignored';
    }
    const subscription = await this.stripe.retrieveSubscription(subscriptionId);
    return this.applySubscription(event, subscription);
  }

  private async applySubscription(
    event: Stripe.Event,
    subscription: Stripe.Subscription,
  ): Promise<BillingEventOutcome> {
    const workspace = await this.workspaceFor(event, subscription);
    if (!workspace) {
      return this.orphaned(
        event,
        subscription,
        'names no workspace this instance knows',
      );
    }

    const customerId = customerIdOf(subscription);
    if (
      workspace.billingCustomerId &&
      workspace.billingCustomerId !== customerId
    ) {
      return this.orphaned(
        event,
        subscription,
        `names workspace ${workspace.id}, which belongs to customer ${workspace.billingCustomerId}`,
      );
    }

    const eventAt = new Date(event.created * 1000);
    if (
      workspace.subscriptionEventAt &&
      workspace.subscriptionEventAt > eventAt
    ) {
      this.logger.log(
        `stripe event ${event.id} is older than the state workspace ${workspace.id} already holds`,
      );
      return 'ignored';
    }

    const state = stateFrom(subscription, this.prices);
    await this.prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        ...projectionOf(state),
        subscriptionEventAt: eventAt,
        billingCustomerId: customerId,
        ...reopenedCapacity(state.plan),
        ...(await this.dunning(workspace, state.status)),
        ...(await this.pending(workspace, subscription, eventAt)),
      },
    });
    this.logger.log(
      `workspace ${workspace.id} is now ${state.plan} (${state.status})`,
    );
    return 'applied';
  }

  private orphaned(
    event: Stripe.Event,
    subscription: Stripe.Subscription,
    reason: string,
  ): BillingEventOutcome {
    this.logger.warn(
      `stripe event ${event.id} for subscription ${subscription.id} on customer ${customerIdOf(subscription)} ${reason}; settled as orphaned for the nightly reconciliation to report`,
    );
    return 'orphaned';
  }

  private async pending(
    workspace: Workspace,
    subscription: Stripe.Subscription,
    now: Date,
  ): Promise<{ pendingPlan?: string | null; downgradeWarnedAt?: null }> {
    const scheduleId = scheduleIdOf(subscription);
    if (!scheduleId) return this.settled(workspace, null);

    try {
      const schedule = await this.stripe.retrieveSchedule(scheduleId);
      return this.settled(
        workspace,
        nextPhasePlan(schedule, now, (priceId) => this.prices.find(priceId)),
      );
    } catch (error) {
      this.logger.warn(
        `could not read stripe schedule ${scheduleId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {};
    }
  }

  private settled(
    workspace: Workspace,
    pendingPlan: string | null,
  ): { pendingPlan?: string | null; downgradeWarnedAt?: null } {
    if (pendingPlan === workspace.pendingPlan) return {};
    return { pendingPlan, downgradeWarnedAt: null };
  }

  private async dunning(
    workspace: Workspace,
    status: SubscriptionStatus,
  ): Promise<{ dunningNotifiedAt?: Date | null }> {
    if (leavesDunning(workspace, status)) return { dunningNotifiedAt: null };
    if (!entersDunning(workspace, status)) return {};

    const outcome = await this.notifier.notify(
      workspace.id,
      'billing.payment_failed',
      paymentFailed(`${this.notifier.appUrl}${SETTINGS_PATH}`),
    );
    if (!noticeSettled(outcome)) return {};
    return { dunningNotifiedAt: new Date() };
  }

  private async workspaceFor(
    event: Stripe.Event,
    subscription: Stripe.Subscription,
  ) {
    const named =
      workspaceIdOf(event, WORKSPACE_METADATA_KEY) ??
      workspaceNamedBy(subscription);
    if (named) {
      return this.prisma.workspace.findUnique({ where: { id: named } });
    }
    const customerId = customerIdOf(subscription);
    if (!customerId) return null;
    return this.prisma.workspace.findUnique({
      where: { billingCustomerId: customerId },
    });
  }
}

function namesWorkspace(
  row: { workspaceId: string | null; payload: Prisma.JsonValue },
  workspace: { id: string; billingCustomerId: string | null },
): boolean {
  if (row.workspaceId !== null) return row.workspaceId === workspace.id;
  const customer = customerIdOfEvent(row.payload as unknown as Stripe.Event);
  return customer !== null && customer === workspace.billingCustomerId;
}

function reopenedCapacity(plan: PlanName) {
  if (!isPaidPlan(plan)) return {};
  return { overLimitSince: null, overLimitNotifiedAt: null };
}

function customerIdOf(subscription: Stripe.Subscription): string {
  return typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id;
}

function isDuplicate(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
