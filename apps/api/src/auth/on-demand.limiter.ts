import { Injectable } from '@nestjs/common';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { OnDemandAction } from '@asobeast/shared';
import { QuotaService } from './quota.service';
import { FailFastRedis } from '../redis/fail-fast-redis';
import { secondsUntilReset, windowKey } from './rate-limit/window';

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
    private readonly redis: FailFastRedis,
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

    const used = await this.redis.run(async (client) => {
      const hits = await client.incr(key);
      if (hits === 1) await client.expire(key, rule.windowSeconds);
      return hits;
    });
    if (used <= rule.limit) return;

    throw new OnDemandLimitError(
      action,
      rule.limit,
      secondsUntilReset(rule.windowSeconds, now),
    );
  }
}
