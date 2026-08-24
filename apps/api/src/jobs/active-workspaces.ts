import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isEntitled } from '../auth/entitlement';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

const ROSTER_JUSTIFICATION =
  'the daily run decides which workspaces to visit before scoping to each';

@Injectable()
export class ActiveWorkspaces {
  private readonly logger = new Logger(ActiveWorkspaces.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async forDailyRun(now = new Date()): Promise<string[]> {
    const rows = await this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      ROSTER_JUSTIFICATION,
      () => this.withApps(),
    );
    const billing = this.config.get('BILLING_ENABLED', { infer: true });
    const active = rows.filter(
      (row) => row.suspendedAt === null && (!billing || isEntitled(row, now)),
    );

    const skipped = rows.length - active.length;
    if (skipped > 0) {
      this.logger.log(
        `daily run skips ${skipped} unentitled or suspended workspaces`,
      );
    }
    return active.map((row) => row.id);
  }

  private withApps() {
    return this.prisma.workspace.findMany({
      where: { apps: { some: {} } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        plan: true,
        trialEndsAt: true,
        planExpiresAt: true,
        suspendedAt: true,
      },
    });
  }
}
