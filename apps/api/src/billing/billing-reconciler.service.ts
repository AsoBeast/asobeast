import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Workspace } from '@prisma/client';
import type Stripe from 'stripe';
import { FREE_PLAN, planOf } from '@asobeast/shared';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { PrismaService } from '../prisma/prisma.service';
import { PriceCatalog } from './price-catalog';
import { isMissingResource, reasonOf } from './stripe-errors';
import { stateOf, type SubscriptionState } from './subscription-state';
import { StripeService } from './stripe.service';

const RECONCILE_JUSTIFICATION =
  'reconciliation compares every workspace against the billing provider';

export interface ReconcileReport {
  checked: number;
  corrected: number;
  orphanSubscriptions: string[];
  unreconciled: string[];
}

type Outcome = 'corrected' | 'agreed' | 'unreachable';

@Injectable()
export class BillingReconciler {
  private readonly logger = new Logger(BillingReconciler.name);

  constructor(
    private readonly stripe: StripeService,
    private readonly prices: PriceCatalog,
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
  ) {}

  reconcile(): Promise<ReconcileReport> {
    return this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      RECONCILE_JUSTIFICATION,
      () => this.sweep(),
    );
  }

  reconcileOne(workspaceId: string): Promise<ReconcileReport> {
    return this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      RECONCILE_JUSTIFICATION,
      async () => {
        const workspace = await this.prisma.workspace.findUnique({
          where: { id: workspaceId },
        });
        if (!workspace) throw new NotFoundException('Workspace not found');

        const outcome = await this.attempt(workspace);
        if (outcome === 'unreachable') {
          throw new ServiceUnavailableException(
            'Stripe could not be reached, so this workspace keeps the plan it already has. Try again shortly.',
          );
        }
        return {
          checked: 1,
          corrected: outcome === 'corrected' ? 1 : 0,
          orphanSubscriptions: [],
          unreconciled: [],
        };
      },
    );
  }

  private async sweep(): Promise<ReconcileReport> {
    if (!this.stripe.enabled) {
      return {
        checked: 0,
        corrected: 0,
        orphanSubscriptions: [],
        unreconciled: [],
      };
    }

    const known = await this.prisma.workspace.findMany({
      where: {
        OR: [{ subscriptionId: { not: null } }, { plan: { not: FREE_PLAN } }],
      },
    });

    let corrected = 0;
    const unreconciled: string[] = [];
    for (const workspace of known) {
      const outcome = await this.attempt(workspace);
      if (outcome === 'corrected') corrected += 1;
      if (outcome === 'unreachable') unreconciled.push(workspace.id);
    }

    const orphanSubscriptions = await this.orphans(known);
    this.logger.log(
      `reconciled ${known.length} workspaces, corrected ${corrected}, left ${unreconciled.length} unreconciled, found ${orphanSubscriptions.length} orphan subscriptions`,
    );
    return {
      checked: known.length,
      corrected,
      orphanSubscriptions,
      unreconciled,
    };
  }

  private async attempt(workspace: Workspace): Promise<Outcome> {
    try {
      return (await this.correct(workspace)) ? 'corrected' : 'agreed';
    } catch (error) {
      this.logger.error(
        `workspace ${workspace.id} could not be reconciled against Stripe, so it keeps ${workspace.plan}: ${reasonOf(error)}`,
      );
      return 'unreachable';
    }
  }

  private async correct(workspace: Workspace): Promise<boolean> {
    const desired = await this.desiredState(workspace);
    if (!desired) return this.revokeUnknownSubscription(workspace);

    if (matches(workspace, desired)) return false;

    this.logger.error(
      `workspace ${workspace.id} drifted from Stripe: local ${workspace.plan}/${workspace.subscriptionStatus ?? 'none'}, Stripe ${desired.plan}/${desired.status}`,
    );
    await this.prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        plan: desired.plan,
        planExpiresAt: desired.planExpiresAt,
        subscriptionId: desired.subscriptionId,
        subscriptionStatus: desired.status,
        cancelAtPeriodEnd: desired.cancelAtPeriodEnd,
      },
    });
    return true;
  }

  private async desiredState(
    workspace: Workspace,
  ): Promise<SubscriptionState | null> {
    if (!workspace.subscriptionId) return null;

    let subscription: Stripe.Subscription;
    try {
      subscription = await this.stripe.retrieveSubscription(
        workspace.subscriptionId,
      );
    } catch (error) {
      if (!isMissingResource(error)) throw error;
      this.logger.error(
        `workspace ${workspace.id} holds subscription ${workspace.subscriptionId} that Stripe has no record of: ${reasonOf(error)}`,
      );
      return null;
    }
    return stateOf(subscription, this.planFor(subscription));
  }

  private planFor(subscription: Stripe.Subscription) {
    const priceId = subscription.items.data[0]?.price.id ?? '';
    return this.prices.require(priceId).plan;
  }

  private async revokeUnknownSubscription(
    workspace: Workspace,
  ): Promise<boolean> {
    if (planOf(workspace.plan) === FREE_PLAN && !workspace.subscriptionId) {
      return false;
    }
    this.logger.error(
      `workspace ${workspace.id} claims ${workspace.plan} with no subscription Stripe recognises; revoking`,
    );
    await this.prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        plan: FREE_PLAN,
        subscriptionId: null,
        subscriptionStatus: null,
        cancelAtPeriodEnd: false,
      },
    });
    return true;
  }

  private async orphans(known: Workspace[]): Promise<string[]> {
    const owned = new Set(
      known.map((workspace) => workspace.subscriptionId).filter(Boolean),
    );
    const orphans: string[] = [];
    for await (const subscription of this.stripe.listActiveSubscriptions()) {
      if (owned.has(subscription.id)) continue;
      if (!ACTIVE_ENOUGH.has(subscription.status)) continue;
      orphans.push(subscription.id);
      this.logger.error(
        `stripe subscription ${subscription.id} (${subscription.status}) belongs to no workspace`,
      );
    }
    return orphans;
  }
}

const ACTIVE_ENOUGH = new Set<Stripe.Subscription.Status>([
  'trialing',
  'active',
  'past_due',
]);

function matches(workspace: Workspace, desired: SubscriptionState): boolean {
  return (
    workspace.plan === desired.plan &&
    workspace.subscriptionStatus === desired.status &&
    workspace.cancelAtPeriodEnd === desired.cancelAtPeriodEnd &&
    sameMoment(workspace.planExpiresAt, desired.planExpiresAt)
  );
}

function sameMoment(left: Date | null, right: Date | null): boolean {
  if (left === null || right === null) return left === right;
  return left.getTime() === right.getTime();
}
