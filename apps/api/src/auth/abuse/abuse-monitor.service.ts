import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import type { RateClass } from '@asobeast/shared';
import { CrossTenantAccess } from '../../common/tenancy/cross-tenant-access';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUES } from '../../jobs/jobs.types';
import { DAY_SECONDS } from '@asobeast/shared';
import { windowKey } from '../rate-limit/window';

export const ABUSE_REFUSALS_PER_DAY = 500;

const FLAG_JUSTIFICATION =
  'flagging sustained limit abuse writes to the workspace the refused caller belongs to';

interface RefusalCounter {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  exists(key: string): Promise<number>;
  set(
    key: string,
    value: string,
    mode: 'EX',
    seconds: number,
  ): Promise<unknown>;
}

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
    @InjectQueue(QUEUES.PIPELINE) private readonly queue: Queue,
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
    const client = (await this.queue.getBackend()
      .client) as unknown as RefusalCounter;
    const refusals = await client.incr(key);
    if (refusals === 1) await client.expire(key, DAY_SECONDS);

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
    if ((await client.exists(flagged)) === 1) return;

    await this.flag(refused.workspaceId, now);
    await client.set(flagged, '1', 'EX', DAY_SECONDS);
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
