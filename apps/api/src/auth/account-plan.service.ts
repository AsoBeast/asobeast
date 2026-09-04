import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PLANS,
  UPGRADE_PATH,
  nextPlan,
  type AccountPlan,
} from '@asobeast/shared';
import { holdsSubscription, stalledBy } from '../billing/subscription-status';
import { Env } from '../config/env';
import { QuotaService } from './quota.service';
import { isEntitled, type WorkspaceEntitlement } from './entitlement';

type WorkspacePlan = WorkspaceEntitlement & {
  billingCustomerId: string | null;
  subscriptionId: string | null;
  subscriptionStatus: string | null;
  cancelAtPeriodEnd: boolean;
};

@Injectable()
export class AccountPlanService {
  constructor(
    private readonly quota: QuotaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async describe(
    workspace: WorkspacePlan,
    now = new Date(),
  ): Promise<AccountPlan> {
    const billing = this.config.get('BILLING_ENABLED', { infer: true });
    const { plan, limits, apps, keywordMarkets } = await this.quota.usage();

    return {
      plan,
      displayName: PLANS[plan].displayName,
      billing,
      entitled: !billing || isEntitled(workspace, now),
      hasBillingAccount: workspace.billingCustomerId !== null,
      subscribed: holdsSubscription(workspace),
      subscriptionStalled:
        holdsSubscription(workspace) && stalledBy(workspace.subscriptionStatus),
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
      },
    };
  }
}
