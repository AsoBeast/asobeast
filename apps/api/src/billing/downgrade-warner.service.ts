import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PLANS } from '@asobeast/shared';
import { QuotaService } from '../auth/quota.service';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { AccountNotifier, noticeSettled } from './account-notifier.service';
import { downgradeWarning } from './account-mail';
import { overLimitAfter, planAfterChange, warningDue } from './downgrade';

const SWEEP_JUSTIFICATION =
  'a pending plan change is inspected across every workspace before warning each';

@Injectable()
export class DowngradeWarner {
  private readonly logger = new Logger(DowngradeWarner.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
    private readonly workspace: WorkspaceContext,
    private readonly quota: QuotaService,
    private readonly notifier: AccountNotifier,
    private readonly config: ConfigService<Env, true>,
  ) {}

  sweep(now = new Date()): Promise<number> {
    if (!this.config.get('BILLING_ENABLED', { infer: true })) {
      return Promise.resolve(0);
    }
    return this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      SWEEP_JUSTIFICATION,
      () => this.warnDue(now),
    );
  }

  private async warnDue(now: Date): Promise<number> {
    const shrinking = await this.prisma.workspace.findMany({
      where: {
        downgradeWarnedAt: null,
        planExpiresAt: { not: null },
        OR: [{ pendingPlan: { not: null } }, { cancelAtPeriodEnd: true }],
      },
    });

    let warned = 0;
    for (const workspace of shrinking) {
      if (!warningDue(workspace, now)) continue;

      const next = planAfterChange(workspace);
      const usage = await this.workspace.run(workspace.id, () =>
        this.quota.usage(),
      );
      const over = overLimitAfter(next, usage);
      if (over.length === 0) continue;

      const outcome = await this.notifier.notify(
        workspace.id,
        'billing.downgrade_warning',
        downgradeWarning(
          PLANS[next].displayName,
          effectiveOn(workspace.planExpiresAt),
          over,
          this.notifier.appUrl,
        ),
      );
      if (!noticeSettled(outcome)) continue;

      await this.prisma.workspace.update({
        where: { id: workspace.id },
        data: { downgradeWarnedAt: now },
      });
      if (outcome === 'delivered') warned += 1;
    }

    if (warned > 0) this.logger.log(`warned ${warned} shrinking workspaces`);
    return warned;
  }
}

function effectiveOn(planExpiresAt: Date | null): string {
  return planExpiresAt
    ? planExpiresAt.toISOString().slice(0, 10)
    : 'the end of the period';
}
