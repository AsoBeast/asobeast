import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type Stripe from 'stripe';
import { TrialClaims } from '../auth/trial-claims';
import { workspaceOwnerEmail } from '../auth/workspace-owner';
import { PrismaService } from '../prisma/prisma.service';
import { STRIPE_MAX_NETWORK_RETRIES, STRIPE_TIMEOUT_MS } from './stripe.client';
import { isMissingResource } from './stripe-errors';
import { StripeService } from './stripe.service';

const SETTLE_LOCK = 2_847_513;

const SETTLE_TIMEOUT_MS =
  STRIPE_TIMEOUT_MS * (STRIPE_MAX_NETWORK_RETRIES + 1) + 5_000;

export type TrialSettlement =
  | { outcome: 'skipped' | 'settled' }
  | { outcome: 'ended'; subscription: Stripe.Subscription };

const SKIPPED: TrialSettlement = { outcome: 'skipped' };

export interface TrialSettlementSubject {
  id: string;
  trialClaimedAt: Date | null;
}

type ClaimName = 'mailbox' | 'card';

@Injectable()
export class TrialStarts {
  private readonly logger = new Logger(TrialStarts.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly claims: TrialClaims,
    private readonly stripe: StripeService,
  ) {}

  async settle(
    workspace: TrialSettlementSubject,
    subscription: Stripe.Subscription,
  ): Promise<TrialSettlement> {
    if (!subscription.trial_start || workspace.trialClaimedAt !== null) {
      return SKIPPED;
    }
    const fingerprint = await this.cardFingerprintOf(subscription);
    const owner = await workspaceOwnerEmail(this.prisma, workspace.id);

    return this.prisma.withTransaction(
      async (tx): Promise<TrialSettlement> => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SETTLE_LOCK}, hashtext(${workspace.id}))`;
        const current = await tx.workspace.findUnique({
          where: { id: workspace.id },
          select: { trialClaimedAt: true },
        });
        if (current?.trialClaimedAt) return SKIPPED;
        const lost = await this.claim(tx, workspace.id, owner, fingerprint);
        const ended =
          lost.length > 0
            ? await this.endTrial(workspace.id, subscription, lost)
            : null;
        await markSettled(tx, workspace.id);
        return ended
          ? { outcome: 'ended', subscription: ended }
          : { outcome: 'settled' };
      },
      { timeout: SETTLE_TIMEOUT_MS },
    );
  }

  private async claim(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    owner: string | null,
    fingerprint: string | null,
  ): Promise<ClaimName[]> {
    const lost: ClaimName[] = [];
    if (!owner) {
      this.logger.warn(
        `workspace ${workspaceId} has no owner, so its trial claims no mailbox`,
      );
    } else if (!(await this.claims.claim(tx, owner))) {
      lost.push('mailbox');
    }
    if (fingerprint && !(await this.claims.claimCard(tx, fingerprint))) {
      lost.push('card');
    }
    return lost;
  }

  private async endTrial(
    workspaceId: string,
    subscription: Stripe.Subscription,
    lost: ClaimName[],
  ): Promise<Stripe.Subscription> {
    const which = lost.join(' and ');
    if (subscription.status !== 'trialing') {
      this.logger.warn(
        `workspace ${workspaceId} lost the ${which} claim of subscription ${subscription.id}, whose trial already ended`,
      );
      return subscription;
    }
    const ended = await this.stripe.endTrialNow(subscription.id);
    this.logger.warn(
      `workspace ${workspaceId} lost the ${which} claim, so the trial of subscription ${subscription.id} was ended at stripe and the plan is charged now`,
    );
    return ended;
  }

  private async cardFingerprintOf(
    subscription: Stripe.Subscription,
  ): Promise<string | null> {
    const method = await this.paymentMethodOf(subscription);
    const fingerprint =
      method?.type === 'card' ? (method.card?.fingerprint ?? null) : null;
    if (!fingerprint) {
      this.logger.debug(
        `no card fingerprint on the payment method of subscription ${subscription.id} (${method?.type ?? 'none'}), so its trial claims no card`,
      );
    }
    return fingerprint;
  }

  private async paymentMethodOf(
    subscription: Stripe.Subscription,
  ): Promise<Stripe.PaymentMethod | null> {
    const method = subscription.default_payment_method;
    if (!method) return null;
    if (typeof method !== 'string') return method;
    return this.stripe.retrievePaymentMethod(method).catch((error: unknown) => {
      if (isMissingResource(error)) return null;
      throw error;
    });
  }
}

function markSettled(tx: Prisma.TransactionClient, workspaceId: string) {
  return tx.workspace.updateMany({
    where: { id: workspaceId, trialClaimedAt: null },
    data: { trialClaimedAt: new Date() },
  });
}
