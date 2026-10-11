import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import type { Env } from '../config/env';
import { registerInBackground } from '../jobs/schedule-registration';
import { PrismaService } from '../prisma/prisma.service';
import { TrialClaims } from './trial-claims';

export const BACKFILL_PAGE_SIZE = 500;

const JUSTIFICATION =
  'mailboxes that already had a trial are found across every workspace';

@Injectable()
export class TrialClaimBackfill
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(TrialClaimBackfill.name);
  private readonly lifecycle: { closing: Promise<void> | undefined } = {
    closing: undefined,
  };
  private backfill: Promise<void> = Promise.resolve();

  constructor(
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
    private readonly claims: TrialClaims,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.get('BILLING_ENABLED', { infer: true })) return;
    this.backfill = registerInBackground(
      this.lifecycle,
      () => this.claimAndReport(),
      (error) =>
        this.logger.error(
          `could not claim the mailboxes that already had a trial, trying again: ${error.message}`,
        ),
    );
  }

  onModuleDestroy(): void {
    this.lifecycle.closing = Promise.resolve();
  }

  completed(): Promise<void> {
    return this.backfill;
  }

  run(): Promise<number> {
    return this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      JUSTIFICATION,
      () => this.claimEveryTrialOwner(),
    );
  }

  private async claimAndReport(): Promise<void> {
    const claimed = await this.run();
    if (claimed > 0) {
      this.logger.log(`claimed ${claimed} mailboxes that already had a trial`);
    }
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
