import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { QUEUES } from '../jobs/jobs.types';
import { OnDemandAction } from '@asobeast/shared';
import { QuotaService } from './quota.service';
import { secondsUntilReset, windowKey } from './rate-limit/window';

interface RedisCounter {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
}

export class OnDemandLimitError extends Error {
  constructor(
    readonly action: OnDemandAction,
    readonly limit: number,
    readonly retryAfterSeconds: number,
  ) {
    super(
      `Too many ${action} requests: the limit of ${limit} is reached, available again in ${retryAfterSeconds} seconds`,
    );
    this.name = 'OnDemandLimitError';
  }
}

@Injectable()
export class OnDemandLimiter {
  constructor(
    @InjectQueue(QUEUES.PIPELINE) private readonly queue: Queue,
    private readonly workspace: WorkspaceContext,
    private readonly quota: QuotaService,
  ) {}

  async consume(action: OnDemandAction, now = new Date()): Promise<void> {
    const rules = (await this.quota.limitsOf()).onDemand;
    if (!rules) return;

    const rule = rules[action];
    const workspaceId = this.workspace.require(`an on-demand ${action}`);
    const key = windowKey(
      'on-demand',
      workspaceId,
      action,
      rule.windowSeconds,
      now,
    );

    const client = (await this.queue.getBackend()
      .client) as unknown as RedisCounter;
    const used = await client.incr(key);
    if (used === 1) await client.expire(key, rule.windowSeconds);
    if (used <= rule.limit) return;

    throw new OnDemandLimitError(
      action,
      rule.limit,
      secondsUntilReset(rule.windowSeconds, now),
    );
  }
}
