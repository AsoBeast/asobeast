import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { AccountNotifier, noticeSettled } from './account-notifier.service';
import { trialNotice } from './account-mail';
import { dueTrialNotice } from './trial-notices';

const SWEEP_JUSTIFICATION =
  'trial milestones are counted across every workspace before notifying each';

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
    const trialing = await this.prisma.workspace.findMany({
      where: { trialStartedAt: { not: null }, subscriptionId: null },
      select: {
        id: true,
        trialStartedAt: true,
        trialEndsAt: true,
        trialNoticeDay: true,
      },
    });

    let sent = 0;
    for (const workspace of trialing) {
      const day = dueTrialNotice(workspace, now);
      if (day === null) continue;

      const outcome = await this.notifier.notify(
        workspace.id,
        `trial.day${day}`,
        trialNotice(
          day,
          formatDay(workspace.trialEndsAt),
          this.notifier.appUrl,
        ),
      );
      if (!noticeSettled(outcome)) continue;

      await this.prisma.workspace.update({
        where: { id: workspace.id },
        data: { trialNoticeDay: day },
      });
      if (outcome === 'delivered') sent += 1;
    }

    if (sent > 0) this.logger.log(`sent ${sent} trial notices`);
    return sent;
  }
}

function formatDay(endsAt: Date | null): string {
  return endsAt ? endsAt.toISOString().slice(0, 10) : 'the end of the trial';
}
