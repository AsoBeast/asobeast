import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PLANS,
  UPGRADE_PATH,
  billingIntervalOf,
  nextPlan,
  type AccountPlan,
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

type WorkspacePlan = WorkspaceEntitlement & {
  billingCustomerId: string | null;
  subscriptionId: string | null;
  subscriptionStatus: string | null;
  cancelAtPeriodEnd: boolean;
  billingInterval: string | null;
  firstPaidAt: Date | null;
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
      billingInterval: billingIntervalOf(workspace.billingInterval),
      cancelAtPeriodEnd: workspace.cancelAtPeriodEnd,
      trialEndsAt: workspace.trialEndsAt?.toISOString() ?? null,
      renewsAt: workspace.planExpiresAt?.toISOString() ?? null,
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
