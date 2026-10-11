import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { TrialClaims } from './trial-claims';

export const BACKFILL_PAGE_SIZE = 500;

const JUSTIFICATION =
  'mailboxes that already had a trial are found across every workspace';

@Injectable()
export class TrialClaimBackfill implements OnApplicationBootstrap {
  private readonly logger = new Logger(TrialClaimBackfill.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
    private readonly claims: TrialClaims,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.get('BILLING_ENABLED', { infer: true })) return;
    try {
      const claimed = await this.run();
      if (claimed > 0) {
        this.logger.log(
          `claimed ${claimed} mailboxes that already had a trial`,
        );
      }
    } catch (error) {
      this.logger.error(
        `could not claim the mailboxes that already had a trial: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  run(): Promise<number> {
    return this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      JUSTIFICATION,
      () => this.claimEveryTrialOwner(),
    );
  }

  private async claimEveryTrialOwner(): Promise<number> {
    let claimed = 0;
    let after: string | undefined;
    for (;;) {
      const owners = await this.prisma.user.findMany({
        where: { role: 'owner', workspace: { trialStartedAt: { not: null } } },
        select: { id: true, email: true },
        orderBy: { id: 'asc' },
        take: BACKFILL_PAGE_SIZE,
        ...(after === undefined ? {} : { cursor: { id: after }, skip: 1 }),
      });
      if (owners.length === 0) return claimed;
      claimed += await this.claims.claimAll(
        this.prisma,
        owners.map(({ email }) => email),
      );
      after = owners[owners.length - 1].id;
    }
  }
}
