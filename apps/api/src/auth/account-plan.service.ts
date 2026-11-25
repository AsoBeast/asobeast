import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PLANS,
  UPGRADE_PATH,
  billingIntervalOf,
  nextPlan,
  paidPlanOf,
  type AccountPlan,
  type PaidPlanName,
  type PlanName,
  type TrialOffer,
} from '@asobeast/shared';
import {
  holdsSubscription,
  pendingBy,
  stalledBy,
} from '../billing/subscription-status';
import { AiGateway } from '../ai/ai-gateway.service';
import { Env } from '../config/env';
import { QuotaService } from './quota.service';
import { isEntitled, type WorkspaceEntitlement } from './entitlement';
import { heldPlanOf, type HeldPlanSource } from './entry-step';

type WorkspacePlan = WorkspaceEntitlement &
  HeldPlanSource & {
    billingCustomerId: string | null;
    subscriptionId: string | null;
    subscriptionStatus: string | null;
    cancelAtPeriodEnd: boolean;
    billingInterval: string | null;
    firstPaidAt: Date | null;
    trialRefusedSubscriptionId: string | null;
    pendingPlan: string | null;
  };

@Injectable()
export class AccountPlanService {
  constructor(
    private readonly quota: QuotaService,
    private readonly config: ConfigService<Env, true>,
    private readonly ai: AiGateway,
  ) {}

  async describe(
    workspace: WorkspacePlan,
    now: Date,
    offer: TrialOffer | null,
  ): Promise<AccountPlan> {
    const billing = this.config.get('BILLING_ENABLED', { infer: true });
    const [{ plan, limits, apps, keywordMarkets }, aiCalls] = await Promise.all(
      [this.quota.usage(), this.ai.usage(now)],
    );

    return {
      plan,
      displayName: PLANS[plan].displayName,
      billing,
      entitled: !billing || isEntitled(workspace, now),
      hasBillingAccount: workspace.billingCustomerId !== null,
      subscribed: holdsSubscription(workspace),
      subscriptionStalled:
        holdsSubscription(workspace) &&
        stalledBy(workspace.subscriptionStatus, workspace.firstPaidAt !== null),
      subscriptionPending:
        holdsSubscription(workspace) && pendingBy(workspace.subscriptionStatus),
      trialing: workspace.subscriptionStatus === 'trialing',
      trialChargeFailed:
        holdsSubscription(workspace) &&
        workspace.subscriptionStatus === 'past_due' &&
        workspace.firstPaidAt === null,
      ...(billing ? { trialOffer: offer } : {}),
      ...(billing && refusedTrialStands(workspace)
        ? { trialRefused: true }
        : {}),
      billingInterval: billingIntervalOf(workspace.billingInterval),
      cancelAtPeriodEnd: workspace.cancelAtPeriodEnd,
      trialEndsAt: workspace.trialEndsAt?.toISOString() ?? null,
      renewsAt: workspace.planExpiresAt?.toISOString() ?? null,
      scheduledPlan: scheduledPlanOf(workspace, plan),
      upgradeTo: billing ? nextPlan(plan) : null,
      upgradePath: UPGRADE_PATH,
      limits,
      usage: {
        apps: { used: apps, limit: limits.apps },
        keywordMarkets: {
          used: keywordMarkets,
          limit: limits.keywordMarkets,
        },
        aiCalls,
      },
    };
  }
}

function scheduledPlanOf(
  workspace: WorkspacePlan,
  plan: PlanName,
): PaidPlanName | null {
  if (!holdsSubscription(workspace) || workspace.cancelAtPeriodEnd) return null;
  const next = paidPlanOf(workspace.pendingPlan);
  return next === plan ? null : next;
}

function refusedTrialStands(workspace: WorkspacePlan): boolean {
  return (
    workspace.trialRefusedSubscriptionId !== null && !heldPlanOf(workspace)
  );
}
