import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PLANS,
  billingIntervalOf,
  effectivePlan,
  paidPlanOf,
  planRenewalTerms,
} from '@asobeast/shared';
import { isEntitled } from '../auth/entitlement';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { AccountNotifier, noticeSettled } from './account-notifier.service';
import {
  trialNotice,
  trialRefused,
  type TrialNoticeContext,
} from './account-mail';
import {
  TRIAL_ENDED_NOTICE,
  dueTrialNotice,
  timeLeftLabel,
  type TrialNoticeDay,
} from './trial-notices';

const SWEEP_JUSTIFICATION =
  'trial milestones are counted across every workspace before notifying each';

const DAY_MS = 24 * 60 * 60 * 1000;

const TRIAL_SELECT = {
  id: true,
  plan: true,
  trialStartedAt: true,
  trialEndsAt: true,
  trialNoticeDay: true,
  billingInterval: true,
  cancelAtPeriodEnd: true,
  subscriptionId: true,
  subscriptionStatus: true,
  firstPaidAt: true,
  planExpiresAt: true,
  dunningNotifiedAt: true,
} as const;

interface TrialRow {
  id: string;
  plan: string;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  trialNoticeDay: number | null;
  billingInterval: string | null;
  cancelAtPeriodEnd: boolean;
  subscriptionId: string | null;
  subscriptionStatus: string | null;
  firstPaidAt: Date | null;
  planExpiresAt: Date | null;
  dunningNotifiedAt: Date | null;
}

@Injectable()
export class TrialNotifier {
  private readonly logger = new Logger(TrialNotifier.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
    private readonly notifier: AccountNotifier,
    private readonly config: ConfigService<Env, true>,
  ) {}

  sweep(now = new Date()): Promise<number> {
    if (!this.config.get('BILLING_ENABLED', { infer: true })) {
      return Promise.resolve(0);
    }
    return this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      SWEEP_JUSTIFICATION,
      () => this.notifyDue(now),
    );
  }

  private async notifyDue(now: Date): Promise<number> {
    const trials: TrialRow[] = await this.prisma.workspace.findMany({
      where: {
        trialStartedAt: { not: null },
        OR: [
          { trialNoticeDay: null },
          { trialNoticeDay: { lt: TRIAL_ENDED_NOTICE } },
        ],
        AND: [
          { OR: [{ subscriptionId: null }, { trialClaimedAt: { not: null } }] },
        ],
      },
      select: TRIAL_SELECT,
    });

    let sent = 0;
    for (const workspace of trials) {
      const day = noticeDayOf(workspace, now);
      if (day === null) continue;
      if (
        day === TRIAL_ENDED_NOTICE &&
        (isEntitled(workspace, now) || declineAlreadyMailed(workspace))
      ) {
        await this.record(workspace.id, TRIAL_ENDED_NOTICE);
        continue;
      }

      const outcome = await this.notifier.notify(
        workspace.id,
        `trial.day${day}`,
        trialNotice(day, this.contextOf(workspace, now)),
      );
      if (!noticeSettled(outcome)) continue;

      await this.record(workspace.id, day);
      if (outcome === 'delivered') sent += 1;
    }

    sent += await this.notifyRefused();
    if (sent > 0) this.logger.log(`sent ${sent} trial notices`);
    return sent;
  }

  private async notifyRefused(): Promise<number> {
    const refused = await this.prisma.workspace.findMany({
      where: {
        trialRefusedSubscriptionId: { not: null },
        trialNoticeDay: null,
        subscriptionId: null,
      },
      select: { id: true },
    });

    let sent = 0;
    for (const { id } of refused) {
      const outcome = await this.notifier.notify(
        id,
        'trial.refused',
        trialRefused(),
      );
      if (!noticeSettled(outcome)) continue;
      await this.record(id, TRIAL_ENDED_NOTICE);
      if (outcome === 'delivered') sent += 1;
    }
    return sent;
  }

  private record(workspaceId: string, day: number) {
    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { trialNoticeDay: day },
    });
  }

  private contextOf(workspace: TrialRow, now: Date): TrialNoticeContext {
    const paid = paidPlanOf(workspace.plan);
    return {
      card: workspace.subscriptionId !== null,
      days: this.lengthOf(workspace),
      plan: PLANS[paid ?? effectivePlan(workspace, now)].displayName,
      price: priceOf(workspace),
      endsOn: formatDay(workspace.trialEndsAt),
      timeLeft: timeLeftLabel(workspace.trialEndsAt ?? now, now),
      cancelling: workspace.cancelAtPeriodEnd,
      chargeFailed: firstChargeFailed(workspace),
    };
  }

  private lengthOf({ trialStartedAt, trialEndsAt }: TrialRow): number {
    if (!trialStartedAt || !trialEndsAt) {
      return this.config.get('TRIAL_DAYS', { infer: true });
    }
    return Math.round(
      (trialEndsAt.getTime() - trialStartedAt.getTime()) / DAY_MS,
    );
  }
}

function firstChargeFailed(workspace: TrialRow): boolean {
  return (
    workspace.subscriptionStatus === 'past_due' &&
    workspace.firstPaidAt === null
  );
}

function declineAlreadyMailed(workspace: TrialRow): boolean {
  return firstChargeFailed(workspace) && workspace.dunningNotifiedAt !== null;
}

function noticeDayOf(workspace: TrialRow, now: Date): TrialNoticeDay | null {
  const due = dueTrialNotice(workspace, now);
  if (due === null) return null;
  const stillTrialing = workspace.subscriptionStatus === 'trialing';
  if (due === TRIAL_ENDED_NOTICE && stillTrialing) return null;
  const cardTrialEnded = workspace.subscriptionId !== null && !stillTrialing;
  return cardTrialEnded ? TRIAL_ENDED_NOTICE : due;
}

function priceOf(workspace: TrialRow): string | null {
  if (workspace.subscriptionId === null) return null;
  const plan = paidPlanOf(workspace.plan);
  const interval = billingIntervalOf(workspace.billingInterval);
  return plan && interval ? planRenewalTerms(plan, interval) : null;
}

function formatDay(endsAt: Date | null): string {
  return endsAt ? endsAt.toISOString().slice(0, 10) : 'the end of the trial';
}
