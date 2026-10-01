import { Injectable, Logger } from '@nestjs/common';
import type { RateClass } from '@asobeast/shared';
import { CrossTenantAccess } from '../../common/tenancy/cross-tenant-access';
import { PrismaService } from '../../prisma/prisma.service';
import { DAY_SECONDS } from '@asobeast/shared';
import { FailFastRedis } from '../../redis/fail-fast-redis';
import { windowKey } from '../rate-limit/window';

export const ABUSE_REFUSALS_PER_DAY = 500;

const FLAG_JUSTIFICATION =
  'flagging sustained limit abuse writes to the workspace the refused caller belongs to';

export interface RefusedRequest {
  workspaceId: string;
  method: string;
  route: string;
  rateClass: RateClass;
}

@Injectable()
export class AbuseMonitor {
  private readonly logger = new Logger(AbuseMonitor.name);

  constructor(
    private readonly redis: FailFastRedis,
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
  ) {}

  async recordRefusal(
    refused: RefusedRequest,
    now = new Date(),
  ): Promise<void> {
    const key = windowKey(
      'abuse',
      refused.workspaceId,
      'refusals',
      DAY_SECONDS,
      now,
    );
    const refusals = await this.redis.runOpen(async (client) => {
      const count = await client.incr(key);
      if (count === 1) await client.expire(key, DAY_SECONDS);
      return count;
    }, null);
    if (refusals === null) return;

    this.logger.warn(
      `refused ${refused.method} ${refused.route} for workspace ${refused.workspaceId}: over the ${refused.rateClass} limit, ${refusals} refusals today`,
    );
    if (refusals < ABUSE_REFUSALS_PER_DAY) return;

    const flagged = windowKey(
      'abuse',
      refused.workspaceId,
      'flagged',
      DAY_SECONDS,
      now,
    );
    if (
      (await this.redis.runOpen((client) => client.exists(flagged), 0)) === 1
    ) {
      return;
    }

    await this.flag(refused.workspaceId, now);
    await this.redis.runOpen(
      (client) => client.set(flagged, '1', 'EX', DAY_SECONDS),
      null,
    );
  }

  private async flag(workspaceId: string, now: Date): Promise<void> {
    this.logger.error(
      `workspace ${workspaceId} passed ${ABUSE_REFUSALS_PER_DAY} refused requests today and is flagged for review`,
    );
    await this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      FLAG_JUSTIFICATION,
      () =>
        this.prisma.workspace.update({
          where: { id: workspaceId },
          data: { abuseFlaggedAt: now },
        }),
    );
  }
}
