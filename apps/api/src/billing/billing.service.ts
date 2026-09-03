import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import {
  CHECKOUT_RETURN_COMPLETE,
  CHECKOUT_RETURN_PARAM,
  UPGRADE_PATH,
  type BillingCatalog,
} from '@asobeast/shared';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import type { AccountUser } from '../auth/auth.types';
import { BillingConflictError } from './billing.errors';
import { BillingReconciler } from './billing-reconciler.service';
import { PriceCatalog } from './price-catalog';
import { isMissingResource, reasonOf } from './stripe-errors';
import { StripeService } from './stripe.service';
import { effectOf, holdsSubscription } from './subscription-status';
import { heldSubscription } from './subscription-state';
import { belongsToWorkspace, WORKSPACE_METADATA_KEY } from './workspace-link';

const CHECKOUT_CLAIM_MS = 120_000;

const CHECKOUT_IN_FLIGHT =
  'A checkout is already being opened for this workspace. Try again in a couple of minutes.';

const ALREADY_SUBSCRIBED =
  'This workspace already has a subscription. Change the plan or cancel it in the billing portal instead of buying a second one.';

const SUBSCRIPTION_NEEDS_ATTENTION =
  'This workspace already has a subscription that is not collecting. Add a payment method in the billing portal to switch it back on rather than buying a second one.';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly stripe: StripeService,
    private readonly prices: PriceCatalog,
    private readonly reconciler: BillingReconciler,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  catalog(): BillingCatalog {
    return {
      enabled: this.missingConfiguration().length === 0,
      prices: this.prices.prices,
    };
  }

  async checkout(user: AccountUser, priceId: string): Promise<string> {
    this.refuseUnprovisionableCheckout();
    const price = this.prices.require(priceId);
    await this.refuseSecondSubscription();
    const customerId = await this.customerFor(user);
    await this.refuseLiveSubscription(user.workspaceId, customerId);

    const workspaceId = user.workspaceId;
    const attempt = randomUUID();
    await this.claimCheckout(workspaceId, attempt);
    try {
      await this.closeOpenCheckout(workspaceId);
      const session = await this.stripe.createCheckoutSession(
        {
          mode: 'subscription',
          customer: customerId,
          line_items: [{ price: price.priceId, quantity: 1 }],
          client_reference_id: workspaceId,
          subscription_data: {
            metadata: { [WORKSPACE_METADATA_KEY]: workspaceId },
          },
          success_url: this.checkoutReturnUrl(),
          cancel_url: this.webUrl(UPGRADE_PATH),
          allow_promotion_codes: true,
        },
        `checkout:${workspaceId}:${attempt}`,
      );

      if (!session.url) {
        throw new Error('Stripe returned a checkout session with no url');
      }
      await this.recordCheckout(workspaceId, attempt, session.id);
      return session.url;
    } catch (error) {
      await this.releaseCheckout(workspaceId, attempt);
      throw error;
    }
  }

  private async claimCheckout(
    workspaceId: string,
    attempt: string,
  ): Promise<void> {
    const now = new Date();
    const stale = new Date(now.getTime() - CHECKOUT_CLAIM_MS);
    const claimed = await this.prisma.workspace.updateMany({
      where: {
        id: workspaceId,
        OR: [{ checkoutClaimedAt: null }, { checkoutClaimedAt: { lt: stale } }],
      },
      data: { checkoutClaimedAt: now, checkoutClaimToken: attempt },
    });
    if (claimed.count === 0) {
      throw new BillingConflictError('checkout_in_flight', CHECKOUT_IN_FLIGHT);
    }
  }

  private async closeOpenCheckout(workspaceId: string): Promise<void> {
    const workspace = await this.prisma.workspace.findFirst({
      select: { checkoutSessionId: true },
    });
    const sessionId = workspace?.checkoutSessionId;
    if (!sessionId) return;

    const session = await this.stripe
      .retrieveCheckoutSession(sessionId)
      .catch((error: unknown) => {
        if (!isMissingResource(error)) throw error;
        this.logger.warn(
          `stripe no longer knows the checkout session ${sessionId}, forgetting it: ${reasonOf(error)}`,
        );
        return null;
      });
    if (session === null) {
      await this.forgetCheckout(workspaceId);
      return;
    }
    if (session.status !== 'open') return;

    await this.stripe.expireCheckoutSession(sessionId);
    this.logger.log(
      `expired the checkout session ${sessionId} before opening another`,
    );
  }

  private async forgetCheckout(workspaceId: string): Promise<void> {
    await this.prisma.workspace.updateMany({
      where: { id: workspaceId },
      data: { checkoutSessionId: null },
    });
  }

  private async recordCheckout(
    workspaceId: string,
    attempt: string,
    sessionId: string,
  ): Promise<void> {
    const recorded = await this.prisma.workspace.updateMany({
      where: { id: workspaceId, checkoutClaimToken: attempt },
      data: {
        checkoutSessionId: sessionId,
        checkoutClaimedAt: null,
        checkoutClaimToken: null,
      },
    });
    if (recorded.count > 0) return;

    this.logger.warn(
      `checkout ${attempt} lost the lease on workspace ${workspaceId} while Stripe was answering; expiring ${sessionId} rather than leaving it payable`,
    );
    await this.expireOrphan(sessionId);
    throw new BillingConflictError('checkout_in_flight', CHECKOUT_IN_FLIGHT);
  }

  private async releaseCheckout(
    workspaceId: string,
    attempt: string,
  ): Promise<void> {
    await this.prisma.workspace.updateMany({
      where: { id: workspaceId, checkoutClaimToken: attempt },
      data: { checkoutClaimedAt: null, checkoutClaimToken: null },
    });
  }

  private async expireOrphan(sessionId: string): Promise<void> {
    await this.stripe
      .expireCheckoutSession(sessionId)
      .catch((error: unknown) =>
        this.logger.error(
          `could not expire the orphaned checkout session ${sessionId}: ${reasonOf(error)}`,
        ),
      );
  }

  private async refuseLiveSubscription(
    workspaceId: string,
    customerId: string,
  ): Promise<void> {
    const held = await this.stripe.listCustomerSubscriptions(customerId);
    const live = heldSubscription(
      held.filter((subscription) =>
        belongsToWorkspace(subscription, workspaceId),
      ),
    );
    if (!live) return;

    this.logger.warn(
      `stripe already holds a live subscription for ${customerId} that no webhook recorded; reconciling workspace ${workspaceId} before refusing the checkout`,
    );
    await this.recordWhatStripeHolds(workspaceId);
    throw subscriptionExists(live.status);
  }

  private async recordWhatStripeHolds(workspaceId: string): Promise<void> {
    await this.reconciler
      .reconcileOne(workspaceId)
      .catch((error: unknown) =>
        this.logger.error(
          `workspace ${workspaceId} could not be reconciled while its checkout was refused: ${reasonOf(error)}`,
        ),
      );
  }

  async portal(user: AccountUser): Promise<string> {
    const customerId = await this.customerFor(user);
    const session = await this.stripe.createPortalSession(
      { customer: customerId, return_url: this.returnUrl() },
      `portal:${user.workspaceId}:${minuteBucket()}`,
    );
    return session.url;
  }

  private missingConfiguration(): string[] {
    const missing: string[] = [];
    if (!this.stripe.enabled) missing.push('STRIPE_SECRET_KEY');
    if (!this.prices.configured) missing.push('STRIPE_PRICE_*');
    if (!this.config.get('STRIPE_WEBHOOK_SECRET', { infer: true })) {
      missing.push('STRIPE_WEBHOOK_SECRET');
    }
    if (!this.config.get('WEB_PUBLIC_URL', { infer: true })) {
      missing.push('WEB_PUBLIC_URL');
    }
    return missing;
  }

  private refuseUnprovisionableCheckout(): void {
    const missing = this.missingConfiguration();
    if (missing.length === 0) return;

    this.logger.error(
      `refused a checkout because ${missing.join(', ')} is not configured; a payment taken now could never be provisioned`,
    );
    throw new ServiceUnavailableException(
      'Checkout is not configured on this instance.',
    );
  }

  private async refuseSecondSubscription(): Promise<void> {
    const workspace = await this.prisma.workspace.findFirst({
      select: { subscriptionId: true, subscriptionStatus: true },
    });
    if (!workspace || !holdsSubscription(workspace)) return;

    throw subscriptionExists(workspace.subscriptionStatus);
  }

  private async customerFor(user: AccountUser): Promise<string> {
    const stored = await this.storedCustomer();
    if (stored) return stored;

    const customer = await this.stripe.createCustomer(
      {
        email: user.email,
        name: user.workspace.name,
        metadata: { [WORKSPACE_METADATA_KEY]: user.workspaceId },
      },
      `customer:${user.workspaceId}`,
    );
    const claimed = await this.prisma.workspace.updateMany({
      where: { id: user.workspaceId, billingCustomerId: null },
      data: { billingCustomerId: customer.id },
    });
    if (claimed.count > 0) return customer.id;

    this.logger.warn(
      `workspace ${user.workspaceId} already carried a stripe customer; keeping the stored one`,
    );
    return (await this.storedCustomer()) ?? customer.id;
  }

  private async storedCustomer(): Promise<string | null> {
    const workspace = await this.prisma.workspace.findFirst({
      select: { billingCustomerId: true },
    });
    return workspace?.billingCustomerId ?? null;
  }

  private returnUrl(): string {
    const configured = this.config.get('STRIPE_PORTAL_RETURN_URL', {
      infer: true,
    });
    return configured ?? this.webUrl('/settings');
  }

  private checkoutReturnUrl(): string {
    const url = new URL(this.returnUrl());
    url.searchParams.set(CHECKOUT_RETURN_PARAM, CHECKOUT_RETURN_COMPLETE);
    return url.toString();
  }

  private webUrl(path: string): string {
    const base = this.config.get('WEB_PUBLIC_URL', { infer: true }) ?? '';
    return `${base}${path}`;
  }
}

function minuteBucket(): number {
  return Math.floor(Date.now() / 60_000);
}

function subscriptionExists(status: string | null): BillingConflictError {
  const stalled = status !== null && effectOf(status) === 'recoverable';
  return new BillingConflictError(
    'subscription_exists',
    stalled ? SUBSCRIPTION_NEEDS_ATTENTION : ALREADY_SUBSCRIBED,
  );
}
